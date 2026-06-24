import { getAccess, requireAdmin } from "../_auth.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(init.headers || {}),
    },
  });
}

function errorJson(error, status = 500) {
  return json({
    ok: false,
    error: error && error.message ? error.message : String(error),
  }, { status });
}

function unauthorized() {
  return json({ ok: false, error: "Acesso nao autorizado." }, { status: 401 });
}

function getDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB nao configurado.");
  }

  return env.DB;
}

async function ensureGradebookTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS gradebook (
      id TEXT PRIMARY KEY,
      enrollment_id TEXT NOT NULL,
      full_name TEXT,
      course TEXT,
      period TEXT,
      average REAL NOT NULL DEFAULT 0,
      status TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(enrollment_id, period)
    )`
  ).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_gradebook_enrollment ON gradebook(enrollment_id)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_gradebook_period ON gradebook(period)").run();
}

function normalizeRecord(body) {
  const now = new Date().toISOString();
  const modules = Array.isArray(body.modules) ? body.modules : [];
  const average = Number(body.average || 0);

  return {
    id: body.id || crypto.randomUUID(),
    enrollmentId: body.enrollmentId || "",
    fullName: body.fullName || "",
    cpf: body.cpf || "",
    course: body.course || "",
    period: body.period || "",
    modules: modules.map((item) => ({
      name: item.name || "",
      grade: Number(item.grade || item.total || 0),
      work: 0,
      total: Number(item.grade || item.total || 0),
    })),
    total: Number(body.total || 0),
    average,
    status: body.status || "",
    notes: body.notes || "",
    createdAt: body.createdAt || now,
    updatedAt: now,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await getAccess(request, env);
    if (!access) {
      return unauthorized();
    }

    const db = getDatabase(env);
    await ensureGradebookTable(db);
    const result = await db.prepare(
      "SELECT payload FROM gradebook ORDER BY updated_at DESC"
    ).all();
    const records = result.results.map((row) => JSON.parse(row.payload));
    return json({ records, role: access.role });
  } catch (error) {
    return errorJson(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!await requireAdmin(request, env)) {
      return unauthorized();
    }

    const db = getDatabase(env);
    await ensureGradebookTable(db);
    const body = await request.json();
    const record = normalizeRecord(body);

    if (!record.enrollmentId) {
      return json({ ok: false, error: "Selecione um aluno para salvar o boletim." }, { status: 400 });
    }

    const payload = JSON.stringify(record);
    await db.prepare(
      `INSERT INTO gradebook (
        id, enrollment_id, full_name, course, period, average, status, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(enrollment_id, period) DO UPDATE SET
        full_name = excluded.full_name,
        course = excluded.course,
        average = excluded.average,
        status = excluded.status,
        payload = excluded.payload,
        updated_at = datetime('now')`
    )
      .bind(
        record.id,
        record.enrollmentId,
        record.fullName,
        record.course,
        record.period,
        record.average,
        record.status,
        payload
      )
      .run();

    return json({ ok: true, record }, { status: 201 });
  } catch (error) {
    return errorJson(error);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: jsonHeaders,
  });
}
