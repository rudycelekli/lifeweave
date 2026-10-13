#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  node: { type: 'string' }, 'node-license': { type: 'string' },
  'local-qa-only': { type: 'boolean', default: false }
}});
if (process.platform !== 'darwin') throw new Error('The native desktop shell currently builds only on macOS.');
if (!values.node) throw new Error('Supply --node /absolute/path/to/node; no runtime is silently downloaded.');
if (!path.isAbsolute(values.node)) throw new Error('--node must be an absolute executable path.');
if (!values['node-license'] && !values['local-qa-only']) {
  throw new Error('Supply matching full Node license notices with --node-license, or mark the build --local-qa-only.');
}
if (values['node-license'] && !path.isAbsolute(values['node-license'])) {
  throw new Error('--node-license must be an absolute path.');
}

async function run(command, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve(stdout.trim())
      : reject(new Error(`${path.basename(command)} failed (${code}): ${stderr.slice(-12000)}`)));
  });
}

const nodeInfo = JSON.parse(await run(values.node, ['-p',
  'JSON.stringify({version:process.version,arch:process.arch,platform:process.platform})'],
  { env: { PATH: '/usr/bin:/bin' } }));
if (nodeInfo.platform !== 'darwin' || !['arm64', 'x64'].includes(nodeInfo.arch)
  || Number(nodeInfo.version.split('.')[0].slice(1)) < 22) {
  throw new Error('Supply a macOS arm64/x64 Node 22+ runtime compatible with this machine.');
}

const macho = await run('/usr/bin/otool', ['-l', values.node]);
const runtimeMinimum = macho.match(/cmd LC_BUILD_VERSION[\s\S]*?\n\s*minos ([\d.]+)/)?.[1]
  || macho.match(/cmd LC_VERSION_MIN_MACOSX[\s\S]*?\n\s*version ([\d.]+)/)?.[1];
if (!runtimeMinimum) throw new Error('Cannot verify the supplied Node runtime minimum macOS version.');
const versionParts = value => value.split('.').map(Number);
const compareVersion = (a, b) => {
  const av = versionParts(a), bv = versionParts(b);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    if ((av[i] || 0) !== (bv[i] || 0)) return (av[i] || 0) - (bv[i] || 0);
  }
  return 0;
};
const minimumMacOS = compareVersion(runtimeMinimum, '13.0') > 0 ? runtimeMinimum : '13.0';

// Exact allowlist: code/UI trees and one public research artifact. Never copy the repository root.
const PUBLIC_WEB_FILES = ['apps/web/server.mjs', 'apps/web/index.html', 'apps/web/app.mjs',
  'apps/web/app.css', 'apps/web/icon.svg', 'apps/web/manifest.json', 'apps/web/sw.js'];
const PUBLIC_PACKAGES = ['packages/core', 'packages/ui', 'packages/connectors'];
const PUBLIC_TREES = PUBLIC_PACKAGES.map(name => `${name}/src`);
const PACKAGE_ROOT_FILES = ['package.json', 'README.md', 'LICENSE'];
const REQUIRED = [...PUBLIC_WEB_FILES, 'packages/core/src/index.mjs',
  'packages/ui/src/index.mjs', 'packages/connectors/src/index.mjs', 'docs/research/comparison.json'];
const EXTENSIONS = new Set(['.mjs', '.js', '.css', '.svg', '.ts', '.png', '.woff2']);
const EXCLUDED = new Set(['node_modules', 'dist', 'build', 'coverage', '__tests__', 'test', 'tests', 'fixtures']);
const SECRET_NAME = /(secret|credential|candidate-goals|personal-model|\.pem$|\.key$)/i;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
for (const relative of REQUIRED) {
  const stat = await fs.lstat(path.join(ROOT, relative)).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error(`Required public file missing or unsafe: ${relative}`);
}

