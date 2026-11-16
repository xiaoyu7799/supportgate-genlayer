import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {parseTransaction,recoverTransactionAddress,getAddress,keccak256} from 'viem';
import {studionet} from 'genlayer-js/chains';
import {read,readClient,isSuccess,stringify} from '../src/chain.js';
const files=(await readdir('evidence/browser')).filter(p=>/^ui-.*\.json$/.test(p)).sort();
assert.equal(files.length,6,'Need all six production UI receipts');
const expected=['PROPOSED','READY','RELEASED','PROPOSED','BLOCKED','CANCELLED'];
const results=[];
for(const file of files){
 const exported=JSON.parse(await readFile('evidence/browser/'+file,'utf8'));
 assert.equal(exported.readback.state,expected[results.length]);
 assert.equal(exported.chainId,61999);assert.equal(exported.contract,'0x9a274bBdF8deE8867A2Fe3d7c5ac584a60A19812');
 const proof=exported.walletProof;assert(proof);assert(BigInt(proof.faucet.afterWei)>=1000000000000000000n);
 const tx=exported.transaction;assert(isSuccess(tx));
 const signature=proof.signatures.find(s=>s.hash===tx.hash);assert(signature,'No signed transaction for this receipt');
 assert.equal(keccak256(signature.serializedSignedTransaction),tx.hash,'Signed bytes do not match the broadcast hash');
 const parsed=parseTransaction(signature.serializedSignedTransaction);assert.equal(parsed.nonce,results.length);assert.equal(parsed.chainId,61999);assert.equal(parsed.value??0n,0n);assert.equal(getAddress(parsed.to),getAddress(studionet.consensusMainContract.address));
 const recovered=await recoverTransactionAddress({serializedTransaction:signature.serializedSignedTransaction});assert.equal(getAddress(recovered),getAddress(proof.address));assert.equal(getAddress(tx.from_address),getAddress(proof.address));
 const live=await readClient.getTransaction({hash:tx.hash});assert(isSuccess(live));assert.equal(getAddress(live.from_address),getAddress(recovered));assert.equal(getAddress(live.to_address),getAddress(exported.contract));
 const current=await read(exported.contract,'get_ticket',[exported.readback.id]);
 results.push({file,hash:tx.hash,recoveredSigner:recovered,chainId:parsed.chainId,nonce:parsed.nonce,exportedState:exported.readback.state,exportedRevision:exported.readback.revision,currentState:current.state,finalizedSuccess:true,signatureVerified:true,signedHashVerified:true});
}
const cleanup=JSON.parse(await readFile('evidence/browser/wallet-cleanup.json','utf8'));assert.equal(cleanup.destroyed,true);assert(cleanup.destroyedAt);
const summary={verifiedAt:new Date().toISOString(),site:'https://xiaoyu7799.github.io/supportgate-genlayer/',transactions:results,temporarySignerDestroyed:true};await writeFile('evidence/browser/verification.json',stringify(summary)+'\n');console.log(stringify(summary));
