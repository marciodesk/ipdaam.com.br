const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
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

function getDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB nao configurado.");
  }

  return env.DB;
}

export async function onRequestDelete({ env, params }) {
  const db = getDatabase(env);
  await db.prepare("DELETE FROM enrollments WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
