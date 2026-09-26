/* Isolated-world bridge for the MAIN-world Pro usage observer. Works in all ChatGPT frames. */
(()=>{
  'use strict';
  try{globalThis.__sakuraProUsageBridgeCleanupV2?.();}catch{}
  Object.defineProperty(globalThis,'__sakuraProUsageBridgeV2',{value:true,configurable:true,writable:true});
  const SOURCE='SAKURA_PRO_USAGE_OBSERVER_V1';
  const clean=(v,n=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,n):'';
  const num=v=>Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
  const pct=v=>{const n=num(v);return n!==null&&n<=100?n:null;};
  function send(m){
    try{
      const runtime=globalThis.chrome?.runtime;
      if(!runtime||typeof runtime.sendMessage!=='function')return Promise.resolve({ok:false});
      return Promise.resolve(runtime.sendMessage(m)).catch(()=>({ok:false}));
    }catch{return Promise.resolve({ok:false});}
  }
  function onMessage(e){
    if(e.source!==window||e.origin!==location.origin)return;
    const d=e.data;if(!d||d.source!==SOURCE||d.type!=='PRO_USAGE_OBSERVED'||!Number.isFinite(d.at))return;
    const raw=d.snapshot&&typeof d.snapshot==='object'?d.snapshot:{};
    const meters=(Array.isArray(raw.meters)?raw.meters:[]).slice(0,24).map((m,i)=>{m=m&&typeof m==='object'?m:{};return{id:clean(m.id||('pro:'+i),140),label:clean(m.label||'Pro',100),remaining:num(m.remaining),limit:num(m.limit),usedPercent:pct(m.usedPercent),remainingPercent:pct(m.remainingPercent),resetAt:num(m.resetAt),windowSeconds:num(m.windowSeconds)};}).filter(m=>[m.remaining,m.limit,m.usedPercent,m.remainingPercent,m.resetAt,m.windowSeconds].some(v=>v!==null));
    if(meters.length)void send({type:'UG_PRO_SERVER_USAGE',snapshot:{meters,updatedAt:d.at,source:clean(raw.source,160)}});
  }
  window.addEventListener('message',onMessage,false);
  globalThis.__sakuraProUsageBridgeCleanupV2=()=>window.removeEventListener('message',onMessage,false);
  try{window.postMessage({source:SOURCE,type:'PRO_USAGE_PING'},location.origin);}catch{}
})();