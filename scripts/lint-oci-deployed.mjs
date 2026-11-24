import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { chain, hash, publicClient } from './oci-runtime.mjs';

await chain();
const deployment = JSON.parse(await readFile('public/deployment.json'));
const source = await readFile(deployment.source);
const raw = await publicClient.request({method:'gen_getContractCode',params:[deployment.address]});
const remote = Buffer.from(raw,'base64');
assert.deepEqual(remote,source);
const digest = hash(remote);
assert.equal(digest,deployment.sourceSha256);
const runner = source.toString('utf8').split('\n')[0];
const directory = await mkdtemp(join(tmpdir(),'genvm-source-'));
try {
  const file = join(directory,basename(deployment.source));
  await writeFile(file,remote);
  const linter = process.env.GENVM_LINT ?? 'genvm-lint';
  const version = spawnSync(linter,['--version'],{encoding:'utf8'});
  if (version.error) throw version.error;
  assert.equal(version.status,0,version.stderr);
  const checks = spawnSync(linter,['check',file,'--json'],{encoding:'utf8'});
  if (checks.error) throw checks.error;
  console.log(JSON.stringify({
    address:deployment.address, chainId:61999, localSource:deployment.source,
    deploymentTransaction:deployment.transaction, deployedSourceSha256:digest,
    localSourceSha256:hash(source), sourceMatches:true, sdkDeclaration:runner,
    command:'genvm-lint check <byte-for-byte deployed source> --json',
    tool:version.stdout.trim(), exitCode:checks.status,
    output:JSON.parse(checks.stdout),
    ...(checks.stderr ? {stderr:checks.stderr} : {}),
  },null,2));
  assert.equal(checks.status,0);
  const output = JSON.parse(checks.stdout);
  assert(output.ok && output.lint.ok && output.validate.ok);
} finally {
  await rm(directory,{recursive:true,force:true});
}
