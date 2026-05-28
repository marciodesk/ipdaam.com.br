import { requireAdmin } from "../_auth.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "DELETE, OPTIONS",
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

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!await requireAdmin(request, env)) {
      return unauthorized();
    }

    const db = getDatabase(env);
    await db.prepare("DELETE FROM enrollments WHERE id = ?").bind(params.id).run();
    return json({ ok: true });
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
