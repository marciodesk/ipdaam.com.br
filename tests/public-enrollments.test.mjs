import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createDb, candidate, documentKeys, postPublic, savedRows, setTestNow, restoreClock, envPasswords } from "./helpers.mjs";
import { createSessionCookie } from "../functions/api/_auth.js";
import { onRequestPost as adminPost, onRequestGet as adminGet } from "../functions/api/enrollments/index.js";
import { onRequestGet, onRequestOptions } from "../functions/api/public-enrollments/index.js";

after(restoreClock);

for (const [instant, status] of [
  ["2026-11-16T03:59:59.999Z", 400],
  ["2026-11-16T04:00:00.000Z", 201],
  ["2026-12-08T03:59:59.999Z", 201],
  ["2026-12-08T04:00:00.000Z", 400],
  ["2026-12-10T12:00:00.000Z", 400],
]) {
  test(`API: limite America/Manaus ${instant} => ${status}`, async () => {
    setTestNow(instant);
    const db = await createDb();
    const response = await postPublic(db, candidate());
    assert.equal(response.status, status);
    assert.equal(savedRows(db).length, status === 201 ? 1 : 0);
    db.sqlite.close();
  });
}

test("checklist independente: cada documento pode ser o único marcado", async () => {
  setTestNow("2026-11-20T12:00:00Z");
  for (const key of documentKeys) {
    const db = await createDb();
    const response = await postPublic(db, candidate({ documentsChecklist: { [key]: true, unknown: true } }));
    assert.equal(response.status, 201);
    const body = await response.json();
    const saved = JSON.parse(savedRows(db)[0].payload);
    assert.equal(body.protocol, saved.id);
    assert.deepEqual(saved.documentsChecklist, Object.fromEntries(documentKeys.map((item) => [item, item === key])));
    assert.deepEqual(body.documentsChecklist, saved.documentsChecklist);
    db.sqlite.close();
  }
});

test("requisição que atravessa o horário de encerramento não grava cadastro", async () => {
  setTestNow("2026-12-08T03:59:59.999Z");
  const db = await createDb();
  const originalPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const statement = originalPrepare(sql);
    if (sql.startsWith("SELECT id, payload")) {
      const all = statement.all.bind(statement);
      statement.all = async () => {
        const result = await all();
        setTestNow("2026-12-08T04:00:00.000Z");
        return result;
      };
    }
    return statement;
  };
  assert.equal((await postPublic(db, candidate())).status, 400);
  assert.equal(savedRows(db).length, 0);
  db.sqlite.close();
});

for (const checklist of [undefined, {}, Object.fromEntries(documentKeys.map((key) => [key, true])), { rg: "true", cpf: 1 }]) {
  test(`documentos pendentes não bloqueiam: ${JSON.stringify(checklist)}`, async () => {
    setTestNow("2026-11-20T12:00:00Z");
    const db = await createDb();
    assert.equal((await postPublic(db, candidate({ documentsChecklist: checklist }))).status, 201);
    const saved = JSON.parse(savedRows(db)[0].payload);
    assert.equal(saved.status, "Em espera");
    assert.equal(saved.documentsAcknowledgedDate, "2026-11-20");
    assert.equal(Object.values(saved.documentsChecklist).filter(Boolean).length, checklist && Object.keys(checklist).length === 6 ? 6 : 0);
    db.sqlite.close();
  });
}

for (const value of [undefined, false, "true", "false", 1]) {
  test(`ciência obrigatória no backend: rejeita ${JSON.stringify(value)}`, async () => {
    setTestNow("2026-11-20T12:00:00Z");
    const db = await createDb();
    assert.equal((await postPublic(db, candidate({ documentsAcknowledged: value }))).status, 400);
    assert.equal(savedRows(db).length, 0);
    db.sqlite.close();
  });
}

test("data/período/status/protocolo enviados pelo cliente não alteram os dados oficiais do CFO", async () => {
  setTestNow("2026-11-20T03:00:00Z");
  const db = await createDb();
  const response = await postPublic(db, candidate({ id: "forged", protocol: "forged", status: "Ativa", enrollmentDate: "01/01/2000", enrollmentPeriod: "outro", createdAt: "2000-01-01" }));
  assert.equal(response.status, 201);
  const body = await response.json();
  const saved = JSON.parse(savedRows(db)[0].payload);
  assert.notEqual(body.protocol, "forged");
  assert.equal(body.protocol, saved.id);
  assert.equal(saved.protocol, undefined);
  assert.equal(saved.protocolo, undefined);
  assert.equal(saved.enrollmentDate, "19/11/2026");
  assert.equal(saved.enrollmentPeriod, "2026 - 2º semestre");
  assert.equal(saved.status, "Em espera");
  assert.equal(saved.createdAt, "2026-11-20T03:00:00.000Z");
  db.sqlite.close();
});

test("reenvio após resposta perdida recupera o mesmo protocolo e checklist persistido", async () => {
  setTestNow("2026-11-20T12:00:00Z");
  const db = await createDb();
  const data = candidate();
  const first = await (await postPublic(db, data)).json();
  const before = savedRows(db);
  const retry = await postPublic(db, { ...data, documentsChecklist: {} });
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), first);
  assert.deepEqual(savedRows(db), before);
  assert.equal((await postPublic(db, candidate({ enrollmentPeriod: "forjado" }))).status, 400);
  assert.equal(savedRows(db).length, 1);
  db.sqlite.close();
});

