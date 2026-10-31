import { getAccess, requireAdmin } from '../_auth.js';

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
export const declarationJson = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const text = value => String(value || '').trim();
const normalize = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
const validDate = value => /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text(value)) && Number.isFinite(Date.parse(value));
const number = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value));

export async function declarationAccess(request, env) {
  const access = await getAccess(request, env);
  if (!access) throw fail('Entre com uma conta autorizada da Secretaria.', 401);
  if (!await requireAdmin(request, env)) throw fail('Somente a Secretaria pode emitir e consultar declarações.', 403);
  if (!env.DB) throw fail('Banco local indisponível.', 503);
  return access;
}

export async function declarationEligibility(db, enrollmentId) {
  const row = await db.prepare('SELECT payload FROM enrollments WHERE id=?').bind(enrollmentId).first();
  if (!row) throw fail('Matrícula não encontrada.', 404);
  const student = parse(row.payload, {});
  const course = text(student.grade);
  const hasIdentity = Boolean(text(student.fullName) && course);
  const studies = hasIdentity && normalize(student.status) === 'ativa';
  const reasons = [];
  const validation = await db.prepare('SELECT * FROM declaration_completion_validations WHERE enrollment_id=? AND course=? ORDER BY validated_at DESC LIMIT 1')
    .bind(enrollmentId, course).first();
  let policy = null;
  if (validation) policy = await db.prepare('SELECT * FROM declaration_course_policies WHERE id=? AND course=?').bind(validation.policy_id, course).first();
  if (!policy) reasons.push('Definir e homologar matriz integral, carga horária, frequência, notas, demais requisitos e autoridade responsável.');
  if (!validation || validation.secretary_confirmed !== 1 || !text(validation.validated_by_name) || !text(validation.validated_by_account) ||
      !validDate(validation.validated_at) || !validDate(validation.course_completed_at) || Date.parse(validation.course_completed_at) > Date.now()) {
    reasons.push('Falta confirmação administrativa explícita e documentada da conclusão integral pela Secretaria.');
  }
  if (!hasIdentity || ['cancelada', 'em espera'].includes(normalize(student.status))) reasons.push('Matrícula sem situação elegível ou identificação completa.');
  if (!validation || validation.certificate_status !== 'pending') reasons.push('A pendência do certificado ainda não foi confirmada.');
  if (policy) {
    const modules = parse(policy.required_modules, []), additional = parse(policy.additional_requirements, null);
    const evidence = parse(validation.evidence_json, {});
    const policyReady = Array.isArray(modules) && modules.length > 0 && modules.every(name => text(name)) &&
      number(policy.required_hours) && Number(policy.required_hours) > 0 && number(policy.min_attendance) &&
      Number(policy.min_attendance) >= 0 && Number(policy.min_attendance) <= 100 && number(policy.min_grade) &&
      Number(policy.min_grade) >= 0 && Number(policy.min_grade) <= 10 && Array.isArray(additional) &&
      text(policy.institutional_reference) && text(policy.approved_by) && validDate(policy.approved_at);
    if (!policyReady) reasons.push('Os critérios institucionais estão incompletos ou sem homologação.');
    const evidenceReady = Array.isArray(modules) && number(evidence.completedHours) && Number(evidence.completedHours) >= Number(policy.required_hours) &&
      number(evidence.attendancePercent) && Number(evidence.attendancePercent) >= Number(policy.min_attendance) && Number(evidence.attendancePercent) <= 100 &&
      text(evidence.hoursReference) && text(evidence.attendanceReference) && text(evidence.integralCompletionReference) &&
      Array.isArray(evidence.modules) && modules.every(name => evidence.modules.some(item => item.name === name &&
        number(item.grade) && Number(item.grade) >= Number(policy.min_grade) && Number(item.grade) <= 10 && text(item.evidenceReference))) &&
      Array.isArray(additional) && additional.every(name => Array.isArray(evidence.additionalRequirements) &&
        evidence.additionalRequirements.some(item => item.name === name && item.confirmed === true && text(item.evidenceReference)));
    if (!evidenceReady) reasons.push('Faltam comprovantes de integralização, carga horária, frequência, notas de todos os módulos ou outros requisitos homologados.');
  }
  return { student, policy, validation, studies, completion: reasons.length === 0, reasons };
}

