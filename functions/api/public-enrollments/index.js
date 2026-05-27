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

function getDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB nao configurado.");
  }

  return env.DB;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePayload(payload) {
  const now = new Date().toISOString();
  const enrollment = {
    ...payload,
    id: crypto.randomUUID(),
    fullName: cleanText(payload.fullName, 160),
    cpf: cleanText(payload.cpf, 20),
    grade: cleanText(payload.grade, 40),
    email: cleanText(payload.email, 160),
    status: "Em espera",
    source: "public_form",
    createdAt: now,
    updatedAt: now,
  };

  if (!enrollment.fullName || !enrollment.cpf || !enrollment.grade || !enrollment.declarationAccepted) {
    throw new Error("Preencha nome, CPF, curso e aceite a declaracao.");
  }

  return enrollment;
}

export async function onRequestGet() {
  return json({ ok: false, error: "Metodo nao permitido." }, { status: 405 });
}

export async function onRequestPost({ request, env }) {
  try {
    const db = getDatabase(env);
    const body = await request.json();
    const enrollment = normalizePayload(body);
    const payload = JSON.stringify(enrollment);

    await db.prepare(
      `INSERT INTO enrollments (
        id, full_name, cpf, course, email, status, enrollment_date, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(
        enrollment.id,
        enrollment.fullName,
        enrollment.cpf,
        enrollment.grade,
        enrollment.email,
        enrollment.status,
        enrollment.enrollmentDate || "",
        payload
      )
      .run();

    return json({ ok: true, id: enrollment.id }, { status: 201 });
  } catch (error) {
    return errorJson(error, 400);
  }
}
