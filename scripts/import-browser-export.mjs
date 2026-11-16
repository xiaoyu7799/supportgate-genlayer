import {readFile,writeFile} from 'node:fs/promises';
import {isSuccess,stringify} from '../src/chain.js';
const [path,name]=process.argv.slice(2);if(!path||!/^ui-\d\d-[a-z-]+$/.test(name||''))throw new Error('Usage: node scripts/import-browser-export.mjs downloaded.json ui-01-propose');
const exported=JSON.parse(await readFile(path,'utf8'));if(!isSuccess(exported.transaction))throw new Error('Export is not FINALIZED + SUCCESS');
const tx=exported.transaction,fields=['hash','from_address','to_address','status','statusName','resultName','txExecutionResultName','nonce','created_at'];
exported.transaction=Object.fromEntries(fields.filter(k=>k in tx).map(k=>[k,tx[k]]));const c=tx.consensus_data||{};exported.transaction.consensus_data={final:c.final,votes:c.votes,leader_receipt:(c.leader_receipt||[]).map(v=>Object.fromEntries(['execution_result','error','vote','mode'].filter(k=>k in v).map(k=>[k,v[k]])))};
if(!exported.walletProof)throw new Error('Missing real wallet signature proof');
await writeFile('evidence/browser/'+name+'.json',stringify(exported)+'\n');console.log(stringify({hash:tx.hash,account:exported.walletProof.address,state:exported.readback.state,methods:exported.walletProof.methods.map(m=>m.method),signatures:exported.walletProof.signatures.length}));
