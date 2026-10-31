const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('CREATE TABLE enrollments (id TEXT PRIMARY KEY, payload TEXT)');
let access = { role: 'admin' };
const db = { prepare(sql) {
  let values = [];
  const statement = {
    bind(...args) { values = args; return statement; },
    async run() { return sqlite.prepare(sql).run(...values); },
    async all() { return { results: sqlite.prepare(sql).all(...values) }; },
    async first() { return sqlite.prepare(sql).get(...values); },
  };
  return statement;
} };
const api = vm.createContext({ getAccess: async () => access, Response, crypto: require('node:crypto').webcrypto });
vm.runInContext(fs.readFileSync('functions/api/gradebook/index.js', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replaceAll('export async function', 'async function'), api);
const post = body => api.onRequestPost({ request: { json: async () => body }, env: { DB: db } });
const get = () => api.onRequestGet({ request: {}, env: { DB: db } });
const html = fs.readFileSync('secretaria.html', 'utf8');
const section = (start, end) => html.slice(html.indexOf(`function ${start}(`), html.indexOf(`function ${end}(`));
const year = { value: '2026' };
let exported;
const frontend = vm.createContext({ document: { querySelector: () => year, createElement: () => ({ click() {} }) },
  Blob, URL: { createObjectURL(blob) { exported = blob; return 'blob:test'; }, revokeObjectURL() {} },
  alert(message) { throw new Error(message); }, gradebookStudent: { value: 'fixture' },
  gradebookPeriod: { value: '1º semestre' }, gradebookRecords: [], gradebookTotal: {}, gradebookAverage: {}, gradebookStatus: {},
  getGradebookModules: () => [6,6,6].map(total => ({ total })) });
vm.runInContext(section('toScore','getActiveStudents') + section('getGradebookPeriodValue','renderGradebookStudentOptions') +
  section('findGradebookRecord','fillGradebookFromSelection') + section('updateGradebookTotals','getGradebookModules') +
  section('csvValue','csvBoolean') + section('getModuleScore','printForm'), frontend);

(async () => {
  const modules = ['Teologia basica', 'Etica crista', 'Praticas Liturgicas'].map(name => ({ name, grade: 6, total: 6 }));
  for (const value of ['2025 - 1º semestre', '2026 - 1º semestre', '2026 - 2º semestre']) {
    const response = await post({ enrollmentId:'fixture', fullName:'Aluno fictício', course:'CFO', period:value,
      modules, total:18, average:6, status:'Aprovado', notes:'Somente teste em memória' });
    assert.equal(response.status, 201);
  }
  let records = (await (await get()).json()).records;
  assert.equal(records.length, 3);
  frontend.gradebookRecords = records;
  assert.equal(frontend.findGradebookRecord().period, '2026 - 1º semestre');
  year.value = '2025'; assert.equal(frontend.findGradebookRecord().period, '2025 - 1º semestre');
  year.value = '2024'; assert.equal(frontend.findGradebookRecord(), undefined);
  assert.equal(frontend.sameGradebookPeriod('1º semestre','2026 - 1º semestre'), false);
  assert.equal(frontend.sameGradebookPeriod('2026 - 1 semestre','2026 - 1º semestre'), true);
  assert.equal(frontend.formatGradebookModuleName(modules[0].name), 'Teologia Básica');
  assert.equal(modules[0].name, 'Teologia basica');
  frontend.updateGradebookTotals(); assert.equal(frontend.gradebookAverage.textContent, '6,00');
  assert.equal(frontend.gradebookStatus.textContent, 'Aprovado');
  year.value = '2026'; frontend.exportApprovedCsv();
  const csv = await exported.text();
  assert(csv.includes('2026 - 1º semestre'));
  assert(!csv.includes('2025 - 1º semestre'));
  assert(!csv.includes('2026 - 2º semestre'));
  const saved = records.find(record => record.period === '2026 - 1º semestre');
  await post({ ...saved, notes:'Atualização fictícia' });
  records = (await (await get()).json()).records;
  assert.equal(records.length, 3, 'Existing API replaces the period record, never creates version history');
  assert.equal(records.find(record => record.period === saved.period).notes, 'Atualização fictícia');
  assert.equal(records.find(record => record.period === '2025 - 1º semestre').notes, 'Somente teste em memória');
  sqlite.prepare('INSERT INTO enrollments VALUES (?,?)').run('fixture', JSON.stringify({ id:'fixture',fullName:'Aluno fictício',grade:'CFO' }));
  access = { role:'professor',userId:'teacher-fixture',scopes:[{ course:'CFO',module:'Teologia basica' }] };
  assert.equal((await post({ enrollmentId:'fixture',period:'2026 - 2º semestre',moduleName:'Outro módulo',grade:8 })).status, 403);
  assert.equal((await post({ enrollmentId:'fixture',period:'2026 - 2º semestre',moduleName:'Teologia basica',grade:6 })).status, 201);
  records = (await (await get()).json()).records;
  assert.equal(records.find(record => record.period === '2026 - 2º semestre').status, 'Aprovado', 'Confirmed institutional approval average is 6');
  for (const average of [5.99, 6, 6.01]) {
    const response = await post({ enrollmentId:'fixture',period:'2099 - 1º semestre',moduleName:'Teologia basica',grade:average,
      average:100,status:'Aprovado' });
    assert.equal(response.status, 201);
    const record = (await response.json()).record;
    assert.equal(record.average, average, 'Teacher average must still be computed from module grades');
    assert.equal(record.status, average >= 6 ? 'Aprovado' : 'Em andamento');
    frontend.getGradebookModules = () => [average,average,average].map(total => ({total}));
    frontend.updateGradebookTotals();
    assert.equal(frontend.gradebookStatus.textContent === 'Aprovado', average >= 6, 'Frontend and backend approval boundary must agree');
  }
  access = { role:'professor',scopes:[{ course:'ALFA' }] };
  assert.equal((await (await get()).json()).records.length, 0);
  access = null; assert.equal((await get()).status, 401); assert.equal((await post({})).status, 401);
  sqlite.close();
  console.log('PASS: gradebook persistence, exact year/semester isolation, overwrite without version history, display-only accents, existing calculations and permission scopes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
