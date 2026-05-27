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

function errorJson(error, status = 500) {
  return json({
    ok: false,
    error: error && error.message ? error.message : String(error),
  }, { status });
}

function unauthorized() {
  return json({ ok: false, error: "Acesso nao autorizado." }, { status: 401 });
}

function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) {
    throw new Error("Variavel ADMIN_PASSWORD nao configurada.");
  }

  const password = request.headers.get("x-admin-password") || "";
  if (password !== env.ADMIN_PASSWORD) {
    return false;
  }

  return true;
}

function getDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB nao configurado. Verifique se o binding chama exatamente DB em Producao.");
  }

  return env.DB;
}

function normalizePayload(payload) {
  const now = new Date().toISOString();
  return {
    ...payload,
    id: payload.id || crypto.randomUUID(),
    updatedAt: now,
    createdAt: payload.createdAt || now,
  };
}

export async function onRequestGet({ request, env }) {
  try {
    if (!requireAdmin(request, env)) {
      return unauthorized();
    }

    const db = getDatabase(env);
    const result = await db.prepare(
      "SELECT payload FROM enrollments ORDER BY updated_at DESC"
    ).all();

    const enrollments = result.results.map((row) => JSON.parse(row.payload));
    return json({ enrollments });
  } catch (error) {
    return errorJson(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!requireAdmin(request, env)) {
      return unauthorized();
    }

    const db = getDatabase(env);
    const body = await request.json();
    const enrollment = normalizePayload(body);
    const payload = JSON.stringify(enrollment);

    await db.prepare(
      `INSERT INTO enrollments (
        id, full_name, cpf, course, email, status, enrollment_date, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        full_name = excluded.full_name,
        cpf = excluded.cpf,
        course = excluded.course,
        email = excluded.email,
        status = excluded.status,
        enrollment_date = excluded.enrollment_date,
        payload = excluded.payload,
        updated_at = datetime('now')`
    )
      .bind(
        enrollment.id,
        enrollment.fullName || enrollment.studentName || "",
        enrollment.cpf || "",
        enrollment.grade || "",
        enrollment.email || "",
        enrollment.status || "",
        enrollment.enrollmentDate || "",
        payload
      )
      .run();

    return json({ enrollment }, { status: 201 });
  } catch (error) {
    return errorJson(error);
  }
}
