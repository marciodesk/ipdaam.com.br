import { getAccess, requireAdmin } from "../_auth.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
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
    throw new Error("D1 binding DB nao configurado. Verifique se o binding chama exatamente DB em Producao.");
  }

  return env.DB;
}

function cleanCpf(value) {
  return String(value || "").replace(/\D/g, "");
}

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function cpfSqlExpression() {
  return "REPLACE(REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', ''), '/', '')";
}

function getEnrollmentPeriodFromDate(value) {
  const text = String(value || "").trim();
  let year = "";
  let month = "";

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    [year, month] = text.split("-");
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    const parts = text.split("/");
    year = parts[2];
    month = parts[1];
  }

  if (!year || !month) {
    const now = new Date();
    year = String(now.getUTCFullYear());
    month = String(now.getUTCMonth() + 1).padStart(2, "0");
  }

  return `${year} - ${Number(month) >= 6 ? "2º semestre" : "1º semestre"}`;
}

function getEnrollmentPeriod(payload) {
  return cleanText(payload.enrollmentPeriod, 60) ||
    getEnrollmentPeriodFromDate(payload.enrollmentDate || payload.createdAt);
}

function normalizePayload(payload) {
  const now = new Date().toISOString();
  const normalized = {
    ...payload,
    id: payload.id || crypto.randomUUID(),
    updatedAt: now,
    createdAt: payload.createdAt || now,
  };
  normalized.enrollmentPeriod = getEnrollmentPeriod(normalized);
  delete normalized.candidatePhoto;
  return normalized;
}

async function assertCpfAvailable(db, enrollment, currentId) {
  const normalizedCpf = cleanCpf(enrollment.cpf);
  if (!normalizedCpf) {
    return;
  }

  const result = await db.prepare(
    `SELECT id, payload FROM enrollments WHERE ${cpfSqlExpression()} = ? AND id <> ?`
  )
    .bind(normalizedCpf, currentId || "")
    .all();

  const period = getEnrollmentPeriod(enrollment);
  const existing = (result.results || []).find((row) => {
    try {
      return getEnrollmentPeriod(JSON.parse(row.payload || "{}")) === period;
    } catch (error) {
      return true;
    }
  });

  if (existing) {
    throw new Error("Ja existe uma matricula cadastrada para este CPF neste periodo.");
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const access = await getAccess(request, env);
    if (!access) {
      return unauthorized();
    }

    const db = getDatabase(env);
    const result = await db.prepare(
      "SELECT payload FROM enrollments ORDER BY updated_at DESC"
    ).all();

    const allowedCourses = new Set((access.scopes || [{ course: access.course }]).map((scope) => String(scope.course || "").toUpperCase()));
    const enrollments = result.results
      .map((row) => JSON.parse(row.payload))
      .filter((item) => access.role === "admin" || allowedCourses.has(String(item.grade || "").toUpperCase()));
    return json({ enrollments, ...access });
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

export async function onRequestPost({ request, env }) {
  try {
    if (!await requireAdmin(request, env)) {
      return unauthorized();
    }

    const db = getDatabase(env);
    const body = await request.json();
    const enrollment = normalizePayload(body);
    await assertCpfAvailable(db, enrollment, enrollment.id);
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