const outDir = path.join(ROOT, 'dist/desktop');
const scratch = path.join(outDir, `.build-${process.pid}-${crypto.randomUUID()}`);
const app = path.join(scratch, 'Lifeweave.app');
const contents = path.join(app, 'Contents');
const resources = path.join(contents, 'Resources');
const site = path.join(resources, 'site');
const runtime = path.join(resources, 'runtime');
const macOS = path.join(contents, 'MacOS');
const files = [];
await fs.mkdir(site, { recursive: true }); await fs.mkdir(runtime, { recursive: true });
await fs.mkdir(macOS, { recursive: true });
let succeeded = false;

async function copyPublicFile(relative) {
  const input = path.join(ROOT, relative), output = path.join(site, relative);
  const stat = await fs.lstat(input);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Refusing nonregular public file: ${relative}`);
  const data = await fs.readFile(input);
  await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, data, { mode: 0o644 });
  files.push({ path: `site/${relative}`, bytes: data.length, sha256: hash(data) });
}

async function copyTree(relative) {
  const stat = await fs.lstat(path.join(ROOT, relative));
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing an unsafe public tree: ${relative}`);
  for (const item of await fs.readdir(path.join(ROOT, relative), { withFileTypes: true })) {
    const next = `${relative}/${item.name}`;
    if (item.isSymbolicLink()) throw new Error(`Refusing a symlink in public source: ${next}`);
    if (item.name.startsWith('.') || EXCLUDED.has(item.name) || SECRET_NAME.test(item.name)) continue;
    if (item.isDirectory()) await copyTree(next);
    else if (item.isFile() && (EXTENSIONS.has(path.extname(item.name)) || item.name === 'LICENSE')) await copyPublicFile(next);
  }
}

