const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(fs.readFileSync('migrations/0001_create_enrollments.sql','utf8'));
sqlite.exec(fs.readFileSync('migrations/0006_create_declarations.sql','utf8'));
let access = { role:'admin' };
const db = { prepare(sql) {
  let args = [];
  const statement = { bind(...values) { args = values; return statement; },
    async first() { return sqlite.prepare(sql).get(...args); },
    async all() { return { results:sqlite.prepare(sql).all(...args) }; },
    async run() { return sqlite.prepare(sql).run(...args); } };
  return statement;
} };
const context = vm.createContext({ getAccess:async()=>access, requireAdmin:async()=>access?.role === 'admin', Response, URL, atob, btoa, crypto:require('node:crypto').webcrypto });
vm.runInContext(fs.readFileSync('functions/api/declarations/index.js','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''),context);
const env = { DB:db };
const post = body => context.onRequestPost({ request:{ json:async()=>body }, env });
const get = (url='http://local/api/declarations') => context.onRequestGet({ request:{url}, env });
const base = { enrollmentId:'active',course:'CFO',type:'studies',period:'2026 - 2º semestre',responsibleName:'Responsável Fictício',authorized:true };
const request = (extra={}) => ({ ...base,requestId:crypto.randomUUID(),...extra });
const insertStudent = (id,status) => sqlite.prepare('INSERT INTO enrollments (id,payload) VALUES (?,?)').run(id,JSON.stringify({id,fullName:'Aluno Fictício',grade:'CFO',status,cpf:'111.111.111-11'}));
for (const [id,status] of [['active','Ativa'],['waiting','Em espera'],['cancelled','Cancelada'],['completed','Concluída']]) insertStudent(id,status);

(async()=>{
  access=null; assert.equal((await get()).status,401); assert.equal((await post(request())).status,401);
  access={role:'professor'};assert.equal((await get()).status,403); assert.equal((await post(request())).status,403);
  access={role:'admin'};
  for(const id of ['waiting','cancelled','completed']) assert.equal((await post(request({enrollmentId:id}))).status,409);
  assert.equal((await post(request({authorized:false}))).status,400);
  assert.equal((await post(request({course:'Outro curso'}))).status,409);
  const input=request({studentName:'Nome adulterado',issuerAccount:'Outro emissor'});
  let response=await post(input);assert.equal(response.status,201);
  const issued=(await response.json()).record;
  assert.equal(issued.studentName,'Aluno Fictício'); assert.equal(issued.issuerAccount,'admin');
  assert.equal(issued.issuerIdentitySource,'shared-admin-account-declared-signatory');
  assert(!JSON.stringify(issued).includes('111.111.111-11'));assert(issued.statement.includes('regularmente cursando'));
  response=await post(input);assert.equal(response.status,200);assert.equal((await response.json()).record.id,issued.id);
  assert.equal((await post({...input,period:'2025 - 2º semestre'})).status,409);
  assert.equal((await post(request({type:'completion',secretaryConfirmed:true,average:10,certificatePending:true}))).status,409,'A client assertion or semester grade never authorizes completion');
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM declarations_issued').get().count,1);

  // Explicitly fictional institutional policy and documentary evidence, only in memory.
  sqlite.prepare('INSERT INTO declaration_course_policies VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('fictional-policy','CFO','TEST-ONLY','["A","B"]',100,75,6,'["Atividade final"]','TEST-ONLY DOCUMENT','Secretaria Fictícia','2026-01-01T12:00:00Z');
  const evidence={ completedHours:100,attendancePercent:80,hoursReference:'TEST-HOURS',attendanceReference:'TEST-ATTENDANCE',integralCompletionReference:'TEST-INTEGRAL',
    modules:[{name:'A',grade:8,evidenceReference:'TEST-A'},{name:'B',grade:7,evidenceReference:'TEST-B'}],additionalRequirements:[{name:'Atividade final',confirmed:true,evidenceReference:'TEST-FINAL'}] };
  const saveValidation = (changes={}) => {
    const row={ evidence_json:JSON.stringify(evidence),secretary_confirmed:1,certificate_status:'pending',...changes };
    sqlite.prepare('INSERT OR REPLACE INTO declaration_completion_validations VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('fictional-validation','completed','CFO','fictional-policy',row.evidence_json,row.secretary_confirmed,'Validador Fictício','admin','2026-10-01T12:00:00Z','2026-09-30',row.certificate_status);
  };
  saveValidation({secretary_confirmed:0});assert.equal((await post(request({enrollmentId:'completed',type:'completion'}))).status,409);
  saveValidation({certificate_status:'issued'});assert.equal((await post(request({enrollmentId:'completed',type:'completion'}))).status,409);
  for(const missing of [{completedHours:99},{attendancePercent:74},{modules:[evidence.modules[0]]},{additionalRequirements:[]},{integralCompletionReference:''}]){
    saveValidation({evidence_json:JSON.stringify({...evidence,...missing})});assert.equal((await post(request({enrollmentId:'completed',type:'completion'}))).status,409);
  }
  saveValidation(); response=await post(request({enrollmentId:'completed',type:'completion'}));assert.equal(response.status,201);
  const completion=(await response.json()).record;assert(completion.statement.includes('concluiu integralmente'));assert(completion.statement.includes('pendente de emissão'));assert.equal(completion.validationId,'fictional-validation');
  const history=(await(await get()).json());assert.equal(history.total,2);assert.equal(history.records.length,2);
  assert.equal((await get('http://local/api/declarations?cursor=invalid')).status,400);
  assert.throws(()=>sqlite.prepare('UPDATE declarations_issued SET student_name=? WHERE id=?').run('Alterado',issued.id),/immutable/);
  assert.throws(()=>sqlite.prepare('DELETE FROM declarations_issued WHERE id=?').run(issued.id),/immutable/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM enrollments').get().count,4,'No duplicate enrollments');
  for(let i=0;i<101;i++) {
    const id=crypto.randomUUID();
    sqlite.prepare('INSERT INTO declarations_issued (id,request_id,control_number,type,enrollment_id,student_name,course,period,issued_at,issuer_account,issuer_name,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,id,id,'studies','active','Aluno fictício','CFO','2026 - 2º semestre',issued.issuedAt,'admin','Emissor fictício',JSON.stringify({...issued,id}));
  }
  const firstPage=await(await get()).json();assert.equal(firstPage.records.length,100);assert(firstPage.nextCursor);
  const secondPage=await(await get('http://local/api/declarations?cursor='+encodeURIComponent(firstPage.nextCursor))).json();
  assert.equal(secondPage.records.length,3);assert.equal(secondPage.nextCursor,null);
  assert.equal(new Set([...firstPage.records,...secondPage.records].map(record=>record.id)).size,103);
  sqlite.close();console.log('PASS: declaration authorization, enrollment eligibility, server-side completion proof, certificate pendency, privacy, immutable history, idempotency and distinct institutional texts.');
})().catch(error=>{console.error(error);process.exitCode=1});
