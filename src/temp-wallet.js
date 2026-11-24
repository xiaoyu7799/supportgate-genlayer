import {createAccount} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {decodeFunctionData,getAddress,recoverTransactionAddress} from 'viem';

const RPC='https://studio.genlayer.com/api';
const CHAIN='0xf22f';
/** A real EIP-1193 signer for disposable Studionet testing, never real assets.
 * The private account exists only in a closure. No browser storage or key export.
 */
export async function createTemporaryWallet(contract){
 let signer=createAccount(),activeChain='0x0',registered=false,connected=false,sequence=0;
 const address=getAddress(signer.address),listeners=new Map();
 const proof={kind:'Temporary EIP-1193 Studionet signer',chainId:61999,address,createdAt:new Date().toISOString(),methods:[],signatures:[],destroyed:false};
 async function rpc(method,params=[]){const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++sequence,method,params})});if(!response.ok)throw new Error('Studionet RPC HTTP '+response.status);const data=await response.json();if(data.error)throw Object.assign(new Error(data.error.message||'Studionet RPC error'),{code:data.error.code});return data.result;}
 function require(ok,message){if(!ok)throw new Error(message);}
 function emit(name,value){for(const fn of listeners.get(name)||[])fn(value);}
 try{
  require(BigInt(await rpc('eth_chainId'))===61999n,'Stable Studionet identity mismatch');
  const before=await rpc('eth_getBalance',[address,'latest']);
  const response=await rpc('sim_fundAccount',[address,1000000000000000000]);
  const after=await rpc('eth_getBalance',[address,'latest']);
  require(BigInt(after)>=1000000000000000000n,'Official faucet did not credit the temporary wallet');
  proof.faucet={method:'sim_fundAccount',rpc:RPC,requestedWei:'1000000000000000000',beforeWei:BigInt(before).toString(),afterWei:BigInt(after).toString(),response};
 }catch(error){signer=null;throw error;}
 return {
  on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
  removeListener(name,fn){listeners.get(name)?.delete(fn);},
  getProof(){return JSON.parse(JSON.stringify(proof));},
  destroy(){signer=null;connected=false;activeChain='0x0';proof.destroyed=true;proof.destroyedAt=new Date().toISOString();emit('accountsChanged',[]);listeners.clear();},
  async request({method,params=[]}){
   require(signer!==null,'Temporary signing key has been destroyed');
   proof.methods.push({method,at:new Date().toISOString()});
   if(method==='eth_chainId')return activeChain;
   if(method==='wallet_addEthereumChain'){require(params[0]?.chainId===CHAIN&&JSON.stringify(params[0]?.rpcUrls)===JSON.stringify([RPC]),'Only Stable Studionet is permitted');registered=true;return null;}
   if(method==='wallet_switchEthereumChain'){
    require(params[0]?.chainId===CHAIN,'Only Stable Studionet is permitted');
    if(!registered)throw Object.assign(new Error('Register Stable Studionet first'),{code:4902});
    require(BigInt(await rpc('eth_chainId'))===61999n,'Wrong upstream chain');activeChain=CHAIN;emit('chainChanged',CHAIN);return null;
   }
   if(method==='eth_requestAccounts'){require(activeChain===CHAIN,'Select Stable Studionet first');connected=true;return [address];}
   if(method==='eth_accounts')return connected?[address]:[];
   if(method==='eth_sendTransaction'){
    require(connected&&activeChain===CHAIN,'Connect this temporary wallet first');
    const tx=params[0];
    require(getAddress(tx.from)===address,'Wrong signing account');
    require(tx.chainId == null || BigInt(tx.chainId)===61999n,'Wrong signing chain');
    require(getAddress(tx.to)===getAddress(studionet.consensusMainContract.address),'Only GenLayer consensus calls are permitted');
    const decoded=decodeFunctionData({abi:studionet.consensusMainContract.abi,data:tx.data});
    const call=decoded.args?.[0];
    require(decoded.functionName==='addTransaction'&&call?.userValue===0n&&call.messageAllocations.length===0
      &&getAddress(call.sender)===address&&getAddress(call.recipient)===getAddress(contract),'Only zero-value SupportGate calls are permitted');
    const fee=BigInt(tx.value||0);
    require(fee>=0n&&fee<=250000000000000000n,'Testnet fee exceeds the temporary wallet limit');
    const nonce=Number(BigInt(tx.nonce??await rpc('eth_getTransactionCount',[address,'pending'])));
    const raw=await signer.signTransaction({to:tx.to,data:tx.data,type:'legacy',chainId:61999,nonce,
      value:fee,gas:BigInt(tx.gas),gasPrice:BigInt(tx.gasPrice??await rpc('eth_gasPrice'))});
    const recovered=await recoverTransactionAddress({serializedTransaction:raw});require(getAddress(recovered)===address,'Signature recovery mismatch');
    const entry={serializedSignedTransaction:raw,recoveredSigner:recovered,chainId:61999,nonce,feeWei:fee.toString(),
      valueWei:'0',submittedAt:new Date().toISOString(),hash:null};proof.signatures.push(entry);
    entry.hash=await rpc('eth_sendRawTransaction',[raw]);return entry.hash;
   }
   throw Object.assign(new Error('Unsupported wallet method: '+method),{code:4200});
  }
 };
}