try {
  for (const directory of ['apps/web', ...PUBLIC_PACKAGES]) {
    const stat = await fs.lstat(path.join(ROOT, directory));
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Refusing an unsafe public directory: ${directory}`);
  }
  for (const file of PUBLIC_WEB_FILES) await copyPublicFile(file);
  for (const tree of PUBLIC_TREES) await copyTree(tree);
  for (const packageName of PUBLIC_PACKAGES) {
    for (const filename of PACKAGE_ROOT_FILES) {
      const relative = `${packageName}/${filename}`;
      if (await fs.lstat(path.join(ROOT, relative)).then(stat => stat.isFile() || stat.isSymbolicLink()).catch(() => false)) {
        await copyPublicFile(relative);
      }
    }
  }
  await copyPublicFile('docs/research/comparison.json');
  // The sole generated symlink resolves only to an already copied public package.
  const moduleDirectory = path.join(site, 'node_modules/@lifeweave');
  await fs.mkdir(moduleDirectory, { recursive: true });
  await fs.symlink('../../packages/core', path.join(moduleDirectory, 'core'));
  const packageTarget = await fs.realpath(path.join(moduleDirectory, 'core'));
  if (packageTarget !== path.join(site, 'packages/core')) throw new Error('Generated core link escaped its public package.');
  for (const license of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md']) {
    if (await fs.stat(path.join(ROOT, license)).then(stat => stat.isFile()).catch(() => false)) await copyPublicFile(license);
  }
  const suppliedNode = await fs.readFile(values.node);
  await fs.writeFile(path.join(runtime, 'node'), suppliedNode, { mode: 0o755 });
  const nodeReceipt = { ...nodeInfo, sourceSha256: hash(suppliedNode), bytes: suppliedNode.length,
    license: values['node-license'] ? 'supplied-matching-notices-require-release-review' : 'missing-local-qa-only' };
  if (values['node-license']) {
    const notices = await fs.readFile(values['node-license']);
    if (!notices.toString().includes('Node.js') || notices.length < 2000) throw new Error('Expected the complete Node notice file.');
    await fs.writeFile(path.join(runtime, 'Node-LICENSE'), notices);
    nodeReceipt.licenseSha256 = hash(notices);
    nodeReceipt.licenseFile = 'runtime/Node-LICENSE';
  } else {
    await fs.writeFile(path.join(resources, 'LOCAL_QA_ONLY.txt'),
      'Local QA only: the supplied Node runtime has no retained license notices. Do not distribute this artifact.\n');
  }
  const plist = (await fs.readFile(path.join(ROOT, 'apps/desktop/Info.plist'), 'utf8')).replace(
    /(<key>LSMinimumSystemVersion<\/key><string>)[^<]+(<\/string>)/, `$1${minimumMacOS}$2`);
  await fs.writeFile(path.join(contents, 'Info.plist'), plist);
  const executable = path.join(macOS, 'Lifeweave');
  const architecture = nodeInfo.arch === 'x64' ? 'x86_64' : 'arm64';
  const compiler = await run('/usr/bin/xcrun', ['swiftc', '--version']);
  const cache = path.join(scratch, 'swift-cache');
  await fs.mkdir(cache, { recursive: true });
  await run('/usr/bin/xcrun', ['swiftc', '-parse-as-library', '-swift-version', '5', '-O', '-target', `${architecture}-apple-macos13.0`,
    '-module-cache-path', cache, '-framework', 'AppKit', '-framework', 'WebKit',
    path.join(ROOT, 'apps/desktop/Lifeweave.swift'), '-o', executable],
    { env: { ...process.env, CLANG_MODULE_CACHE_PATH: cache } });
  await run('/usr/bin/codesign', ['--force', '--sign', '-', path.join(runtime, 'node')]);
  nodeReceipt.sha256 = hash(await fs.readFile(path.join(runtime, 'node')));
  await run('/usr/bin/codesign', ['--force', '--sign', '-', app]);
  await run('/usr/bin/codesign', ['--verify', '--strict', app]);
  const boundary = JSON.parse(await run(executable, ['--self-test']));
  if (!boundary.passed) throw new Error('Native loopback boundary checks failed.');
  const manifest = { version: 1, createdAt: new Date().toISOString(), platform: 'macos', architecture,
    compiler, minimumMacOS, node: { ...nodeReceipt, minimumMacOS: runtimeMinimum }, codeSigning: 'ad-hoc-local-qa', notarized: false, appStoreAccepted: false,
    distributionReady: false, distributionGates: ['Artifact security and dependency review',
      'Node runtime provenance and matching complete notice review', 'Developer ID signing and notarization',
      'Architecture and interactive WebKit/accessibility validation', 'Release authorization'],
    whitelist: [...PUBLIC_WEB_FILES, ...PUBLIC_TREES,
      ...PUBLIC_PACKAGES.flatMap(name => PACKAGE_ROOT_FILES.map(filename => `${name}/${filename}`)),
      'docs/research/comparison.json'], excludedPrivateData: true,
    generatedLinks: [{ path: 'site/node_modules/@lifeweave/core', target: '../../packages/core' }],
    bridge: false, externalNavigation: false, fileAccess: false, originBoundaryTest: boundary, files };
  // Manifest must be present before the final ad-hoc signature seals bundle resources.
  await fs.writeFile(path.join(resources, 'desktop-build.json'), JSON.stringify(manifest, null, 2));
  await run('/usr/bin/codesign', ['--force', '--sign', '-', app]);
  await run('/usr/bin/codesign', ['--verify', '--strict', app]);
  const target = path.join(outDir, 'Lifeweave.app');
  await fs.rm(target, { recursive: true, force: true }); await fs.rename(app, target);
  await fs.writeFile(path.join(outDir, 'desktop-build.json'), JSON.stringify(manifest, null, 2));
  succeeded = true;
  console.log(JSON.stringify({ event: 'lifeweave.desktop.built', app: target, architecture,
    node: nodeInfo.version, publicFiles: files.length, privateFiles: 0,
    localQAOnly: true, runtimeLicenseGate: !values['node-license'], minimumMacOS, signed: 'ad-hoc', notarized: false }));
} finally {
  await fs.rm(scratch, { recursive: true, force: true });
  if (!succeeded) console.error('Desktop build stopped; the previous app, if any, was retained until final replacement.');
}
