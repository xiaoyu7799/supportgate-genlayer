import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {checkApproval,checkProof,sha256} from '../scripts/oci-proof.mjs';

const folder=new URL('../evidence/oci/builds/',import.meta.url);
const load=path=>readFile(new URL(path,folder));
const [subject,proof,substitute] = await Promise.all([
  load('billing-rc2/manifest.json'),load('billing-rc2/proof.json'),load('billing-rc1/manifest.json'),
]);

test('reject substituted bytes and an unrelated base layer',()=>{
  assert.throws(()=>checkProof(substitute,proof),/subject manifest digest differs/);
  const replaced=JSON.parse(subject);
  replaced.layers[0].digest='sha256:'+'0'.repeat(64);
  const bytes=Buffer.from(JSON.stringify(replaced));
  const lying=Buffer.from(JSON.stringify({...JSON.parse(proof),subject_sha256:sha256(bytes)}));
  assert.throws(()=>checkProof(bytes,lying),/pinned base layers/);
});

test('pipeline pins release owner, builder, base and proof digest',()=>{
  const p=checkProof(subject,proof);
  const policy={application:'Billing API',environment:'production',releaseOwner:'owner',trustedBuilder:'builder',
    ubuntuBases:{[p.base_sha256]:'noble'}};
  const ticket={state:'RELEASED',source:{supported:true},checked_at:100,application:policy.application,
    environment:policy.environment,owner:'owner',codename:'noble',artifact_sha256:p.subject_sha256,
    provenance:{base_sha256:p.base_sha256,proof_sha256:p.proof_sha256,builder:'builder',attested_at:80}};
  checkApproval(ticket,p,policy,101);
  assert.throws(()=>checkApproval({...ticket,owner:'different'},p,policy,101),/release owner/);
  assert.throws(()=>checkApproval(ticket,p,{...policy,trustedBuilder:'other'},101),/builder/);
  assert.throws(()=>checkApproval(ticket,p,{...policy,ubuntuBases:{}},101),/not pinned/);
  assert.throws(()=>checkApproval(ticket,p,policy,86501),/older than/);
});
