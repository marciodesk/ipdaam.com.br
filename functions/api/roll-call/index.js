import { getAccess } from "../_auth.js";
import { ensureAttendanceTable } from "../attendance/index.js";

const headers = { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" };
const reply = (data, status=200) => new Response(JSON.stringify(data), {status,headers});
const fail = (message,status=400) => Object.assign(new Error(message),{status});
const modules = ["Teologia Basica","Etica Crista","Pratica Ministerial"];
const admin = access => ["admin","administrador"].includes(String(access.role).toLowerCase());
const scopes = access => access.scopes || (access.course ? [{course:access.course,module:access.module||""}] : []);
function contextOf(data, access) {
  const course = String(data.course || "").toUpperCase();
  const module = course === "CFO" ? String(data.module || "") : "";
  const date = String(data.date || "");
  if (!course || course === "TODOS" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date) throw fail("Selecione data, curso e módulo da chamada.");
  if (course === "CFO" && !modules.includes(module)) throw fail("Selecione um módulo válido do CFO.");
  if (!admin(access) && !scopes(access).some(s=>s.course===course && (course!=="CFO" || s.module===module))) throw fail("Sem permissão para esta turma.",403);
  return {course,module,date};
}
// The enrollment model links active students to a course. CFO modules share that roster.
const rosterWhere = "e.course = ? AND lower(trim(e.status)) = 'ativa'";
const join = "LEFT JOIN attendance a ON a.enrollment_id=e.id AND a.class_date=? AND a.module=?";
const signatureSql = `SELECT json_group_array(json_array(id,updated_at,record)) AS signature FROM
  (SELECT e.id,e.updated_at,a.payload AS record FROM enrollments e ${join} WHERE ${rosterWhere} ORDER BY e.id)`;
const args = c => [c.date,c.module,c.course];
async function snapshot(db,c) {
  const row = await db.prepare(signatureSql).bind(...args(c)).first();
  const signature = row.signature;
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(signature));
  return {signature,token:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("")};
}
const totalsSql = `SELECT COUNT(*) AS total, COALESCE(SUM(a.status='Presente'),0) AS present,
 COALESCE(SUM(a.status='Justificado'),0) AS justified, COALESCE(SUM(a.status='Falta'),0) AS absence,
 COALESCE(SUM(a.id IS NULL),0) AS pending FROM enrollments e ${join} WHERE ${rosterWhere}`;
