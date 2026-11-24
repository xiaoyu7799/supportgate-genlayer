import {createAccount,createClient,generatePrivateKey} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {readFile,writeFile,mkdir,chmod,readdir,rm,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
export const encode=value=>JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x,2);
export const hash=code=>createHash('sha256').update(code).digest('hex');
export const publicClient=createClient({chain:studionet});
async function deployedCode(address){return Buffer.from(await publicClient.request({method:"gen_getContractCode",params:[address]}),"base64").toString("utf8");}
export function leaderReceipt(tx) {
 const receipt = tx.consensus_data?.leader_receipt;
 return Array.isArray(receipt) ? receipt.find(entry => entry.mode === 'leader') ?? receipt[0] : receipt;
}
export function success(tx) {
 return leaderReceipt(tx)?.execution_result === 'SUCCESS';
}
export function failure(tx) {
 return ['ERROR', 'FAILURE'].includes(leaderReceipt(tx)?.execution_result);
}
function resultSummary(result) {
 if (!result) return undefined;
 const summary = {status:result.status};
 if (typeof result.payload === 'string') summary.payload = result.payload;
 else if (result.payload?.readable !== undefined) summary.readable = result.payload.readable;
 return summary;
}
export function slim(tx){
 const keys=['hash','from_address','to_address','status','statusName','resultName','txExecutionResultName','created_at','nonce','value'];const out=Object.fromEntries(keys.filter(k=>k in tx).map(k=>[k,tx[k]]));
 const c=tx.consensus_data||{};out.consensus_data={final:c.final,votes:c.votes,leader_receipt:(c.leader_receipt||[]).map(r=>Object.fromEntries(['execution_result','error','vote','mode','result'].filter(k=>k in r).map(k=>[k,k==='result'?resultSummary(r[k]):r[k]])))};
 if(tx.data?.calldata?.readable)out.call=tx.data.calldata.readable;
 return out;
}
async function retryRead(action){
 for(let attempt=0;;attempt++){try{return await action();}catch(error){if(attempt>=3||!/Unexpected token|fetch failed|HTTP|timeout|network|ECONN|EAI_/i.test(error.message||''))throw error;console.log('Transient RPC read error; retrying without submitting any transaction.');await new Promise(resolve=>setTimeout(resolve,2000));}}
}
export async function finalized(hashValue,onStatus=()=>{}){
 const deadline=Date.now()+900000;let prior='';
 while(Date.now()<deadline){const tx=await retryRead(()=>publicClient.getTransaction({hash:hashValue}));const status=tx.statusName||tx.status;if(status!==prior){onStatus(status);prior=status;}if(status==='FINALIZED')return tx;if(['CANCELED','UNDETERMINED','LEADER_TIMEOUT','VALIDATORS_TIMEOUT'].includes(status))throw new Error('Non-final transaction outcome: '+status);await new Promise(resolve=>setTimeout(resolve,3000));}
 throw new Error('Finality timeout; retain pending hash and resume without resubmitting');
}
export async function chain(){assert.equal(BigInt(await publicClient.request({method:'eth_chainId'})),61999n);}
export async function read(address,functionName,args=[]){const v=await retryRead(()=>publicClient.readContract({address,functionName,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));return typeof v==='string'?JSON.parse(v):v;}
export async function startRun(number){
 await chain();await mkdir('evidence',{recursive:true});let log;
 try{log=JSON.parse(await readFile('evidence/oci/live.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;log={network:{chainId:61999,rpc:'https://studio.genlayer.com/api',sdk:'genlayer-js@2.0.0'},startedAt:new Date().toISOString(),operations:{},snapshots:{},funding:[],complete:false};}
 let pendingSave = Promise.resolve();
 const save = () => {
  const contents = encode(log)+'\n';
  pendingSave = pendingSave.then(async () => {
   await writeFile('evidence/oci/live.json.tmp',contents);
   await rename('evidence/oci/live.json.tmp','evidence/oci/live.json');
  });
  return pendingSave;
 };
 if(log.complete)return {done:true,log,save};
 await mkdir('artifacts',{recursive:true,mode:0o700});await chmod('artifacts',0o700);let keys;
 try{keys=JSON.parse(await readFile('artifacts/signers.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;assert(!log.deployment&&Object.keys(log.operations).length===0,'Pending run has lost its signing keys; do not create replacements');keys=Array.from({length:number},()=>generatePrivateKey());await writeFile('artifacts/signers.json',JSON.stringify(keys),{mode:0o600});}
 assert.equal(keys.length,number);const accounts=keys.map(k=>createAccount(k));const clients=accounts.map(account=>createClient({chain:studionet,account}));log.actors=accounts.map(a=>a.address);await save();
 for(const account of accounts){if(log.funding.some(f=>f.address===account.address))continue;const before=await publicClient.request({method:'eth_getBalance',params:[account.address,'latest']});const result=await publicClient.request({method:'sim_fundAccount',params:[account.address,1000000000000000000]});const after=await publicClient.request({method:'eth_getBalance',params:[account.address,'latest']});assert(BigInt(after)>=1000000000000000000n);log.funding.push({address:account.address,method:'sim_fundAccount',requestedWei:'1000000000000000000',beforeWei:BigInt(before).toString(),afterWei:BigInt(after).toString(),result});await save();}
 async function operation(tag,fn,args=[],actor=0,expected='SUCCESS'){
  let entry=log.operations[tag];if(!entry){const txHash=await clients[actor].writeContract({address:log.address,functionName:fn,args,value:0n,leaderOnly:false,fees:await clients[actor].estimateTransactionFees()});entry={function:fn,args,actor:accounts[actor].address,hash:txHash,expected};log.operations[tag]=entry;await save();console.log(tag,'SUBMITTED',txHash);}
  assert.equal(entry.expected,expected);const tx=await finalized(entry.hash,s=>console.log(tag,s));entry.receipt=slim(tx);entry.observed=success(tx)?'SUCCESS':failure(tx)?'FAILURE':'UNKNOWN';await save();assert.equal(entry.observed,expected,'Unexpected execution result for '+tag);return tx;
 }
 async function snapshot(tag,functionName='snapshot',args=[]){if(tag in log.snapshots)return log.snapshots[tag];const state=await read(log.address,functionName,args);log.snapshots[tag]=state;await save();return state;}
 async function finish(){log.complete=true;log.completedAt=new Date().toISOString();await rm('artifacts/signers.json',{force:true});keys=null;log.keyCleanup={removed:true,published:false};await save();console.log('ACCEPTANCE COMPLETE',log.address);}
 return {done:false,log,save,accounts,clients,operation,snapshot,finish};
}
export async function ensureDeployment(run){
 if(run.done)return run.log.address;
 const sourcePath='contracts/'+(await readdir('contracts')).find(n=>n.endsWith('.py'));const source=await readFile(sourcePath,'utf8');const digest=hash(source);
 if(run.log.sourceSha256)assert.equal(run.log.sourceSha256,digest,'Source changed after deployment; create an explicit new deployment');
 if(!run.log.deployment){await run.clients[0].getContractSchemaForCode(source);const txHash=await run.clients[0].deployContract({code:new Uint8Array(Buffer.from(source)),args:[],leaderOnly:false,fees:await run.clients[0].estimateTransactionFees()});run.log.deployment={hash:txHash};run.log.sourceSha256=digest;run.log.sourcePath=sourcePath;await run.save();console.log('DEPLOY SUBMITTED',txHash);}
 const tx=await finalized(run.log.deployment.hash,s=>console.log('DEPLOY',s));run.log.deployment.receipt=slim(tx);await run.save();assert(success(tx),'Deployment failed');const address=tx.to_address||tx.data?.contract_address||tx.recipient;assert(/^0x[0-9a-fA-F]{40}$/.test(address||'')&&!/^0x0{40}$/.test(address));assert.equal(await deployedCode(address),source);run.log.address=address;await run.save();await writeFile('public/deployment.json',encode({...run.log.network,address,transaction:run.log.deployment.hash,sourceSha256:digest,source:sourcePath})+'\n');return address;
}
export async function verifyRun(){
 await chain();const log=JSON.parse(await readFile('evidence/oci/live.json','utf8'));assert(log.complete,'Acceptance not complete');const source=await readFile(log.sourcePath,'utf8');assert.equal(hash(source),log.sourceSha256);assert.equal(await deployedCode(log.address),source);const verified=[];
 const cases = [['deploy', log.deployment], ...Object.entries(log.operations)];
 const receipts = await Promise.all(cases.map(async ([tag, entry]) => {
  const tx = await finalized(entry.hash);
  const expected = entry.expected ?? 'SUCCESS';
  const receipt = leaderReceipt(tx);
  assert(expected === 'SUCCESS' ? success(tx) : failure(tx), tag);
  assert.equal(tx.to_address.toLowerCase(), log.address.toLowerCase(), tag);
  if (entry.actor) assert.equal(tx.from_address.toLowerCase(), entry.actor.toLowerCase(), tag);
  if (tag === 'deploy' || (['evaluate','release'].includes(entry.function) && expected === 'SUCCESS')) {
   assert(Object.values(tx.consensus_data.votes).filter(v => v === 'agree').length >= 2, tag);
  }
  return {tag, hash:entry.hash, function:entry.function ?? 'deploy', status:'FINALIZED',
          execution:receipt.execution_result, result:resultSummary(receipt.result), actor:tx.from_address,
          contractError:receipt.genvm_result?.stderr?.match(/^ValueError: ([A-Z_]+)$/m)?.[1],
          equivalenceOutputs:Object.keys(receipt.eq_outputs ?? {}),
          votes:tx.consensus_data.votes};
 }));
 verified.push(...receipts);
 const state=await read(log.address,'list_tickets',[0,50]);console.log('VERIFIED',verified.length,'finalized transactions',log.address);return {log,state,verified};
}
