import { authenticatePassword, clearSessionCookie, createSessionCookie, getAccess } from "../_auth.js";

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
  return json({ ok: true, role: access.role });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const access = authenticatePassword(String(body.password || ""), env);
    if (!access) return unauthorized();

    return json({ ok: true, role: access.role }, {
      headers: {
        "set-cookie": await createSessionCookie(access.role, env),
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
