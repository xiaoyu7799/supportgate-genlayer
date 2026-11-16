import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createAccount,createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {TransactionHashVariant} from 'genlayer-js/types';
import {finalized,stringify} from '../src/chain.js';
const config=JSON.parse(await readFile('public/deployment.json','utf8'));
if(config.chainId!==61999||!config.address)throw new Error('Deploy to Stable Studionet first');
if(!process.env.SUPPORTGATE_PRIVATE_KEY)throw new Error('Authorized SUPPORTGATE_PRIVATE_KEY required');
const account=createAccount(process.env.SUPPORTGATE_PRIVATE_KEY);const client=createClient({chain:studionet,account});
assert.equal(parseInt(await client.request({method:'eth_chainId'}),16),61999);
const evidence={chainId:61999,address:config.address,actor:account.address,transactions:[],readbacks:[]};
await mkdir('evidence',{recursive:true});
const save=()=>writeFile('evidence/live.json',stringify(evidence)+'\n');
async function read(id){const r=JSON.parse(await client.readContract({address:config.address,functionName:'get_ticket',args:[id],transactionHashVariant:TransactionHashVariant.LATEST_FINAL}));evidence.readbacks.push(r);await save();return r;}
async function write(fn,args){const hash=await client.writeContract({address:config.address,functionName:fn,args,value:0n,leaderOnly:false});evidence.transactions.push({fn,args,hash,receipt:null});await save();console.log(fn,hash);const receipt=await finalized(client,hash,status=>console.log(status));evidence.transactions.at(-1).receipt=receipt;await save();return receipt;}
const suffix=Date.now().toString(36),ref='accept-'+suffix,id=account.address.toLowerCase()+':'+ref;
const artifact=await readFile('dist/index.html');const digest=createHash('sha256').update(artifact).digest('hex');
await write('propose',[ref,'SupportGate acceptance',digest,'noble','staging']);assert.equal((await read(id)).state,'PROPOSED');
await write('evaluate',[id]);assert.equal((await read(id)).state,'READY');
await write('release',[id,1]);assert.equal((await read(id)).state,'RELEASED');
const negative='unsupported-'+suffix,nid=account.address.toLowerCase()+':'+negative;
await write('propose',[negative,'SupportGate acceptance',digest,'dapper','staging']);await write('evaluate',[nid]);assert.equal((await read(nid)).state,'BLOCKED');await write('cancel',[nid]);assert.equal((await read(nid)).state,'CANCELLED');
console.log('Live acceptance passed; every call finalized with successful execution and finalized readback.');
