import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..'), dist = path.join(root, 'dist');
const manifestBytes = await fs.readFile(path.join(dist, 'release-manifest.json'));
const original = JSON.parse(manifestBytes);
const verifierBytes = await fs.readFile(path.join(root, 'scripts/verify-packed.mjs'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'lifeweave-packed-negative-'));
const experiments = [];

function tar(args) {
  const result = spawnSync('tar', args, { encoding: 'utf8', timeout: 30000, maxBuffer: 2000000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Temporary tar operation failed');
}
async function seed(name) {
  const fixture = path.join(temp, name);
  await fs.mkdir(path.join(fixture, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(fixture, 'dist'), { recursive: true });
  await fs.writeFile(path.join(fixture, 'scripts/verify-packed.mjs'), verifierBytes);
  await fs.writeFile(path.join(fixture, 'dist/release-manifest.json'), manifestBytes);
  for (const artifact of [original.source, ...original.packages]) {
    const bytes = await fs.readFile(path.join(dist, artifact.name));
    assert.equal(hash(bytes), artifact.sha256, 'Canonical input changed while preparing a temporary evaluator fixture');
    await fs.writeFile(path.join(fixture, 'dist', artifact.name), bytes);
  }
  return fixture;
}
function runVerifier(fixture) {
  const result = spawnSync(process.execPath, [path.join(fixture, 'scripts/verify-packed.mjs')], {
    cwd: fixture, encoding: 'utf8', timeout: 30000, maxBuffer: 2000000
  });
  assert.equal(result.error, undefined, 'Verifier must finish normally, rather than time out or fail to start');
  assert.equal(result.signal, null, 'Verifier must reject through an ordinary exit, not a signal');
  return result;
}
async function unpack(fixture, artifact, name) {
  const target = path.join(fixture, name);
  await fs.mkdir(target, { recursive: true });
  tar(['-xzf', path.join(fixture, 'dist', artifact.name), '-C', target]);
  return target;
}
async function repack(fixture, target, name, artifact) {
  tar(['-czf', path.join(fixture, 'dist', artifact.name), '-C', target, name]);
  artifact.sha256 = hash(await fs.readFile(path.join(fixture, 'dist', artifact.name)));
}
async function rejectMutant(id, expected, mutate) {
  const fixture = await seed(id), manifest = structuredClone(original);
  await mutate(fixture, manifest);
  await fs.writeFile(path.join(fixture, 'dist/release-manifest.json'), JSON.stringify(manifest, null, 2));
  const result = runVerifier(fixture);
  assert.notEqual(result.status, 0, `${id}: mutant must not pass packed verification`);
  assert.match(result.stderr, /AssertionError/, `${id}: rejection must come from a verifier assertion`);
  assert.match(result.stderr, expected, `${id}: rejection must match its intended defect, rather than an unrelated error`);
  if (id === 'same-generation-broken-public-export') assert.match(result.stderr, /ERR_MODULE_NOT_FOUND/, 'Broken export must fail module resolution for the named missing entrypoint');
  experiments.push({ id, status: 'rejected-as-expected', verifierExitCode: result.status, expectedReason: expected.source });
}

try {
  // Positive control runs the same copied verifier and unmodified packaged bytes.
  // Its temporary packed receipt cannot overwrite the canonical release receipt.
  const baselineFixture = await seed('baseline'), baselineResult = runVerifier(baselineFixture);
  assert.equal(baselineResult.status, 0, baselineResult.stderr || 'Unmodified packed baseline must pass');
  const baseline = JSON.parse(await fs.readFile(path.join(baselineFixture, 'dist/packed-verification.json'), 'utf8'));
  assert.equal(baseline.status, 'passed');

  await rejectMutant('unlisted-source-file', /Extracted source must equal the manifest allowlist/, async (fixture, manifest) => {
    const unpacked = await unpack(fixture, manifest.source, 'source-mutation');
    // Place the extra file outside the expected root, so this tests the entire
    // archive rather than only descendants of the legitimate lifeweave tree.
    await fs.writeFile(path.join(unpacked, 'unlisted-negative-test.txt'), 'Synthetic evaluator test: this archive sibling is absent from the manifest.\n');
    await repack(fixture, unpacked, '.', manifest.source);
  });

  await rejectMutant('sdk-source-byte-mismatch', /SDK bytes must match source generation/, async (fixture, manifest) => {
    const core = manifest.packages.find(artifact => /^lifeweave-core-/.test(artifact.name));
    assert.ok(core, 'Core archive is required for this evaluator experiment');
    const unpacked = await unpack(fixture, core, 'sdk-mutation');
    await fs.appendFile(path.join(unpacked, 'package/src/index.mjs'), '\n// Synthetic changed SDK byte; source generation is unchanged.\n');
    await repack(fixture, unpacked, 'package', core);
  });

  await rejectMutant('same-generation-broken-public-export', /missing-negative-entrypoint\.mjs/, async (fixture, manifest) => {
    const core = manifest.packages.find(artifact => /^lifeweave-core-/.test(artifact.name));
    assert.ok(core, 'Core archive is required for this evaluator experiment');
    const source = await unpack(fixture, manifest.source, 'source-mutation'), sdk = await unpack(fixture, core, 'sdk-mutation');
    const relative = 'packages/core/package.json', sourceFile = path.join(source, 'lifeweave', relative);
    const metadata = JSON.parse(await fs.readFile(sourceFile, 'utf8'));
    metadata.exports['.'].import = './missing-negative-entrypoint.mjs';
    const bytes = Buffer.from(JSON.stringify(metadata, null, 2) + '\n');
    await fs.writeFile(sourceFile, bytes);
    await fs.writeFile(path.join(sdk, 'package/package.json'), bytes);
    const item = manifest.files.find(file => file.path === relative);
    assert.ok(item, 'Source manifest must cover core package metadata');
    item.sha256 = hash(bytes); item.bytes = bytes.length;
    await repack(fixture, source, 'lifeweave', manifest.source);
    await repack(fixture, sdk, 'package', core);
  });

  assert.equal(experiments.length, 3);
  const receipt = { version: 1, at: new Date().toISOString(), status: 'passed', release: original.releaseVersion,
    verifierSha256: hash(verifierBytes), harnessSha256: hash(await fs.readFile(new URL(import.meta.url))), sourceArchive: original.source,
    baseline: { status: baseline.status, checks: baseline.checkCount },
    experiments, experimentCount: experiments.length, fixture: 'temporary-public-artifact-mutants', canonicalArtifactsModified: false,
    providerCalls: 0, externalActions: 0,
    limits: 'Three targeted negative controls plus an unmodified positive control; not exhaustive adversarial assurance or production qualification.' };
  await fs.writeFile(path.join(dist, 'packed-negative-verification.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify({ status: 'passed', experiments: experiments.length, baselineChecks: baseline.checkCount, release: original.releaseVersion }));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
