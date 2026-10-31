const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('secretaria.html', 'utf8');
function sourceOf(name) {
  const start = html.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  return html.slice(start, html.indexOf('\n}', start) + 2);
}
const nodes = new Map();
const element = () => ({textContent: '', classList: {add() {}, remove() {}}});
const fields = {
  id: {value: 'fake-one'}, fullName: {value: 'Primeiro aluno fictício'},
  grade: {value: 'CFO'}, enrollmentPeriod: {value: '2026 - 2º semestre'},
  declarationAccepted: {checked: false, dataset: {acceptedDate: ''}},
};
let prints = 0, alerts = 0;
const records = [{id: 'fake-one'}, {id: 'fake-two'}];
const context = vm.createContext({
  fields, enrollments: records, Intl, Date, declarationPrintInfo: element(),
  document: {querySelector(selector) {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  }},
  formatDate: value => value,
  window: {print() {prints++;}}, alert() {alerts++;},
});
vm.runInContext(sourceOf('updateDeclarationPrintInfo') + '\n' + sourceOf('printForm'), context);
for (const [accepted, date] of [[false, ''], [true, '2025-03-04'], [true, '']]) {
  fields.declarationAccepted.checked = accepted;
  fields.declarationAccepted.dataset.acceptedDate = date;
  const originalFields = JSON.stringify(fields);
  const originalRecords = JSON.stringify(records);
  context.printForm();
  assert.equal(JSON.stringify(fields), originalFields, 'Printing never modifies form data or acceptance');
  assert.equal(JSON.stringify(records), originalRecords, 'Printing never modifies a registration');
}
assert.equal(prints, 3);
assert.equal(nodes.get('#termStudentName').textContent, 'Primeiro aluno fictício');
fields.id.value = 'fake-two';
fields.fullName.value = 'Segundo aluno fictício';
fields.grade.value = 'CAPELANIA';
fields.enrollmentPeriod.value = '2025 - 1º semestre';
context.printForm();
assert.equal(nodes.get('#termStudentName').textContent, fields.fullName.value);
assert.equal(nodes.get('#termStudentCourse').textContent, fields.grade.value);
assert.equal(nodes.get('#termEnrollmentPeriod').textContent, fields.enrollmentPeriod.value);
for (const id of ['', 'unknown-student']) {
  fields.id.value = id;
  context.printForm();
}
assert.equal(prints, 4, 'Missing or unknown selection cannot print');
assert.equal(alerts, 2);
context.updateDeclarationPrintInfo();
assert.equal(nodes.get('#termStudentName').textContent, '-', 'No stale name after clearing selection');
assert.match(nodes.get('#termEmissionDate').textContent, /^Manaus, \d{1,2} de .+ de \d{4}\.$/);
console.log('PASS: printing preserves acceptance, dates, fields and records; selected student/period synchronization; invalid selection blocked; no stale identification.');
