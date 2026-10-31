const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MARKER = '.ipdaam-generated';
const OWNER = 'IPDAAM Pages package v1\n';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = (name, bytes) => /\.(?:html|css|js)$/.test(name) || ['CNAME', '_headers'].includes(name)
  ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;

function requireSafeFile(root, name) {
  if (!name || name.includes('\\') || name.includes(':') || name.includes('\0') ||
      name.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Unsafe path: ' + name);
  let current = root;
  for (const part of name.split('/')) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) throw Error('Missing source: ' + name);
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Symbolic links are forbidden: ' + name);
  }
  if (!fs.statSync(current).isFile()) throw Error('Source must be a file: ' + name);
  return current;
}

function walk(root, dir = root) {
  if (fs.lstatSync(dir).isSymbolicLink()) throw Error('Symbolic links are forbidden: ' + dir);
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error('Symbolic links are forbidden: ' + full);
    return entry.isDirectory() ? walk(root, full) : [path.relative(root, full).split(path.sep).join('/')];
  });
}

function validateReferences(plan) {
  let references = 0, imports = 0;
  const hasPublic = target => plan.has('public/' + target) || plan.has('public/' + target + '.html') ||
    plan.has('public/' + path.posix.join(target, 'index.html'));
  for (const [name, bytes] of plan) {
    const source = bytes.toString('utf8');
    if (name.endsWith('.html') && name.startsWith('public/')) {
      for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        const ref = match[1];
        if (/^(?:[a-z]+:|\/\/|#)/i.test(ref) || ref.includes('${')) continue;
        const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
        if (!clean) continue;
        const target = clean.startsWith('/') ? path.posix.normalize(clean).slice(1)
          : path.posix.normalize(path.posix.join(path.posix.dirname(name.slice(7)), clean));
        if (!hasPublic(target)) throw Error('Missing public reference: ' + name + ' -> ' + ref);
        references++;
      }
    }
    if (name === 'public/_headers') {
      for (const match of source.matchAll(/Link:\s*<([^>]+)>/g)) {
        const target = match[1].split(/[?#]/)[0].replace(/^\//, '');
        if (!hasPublic(target)) throw Error('Missing header reference: ' + target);
        references++;
      }
    }
    if (name.startsWith('functions/') && name.endsWith('.js')) {
      for (const match of source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g)) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]));
        if (!plan.has(target)) throw Error('Missing Function import: ' + name + ' -> ' + match[1]);
        imports++;
      }
    }
  }
  return {references, imports};
}

function buildPages(root = path.resolve(__dirname, '..')) {
  root = fs.realpathSync(root);
  const policy = JSON.parse(fs.readFileSync(requireSafeFile(root, 'scripts/pages-files.json'), 'utf8'));
  if (policy.version !== 1 || !Array.isArray(policy.public) || !Array.isArray(policy.functions)) throw Error('Invalid allowlist');
  const plan = new Map();
  const blocked = /(?:^|\/)(?:\.[^/]*|node_modules|tests|scripts|migrations|backups|exports|tmp|temp)(?:\/|$)|(?:^|\/)(?:dev\.vars|wrangler[^/]*|tatus --short)$|\.(?:sql|md|json|jsonc|toml|ya?ml|db|sqlite\d*|bak|backup|log|pem|key)$/i;
  for (const [kind, names] of [['public', policy.public], ['functions', policy.functions]]) {
    const unique = new Set(names);
    if (unique.size !== names.length) throw Error('Duplicate allowlist entries');
    for (const name of names) {
      if (blocked.test(name) || (kind === 'functions' && (!name.startsWith('functions/') || !name.endsWith('.js'))) ||
          (kind === 'public' && !['CNAME', '_headers'].includes(name) &&
            !/^(?:[^/]+\.html|assets\/.*\.(?:css|js|svg|png|jpe?g|webp|ico|woff2?))$/.test(name))) throw Error('Forbidden allowlist entry: ' + name);
      const target = kind === 'public' ? 'public/' + name : name;
      if (plan.has(target)) throw Error('Duplicate target: ' + target);
      plan.set(target, canonical(name, fs.readFileSync(requireSafeFile(root, name))));
    }
  }
  const actualFunctions = walk(path.join(root, 'functions')).map(name => 'functions/' + name).sort();
  if (JSON.stringify(actualFunctions) !== JSON.stringify([...policy.functions].sort())) throw Error('Functions tree differs from reviewed allowlist');
  const checks = validateReferences(plan);
  const output = path.join(root, 'build', 'pages');
  // Refuse unknown output content instead of recursively deleting anything.
  if (fs.existsSync(path.join(root, 'build')) && fs.lstatSync(path.join(root, 'build')).isSymbolicLink()) throw Error('Symlink build directory');
  const permitted = new Set([...plan.keys(), 'manifest.json', MARKER]);
  if (fs.existsSync(output)) {
    if (fs.lstatSync(output).isSymbolicLink()) throw Error('Symlink output');
    const existingFiles = walk(output);
    if (!fs.existsSync(path.join(output, MARKER)) || fs.readFileSync(path.join(output, MARKER), 'utf8') !== OWNER) throw Error('Unowned output directory');
    for (const name of existingFiles) if (!permitted.has(name)) throw Error('Unexpected output file; review manually: ' + name);
  }
  const files = [...plan].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, bytes]) => ({name, sha256:hash(bytes), bytes:bytes.length}));
  fs.mkdirSync(output, {recursive:true});
  fs.writeFileSync(path.join(output, MARKER), OWNER);
  for (const [name, bytes] of plan) {
    fs.mkdirSync(path.dirname(path.join(output, name)), {recursive:true});
    fs.writeFileSync(path.join(output, name), bytes);
  }
  const manifest = {version:1, textEncoding:'UTF-8', lineEndings:'LF', files};
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  for (const entry of files) if (hash(fs.readFileSync(path.join(output, entry.name))) !== entry.sha256) throw Error('Output integrity failure: ' + entry.name);
  return {output, publicFiles:policy.public.length, functionFiles:policy.functions.length, ...checks, manifest};
}

module.exports = {buildPages, canonical, hash};
if (require.main === module) {
  try {
    const {manifest, ...result} = buildPages();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error('Build refused: ' + error.message); process.exitCode = 1; }
}
