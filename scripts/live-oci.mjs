import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {startRun,ensureDeployment,encode} from './oci-runtime.mjs';
import {checkProof} from './oci-proof.mjs';

const descriptions = [
 ['billing-rc1','Billing API','noble','production',0,1,'SUPERSEDED'],
 ['billing-rc2','Billing API','noble','production',0,1,'RELEASED'],
 ['indexer','Search Indexer','jammy','staging',1,2,'RELEASED'],
 ['retired','Legacy Worker','dapper','production',2,0,'BLOCKED'],
 ['unattested','Metrics Exporter','noble','staging',1,2,'PROPOSED'],
 ['withdrawn','Batch Scheduler','jammy','staging',2,0,'CANCELLED'],
];
const run = await startRun(3);
if (run.done) process.exit(0);
const address = await ensureDeployment(run);
const cases = await Promise.all(descriptions.map(async ([reference,application,code,env,owner,builder,state])=>{
 const folder = 'evidence/oci/builds/'+reference;
 const [manifest,proof] = await Promise.all([readFile(folder+'/manifest.json'),readFile(folder+'/proof.json')]);
 return {reference,application,code,env,owner,builder,state,id:run.accounts[owner].address.toLowerCase()+':'+reference,
  ...checkProof(manifest,proof)};
}));
const job = (caseIndex, label, method, args, role, expected) => {
 const c=cases[caseIndex];
 return run.operation(c.reference+'/'+label,method,args,c[role],expected);
};
const propose=i=>{
 const c=cases[i];
 return job(i,'propose','propose_oci',[c.reference,c.application,c.subject_sha256,c.code,c.env,c.base_sha256,
  run.accounts[c.builder].address.toLowerCase()],'owner');
};
const attest=(i,role='builder',tag='attest',mutated=false,expected='SUCCESS')=>{
 const c=cases[i];
 return job(i,tag,'attest_build',[c.id,mutated?'a'.repeat(64):c.subject_sha256,c.base_sha256,c.proof_sha256],role,expected);
};
const evaluate=(i,expected='SUCCESS')=>job(i,'evaluate','evaluate',[cases[i].id],'owner',expected);
const release=i=>job(i,'release','release',[cases[i].id,2],'owner');

await Promise.all([propose(0),propose(2),propose(3)]);
await Promise.all([propose(1),propose(4),propose(5)]);
await Promise.all([attest(0),attest(2),attest(3)]);
await Promise.all([evaluate(0),evaluate(2),evaluate(3)]);
await Promise.all([release(0),release(2),job(5,'cancel','cancel',[cases[5].id],'owner')]);
await Promise.all([attest(4,'owner','reject-owner',false,'FAILURE'),
 job(3,'reject-release','release',[cases[3].id,2],'owner','FAILURE')]);
await attest(1);
await Promise.all([evaluate(1),evaluate(4,'FAILURE'),attest(4,'builder','reject-subject',true,'FAILURE')]);
await release(1);
await job(0,'supersede','supersede',[cases[0].id,cases[1].id],'owner');
for (const c of cases) {
 const state=await run.snapshot(c.reference,'get_ticket',[c.id]);
 assert.equal(state.state,c.state);
 if (['RELEASED','SUPERSEDED','BLOCKED'].includes(c.state)) assert.equal(state.provenance.proof_sha256,c.proof_sha256);
}
const policy={chainId:61999,contract:address,releaseOwner:run.accounts[0].address.toLowerCase(),
 trustedBuilder:run.accounts[1].address.toLowerCase(),application:'Billing API',environment:'production',
 ubuntuBases:{[cases[1].base_sha256]:'noble',[cases[2].base_sha256]:'jammy'}};
await writeFile('evidence/oci/demo-policy.json',encode(policy)+'\n');
await run.finish();
