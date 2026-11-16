import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionHashVariant } from 'genlayer-js/types';

export const NETWORK = {chainId:'0xf22f',chainName:'GenLayer Stable Studionet',nativeCurrency:{name:'GEN',symbol:'GEN',decimals:18},rpcUrls:['https://studio.genlayer.com/api'],blockExplorerUrls:['https://explorer-studio.genlayer.com']};
export const readClient = createClient({chain:studionet});
export const wallets = new Map();
export function discoverWallets(onChange=()=>{}) {
  const add = (id,name,provider) => {if(provider?.request && ![...wallets.values()].some(w=>w.provider===provider)){wallets.set(id,{id,name,provider});onChange();}};
  window.addEventListener('eip6963:announceProvider',e=>{const d=e.detail;if(d?.info?.uuid)add(d.info.uuid,d.info.name,d.provider);});
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const injected = [...(window.ethereum?.providers || []), window.ethereum, window.okxwallet, window.coinbaseWalletExtension].filter(Boolean);
  injected.forEach((p,i)=>add('injected-'+i,p.isRabby?'Rabby':p.isOkxWallet||p.isOKExWallet?'OKX Wallet':p.isCoinbaseWallet?'Coinbase Wallet':p.isMetaMask?'MetaMask':'Injected wallet '+(i+1),p));
}
export async function ensureNetwork(provider) {
  if((await provider.request({method:'eth_chainId'})).toLowerCase()===NETWORK.chainId)return;
  try {await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:NETWORK.chainId}]});}
  catch(e){if(e.code!==4902 && e?.data?.originalError?.code!==4902)throw e;await provider.request({method:'wallet_addEthereumChain',params:[NETWORK]});await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:NETWORK.chainId}]});}
  if((await provider.request({method:'eth_chainId'})).toLowerCase()!==NETWORK.chainId)throw new Error('Wallet did not switch to Stable Studionet.');
}
export function isSuccess(tx) {
  const final = tx.statusName==='FINALIZED'||tx.status==='FINALIZED';
  const leaders=tx.consensus_data?.leader_receipt||[];
  const success=tx.resultName==='SUCCESS'||leaders.some(r=>r.execution_result==='SUCCESS');
  return final && success && tx.txExecutionResultName!=='FINISHED_WITH_ERROR' && !leaders.some(r=>r.execution_result==='ERROR'||r.error);
}
export function stateName(tx){return tx.statusName||String(tx.status||'PENDING');}
export async function finalized(client,hash,onStatus=()=>{},timeoutMs=900000) {
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
    const tx=await client.getTransaction({hash});const status=stateName(tx);onStatus(status,tx);
    if(status==='FINALIZED'){if(!isSuccess(tx))throw Object.assign(new Error('Finalized transaction did not execute successfully. Inspect the receipt.'),{receipt:tx});return tx;}
    if(['CANCELED','UNDETERMINED','LEADER_TIMEOUT','VALIDATORS_TIMEOUT'].includes(status))throw Object.assign(new Error('Transaction stopped: '+status),{receipt:tx});
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  throw new Error('Finality is still pending. Resume monitoring this transaction; do not resubmit it.');
}
export async function read(address,functionName,args=[]) {
  const result=await readClient.readContract({address,functionName,args,transactionHashVariant:TransactionHashVariant.LATEST_FINAL});
  return typeof result==='string'?JSON.parse(result):result;
}
export function signingClient(provider,account){return createClient({chain:studionet,provider,account});}
export function stringify(data){return JSON.stringify(data,(_,v)=>typeof v==='bigint'?v.toString():v,2);}
