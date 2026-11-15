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
  start: "2026-09-01",
  end: "2026-09-04",
};
const cfoRegistrationWindow = {
  start: "2026-11-16",
  end: "2026-12-07",
};
const documentKeys = ["rg", "cpf", "civilStatusCertificate", "criminalRecordCertificate", "recommendationLetter", "proofOfResidence"];
const baptismRequirementForCfo = "03 anos de batismo";
const noCfoBaptismRequirement = "Nao tenho 03 anos de batismo";

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

function assertRegistrationOpen(course) {
  const today = getManausDate();
  const window = course === "CFO" ? cfoRegistrationWindow : registrationWindow;
  if (today < window.start) {
    throw new Error(course === "CFO" ? "As pré-inscrições do CFO iniciam em 16/11/2026." : "As inscricoes iniciam em 01/09/2026.");
  }
  if (today > window.end) {
    throw new Error(course === "CFO" ? "Pré-inscrições do CFO encerradas em 07/12/2026, às 23h59 (horário de Manaus)." : "Inscricoes encerradas em 04/09/2026.");
  }
}

function cleanText(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanCpf(value) {
  return String(value || "").replace(/\D/g, "");
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
    [year, month] = getManausDate().split("-");
  }

  return `${year} - ${Number(month) >= 6 ? "2º semestre" : "1º semestre"}`;
}

function getEnrollmentPeriod(payload) {
  return cleanText(payload.enrollmentPeriod, 60) ||
    getEnrollmentPeriodFromDate(payload.enrollmentDate || payload.createdAt);
}

function getConfiguredEnrollmentPeriod(payload) {
  return cleanText(payload.enrollmentPeriod, 60) ||
    registrationWindow.period ||
    getEnrollmentPeriod(payload);
}

function normalizePayload(payload) {
  const now = new Date().toISOString();
  const enrollment = {
    ...payload,
    id: crypto.randomUUID(),
    fullName: cleanText(payload.fullName, 160),
    cpf: cleanText(payload.cpf, 20),
    grade: cleanText(payload.grade, 40),
    baptismRequirement: cleanText(payload.baptismRequirement, 60),
    email: cleanText(payload.email, 160),
    status: "Em espera",
    source: "public_form",
    createdAt: now,
    updatedAt: now,
  };
  // The existing persisted id is the protocol; ignore client-supplied aliases.
  delete enrollment.protocol;
  delete enrollment.protocolo;
  enrollment.enrollmentPeriod = getConfiguredEnrollmentPeriod(enrollment);
  // The public CFO period is authoritative, regardless of dates supplied by the client.
  if (enrollment.grade === "CFO") {
    enrollment.enrollmentDate = getManausDate().split("-").reverse().join("/");
    enrollment.enrollmentPeriod = getEnrollmentPeriodFromDate(getManausDate());
    if (payload.documentsAcknowledged !== true) {
      throw new Error("Confirme que apresentará a documentação exigida à secretaria da ETDA no período informado.");
    }
    enrollment.documentsChecklist = Object.fromEntries(documentKeys.map((key) => [key, payload.documentsChecklist?.[key] === true]));
    enrollment.documentsAcknowledged = true;
    enrollment.documentsAcknowledgedDate = getManausDate();
  }

  if (payload.submissionKey !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.submissionKey)) {
    throw new Error("Identificador de envio invalido. Recarregue a ficha e tente novamente.");
  }

  if (!enrollment.fullName || !enrollment.cpf || !enrollment.grade || !enrollment.declarationAccepted || !enrollment.lgpdAccepted) {
    throw new Error("Preencha nome, CPF, curso e aceite a declaracao e o termo LGPD.");
  }

  const availableCourses = ["ALFA", "CFO", "INC"];
  if (!availableCourses.includes(enrollment.grade)) {
    throw new Error("Este curso esta sem previsao de inicio das aulas e nao esta disponivel para pre-inscricao.");
  }

  if (enrollment.grade === "CFO" && enrollment.baptismRequirement !== baptismRequirementForCfo) {
    throw new Error("Para continuar em CFO, selecione a opcao 03 anos de batismo.");
  }

  if (enrollment.baptismRequirement === noCfoBaptismRequirement && enrollment.grade !== "INC") {
    throw new Error("Para candidatos sem 03 anos de batismo, a opcao disponivel e somente INC.");
  }

  return enrollment;
}

async function findExistingEnrollment(db, enrollment) {
  const normalizedCpf = cleanCpf(enrollment.cpf);
  if (!normalizedCpf) {
    throw new Error("CPF invalido.");
  }

  const result = await db.prepare(
    `SELECT id, payload FROM enrollments WHERE ${cpfSqlExpression()} = ?`
  )
    .bind(normalizedCpf)
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
    const saved = JSON.parse(existing.payload || "{}");
    if (enrollment.submissionKey && saved.submissionKey === enrollment.submissionKey && saved.grade === enrollment.grade && saved.source === "public_form") {
      return { ...saved, id: existing.id };
    }
    throw new Error("Ja existe uma pre-inscricao cadastrada para este CPF neste periodo.");
  }
  return null;
}

function confirmation(enrollment, status = 200) {
  return json({
    ok: true,
    id: enrollment.id,
    protocol: enrollment.id,
    ...(enrollment.grade === "CFO" ? { documentsChecklist: enrollment.documentsChecklist } : {}),
  }, { status });
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
    const body = await request.json();
    assertRegistrationOpen(cleanText(body.grade, 40));
    const db = getDatabase(env);
    const enrollment = normalizePayload(body);
    const existing = await findExistingEnrollment(db, enrollment);
    // A slow database read must not let a request cross the closing deadline.
    assertRegistrationOpen(enrollment.grade);
    if (existing) return confirmation(existing);
    const payload = JSON.stringify(enrollment);

    // This single statement also protects concurrent requests that both passed the
    // legacy-aware CPF check above. New public/admin records persist the period.
    const result = await db.prepare(
      `INSERT INTO enrollments (
        id, full_name, cpf, course, email, status, enrollment_date, payload, created_at, updated_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
      WHERE NOT EXISTS (
        SELECT 1 FROM enrollments WHERE ${cpfSqlExpression()} = ?
        AND CASE WHEN json_valid(payload)
          THEN TRIM(json_extract(payload, '$.enrollmentPeriod')) = ?
          ELSE 1 END
      )`
    )
      .bind(
        enrollment.id,
        enrollment.fullName,
        enrollment.cpf,
        enrollment.grade,
        enrollment.email,
        enrollment.status,
        enrollment.enrollmentDate || "",
        payload,
        cleanCpf(enrollment.cpf),
        enrollment.enrollmentPeriod
      )
      .run();

    if (!result.meta?.changes) {
      const saved = await findExistingEnrollment(db, enrollment);
      if (saved) return confirmation(saved);
      throw new Error("Nao foi possivel confirmar a pre-inscricao. Tente novamente.");
    }
    return confirmation(enrollment, 201);
  } catch (error) {
    return errorJson(error, 400);
  }
}
