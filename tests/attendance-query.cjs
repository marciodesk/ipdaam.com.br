const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const sqlite = new DatabaseSync(':memory:');
let access = { role: 'admin' };
const db = {
  prepare(sql) {
    let binds = [];
    const statement = {
      bind(...values) { binds = values; return statement; },
      async run() { return sqlite.prepare(sql).run(...binds); },
      async all() { return { results: sqlite.prepare(sql).all(...binds) }; },
      async first() { return sqlite.prepare(sql).get(...binds); }
    };
    return statement;
  },
  batch(statements) { return Promise.all(statements.map(statement => statement.all())); }
};
const source = fs.readFileSync('functions/api/attendance/index.js', 'utf8')
  .replace(/^import .*;\r?\n/, '').replaceAll('export async function', 'async function');
const context = { getAccess: async () => access, Response, URL, env: { DB: db } };
vm.createContext(context);
vm.runInContext(source, context);
async function get(query) {
  const response = await context.onRequestGet({ request: { url: 'https://test/api/attendance?' + query }, env: { DB: db } });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
(async () => {
  await context.ensureAttendanceTable(db);
  const insert = sqlite.prepare('INSERT INTO attendance(id,enrollment_id,full_name,course,module,class_date,status,payload,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  for (let i = 0; i < 1205; i++) {
    const record = { id: String(i).padStart(5,'0'), enrollmentId: 'student-' + i, fullName: 'JOSÉ SILVA', course:'CFO', module:i % 2 ? 'A' : 'B', classDate:'2026-09-23', status:'Falta' };
    insert.run(record.id,record.enrollmentId,record.fullName,record.course,record.module,record.classDate,record.status,JSON.stringify(record),'2026-09-23 12:00:00');
  }
  for (let i=0;i<1205;i++) {
    const date=new Date(Date.UTC(2000,0,1+i)).toISOString().slice(0,10);
    const r={id:'h'+i,enrollmentId:'history',fullName:'History',course:'CFO',module:'A',classDate:date,status:'Falta'};
    insert.run(r.id,r.enrollmentId,r.fullName,r.course,r.module,date,r.status,JSON.stringify(r),date+' 12:00:00');
  }
  let cursor = null, count = 0;
  const ids = new Set();
  do {
    const params = new URLSearchParams({view:'page',date:'2026-09-23',limit:'50',q:'jose'});
    if (cursor) params.set('cursor',cursor);
    const page = await get(params);
    assert.equal(page.totals.total,1205);
    assert(page.records.length <= 50);
    page.records.forEach(row => { assert(!ids.has(row.id)); ids.add(row.id); count++; });
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(count,1205);
  const risk = await get('view=risk');
  assert.equal(risk.alerts.reduce((sum,row)=>sum+row.count,0),1205);
  assert(!('records' in risk));
  access = {role:'professor',scopes:[{course:'CFO',module:'A'}]};
  const scoped = await get('view=page&course=CFO&date=2026-09-23');
  assert.equal(scoped.totals.total,602);
  assert(scoped.records.every(row=>row.module==='A'));
  const scopedRisk = await get('view=risk&course=CFO&module=B');
  assert(scopedRisk.alerts.every(row=>row.module==='A'));
  access = {role:'professor',scopes:[]};
  assert.equal((await get('view=page')).totals.total,0);
  access = {role:'admin'};
  assert.equal((await get('date=2026-09-23')).records.length,300);
  const invalid = await context.onRequestGet({request:{url:'https://test/api/attendance?view=page&cursor=bad'},env:{DB:db}});
  assert.equal(invalid.status,400);
  console.log('PASS: 1205 rows, tied timestamps, complete cursor traversal, totals, accent search, full risk aggregation, scope isolation, legacy API and invalid cursor.');
  sqlite.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
