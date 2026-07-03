import { getAccess } from "../_auth.js";

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
      module TEXT NOT NULL DEFAULT '',
      class_date TEXT NOT NULL,
      status TEXT NOT NULL,
      justification TEXT,
      method TEXT,
      recorded_by TEXT,
      recorded_by_name TEXT,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(enrollment_id, class_date, module)
    )`
  ).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(class_date)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_cpf ON attendance(cpf)").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS attendance_audit (
    id TEXT PRIMARY KEY, attendance_id TEXT NOT NULL, action TEXT NOT NULL,
    changed_by TEXT, changed_by_name TEXT, previous_payload TEXT, new_payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();
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
    const access = await getAccess(request, env);
    if (!access) {
      return unauthorized();
    }

    const db = getDatabase(env);
    await ensureAttendanceTable(db);
    const url = new URL(request.url);
    const date = url.searchParams.get("date") || "";
    const requestedCourse = url.searchParams.get("course") || "";
    const requestedModule = url.searchParams.get("module") || "";
    const course = access.role === "admin" ? requestedCourse : access.course;
    const module = access.role === "admin" ? requestedModule : (access.module || "");
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
    if (module) {
      where.push("module = ?");
      binds.push(module);
    }

    const sql = `SELECT payload FROM attendance ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ?`;
    const result = await db.prepare(sql).bind(...binds, limit).all();
    const records = result.results.map((row) => JSON.parse(row.payload));
    return json({ records, ...access });
  } catch (error) {
    return errorJson(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await getAccess(request, env);
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

    const enrollmentCourse = String(enrollment.grade || "").toUpperCase();
    if (access.role !== "admin" && enrollmentCourse !== String(access.course || "").toUpperCase()) {
      return json({ ok: false, error: "Este aluno nao pertence ao curso autorizado para seu usuario." }, { status: 403 });
    }
    const allowedModules = ["Teologia Basica", "Etica Crista", "Pratica Ministerial"];
    let module = enrollmentCourse === "CFO" ? String(body.module || access.module || "") : "";
    if (enrollmentCourse === "CFO" && !allowedModules.includes(module)) {
      return json({ ok: false, error: "Selecione um modulo valido do CFO." }, { status: 400 });
    }
    if (access.role !== "admin" && access.module && module !== access.module) {
      return json({ ok: false, error: "Seu usuario nao possui acesso a este modulo." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const record = {
      id: body.id || crypto.randomUUID(),
      enrollmentId: enrollment.id,
      cpf: enrollment.cpf || "",
      fullName: enrollment.fullName || "",
      course: enrollment.grade || "",
      module,
      classDate: body.classDate || now.slice(0, 10),
      status: normalizeStatus(body.status),
      justification: String(body.justification || "").trim(),
      method: body.method || "Manual",
      recordedBy: access.userId || "admin",
      recordedByName: access.name || "Administrador",
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const previous = await db.prepare("SELECT payload FROM attendance WHERE enrollment_id=? AND class_date=? AND module=?")
      .bind(record.enrollmentId, record.classDate, record.module).first();
    if (previous?.payload) record.id = JSON.parse(previous.payload).id || record.id;
    const payload = JSON.stringify(record);
    await db.prepare(
      `INSERT INTO attendance (
        id, enrollment_id, cpf, full_name, course, module, class_date, status, justification, method,
        recorded_by, recorded_by_name, payload, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(enrollment_id, class_date, module) DO UPDATE SET
        cpf = excluded.cpf,
        full_name = excluded.full_name,
        course = excluded.course,
        module = excluded.module,
        status = excluded.status,
        justification = excluded.justification,
        method = excluded.method,
        recorded_by = excluded.recorded_by,
        recorded_by_name = excluded.recorded_by_name,
        payload = excluded.payload,
        updated_at = datetime('now')`
    )
      .bind(
        record.id,
        record.enrollmentId,
        cleanCpf(record.cpf),
        record.fullName,
        record.course,
        record.module,
        record.classDate,
        record.status,
        record.justification,
        record.method,
        record.recordedBy,
        record.recordedByName,
        payload
      )
      .run();

    await db.prepare(`INSERT INTO attendance_audit
      (id, attendance_id, action, changed_by, changed_by_name, previous_payload, new_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), record.id, previous ? "Atualizacao" : "Criacao", record.recordedBy,
        record.recordedByName, previous?.payload || null, payload).run();

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
