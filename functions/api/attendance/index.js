const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, x-admin-password",
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

function getAccess(request, env) {
  if (!env.ADMIN_PASSWORD) {
    throw new Error("Variavel ADMIN_PASSWORD nao configurada.");
  }

  const password = request.headers.get("x-admin-password") || "";
  if (password === env.ADMIN_PASSWORD) return { role: "admin" };
  if (env.USER_PASSWORD && password === env.USER_PASSWORD) return { role: "usuario" };
  return null;
}

function getDatabase(env) {
  if (!env.DB) {
    throw new Error("D1 binding DB nao configurado.");
  }

  return env.DB;
}

function cleanCpf(value) {
  return String(value || "").replace(/\D/g, "");
}

async function ensureAttendanceTable(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      enrollment_id TEXT NOT NULL,
      cpf TEXT,
      full_name TEXT,
      course TEXT,
      class_date TEXT NOT NULL,
      status TEXT NOT NULL,
      justification TEXT,
      method TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(enrollment_id, class_date)
    )`
  ).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(class_date)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_cpf ON attendance(cpf)").run();
}

async function findEnrollment(db, body) {
  if (body.enrollmentId) {
    const row = await db.prepare("SELECT payload FROM enrollments WHERE id = ?").bind(body.enrollmentId).first();
    if (row) return JSON.parse(row.payload);
  }

  const cpf = cleanCpf(body.cpf);
  if (!cpf) return null;

  const rows = await db.prepare("SELECT payload FROM enrollments").all();
  return rows.results
    .map((row) => JSON.parse(row.payload))
    .find((item) => cleanCpf(item.cpf) === cpf) || null;
}

function normalizeStatus(status) {
  const allowed = ["Presente", "Justificado", "Falta"];
  return allowed.includes(status) ? status : "Presente";
}

export async function onRequestGet({ request, env }) {
  try {
    const access = getAccess(request, env);
    if (!access) {
      return unauthorized();
    }

    const db = getDatabase(env);
    await ensureAttendanceTable(db);
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";
    const course = url.searchParams.get("course") || "";
    const limit = Math.min(Number(url.searchParams.get("limit") || 300), 1000);
    const where = [];
    const binds = [];

    if (date) {
      where.push("class_date = ?");
      binds.push(date);
    }
    if (course) {
      where.push("course = ?");
      binds.push(course);
    }

    const sql = `SELECT payload FROM attendance ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ?`;
    const result = await db.prepare(sql).bind(...binds, limit).all();
    const records = result.results.map((row) => JSON.parse(row.payload));
    return json({ records, role: access.role });
  } catch (error) {
    return errorJson(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = getAccess(request, env);
    if (!access) {
      return unauthorized();
    }

    const db = getDatabase(env);
    await ensureAttendanceTable(db);
    const body = await request.json();
    const enrollment = await findEnrollment(db, body);
    if (!enrollment) {
      return json({ ok: false, error: "Aluno nao encontrado." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const record = {
      id: body.id || crypto.randomUUID(),
      enrollmentId: enrollment.id,
      cpf: enrollment.cpf || "",
      fullName: enrollment.fullName || "",
      course: enrollment.grade || "",
      classDate: body.classDate || now.slice(0, 10),
      status: normalizeStatus(body.status),
      justification: String(body.justification || "").trim(),
      method: body.method || "Manual",
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const payload = JSON.stringify(record);
    await db.prepare(
      `INSERT INTO attendance (
        id, enrollment_id, cpf, full_name, course, class_date, status, justification, method, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(enrollment_id, class_date) DO UPDATE SET
        cpf = excluded.cpf,
        full_name = excluded.full_name,
        course = excluded.course,
        status = excluded.status,
        justification = excluded.justification,
        method = excluded.method,
        payload = excluded.payload,
        updated_at = datetime('now')`
    )
      .bind(
        record.id,
        record.enrollmentId,
        cleanCpf(record.cpf),
        record.fullName,
        record.course,
        record.classDate,
        record.status,
        record.justification,
        record.method,
        payload
      )
      .run();

    return json({ ok: true, record }, { status: 201 });
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
