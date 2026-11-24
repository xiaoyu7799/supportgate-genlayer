import './style.css';
import {createTemporaryWallet} from './temp-wallet.js';
import {wallets,discoverWallets,ensureNetwork,signingClient,read,readClient,finalized,stringify} from './chain.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=s=>s?s.slice(0,6)+'…'+s.slice(-4):'—';
let temporaryWallet=null;
let config,account='',provider,client,busy=false,tickets=[],selected,filter='all',receipt=null,txHash='',walletGeneration=0;

$('#app').innerHTML=`<header class="top"><a class="brand" href="./"><span class="mark">///</span>SupportGate</a><span class="top-title">OCI RELEASE CONTROL</span><nav><a href="#workspace">Control room</a><a href="https://github.com/xiaoyu7799/supportgate-genlayer" target="_blank" rel="noreferrer">Documentation ↗</a></nav><button id="connect" class="outline">Connect wallet</button></header>
<main id="workspace">
  <div class="instrument-bar"><span><i class="dot"></i> STABLE STUDIONET / 61999</span><div id="deployment" role="status">Connecting to finalized state…</div><button id="refresh" class="text-btn">↻ Refresh</button></div>
  <section class="room" aria-label="Release control room">
    <aside class="pipeline">
      <h2 class="panel-title">Release sequence</h2>
      <div id="sequence" class="sequence"></div>
      <button id="new" class="primary">New OCI ticket <span>↗</span></button>
      <p class="desk-note">Builder signature first. Ubuntu support is checked by GenLayer and fetched again at release.</p>
    </aside>
    <section class="blueprint" aria-label="Interactive release stack">
      <div class="plan-meta"><span>FIG. 01 / EXPLODED VIEW</span><span>SG / 02</span></div>
      <h1>Release<br><em>control.</em></h1>
      <div class="viewport" id="viewport">
        <div class="stack" id="stack">
          <div class="axis"></div>
          <button type="button" class="plate plate-release" data-stage="2" aria-label="Inspect release decision"><span>↗ &nbsp; RELEASE</span></button>
          <button type="button" class="plate plate-build" data-stage="1" aria-label="Inspect builder attestation"><span>◇ &nbsp; BUILD</span></button>
          <button type="button" class="plate plate-base" data-stage="0" aria-label="Inspect Ubuntu base"><span>◎ &nbsp; BASE</span></button>
        </div>
        <span class="axis-label axis-x">X</span><span class="axis-label axis-z">Z</span>
      </div>
      <div class="stack-tools"><label for="separation">Explode stack</label><input id="separation" type="range" min="55" max="140" value="100"><button id="reset-view" class="text-btn" type="button">Reset</button></div>
      <div class="blueprint-foot"><span id="plate-caption">Select a layer to inspect finalized evidence.</span><span>← &nbsp; SHA‑256 &nbsp; →</span></div>
    </section>
    <aside class="inspector">
      <div class="panel-title inspector-title"><h2>Inspector</h2><span id="inspector-index">—</span></div>
      <article id="detail" class="detail"></article>
    </aside>
  </section>
  <section class="ledger" aria-label="Finalized releases">
    <div class="ledger-toolbar"><h2 class="panel-title">Release ledger</h2><span id="count">—</span><div class="tabs" role="group" aria-label="Filter releases"><button data-filter="all" class="active">All</button><button data-filter="mine">Mine</button></div><button class="text-btn" id="previous" aria-label="Previous tickets">←</button><button class="text-btn" id="next" aria-label="Next tickets">→</button></div>
    <div id="records" tabindex="0"><p class="empty">Reading finalized chain state…</p></div><button id="more" class="outline hidden">Load more</button>
  </section>
  <footer><span>SUPPORTGATE / RELEASE CONTROL</span><a href="https://changelogs.ubuntu.com/meta-release-lts" target="_blank" rel="noreferrer">Ubuntu LTS source ↗</a><a href="https://github.com/xiaoyu7799/supportgate-genlayer/commit/124ba91c1ff122bd86e00795d445cc1407afe973" target="_blank" rel="noreferrer">V1 source ↗</a></footer>
</main>
<dialog id="manifest-dialog"><div class="dialog-heading"><h2>New OCI ticket</h2><button id="close-manifest" class="icon" aria-label="Close">×</button></div><form id="manifest">
<label>Release reference<input name="reference" required pattern="[a-z0-9-]{3,40}" maxlength="40" placeholder="billing-rc3"></label>
<label>Application<input name="application" required minlength="2" maxlength="80" placeholder="Billing API"></label>
<div class="form-row"><label>Ubuntu codename<input name="codename" required pattern="[a-z]{2,24}" placeholder="noble"></label><label>Environment<select name="environment"><option value="staging">Staging</option><option value="production">Production</option></select></label></div>
<label>OCI manifest SHA-256<input name="artifact_sha256" required pattern="[a-f0-9]{64}" placeholder="64 lowercase hex characters"></label>
<label>Or select the exact manifest file<input id="artifact" type="file" accept=".json,application/json"></label>
<label>Pinned base manifest SHA-256<input name="base_sha256" required pattern="[a-f0-9]{64}" placeholder="64 lowercase hex characters"></label>
<label>Builder wallet<input name="builder" required pattern="0x[a-fA-F0-9]{40}" placeholder="0x… (a different wallet)"></label>
<button id="propose" class="primary" type="submit">Propose on chain ↗</button></form></dialog>
<dialog id="build-dialog"><div class="dialog-heading"><h2>Attest build</h2><button id="close-build" class="icon" aria-label="Close">×</button></div>
<form id="build-form"><label>Build proof JSON<input name="proof" type="file" accept=".json,application/json" required></label><p class="muted">The builder signs the exact proof file digest and the image and base digests it declares. CI checks the bytes and inherited layers before publishing.</p><button class="primary">Sign builder attestation ↗</button></form></dialog>
<dialog id="wallet-dialog"><div class="dialog-heading"><h3>Choose your wallet</h3><button id="close-wallet" class="icon" aria-label="Close">×</button></div><p class="muted">EIP-6963 discovery and EIP-1193 injected providers.</p><div id="wallets"></div><p class="muted">MetaMask, OKX, Rabby, Coinbase Wallet and compatible injected wallets are supported by the connection flow.</p></dialog>
<div id="transaction" class="transaction hidden" role="status" aria-live="polite"><div><b id="tx-title">Transaction</b><button id="hide-tx" class="icon" aria-label="Hide transaction">×</button></div><p id="tx-message"></p><a id="tx-link" target="_blank" rel="noreferrer"></a><button id="resume" class="outline hidden">Resume monitoring</button><button id="export" class="outline hidden">Export receipt & readback</button></div>`;