async function authorized(request,env) {
  const access = await getAccess(request,env);
  if (!access) throw fail("Sessão expirada. Entre novamente.",401);
  if (!env.DB) throw fail("Banco indisponível.",503);
  await ensureAttendanceTable(env.DB);
  return access;
}
export async function onRequestGet({request,env}) {
  try {
    const access = await authorized(request,env), db=env.DB;
    const params = new URL(request.url).searchParams;
    if (params.get("view")==="courses") {
      const result = await db.prepare("SELECT DISTINCT course FROM enrollments WHERE lower(trim(status))='ativa' ORDER BY course").all();
      return reply({courses:result.results.map(r=>r.course).filter(course=>course && (admin(access)||scopes(access).some(s=>s.course===course)))});
    }
    const c=contextOf(Object.fromEntries(params),access);
    const before=await snapshot(db,c);
    if (params.get("snapshot") && params.get("snapshot")!==before.token) throw fail("A chamada mudou durante o carregamento. Tente novamente.",409);
    const cursor=params.get("cursor")||"";
    if (cursor.length>200) throw fail("Página inválida.");
    const result=await db.prepare(`SELECT e.id,e.full_name,e.cpf,
      json_extract(e.payload,'$.region') AS region,json_extract(e.payload,'$.regiao') AS regiao,
      json_extract(e.payload,'$.currentMinistryRole') AS role,json_extract(e.payload,'$.pastor') AS pastor,
      json_extract(e.payload,'$.city') AS city,a.payload AS record
      FROM enrollments e ${join} WHERE ${rosterWhere} AND e.id > ? ORDER BY e.id LIMIT 101`).bind(...args(c),cursor).all();
    const totals=await db.prepare(totalsSql).bind(...args(c)).first();
    const after=await snapshot(db,c);
    if (before.token!==after.token) throw fail("A chamada mudou durante o carregamento. Tente novamente.",409);
    const more=result.results.length>100;
    const rows=result.results.slice(0,100).map(r=>({id:r.id,fullName:r.full_name,cpf:r.cpf,region:r.region||r.regiao||"",role:r.role||"",pastor:r.pastor||"",city:r.city||"",record:r.record?JSON.parse(r.record):null}));
    return reply({rows,totals,snapshot:after.token,nextCursor:more?rows[rows.length-1].id:null});
  } catch(error) { return reply({error:error.message},error.status||500); }
}
export async function onRequestPost({request,env}) {
  try {
    const access=await authorized(request,env),db=env.DB,body=await request.json();
    const c=contextOf(body,access);
    if (body.action==="finalize") return await finalize(db,c,body,access);
    if (body.action!=="save" || !["Presente","Justificado","Falta"].includes(body.status)) throw fail("Selecione Presente, Justificado ou Falta. Pendente não é gravado.");
    const student=await db.prepare(`SELECT e.id,e.full_name,e.cpf FROM enrollments e WHERE ${rosterWhere} AND e.id=?`).bind(c.course,String(body.enrollmentId||"")).first();
    if (!student) throw fail("Aluno não pertence à lista ativa deste curso.",404);
    const previous=await db.prepare("SELECT payload FROM attendance WHERE enrollment_id=? AND class_date=? AND module=?").bind(student.id,c.date,c.module).first();
    const old=previous?JSON.parse(previous.payload):null,now=new Date().toISOString();
    const record={id:old?.id||crypto.randomUUID(),enrollmentId:student.id,fullName:student.full_name,cpf:student.cpf,course:c.course,module:c.module,classDate:c.date,status:body.status,
      justification:body.status==="Justificado"?String(body.justification||"").trim().slice(0,2000):"",method:"Manual",recordedBy:access.userId||"admin",recordedByName:access.name||"Administrador",createdAt:old?.createdAt||now,updatedAt:now};
    const payload=JSON.stringify(record);
    const results=await db.batch([
      db.prepare(`INSERT INTO attendance(id,enrollment_id,full_name,cpf,course,module,class_date,status,justification,method,recorded_by,recorded_by_name,payload)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(enrollment_id,class_date,module) DO UPDATE SET
       status=excluded.status,justification=excluded.justification,recorded_by=excluded.recorded_by,recorded_by_name=excluded.recorded_by_name,
       payload=json_set(excluded.payload,'$.id',attendance.id,'$.createdAt',json_extract(attendance.payload,'$.createdAt')),updated_at=datetime('now')`)
       .bind(record.id,student.id,student.full_name,student.cpf,c.course,c.module,c.date,record.status,record.justification,record.method,record.recordedBy,record.recordedByName,payload),
      db.prepare(`INSERT INTO attendance_audit(id,attendance_id,action,changed_by,changed_by_name,previous_payload,new_payload)
       SELECT ?,id,?,?,?,?,payload FROM attendance WHERE enrollment_id=? AND class_date=? AND module=?`)
       .bind(crypto.randomUUID(),old?"Atualizacao":"Criacao",record.recordedBy,record.recordedByName,previous?.payload||null,student.id,c.date,c.module),
      db.prepare("SELECT payload FROM attendance WHERE enrollment_id=? AND class_date=? AND module=?").bind(student.id,c.date,c.module)
    ]);
    return reply({ok:true,record:JSON.parse(results[2].results[0].payload)});
  } catch(error) { return reply({error:error.message},error.status||500); }
}
async function finalize(db,c,body,access) {
  if (body.confirmed!==true || !Number.isInteger(body.expectedPending) || body.expectedPending<0 || typeof body.snapshot!=="string") throw fail("Confirme o fechamento após carregar a lista completa.");
  const before=await snapshot(db,c);
  const totals=await db.prepare(totalsSql).bind(...args(c)).first();
  // A retry after a committed transaction is harmless, including a lost HTTP response.
  if (totals.total && totals.pending===0) return reply({ok:true,totals,created:0});
  if (!totals.total || before.token!==body.snapshot || totals.pending!==body.expectedPending) throw fail("A lista ou as marcações mudaram. Atualize e confirme novamente.",409);
  const operation=crypto.randomUUID(),now=new Date().toISOString();
  const user=access.userId||"admin",name=access.name||"Administrador";
  const results=await db.batch([
    db.prepare(`INSERT INTO attendance(id,enrollment_id,full_name,cpf,course,module,class_date,status,justification,method,recorded_by,recorded_by_name,payload)
      SELECT ? || e.id,e.id,e.full_name,e.cpf,e.course,?,?,'Falta','','Manual',?,?,
       json_object('id',? || e.id,'enrollmentId',e.id,'fullName',e.full_name,'cpf',e.cpf,'course',e.course,'module',?,'classDate',?,'status','Falta','justification','','method','Manual','recordedBy',?,'recordedByName',?,'createdAt',?,'updatedAt',?,'finalizationId',?)
      FROM enrollments e WHERE ${rosterWhere}
      AND NOT EXISTS(SELECT 1 FROM attendance a WHERE a.enrollment_id=e.id AND a.class_date=? AND a.module=?)
      AND (${signatureSql})=? ON CONFLICT(enrollment_id,class_date,module) DO NOTHING`)
      .bind(operation,c.module,c.date,user,name,operation,c.module,c.date,user,name,now,now,operation,c.course,c.date,c.module,...args(c),before.signature),
    db.prepare(`INSERT INTO attendance_audit(id,attendance_id,action,changed_by,changed_by_name,previous_payload,new_payload)
      SELECT ? || id,id,'Finalizacao',?,?,NULL,payload FROM attendance WHERE json_extract(payload,'$.finalizationId')=?`)
      .bind(operation,user,name,operation),
    db.prepare(totalsSql).bind(...args(c))
  ]);
  const confirmed=results[2].results[0];
  if (confirmed.pending!==0) throw fail("A turma mudou durante o fechamento. Atualize e confirme novamente.",409);
  return reply({ok:true,totals:confirmed,created:results[0].meta?.changes||0});
}
