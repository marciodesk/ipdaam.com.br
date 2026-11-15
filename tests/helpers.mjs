import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve, extname } from "node:path";
import * as publicApi from "../functions/api/public-enrollments/index.js";
import * as adminApi from "../functions/api/enrollments/index.js";
import * as sessionApi from "../functions/api/session/index.js";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const documentKeys = ["rg", "cpf", "civilStatusCertificate", "criminalRecordCertificate", "recommendationLetter", "proofOfResidence"];
export const envPasswords = { ADMIN_PASSWORD: "test-only-admin", USER_PASSWORD: "test-only-user", SESSION_SECRET: "test-only-secret" };

const RealDate = Date;
let currentTime;
export function setTestNow(value) {
  currentTime = new RealDate(value).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [currentTime])); }
    static now() { return currentTime; }
  };
}
export function restoreClock() { globalThis.Date = RealDate; }

export async function createDb() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(await readFile(new URL("../migrations/0001_create_enrollments.sql", import.meta.url), "utf8"));
  return {
    sqlite,
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async all() { return { results: statement.all(...values) }; },
        async first() { return statement.get(...values) || null; },
        async run() { const result = statement.run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
    },
  };
}

export function candidate(overrides = {}) {
  return {
    fullName: "Candidata de Teste", cpf: "123.456.789-01", grade: "CFO",
    baptismRequirement: "03 anos de batismo", declarationAccepted: true, lgpdAccepted: true,
    documentsAcknowledged: true, documentsChecklist: { rg: true, cpf: true },
    submissionKey: crypto.randomUUID(), whatsappDdd: "92", whatsappPhone: "99999-9999",
    ...overrides,
  };
}

export function postPublic(db, data) {
  return publicApi.onRequestPost({
    request: new Request("https://local.test/api/public-enrollments", { method: "POST", body: JSON.stringify(data) }),
    env: { DB: db },
  });
}

export function savedRows(db) {
  return db.sqlite.prepare("SELECT * FROM enrollments ORDER BY id").all();
}

// Loopback only: real Functions handlers, synthetic records, in-memory SQLite.
export async function startTestServer(db) {
  const env = { DB: db, ...envPasswords };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      const route = {
        "/api/public-enrollments": publicApi,
        "/api/enrollments": adminApi,
        "/api/session": sessionApi,
      }[url.pathname];
      if (route) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks);
        const request = new Request(url, {
          method: req.method, headers: req.headers,
          ...(body.length ? { body, duplex: "half" } : {}),
        });
        const handler = route[`onRequest${req.method[0]}${req.method.slice(1).toLowerCase()}`];
        const response = handler ? await handler({ request, env }) : new Response(null, { status: 405 });
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      if (url.pathname === "/api/gradebook") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ records: [], role: "admin" }));
        return;
      }
      const path = resolve(root, `.${url.pathname === "/" ? "/inscricao.html" : url.pathname}`);
      if (!path.startsWith(root)) throw new Error("Invalid path");
      const content = await readFile(path);
      res.writeHead(200, { "content-type": ({ ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" })[extname(path)] || "application/octet-stream" });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}
