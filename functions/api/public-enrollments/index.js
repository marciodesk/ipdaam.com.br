const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
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

function getDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB nao configurado.");
  }

  return env.DB;
}

const registrationWindow = {
  start: "2026-06-01",
  end: "2026-06-30",
};

function getManausDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}

function assertRegistrationOpen() {
  const today = getManausDate();
  if (today < registrationWindow.start) {
    throw new Error("As inscricoes iniciam em 01/06/2026.");
  }
  if (today > registrationWindow.end) {
    throw new Error("Inscricoes encerradas em 30/06/2026.");
  }
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

  const availableCourses = ["ALFA", "CFO", "INC"];
  if (!availableCourses.includes(enrollment.grade)) {
    throw new Error("Este curso esta sem previsao de inicio das aulas e nao esta disponivel para pre-inscricao.");
  }

  return enrollment;
}

export async function onRequestGet() {
  return json({ ok: false, error: "Metodo nao permitido." }, { status: 405 });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: jsonHeaders,
  });
}

export async function onRequestPost({ request, env }) {
  try {
    assertRegistrationOpen();
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
