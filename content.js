/* Two-phase local confirmation. Composer text is compared only in RAM, never sent or stored. */
(()=>{
  'use strict';
  if(globalThis.__gptTrackerLive)return;
  Object.defineProperty(globalThis,'__gptTrackerLive',{value:true,configurable:true});
  const C=GPTUsageCore, TTL=20000, SETTLE=900;
  const send=m=>chrome.runtime.sendMessage(m).catch(()=>({ok:false,error:'extension_reloaded'}));
  const digest=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const normalize=s=>(s||'').replace(/\s+/g,' ').trim();
  const messageSelector='[data-message-author-role="user"]';
  const seen=new Set(), nodes=new WeakSet();
  let pending=null, route=location.pathname, checking=false, inFlight=null;
  function modelLabel(){
    for(const sel of ['[data-testid="model-switcher-dropdown-button"]','button[aria-label*="model" i]','button[data-testid*="model" i]']){const txt=C.text(document.querySelector(sel)?.textContent,90);if(txt)return txt;}
    return '';
  }
  function identity(n){return n.getAttribute('data-message-id')||n.closest('[data-message-id]')?.getAttribute('data-message-id')||'';}
  function remember(n){nodes.add(n);const id=identity(n);if(id)seen.add(id);}
  function scan(root=document){if(root instanceof Element&&root.matches(messageSelector))remember(root);for(const n of root.querySelectorAll?.(messageSelector)||[])remember(n);}
  function composer(){return document.querySelector('#prompt-textarea')||document.querySelector('form textarea,form [contenteditable="true"],[data-testid*="composer"] [contenteditable="true"]');}
  function value(n){return normalize(n?.value??n?.innerText??n?.textContent);}
  function sendButton(n){return n?.closest('form')?.querySelector('[data-testid*="send-button"],button[aria-label="Send prompt"],button[aria-label="Send message"]')||document.querySelector('[data-testid="send-button"]');}
  function disabled(b){return b&&(b.disabled||b.getAttribute('aria-disabled')==='true');}
  function syncRoute(){
    const next=location.pathname;if(next===route)return;
    // Only the first-send / -> /c/id transition can retain an intent.
    if(!(pending&&route==='/'&&/^\/c\/[^/]+$/.test(next)))pending=null;
    route=next;if(!pending)scan();
  }
  function arm(e,button){
    syncRoute();const n=composer();if(!n||disabled(button||sendButton(n)))return;
    const text=value(n);if(!text)return;
    if(pending&&Date.now()-pending.ts<700&&pending.text===text)return;
    scan();
    pending={text,ts:Date.now(),model:modelLabel(),candidate:null,errors:new Map([...document.querySelectorAll('[role="alert"],[data-testid*="error"]')].map(n=>[n,normalize(n.textContent)]))};
    // A page handler can cancel a submit or leave the composer intact: neither alone confirms a send.
    setTimeout(check,SETTLE);
  }
  function failed(p,n){
    const turn=n?.closest('article,[data-testid^="conversation-turn"]')||n;
    if(n?.getAttribute('data-message-status')==='failed')return true;
    if(turn?.querySelector('[data-testid*="error"],[data-message-status="failed"]'))return true;
    return [...document.querySelectorAll('[role="alert"],[data-testid*="error"]')].some(x=>p.errors.get(x)!==normalize(x.textContent)&&normalize(x.textContent));
  }
  async function check(){
    if(checking)return;checking=true;
    try{
      syncRoute();const p=pending;if(!p)return;
      if(Date.now()-p.ts>TTL){pending=null;scan();return;}
      for(const n of document.querySelectorAll(messageSelector)){
        const id=identity(n);
        if(!id||seen.has(id)||nodes.has(n)||value(n)!==p.text)continue;
        if(!p.candidate||p.candidate.id!==id){p.candidate={id,node:n,at:Date.now()};setTimeout(check,SETTLE);}
        if(failed(p,n)){pending=null;scan();return;}
        // Require a stable new user message and the composer to have cleared.
        if(Date.now()-p.candidate.at<SETTLE||value(composer())===p.text)continue;
        pending=null;seen.add(id);nodes.add(n);
        const eventId=await digest(`gpt-tracker:user:${id}`);
        await send({type:'UG_EVENT',event:{id:eventId,scope:C.LOCAL_SCOPE,ts:p.ts,model:p.model,effort:''}});
        scan();return;
      }
    }finally{checking=false;}
  }
  scan();
  document.addEventListener('click',e=>{const b=e.target instanceof Element?e.target.closest('button'):null;if(!b)return;const id=b.getAttribute('data-testid')||'',label=b.getAttribute('aria-label')||'';if(id.includes('send-button')||/^send (prompt|message)$/i.test(label))arm(e,b);},true);
  document.addEventListener('submit',e=>{const n=composer();if(n&&e.target instanceof HTMLFormElement&&e.target.contains(n))arm(e);},true);
  document.addEventListener('keydown',e=>{if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.altKey||e.metaKey||e.isComposing||e.repeat)return;const n=composer();if(n&&(n===e.target||n.contains(e.target)))arm(e);},true);
  window.addEventListener('popstate',()=>{pending=null;route=location.pathname;scan();});
  const observer=new MutationObserver(records=>{syncRoute();if(pending)void check();else for(const r of records){if(r.type==='attributes')scan(r.target);else for(const n of r.addedNodes)if(n instanceof Element)scan(n);}});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-message-id','data-message-status']});
  setInterval(()=>{if(pending)void check();else syncRoute();},1000);

  async function readJSON(path,headers={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{const res=await fetch(path,{method:'GET',credentials:'include',headers:{accept:'application/json',...headers},signal:controller.signal,redirect:'error',cache:'no-store'});if(!res.ok)throw Object.assign(Error('http'),{status:res.status});return await res.json();}
    finally{clearTimeout(timer);}
  }
  function bootstrapToken(){try{const d=JSON.parse(document.getElementById('client-bootstrap')?.textContent||'{}');return C.text(d?.session?.accessToken||d?.session?.access_token,8000);}catch{return '';}}
  async function capture(manual=false){
    if(document.hidden&&!manual)return {ok:false,status:'hidden'};
    if(inFlight)return inFlight;
    inFlight=(async()=>{
      try{
        let token=manual?'':bootstrapToken();
        if(!token){const data=await readJSON('/api/auth/session');token=C.text(data?.accessToken||data?.access_token||data?.session?.accessToken,8000);}
        if(document.hidden&&!manual)return {ok:false,status:'hidden'};
        const headers={'oai-language':navigator.language||'en-US'};if(token)headers.authorization=`Bearer ${token}`;
        const snapshot=C.normalizeWham(await readJSON('/backend-api/wham/usage',headers));token='';
        if(!snapshot.plan&&!snapshot.meters.length&&!snapshot.credits)throw Object.assign(Error('invalid'),{status:'invalid-response'});
        const stored=await send({type:'UG_SERVER_USAGE',snapshot});return {ok:!!stored.ok,status:stored.ok?'ok':'store-failed'};
      }catch(e){const status=e.name==='AbortError'?'timeout':e.status||'network-error';await send({type:'UG_SERVER_ERROR',error:{status,ts:Date.now()}});return {ok:false,status,sessionRenewed:manual};}
      finally{inFlight=null;}
    })();return inFlight;
  }
  const poll=()=>{if(!document.hidden)void send({type:'UG_POLL_LIVE'});};
  setTimeout(poll,1200);setInterval(poll,5*60*1000);document.addEventListener('visibilitychange',poll);
  chrome.runtime.onMessage.addListener((msg,_sender,reply)=>{if(msg?.type!=='UG_CAPTURE_SERVER')return false;capture(msg.manual===true).then(reply);return true;});
})();