for (const sameKey of [true, false]) {
  test(`concorrência: duas leituras antes do INSERT, mesma chave = ${sameKey}`, async () => {
    setTestNow("2026-11-20T12:00:00Z");
    const db = await createDb();
    const originalPrepare = db.prepare.bind(db);
    let waiting = [];
    let reads = 0;
    db.prepare = (sql) => {
      const statement = originalPrepare(sql);
      if (sql.startsWith("SELECT id, payload")) {
        const all = statement.all.bind(statement);
        statement.all = async () => {
          const result = await all();
          if (++reads <= 2) await new Promise((resolve) => {
            waiting.push(resolve);
            if (waiting.length === 2) waiting.forEach((release) => release());
          });
          return result;
        };
      }
      return statement;
    };
    const data = candidate();
    const responses = await Promise.all([postPublic(db, data), postPublic(db, { ...data, cpf: "12345678901", submissionKey: sameKey ? data.submissionKey : crypto.randomUUID() })]);
    assert.deepEqual(responses.map((response) => response.status).sort(), sameKey ? [200, 201] : [201, 400]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    if (sameKey) assert.equal(bodies[0].protocol, bodies[1].protocol);
    assert.equal(savedRows(db).length, 1);
    db.sqlite.close();
  });
}

test("histórico preservado e CPF legado no mesmo semestre continua bloqueado", async () => {
  setTestNow("2026-11-20T12:00:00Z");
  const db = await createDb();
  const old = candidate({ id: "legacy", enrollmentDate: "01/09/2026", enrollmentPeriod: undefined, submissionKey: undefined });
  db.sqlite.prepare("INSERT INTO enrollments(id, cpf, payload) VALUES (?, ?, ?)").run(old.id, old.cpf, JSON.stringify(old));
  const before = savedRows(db);
  assert.equal((await postPublic(db, candidate())).status, 400);
  assert.deepEqual(savedRows(db), before);
  db.sqlite.prepare("UPDATE enrollments SET payload=? WHERE id='legacy'").run(JSON.stringify({ ...old, enrollmentDate: "01/01/2026" }));
  const previous = savedRows(db)[0];
  assert.equal((await postPublic(db, candidate())).status, 201);
  assert.deepEqual(savedRows(db).find((row) => row.id === "legacy"), previous);
  db.sqlite.close();
});

test("ALFA/INC preservam a reabertura de produção em 28/09, sem exigir checklist CFO", async () => {
  for (const grade of ["ALFA", "INC"]) {
    const db = await createDb();
    setTestNow("2026-09-28T03:59:59.999Z");
    assert.equal((await postPublic(db, candidate({ grade, documentsAcknowledged: undefined }))).status, 400);
    setTestNow("2026-09-28T04:00:00Z");
    assert.equal((await postPublic(db, candidate({ grade, documentsAcknowledged: undefined }))).status, 201);
    setTestNow("2026-11-20T12:00:00Z");
    assert.equal((await postPublic(db, candidate({ grade, cpf: "98765432100", documentsAcknowledged: undefined }))).status, 201);
    setTestNow("2026-12-08T04:00:00Z");
    assert.equal((await postPublic(db, candidate({ grade, cpf: "98765432101", documentsAcknowledged: undefined }))).status, 201);
    db.sqlite.close();
  }
});

test("elegibilidade do CFO continua exigindo 03 anos de batismo", async () => {
  setTestNow("2026-11-20T12:00:00Z");
  const db = await createDb();
  assert.equal((await postPublic(db, candidate({ baptismRequirement: "Nao tenho 03 anos de batismo" }))).status, 400);
  assert.equal(savedRows(db).length, 0);
  db.sqlite.close();
});

test("secretaria mantém autorização e pode efetivar após o encerramento público", async () => {
  setTestNow("2026-11-20T12:00:00Z");
  const db = await createDb();
  await postPublic(db, candidate());
  const record = JSON.parse(savedRows(db)[0].payload);
  setTestNow("2026-12-11T12:00:00Z");
  const env = { DB: db, ...envPasswords };
  const request = (cookie = "", method = "POST") => new Request("https://local.test/api/enrollments", {
    method, headers: { cookie }, ...(method === "POST" ? { body: JSON.stringify({ ...record, status: "Ativa", candidatePhotoKey: "test-photo" }) } : {}),
  });
  assert.equal((await adminPost({ request: request(), env })).status, 401);
  const userCookie = await createSessionCookie({ role: "usuario" }, env);
  assert.equal((await adminPost({ request: request(userCookie), env })).status, 401);
  const adminCookie = await createSessionCookie({ role: "admin" }, env);
  assert.equal((await adminPost({ request: request(adminCookie), env })).status, 201);
  const saved = JSON.parse(savedRows(db)[0].payload);
  assert.equal(saved.id, record.id);
  assert.equal(saved.status, "Ativa");
  assert.deepEqual(saved.documentsChecklist, record.documentsChecklist);
  assert.equal((await adminGet({ request: request("", "GET"), env })).status, 401);
  db.sqlite.close();
});

test("GET não expõe inscrições; preflight permanece compatível", async () => {
  assert.equal((await onRequestGet()).status, 405);
  const response = await onRequestOptions();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
});
