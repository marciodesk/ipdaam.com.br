const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {buildPages} = require('../scripts/build-pages.cjs');
const root = path.resolve(__dirname, '..');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'scripts/pages-files.json'), 'utf8'));
const first = buildPages(root);
const snapshot = fs.readFileSync(path.join(first.output, 'manifest.json'));
buildPages(root);
assert(fs.readFileSync(path.join(first.output, 'manifest.json')).equals(snapshot), 'Repeated build must be byte-identical');
assert.equal(first.publicFiles, 33);
assert.equal(first.functionFiles, 14);
assert.equal(first.imports, 13);
assert.equal(first.references, 89);
for (const entry of first.manifest.files) {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(first.output, entry.name))).digest('hex'), entry.sha256);
  assert(!/^public\/(?:functions|migrations|tests|scripts|\.git|\.wrangler)\//.test(entry.name));
}

// All mutations below affect disposable fixtures under ignored build/, never application sources.
const fixture = fs.mkdtempSync(path.join(root, 'build', 'package-tests-'));
for (const name of ['scripts/pages-files.json', ...policy.public, ...policy.functions]) {
  const target = path.join(fixture, name);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.copyFileSync(path.join(root, name), target);
}
const policyFile = path.join(fixture, 'scripts/pages-files.json');
const savePolicy = value => fs.writeFileSync(policyFile, JSON.stringify(value));
const privateText = 'FICTIONAL_PRIVATE_PACKAGE_TEST_SENTINEL';
for (const name of ['.dev.vars', 'dev.vars', '.env', 'wrangler.local.toml', 'exports/students.sql', 'backups/local.db', 'tests/private.txt', 'internal.md']) {
  fs.mkdirSync(path.dirname(path.join(fixture, name)), {recursive:true});
  fs.writeFileSync(path.join(fixture, name), privateText);
}
const generated = buildPages(fixture);
assert(fs.readFileSync(path.join(generated.output, 'manifest.json')).equals(snapshot));
for (const entry of generated.manifest.files) assert(!fs.readFileSync(path.join(generated.output, entry.name)).includes(Buffer.from(privateText)));

// LF and CRLF checkouts produce exactly the same output, including server sources.
for (const name of [...policy.public, ...policy.functions].filter(n => /\.(?:html|css|js)$/.test(n) || ['CNAME', '_headers'].includes(n))) {
  const file = path.join(fixture, name);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
}
buildPages(fixture);
assert(fs.readFileSync(path.join(generated.output, 'manifest.json')).equals(snapshot), 'Line-ending independent build');

for (const forbidden of ['exports/students.sql', 'internal.md', '.dev.vars', '../.dev.vars', 'functions/api/_auth.js']) {
  savePolicy({...policy, public:[...policy.public, forbidden]});
  assert.throws(() => buildPages(fixture), /Forbidden|Unsafe/, forbidden);
}
savePolicy({...policy, public:[...policy.public, policy.public[0]]});
assert.throws(() => buildPages(fixture), /Duplicate/);
savePolicy(policy);

const htmlFile = path.join(fixture, 'index.html'), html = fs.readFileSync(htmlFile);
fs.appendFileSync(htmlFile, '<img src="/assets/not-reviewed.png">');
assert.throws(() => buildPages(fixture), /Missing public reference/);
fs.writeFileSync(htmlFile, html);
const apiFile = path.join(fixture, 'functions/api/declarations/index.js'), api = fs.readFileSync(apiFile);
fs.appendFileSync(apiFile, '\nimport missing from "./missing.js";');
assert.throws(() => buildPages(fixture), /Missing Function import/);
fs.writeFileSync(apiFile, api);
const asset = path.join(fixture, 'assets/declaracoes.css'), css = fs.readFileSync(asset);
fs.unlinkSync(asset);
assert.throws(() => buildPages(fixture), /Missing source/);
fs.writeFileSync(asset, css);
const extraFunction = path.join(fixture, 'functions/api/unreviewed.js');
fs.writeFileSync(extraFunction, 'export function onRequest() {}');
assert.throws(() => buildPages(fixture), /Functions tree differs/);
fs.unlinkSync(extraFunction);

const extraOutput = path.join(generated.output, 'public/students.sql');
fs.writeFileSync(extraOutput, privateText);
assert.throws(() => buildPages(fixture), /Unexpected output/);
assert.equal(fs.readFileSync(extraOutput, 'utf8'), privateText, 'Refusal must never delete unknown files');
fs.unlinkSync(extraOutput);

const linked = path.join(fixture, 'assets/linked-logo');
fs.symlinkSync(path.join(fixture, 'assets/logo'), linked, process.platform === 'win32' ? 'junction' : 'dir');
savePolicy({...policy, public:[...policy.public, 'assets/linked-logo/etda.png']});
assert.throws(() => buildPages(fixture), /Symbolic links/);
savePolicy(policy);
buildPages(fixture);
assert(fs.readFileSync(path.join(generated.output, 'manifest.json')).equals(snapshot));

const unowned = fs.mkdtempSync(path.join(root, 'build', 'unowned-tests-'));
for (const name of ['scripts/pages-files.json', ...policy.public, ...policy.functions]) {
  const target = path.join(unowned, name);
  fs.mkdirSync(path.dirname(target), {recursive:true});
  fs.copyFileSync(path.join(root, name), target);
}
fs.mkdirSync(path.join(unowned, 'build/pages'), {recursive:true});
assert.throws(() => buildPages(unowned), /Unowned output/);
console.log('PASS: 47 reviewed files; SHA-256 integrity; deterministic repeated/LF/CRLF builds; private-file exclusion; traversal/duplicate/symlink rejection; missing asset/import/reference checks; unreviewed Functions and stale/unowned outputs refused without recursive deletion.');
