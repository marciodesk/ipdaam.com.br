import { getAccess, hashPassword } from "../_auth.js";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data, init = {}) => new Response(JSON.stringify(data), { ...init, headers: { ...headers, ...(init.headers || {}) } });
const allowedCourses = ["ALFA", "CFO", "INC"];
const cfoModules = ["Teologia Basica", "Etica Crista", "Pratica Ministerial"];

function normalizeScopes(value, fallbackCourse, fallbackModule) {
  const source = Array.isArray(value) ? value : [{ course: fallbackCourse, module: fallbackModule }];
  const unique = new Map();
  source.forEach((scope) => {
    const course = String(scope.course || "").toUpperCase();
    const module = course === "CFO" ? String(scope.module || "") : "";
    if (!allowedCourses.includes(course) || (course === "CFO" && !cfoModules.includes(module))) return;
    unique.set(`${course}:${module}`, { course, module });
  });
  return [...unique.values()];
}

function dbFrom(env) {
  if (!env.DB) throw new Error("D1 binding DB nao configurado.");
  return env.DB;
}

async function ensureTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS attendance_users (
    id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'professor', course TEXT NOT NULL,
    module TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
}

async function requireAdmin(request, env) {
  const access = await getAccess(request, env);
  return access?.role === "admin" ? access : null;
}

export async function onRequestGet({ request, env }) {
  try {
    if (!await requireAdmin(request, env)) return json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const db = dbFrom(env);
    await ensureTable(db);
    const result = await db.prepare("SELECT id, login, name, role, course, module, scopes, active, created_at AS createdAt, updated_at AS updatedAt FROM attendance_users ORDER BY active, name").all();
    const users = result.results.map((user) => {
      try { user.scopes = JSON.parse(user.scopes || "[]"); } catch { user.scopes = []; }
      if (!user.scopes.length && user.course) user.scopes = [{ course: user.course, module: user.module || "" }];
      return user;
    });
    return json({ users });
  } catch (error) {
    return json({ error: error.message }, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!await requireAdmin(request, env)) return json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const db = dbFrom(env);
    await ensureTable(db);
    const body = await request.json();
    const login = String(body.login || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    const course = String(body.course || body.scopes?.[0]?.course || "").toUpperCase();
    const module = course === "CFO" ? String(body.module || body.scopes?.[0]?.module || "") : "";
    const scopes = normalizeScopes(body.scopes, course, module);
    if (!login || !name || password.length < 6) return json({ error: "Informe nome, login e uma senha com pelo menos 6 caracteres." }, { status: 400 });
    if (!scopes.length) return json({ error: "Selecione pelo menos um curso ou modulo." }, { status: 400 });
    const first = scopes[0];
    const id = body.id || crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    await db.prepare(`INSERT INTO attendance_users (id, login, name, password_hash, role, course, module, scopes, active)
      VALUES (?, ?, ?, ?, 'professor', ?, ?, ?, 1)
      ON CONFLICT(login) DO UPDATE SET name=excluded.name, password_hash=excluded.password_hash,
      course=excluded.course, module=excluded.module, scopes=excluded.scopes, active=1, updated_at=datetime('now')`)
      .bind(id, login, name, passwordHash, first.course, first.module, JSON.stringify(scopes)).run();
    return json({ ok: true });
  } catch (error) {
    const message = String(error.message || error);
    return json({ error: message.includes("UNIQUE") ? "Este login ja esta cadastrado." : message }, { status: 400 });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    if (!await requireAdmin(request, env)) return json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "Usuario nao informado." }, { status: 400 });
    await dbFrom(env).prepare("UPDATE attendance_users SET active=1, updated_at=datetime('now') WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    if (!await requireAdmin(request, env)) return json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const db = dbFrom(env);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "Usuario nao informado." }, { status: 400 });
    await db.prepare("DELETE FROM attendance_users WHERE id=?").bind(id).run();
    return json({ ok: true });
  } catch (error) {
    return json({ error: error.message }, { status: 400 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
