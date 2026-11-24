import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {encode,read,verifyRun} from './oci-runtime.mjs';
import {checkApproval,checkProof} from './oci-proof.mjs';

const {log,verified}=await verifyRun();
const errors={
 'unattested/reject-owner':'BUILDER_ONLY',
 'unattested/reject-subject':'BUILD_MISMATCH',
 'unattested/evaluate':'BUILD_ATTESTATION_REQUIRED',
 'retired/reject-release':'NOT_READY',
};
for(const [tag,error] of Object.entries(errors)) assert.equal(verified.find(tx=>tx.tag===tag)?.contractError,error,tag);
const records=await Promise.all(Object.values(log.snapshots).map(ticket=>read(log.address,'get_ticket',[ticket.id])));
assert.equal(records.length,6);
for(const observed of records) assert.deepEqual(observed,log.snapshots[observed.reference]);
assert.equal(log.snapshots['billing-rc1'].superseded_by,log.snapshots['billing-rc2'].id);
assert.equal(log.snapshots.retired.source.supported,false);
const dir='evidence/oci/builds/';
const [manifest,proof,oldManifest,policy]=await Promise.all([
 readFile(dir+'billing-rc2/manifest.json'),readFile(dir+'billing-rc2/proof.json'),
 readFile(dir+'billing-rc1/manifest.json'),readFile('evidence/oci/demo-policy.json','utf8').then(JSON.parse),
]);
const ticket=log.snapshots['billing-rc2'];
assert.equal(policy.contract,log.address);
checkApproval(ticket,checkProof(manifest,proof),policy);
assert.throws(()=>checkProof(oldManifest,proof),/subject manifest digest differs/);
const oldProof=await readFile(dir+'billing-rc1/proof.json');
assert.throws(()=>checkApproval(log.snapshots['billing-rc1'],checkProof(oldManifest,oldProof),policy),/approval missing/);
const lint=JSON.parse(await readFile('evidence/oci/lint-deployed.json'));
assert.equal(lint.deployedSourceSha256,log.sourceSha256);
assert.equal(lint.exitCode,0);
assert(lint.output.lint.ok&&lint.output.validate.ok);
await writeFile('evidence/oci/verification.json',encode({
 verifiedAt:new Date(),chainId:61999,address:log.address,sourceSha256:log.sourceSha256,
 sourceMatches:true,transactions:verified,records,
 gate:{approved:ticket.id,substitutedImage:'DENIED',supersededTicket:'DENIED'}
})+'\n');
