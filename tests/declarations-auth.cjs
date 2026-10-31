const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');

// Exercise the real cookie signature and role checks, not a mocked permission helper.
const context = vm.createContext({Response, Request, URL, TextEncoder, TextDecoder, atob, btoa, crypto:webcrypto});
const load = file => vm.runInContext(fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '').replaceAll('export ', ''), context);
load('functions/api/_auth.js');
load('functions/api/declarations/index.js');
const history = context.onRequestGet, issue = context.onRequestPost;
load('functions/api/declarations/eligibility.js');
const eligibility = context.onRequestGet;
let reads = 0;
const env = {SESSION_SECRET:'fictional-local-auth-test-only', DB:{prepare(sql) {
  reads++;
  return {bind() {return this;}, async all() {return {results:[]};}, async first() {
    if (sql.includes('COUNT(*)')) return {total:0};
    if (sql.includes('FROM enrollments')) return {payload:JSON.stringify({fullName:'Aluno fictício',grade:'CFO',status:'Ativa'})};
    return null;
  }};
}}};
async function check(cookie, expected) {
  const headers = cookie ? {cookie} : {};
  for (const [handler, path, options] of [
    [history, '/api/declarations', {}],
    [eligibility, '/api/declarations/eligibility?enrollmentId=fictional', {}],
    [issue, '/api/declarations', {method:'POST', body:'{}'}],
  ]) {
    const before = reads;
    const response = await handler({request:new Request('https://local.test'+path, {...options, headers}), env});
    assert.equal(response.status, expected, path);
    assert.equal(reads, before, 'Denied direct requests never query the database');
  }
}
(async () => {
  await check('', 401);
  await check('etda_session=invalid.signature', 401);
  for (const role of ['professor', 'usuario']) {
    const cookie = (await context.createSessionCookie({role}, env)).split(';')[0];
    await check(cookie, 403);
  }
  for (const role of ['admin', 'administrador']) {
    const cookie = (await context.createSessionCookie({role}, env)).split(';')[0];
    const request = new Request('https://local.test/api/declarations', {headers:{cookie}});
    assert.equal((await history({request, env})).status, 200);
    const response = await eligibility({request:new Request('https://local.test/api/declarations/eligibility?enrollmentId=fictional', {headers:{cookie}}), env});
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.studies, true);
    assert.equal(data.completion, false);
  }
  console.log('PASS: real signed sessions; anonymous/invalid cookies 401; teacher/user direct history, eligibility and issue 403 before DB access; admin/administrador allowed.');
})().catch(error => {console.error(error);process.exitCode=1;});
