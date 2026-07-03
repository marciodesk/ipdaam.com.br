import { authenticatePassword, clearSessionCookie, createSessionCookie, getAccess, verifyPassword } from "../_auth.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
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

function unauthorized() {
  return json({ ok: false, error: "Acesso nao autorizado." }, { status: 401 });
}

export async function onRequestGet({ request, env }) {
  const access = await getAccess(request, env);
  if (!access) return unauthorized();
  return json({ ok: true, ...access });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const password = String(body.password || "");
    const login = String(body.login || "").trim().toLowerCase();
    let access = !login || login === "admin" ? authenticatePassword(password, env) : null;
    if (!access && login && env.DB) {
      const user = await env.DB.prepare("SELECT id, login, name, password_hash, role, course, module FROM attendance_users WHERE login=? COLLATE NOCASE AND active=1").bind(login).first();
      if (user && await verifyPassword(password, user.password_hash)) {
        access = { role: user.role, userId: user.id, login: user.login, name: user.name, course: user.course, module: user.module || "" };
      }
    }
    if (!access) return unauthorized();

    return json({ ok: true, ...access }, {
      headers: {
        "set-cookie": await createSessionCookie(access, env),
      },
    });
  } catch (error) {
    return json({ ok: false, error: error.message || "Nao foi possivel entrar." }, { status: 400 });
  }
}

export async function onRequestDelete() {
  return json({ ok: true }, {
    headers: {
      "set-cookie": clearSessionCookie(),
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: jsonHeaders,
  });
}