let stage = 2;
const stageNames = ['Ubuntu base', 'OCI build', 'Release decision'];
const setStage = number => { stage = number; renderDetail(); };
document.querySelectorAll('[data-stage]').forEach(button => button.onclick = () => setStage(Number(button.dataset.stage)));
$('#separation').oninput = event => $('#stack').style.setProperty('--gap',event.target.value+'px');
$('#reset-view').onclick = () => {
  $('#separation').value = 100;
  $('#stack').style.setProperty('--gap','100px');
  $('#stack').style.setProperty('--twist','0deg');
  $('#stack').style.setProperty('--tilt','0deg');
};
$('#viewport').onpointermove = event => {
  if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = event.currentTarget.getBoundingClientRect();
  $('#stack').style.setProperty('--twist',((event.clientX-rect.left)/rect.width-.5)*14+'deg');
  $('#stack').style.setProperty('--tilt',((event.clientY-rect.top)/rect.height-.5)*10+'deg');
};
$('#previous').onclick = () => $('#records').scrollBy({left:-330,behavior:'smooth'});
$('#next').onclick = () => $('#records').scrollBy({left:330,behavior:'smooth'});
$('#new').onclick = () => $('#manifest-dialog').showModal();
$('#close-manifest').onclick = () => $('#manifest-dialog').close();
$('#close-build').onclick = () => $('#build-dialog').close();
async function digestFile(file) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',file)),b=>b.toString(16).padStart(2,'0')).join('');
}
$('#build-form').onsubmit = async event => {
  event.preventDefault();
  const ticket = selected;
  if (!ticket?.provenance || !account || account.toLowerCase() !== ticket.provenance.builder) return;
  try {
    const file = event.target.elements.proof.files[0];
    if (!file || file.size > 400000) throw new Error('Select a proof JSON of at most 400 kB.');
    const bytes = await file.arrayBuffer();
    const proof = JSON.parse(new TextDecoder().decode(bytes));
    if (proof.version !== 1 || proof.subject_sha256 !== ticket.artifact_sha256 ||
        proof.base_sha256 !== ticket.provenance.base_sha256) throw new Error('Proof image or base digest differs from this ticket.');
    $('#build-dialog').close();
    await send('attest_build',[ticket.id,proof.subject_sha256,proof.base_sha256,await digestFile(bytes)],ticket.id);
  } catch (error) { toast('Build proof refused',error.message); }
};
function toast(title,message){$('#transaction').classList.remove('hidden');$('#tx-title').textContent=title;$('#tx-message').textContent=message;}
function setBusy(value){busy=value;$('#propose').disabled=value||!config?.address;$('#connect').disabled=value;$('#refresh').disabled=value||!config?.address;document.querySelectorAll('[data-action]').forEach(el=>el.disabled=value);}
function showWallets(){const box=$('#wallets');box.replaceChildren();if(!wallets.size){box.innerHTML='<div class="notice">No injected wallet detected. You can use a temporary wallet on Stable Studionet below.</div>';}for(const wallet of wallets.values()){const b=document.createElement('button');b.className='wallet-option';b.textContent=wallet.name;b.onclick=()=>connect(wallet);box.append(b);}const help=document.createElement('p');help.className='muted';help.textContent='Temporary test wallet: free faucet GEN, real signatures. Key stays only in this tab’s memory. Reloading, closing or destroying the wallet discards the key. No key export.';box.append(help);const action=document.createElement('button');action.className='wallet-option';action.id='temporary-wallet';action.textContent=temporaryWallet?'Destroy temporary wallet':'Create temporary Studionet wallet';action.disabled=busy||!config?.address;action.onclick=async()=>{if(temporaryWallet){const proof=temporaryWallet.getProof();temporaryWallet.destroy();proof.destroyed=true;proof.destroyedAt=new Date().toISOString();wallets.delete('temporary-studionet');temporaryWallet=null;download(proof,'supportgate-wallet-cleanup.json');showWallets();return;}action.disabled=true;action.textContent='Creating wallet and requesting official faucet…';try{temporaryWallet=await createTemporaryWallet(config.address);const wallet={id:'temporary-studionet',name:'Temporary Studionet wallet',provider:temporaryWallet};wallets.set(wallet.id,wallet);await connect(wallet);}catch(e){toast('Temporary wallet',e.message);showWallets();}};box.append(action);}
async function connect(wallet){try{await ensureNetwork(wallet.provider);const accounts=await wallet.provider.request({method:'eth_requestAccounts'});if(!accounts?.[0])throw new Error('No wallet account selected.');provider=wallet.provider;account=accounts[0];client=signingClient(provider,account);const generation=++walletGeneration;provider.on?.('accountsChanged',()=>{if(generation===walletGeneration)disconnect('Wallet account changed. Reconnect to continue.');});provider.on?.('chainChanged',()=>{if(generation===walletGeneration)disconnect('Wallet network changed. Reconnect to Stable Studionet.');});$('#connect').textContent=short(account);$('#wallet-dialog').close();render();}catch(e){toast('Wallet connection',e.message||String(e));}}
function disconnect(message){account='';client=null;provider=null;walletGeneration++;$('#connect').textContent='Connect wallet ';toast('Reconnect wallet',message);render();}
$('#connect').onclick=()=>{showWallets();$('#wallet-dialog').showModal();};$('#close-wallet').onclick=()=>$('#wallet-dialog').close();
$('#hide-tx').onclick=()=>$('#transaction').classList.add('hidden');
discoverWallets(showWallets);
async function refresh(){if(!config?.address)return;const response=await read(config.address,'list_tickets',[0,50]);tickets=response.items;$('#more').classList.toggle('hidden',tickets.length>=response.total);$('#count').textContent=response.total+' records';if(!selected)selected=tickets.find(t=>t.state==='RELEASED')||tickets.at(-1);if(selected)selected=tickets.find(t=>t.id===selected.id)||await read(config.address,'get_ticket',[selected.id]);render();}
$('#more').onclick=async()=>{try{const response=await read(config.address,'list_tickets',[tickets.length,50]);tickets.push(...response.items);$('#more').classList.toggle('hidden',tickets.length>=response.total);render();}catch(e){toast('Read failed',e.message);}};
$('#refresh').onclick=()=>refresh().catch(e=>toast('Chain read failed',e.message));
document.querySelectorAll('[data-filter]').forEach(el=>el.onclick=()=>{filter=el.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b===el));render();});
function render(){const rows=tickets.filter(t=>filter!=='mine'||t.owner.toLowerCase()===account.toLowerCase()).slice().reverse();$('#records').innerHTML=rows.length?rows.map(t=>`<button class="record ${selected?.id===t.id?'selected':''}" data-id="${esc(t.id)}"><div class="record-symbol">${esc(t.application.slice(0,1).toUpperCase())}</div><div class="record-main"><strong>${esc(t.application)}</strong><span>${esc(t.reference)} · ${esc(t.environment)}</span></div><div class="record-end"><span class="badge ${esc(t.state.toLowerCase())}">${esc(t.state)}</span><small>Ubuntu ${esc(t.codename)} <span></span></small></div></button>`).join(''):`<div class="empty"><span></span><h3>${filter==='mine'?'Your next release starts here.':'A clean release desk.'}</h3><p>${filter==='mine'&&!account?'Connect your wallet to see your manifests.':'Propose a manifest to begin. Only finalized chain records appear here.'}</p></div>`;
document.querySelectorAll('[data-id]').forEach(el=>el.onclick=()=>{selected=tickets.find(t=>t.id===el.dataset.id);render();});renderDetail();setBusy(busy);}
function renderDetail(){
  const ticket=selected, p=ticket?.provenance, el=$('#detail');
  const owner=ticket && account.toLowerCase()===ticket.owner;
  const builder=p && account.toLowerCase()===p.builder;
  const open=ticket && ['PROPOSED','READY','BLOCKED'].includes(ticket.state);
  const attested=Boolean(p?.proof_sha256);
  const signals=[ticket?.source ? (ticket.source.supported?'Supported':'Denied') : 'Unchecked',
    attested?'Signed':'Awaiting signature',ticket?.state ?? '—'];
  $('#sequence').innerHTML=[1,0,2].map((number,index)=>`<button aria-pressed="${number===stage}" data-select-stage="${number}">
    <span class="sequence-number">0${index+1}</span><span><strong>${stageNames[number]}</strong><small>${signals[number]}</small></span><span>↗</span></button>`).join('');
  document.querySelectorAll('[data-select-stage]').forEach(button=>button.onclick=()=>setStage(Number(button.dataset.selectStage)));
  document.querySelectorAll('[data-stage]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.stage)===stage)));
  $('#plate-caption').textContent=stageNames[stage]+' / '+signals[stage];
  $('#inspector-index').textContent=ticket?'REV. '+String(ticket.revision).padStart(2,'0'):'—';
  if (!ticket) { el.innerHTML='<p class="empty">Select a finalized ticket to inspect its release layers.</p>'; return; }
  const data = stage===0
    ? [['Ubuntu',ticket.codename],['Base manifest',p?.base_sha256],['Official feed',ticket.source ? ticket.source.supported?'Supported: 1':'Support denied':'Unchecked']]
    : stage===1
    ? [['OCI manifest',ticket.artifact_sha256],['Builder wallet',p?.builder],['Signed proof',p?.proof_sha256]]
    : [['Environment',ticket.environment],['Proposer',ticket.owner],['Checked',ticket.checked_at?new Date(ticket.checked_at*1000).toISOString():null],
       ...(ticket.superseded_by?[['Replacement',ticket.superseded_by]]:[])];
  const action = (name,label,kind='outline') => `<button class="${kind}" data-action="${name}">${label}</button>`;
  el.innerHTML=`<div class="detail-head"><div><p>${esc(ticket.reference)}</p><h3>${esc(ticket.application)}</h3></div><span class="badge ${esc(ticket.state.toLowerCase())}">${esc(ticket.state)}</span></div>
  <h4>${stageNames[stage]}</h4><dl>${data.map(([key,val])=>`<div><dt>${key}</dt><dd>${esc(val||'—')}</dd></div>`).join('')}</dl>
  <div class="actions">${builder&&open&&!attested?action('attest','Attest build','primary'):''}${open&&attested?action('evaluate','Verify Ubuntu'):''}
  ${owner&&ticket.state==='READY'?action('release','Recheck & release','primary'):''}${owner&&open?action('cancel','Cancel ticket','text-btn'):''}
  ${owner&&ticket.state==='RELEASED'?action('supersede','Link replacement'):''}<button class="text-btn" id="export-ticket">Export record ↓</button></div>
  <details><summary>Finalized support history (${ticket.history.length})</summary><ol class="history">${ticket.history.map(h=>`<li><b>${esc(h.action)}</b> ${esc(h.source.version||h.source.codename)}<br><small>${new Date(h.at*1000).toISOString()}</small></li>`).join('')}</ol></details>`;
  el.querySelectorAll('[data-action]').forEach(b=>{b.disabled=busy;b.onclick=()=>act(b.dataset.action);});
  $('#export-ticket').onclick=()=>download(ticket,'supportgate-'+ticket.reference+'.json');
}
async function act(action){if(!selected)return;if(action==='attest'){$('#build-form').reset();$('#build-dialog').showModal();return;}let args=[selected.id];if(action==='release')args.push(selected.revision);if(action==='supersede'){const eligible=tickets.filter(t=>t.id!==selected.id&&t.owner===selected.owner&&t.application===selected.application&&t.environment===selected.environment&&t.state==='RELEASED'&&t.created_at>=selected.created_at);if(!eligible.length){toast('No eligible replacement','Create and release a newer manifest for the same application and environment first.');return;}const choice=window.prompt('Enter the exact replacement ticket ID:\n'+eligible.map(t=>t.id).join('\n'));if(!choice)return;if(!eligible.some(t=>t.id===choice)){toast('Invalid replacement','Choose an eligible released ticket ID.');return;}args.push(choice);}await send(action,args,selected.id);}
async function monitor(hash,ticketId){$('#resume').classList.add('hidden');receipt=await finalized(readClient,hash,status=>toast('Transaction · '+status,'Waiting for FINALIZED + SUCCESS. The record remains unchanged until finalized readback.'));const state=await read(config.address,'get_ticket',[ticketId]);await refresh();selected=state;render();toast('Finalized + successful',`Read back revision ${state.revision}: ${state.state}. ${state.state==='BLOCKED'?'The transaction succeeded; policy denied release.':''}`);$('#export').classList.remove('hidden');receipt={transaction:receipt,contract:config.address,chainId:61999,readback:state,walletProof:provider?.getProof?.()||null};}
async function send(method,args,ticketId){if(busy)return;if(sessionStorage.getItem('supportgate-oci-pending')){toast('Pending transaction','Resume monitoring the existing transaction before submitting another call.');$('#resume').classList.remove('hidden');$('#resume').onclick=resume;return;}if(!client){$('#wallet-dialog').showModal();showWallets();return;}setBusy(true);receipt=null;txHash='';$('#tx-link').textContent='';$('#export').classList.add('hidden');$('#resume').classList.add('hidden');try{await ensureNetwork(provider);const current=await provider.request({method:'eth_accounts'});if(current[0]?.toLowerCase()!==account.toLowerCase())throw new Error('Selected account changed. Reconnect before signing.');toast('Confirm in your wallet','Sign the '+method+' call on Stable Studionet. Only testnet fees apply.');const signer=account;txHash=await client.writeContract({address:config.address,functionName:method,args,value:0n,leaderOnly:false,fees:await client.estimateTransactionFees()});const id=ticketId||signer.toLowerCase()+':'+args[0];$('#tx-link').href='https://explorer-studio.genlayer.com/tx/'+txHash;$('#tx-link').textContent=short(txHash)+' · View on explorer ';sessionStorage.setItem('supportgate-oci-pending',JSON.stringify({hash:txHash,id,address:config.address}));await monitor(txHash,id);sessionStorage.removeItem('supportgate-oci-pending');}catch(e){toast('Transaction needs attention',e.message||String(e));if(e.receipt){sessionStorage.removeItem('supportgate-oci-pending');receipt=e.receipt;$('#export').classList.remove('hidden');}if(txHash&&!e.receipt){$('#resume').classList.remove('hidden');$('#resume').onclick=resume;}}finally{setBusy(false);}}
async function resume(){const pending=JSON.parse(sessionStorage.getItem('supportgate-oci-pending')||'null');if(!pending||pending.address!==config.address)return;setBusy(true);try{txHash=pending.hash;$('#tx-link').href='https://explorer-studio.genlayer.com/tx/'+txHash;$('#tx-link').textContent=short(txHash)+' · View on explorer ';await monitor(pending.hash,pending.id);sessionStorage.removeItem('supportgate-oci-pending');}catch(e){toast('Monitoring paused',e.message);if(e.receipt){sessionStorage.removeItem('supportgate-oci-pending');receipt=e.receipt;$('#export').classList.remove('hidden');}else $('#resume').classList.remove('hidden');}finally{setBusy(false);}}
function download(data,name){const url=URL.createObjectURL(new Blob([stringify(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
$('#export').onclick=()=>receipt&&download(receipt,'supportgate-transaction.json');
$('#artifact').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>256*1024*1024)throw new Error('Use a local SHA-256 tool for files larger than 256 MiB.');const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());$('#manifest').elements.artifact_sha256.value=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}catch(e){toast('Artifact hash',e.message);}};
$('#manifest').onsubmit=async e=>{e.preventDefault();if(!config?.address)return;const f=new FormData(e.target);const digest=f.get('artifact_sha256');if(!/^[0-9a-f]{64}$/.test(digest)){toast('Invalid artifact digest','Use exactly 64 lowercase hexadecimal characters.');return;}$('#manifest-dialog').close();await send('propose_oci',[f.get('reference'),f.get('application'),digest,f.get('codename'),f.get('environment'),f.get('base_sha256'),f.get('builder').toLowerCase()]);};
async function init(){try{config=await fetch('./deployment.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Deployment configuration unavailable');return r.json();});if(config.chainId!==61999||config.rpc!=='https://studio.genlayer.com/api')throw new Error('Unsupported network configuration.');if(!/^0x[0-9a-fA-F]{40}$/.test(config.address||'')){config.address=null;$('#deployment').textContent='Contract deployment is not configured. Chain writes are disabled; no demo records or simulated transactions are shown.';$('#records').innerHTML='<div class="empty"><span>◎</span><h3>Awaiting a verified deployment.</h3><p>The release desk will load real finalized records when a Stable Studionet contract is configured.</p></div>';}else{const protocol=await read(config.address,'get_protocol');if(protocol.name!=='SupportGate'||protocol.chain_id!==61999||protocol.version!==2)throw new Error('Contract identity mismatch.');$('#deployment').innerHTML='<span class="dot"></span> Stable Studionet · 61999 <a target="_blank" rel="noreferrer" href="https://explorer-studio.genlayer.com/address/'+esc(config.address)+'">'+esc(short(config.address))+' </a> <span>Finalized state only</span>';await refresh();if(sessionStorage.getItem('supportgate-oci-pending')){toast('Pending transaction found','Resume monitoring before submitting another call.');$('#resume').classList.remove('hidden');$('#resume').onclick=resume;}}}catch(e){config=null;$('#deployment').textContent='Chain unavailable: '+e.message;$('#records').innerHTML='<p class="empty">Could not load finalized records. Try refreshing after connectivity is restored.</p>';}setBusy(false);

}
init();