export async function onRequestGet({ request, env }) {
  try {
    await declarationAccess(request, env);
    const cursor = new URL(request.url || 'http://local/api/declarations').searchParams.get('cursor');
    let previous = null;
    if (cursor) {
      try { previous = JSON.parse(atob(cursor)); } catch { throw fail('Página de histórico inválida.'); }
      if (!validDate(previous?.date) || !/^[0-9a-f-]{36}$/i.test(text(previous?.id))) throw fail('Página de histórico inválida.');
    }
    const query = previous
      ? env.DB.prepare('SELECT id,issued_at,payload FROM declarations_issued WHERE issued_at < ? OR (issued_at=? AND id < ?) ORDER BY issued_at DESC,id DESC LIMIT 101').bind(previous.date, previous.date, previous.id)
      : env.DB.prepare('SELECT id,issued_at,payload FROM declarations_issued ORDER BY issued_at DESC,id DESC LIMIT 101');
    const result = await query.all();
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM declarations_issued').first();
    const page = result.results.slice(0,100), last = page.at(-1);
    return declarationJson({ records: page.map(row => JSON.parse(row.payload)), total: count.total,
      nextCursor: result.results.length > 100 ? btoa(JSON.stringify({ date:last.issued_at,id:last.id })) : null });
  } catch (error) { return declarationJson({ error: error.message }, error.status || 503); }
}

export async function onRequestPost({ request, env }) {
  try {
    const access = await declarationAccess(request, env);
    const body = await request.json();
    if (!['studies', 'completion'].includes(body.type)) throw fail('Selecione o tipo de declaração.');
    if (!/^\d{4} - [12]º semestre$/.test(text(body.period)) || Number(body.period.slice(0,4)) < 1900) throw fail('Informe ano e semestre válidos.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(body.requestId))) throw fail('Identificador de solicitação inválido.');
    const responsibleName = text(body.responsibleName);
    if (responsibleName.length < 6 || responsibleName.length > 120 || body.authorized !== true) throw fail('Identifique o responsável e confirme a autorização para emissão.');
    const account = text(access.userId || access.login || access.role);
    const previous = await env.DB.prepare('SELECT payload FROM declarations_issued WHERE request_id=?').bind(body.requestId).first();
    if (previous) {
      const record = JSON.parse(previous.payload);
      if (record.enrollmentId !== body.enrollmentId || record.type !== body.type || record.period !== body.period || record.issuerAccount !== account || record.issuerName !== responsibleName) throw fail('Solicitação já utilizada para outra emissão.', 409);
      return declarationJson({ record });
    }
    const eligibility = await declarationEligibility(env.DB, text(body.enrollmentId));
    if (body.type === 'studies' && !eligibility.studies) throw fail('Declaração de estudos exige matrícula ativa e identificação completa.', 409);
    if (body.type === 'completion' && !eligibility.completion) throw fail(eligibility.reasons.join(' '), 409);
    const { student, validation, policy } = eligibility;
    if (body.course !== student.grade) throw fail('O curso deve corresponder à matrícula selecionada.', 409);
    const issuedAt = new Date().toISOString(), id = crypto.randomUUID();
    const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Manaus' }).format(new Date(issuedAt));
    const record = { id, controlNumber: `ETDA-${year}-${id.replace(/-/g, '').toUpperCase()}`, type: body.type,
      enrollmentId: text(body.enrollmentId), studentName: student.fullName, course: student.grade, period: body.period,
      issuedAt, issuerAccount: account, issuerName: responsibleName, authenticatedName: access.name || null, issuerIdentitySource: access.name ? 'authenticated-account-and-declared-signatory' : 'shared-admin-account-declared-signatory',
      validationId: body.type === 'completion' ? validation.id : null,
      completedAt: body.type === 'completion' ? validation.course_completed_at : null,
      requiredHours: body.type === 'completion' ? policy.required_hours : null,
      templateVersion: 1 };
    record.statement = body.type === 'studies'
      ? `Declaramos, para os devidos fins, que ${record.studentName} encontra-se regularmente matriculado(a) e regularmente cursando o curso ${record.course}, na Escola Teológica Deus é Amor — ETDA Manaus, no período ${record.period}.`
      : `Declaramos, para os devidos fins, que ${record.studentName} concluiu integralmente o curso ${record.course}, na Escola Teológica Deus é Amor — ETDA Manaus, conforme confirmação documental da Secretaria. O curso foi concluído em ${new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Manaus' }).format(new Date(record.completedAt.length === 10 ? record.completedAt + 'T12:00:00Z' : record.completedAt))}, com carga horária de ${record.requiredHours} horas. O certificado de conclusão encontra-se pendente de emissão.`;
    await env.DB.prepare(`INSERT INTO declarations_issued (id,request_id,control_number,type,enrollment_id,student_name,course,period,issued_at,issuer_account,issuer_name,validation_id,payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, body.requestId, record.controlNumber, record.type, record.enrollmentId, record.studentName, record.course,
      record.period, issuedAt, account, responsibleName, record.validationId, JSON.stringify(record)).run();
    return declarationJson({ record }, 201);
  } catch (error) { return declarationJson({ error: error.message }, error.status || 503); }
}
