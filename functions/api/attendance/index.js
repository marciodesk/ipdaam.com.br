import { getAccess } from "../_auth.js";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
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

const attendanceSchema = new WeakMap();
export async function ensureAttendanceTable(db) {
  if (!attendanceSchema.has(db)) {
    const ready = initializeAttendanceTable(db).catch(error => { attendanceSchema.delete(db); throw error; });
    attendanceSchema.set(db,ready);
  }
  return attendanceSchema.get(db);
}

async function initializeAttendanceTable(db) {
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
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_page ON attendance(class_date, created_at DESC, id DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_attendance_risk ON attendance(course, module, enrollment_id) WHERE status = 'Falta'").run();
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

function normalizeRole(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function isAdminAccess(access) {
  const role = normalizeRole(access?.role);
  return role === "admin" || role === "administrador";
}

function getAccessScopes(access) {
  return access.scopes || (access.course ? [{ course: access.course, module: access.module || "" }] : []);
}

function canAccessAttendanceRecord(access, record) {
  if (isAdminAccess(access)) return true;
  const course = String(record.course || "").toUpperCase();
  const module = String(record.module || "");
  return getAccessScopes(access).some((scope) =>
    scope.course === course && (course !== "CFO" || scope.module === module)
  );
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
    const scopes = access.scopes || (access.course ? [{ course: access.course, module: access.module || "" }] : []);
    const allowedRequestedScope = scopes.find((scope) => scope.course === requestedCourse && (!requestedModule || scope.module === requestedModule));
    const isAdmin = isAdminAccess(access);
    const course = isAdmin ? requestedCourse : (allowedRequestedScope ? requestedCourse : "");
    const module = isAdmin ? requestedModule : (allowedRequestedScope ? requestedModule : "");
    const pageMode = url.searchParams.get("view") === "page";
    const riskMode = url.searchParams.get("view") === "risk";
    const requestedLimit = Number(url.searchParams.get("limit") || (pageMode ? 50 : 300));
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.floor(requestedLimit), pageMode ? 200 : 1000)) : 50;
    const where = [];
    const binds = [];

    if (date && !riskMode) {
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
    if (!isAdmin) {
      const scopeClauses = [];
      scopes.forEach((scope) => {
        if (scope.course === "CFO") {
          scopeClauses.push("(course = ? AND module = ?)");
          binds.push(scope.course, scope.module || "");
        } else {
          scopeClauses.push("course = ?");
          binds.push(scope.course);
        }
      });
      if (!scopeClauses.length) return json({ records: [], alerts: [], totals: { total:0, present:0, justified:0, absence:0 }, nextCursor:null, ...access });
      where.push(`(${scopeClauses.join(" OR ")})`);
    }

    if (riskMode) {
      where.push("status = 'Falta'");
      const result = await db.prepare(`SELECT enrollment_id AS enrollmentId, MAX(full_name) AS name, MAX(course) AS course, MAX(module) AS module, COUNT(*) AS count FROM attendance WHERE ${where.join(" AND ")} GROUP BY enrollment_id HAVING COUNT(*) >= 3 ORDER BY count DESC, name COLLATE NOCASE`).bind(...binds).all();
      return json({ alerts: result.results || [] });
    }
    const enrollmentId = url.searchParams.get("enrollmentId");
    if (enrollmentId) { where.push("enrollment_id = ?"); binds.push(enrollmentId); }
    const query = String(url.searchParams.get("q") || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (query) {
      let searchable = "lower(COALESCE(full_name,'') || ' ' || COALESCE(cpf,'') || ' ' || COALESCE(course,''))";
      for (const [letters, replacement] of [["áàâãäÁÀÂÃÄ","a"],["éèêëÉÈÊË","e"],["íìîïÍÌÎÏ","i"],["óòôõöÓÒÔÕÖ","o"],["úùûüÚÙÛÜ","u"],["çÇ","c"]]) {
        for (const letter of letters) searchable = `replace(${searchable}, '${letter}', '${replacement}')`;
      }
      where.push(`instr(${searchable}, ?) > 0`); binds.push(query);
    }
    const baseWhere = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const totalsQuery = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(status='Presente'),0) AS present, COALESCE(SUM(status='Justificado'),0) AS justified, COALESCE(SUM(status='Falta'),0) AS absence FROM attendance ${baseWhere}`).bind(...binds);
    if (pageMode && url.searchParams.has("cursor")) {
      let cursor;
      try { cursor = JSON.parse(url.searchParams.get("cursor")); } catch { return errorJson(new Error("Cursor invalido."), 400); }
      if (!Array.isArray(cursor) || cursor.length !== 2 || cursor.some(value => typeof value !== "string" || value.length > 100)) return errorJson(new Error("Cursor invalido."),400);
      where.push("(created_at < ? OR (created_at = ? AND id < ?))"); binds.push(cursor[0],cursor[0],cursor[1]);
    }
    const rowsQuery = db.prepare(`SELECT payload, created_at, id FROM attendance ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY created_at DESC, id DESC LIMIT ?`).bind(...binds, pageMode ? limit+1 : limit);
    const includeTotals = pageMode && url.searchParams.get("totals") !== "0";
    const results = includeTotals ? await db.batch([rowsQuery,totalsQuery]) : [await rowsQuery.all()];
    const rows = results[0].results || [];
    const hasMore = pageMode && rows.length > limit;
    if (hasMore) rows.pop();
    const last = rows[rows.length-1];
    return json({ records:rows.map(row=>JSON.parse(row.payload)), ...(includeTotals ? {totals:results[1].results[0]} : {}), ...(pageMode ? { nextCursor:hasMore ? JSON.stringify([last.created_at,last.id]) : null } : {}), ...access });
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
    const accessScopes = access.scopes || (access.course ? [{ course: access.course, module: access.module || "" }] : []);
    const allowedModules = ["Teologia Basica", "Etica Crista", "Pratica Ministerial"];
    let module = enrollmentCourse === "CFO" ? String(body.module || access.module || "") : "";
    if (enrollmentCourse === "CFO" && !allowedModules.includes(module)) {
      return json({ ok: false, error: "Selecione um modulo valido do CFO." }, { status: 400 });
    }
    if (!isAdminAccess(access) && !accessScopes.some((scope) => scope.course === enrollmentCourse && (enrollmentCourse !== "CFO" || scope.module === module))) {
      return json({ ok: false, error: "Seu usuario nao possui acesso a este curso ou modulo." }, { status: 403 });
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

export async function onRequestDelete({ request, env }) {
  try {
    const access = await getAccess(request, env);
    if (!access) {
      return unauthorized();
    }
    if (!isAdminAccess(access)) {
      return json({ ok: false, error: "Apenas o administrador pode remover presencas." }, { status: 403 });
    }

    const db = getDatabase(env);
    await ensureAttendanceTable(db);
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    if (!id) {
      return json({ ok: false, error: "Registro de presenca nao informado." }, { status: 400 });
    }

    const previous = await db.prepare("SELECT payload FROM attendance WHERE id = ?").bind(id).first();
    if (!previous?.payload) {
      return json({ ok: false, error: "Registro de presenca nao encontrado." }, { status: 404 });
    }

    const record = JSON.parse(previous.payload);
    if (!canAccessAttendanceRecord(access, record)) {
      return json({ ok: false, error: "Seu usuario nao possui acesso a este registro." }, { status: 403 });
    }

    await db.prepare("DELETE FROM attendance WHERE id = ?").bind(id).run();
    await db.prepare(`INSERT INTO attendance_audit
      (id, attendance_id, action, changed_by, changed_by_name, previous_payload, new_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), id, "Remocao", access.userId || "admin",
        access.name || "Administrador", previous.payload, "{}").run();

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
