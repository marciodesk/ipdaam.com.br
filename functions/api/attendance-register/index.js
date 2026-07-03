import { hashPassword } from "../_auth.js";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (data, init = {}) => new Response(JSON.stringify(data), { ...init, headers: { ...headers, ...(init.headers || {}) } });
const allowedCourses = ["ALFA", "CFO", "INC"];
const allowedModules = ["Teologia Basica", "Etica Crista", "Pratica Ministerial"];

function normalizeScopes(value) {
  const scopes = Array.isArray(value) ? value : [];
  const unique = new Map();
  scopes.forEach((scope) => {
    const course = String(scope.course || "").toUpperCase();
    const module = course === "CFO" ? String(scope.module || "") : "";
    if (!allowedCourses.includes(course)) return;
    if (course === "CFO" && !allowedModules.includes(module)) return;
    unique.set(`${course}:${module}`, { course, module });
  });
  return [...unique.values()];
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) throw new Error("D1 binding DB nao configurado.");
    const body = await request.json();
    const name = String(body.name || "").trim();
    const login = String(body.login || "").trim().toLowerCase();
    const password = String(body.password || "");
    const scopes = normalizeScopes(body.scopes);
    if (!name || !login || password.length < 6) return json({ error: "Informe nome, login e senha com pelo menos 6 caracteres." }, { status: 400 });
    if (!scopes.length) return json({ error: "Selecione pelo menos um curso ou modulo." }, { status: 400 });
    const first = scopes[0];
    await env.DB.prepare(`INSERT INTO attendance_users
      (id, login, name, password_hash, role, course, module, scopes, active)
      VALUES (?, ?, ?, ?, 'professor', ?, ?, ?, 0)`)
      .bind(crypto.randomUUID(), login, name, await hashPassword(password), first.course, first.module, JSON.stringify(scopes)).run();
    return json({ ok: true, message: "Cadastro enviado. Aguarde a aprovacao do administrador." }, { status: 201 });
  } catch (error) {
    const message = String(error.message || error);
    return json({ error: message.includes("UNIQUE") ? "Este login ja esta cadastrado." : message }, { status: 400 });
  }
}

export async function onRequestOptions() { return new Response(null, { status: 204, headers }); }

