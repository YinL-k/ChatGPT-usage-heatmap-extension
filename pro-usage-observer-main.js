/* MAIN-world, read-only Pro allowance observer.
   Reads only same-origin JSON responses that look like account/model usage metadata.
   It never exports conversation text; only normalized quota/reset fields are posted. */
(()=>{
  'use strict';
  if(globalThis.__sakuraProUsageObserverV1)return;
  Object.defineProperty(globalThis,'__sakuraProUsageObserverV1',{value:true,configurable:true});
  const SOURCE='SAKURA_PRO_USAGE_OBSERVER_V1';
  const MAX_BYTES=2*1024*1024,MAX_NODES=800,MAX_METERS=24;
  let lastSnapshot=null,lastSignature='',lastEmit=0;
  const clean=(v,n=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,n):'';
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const num=v=>{const n=typeof v==='number'?v:typeof v==='string'&&/^-?\d+(?:\.\d+)?$/.test(v.trim())?Number(v):NaN;return Number.isFinite(n)?n:null;};
  const nonneg=v=>{const n=num(v);return n!==null&&n>=0?n:null;};
  const pct=v=>{const n=num(v);return n!==null&&n>=0&&n<=100?n:null;};
  const proToken=v=>/(^|[-_\s])pro($|[-_\s])/.test(clean(v,120).toLowerCase());
  const firstText=(r,keys)=>{for(const k of keys){const v=clean(r[k],120);if(v)return v;}return '';};
  function resetAt(r,now){
    for(const k of ['reset_at','resets_at','resetAt','resetsAt','next_reset_at','nextResetAt']){
      const v=r[k],n=num(v);if(n!==null){const ts=n>=1e12?n:n*1000;if(Number.isFinite(ts)&&ts>946684800000&&ts<4133980800000)return ts;}
      if(typeof v==='string'){const ts=Date.parse(v);if(Number.isFinite(ts))return ts;}
    }
    for(const k of ['reset_after_seconds','reset_after','resets_after','resetAfterSeconds']){const n=nonneg(r[k]);if(n!==null)return now+n*1000;}
    return null;
  }
  function windowSeconds(r){
    for(const k of ['limit_window_seconds','window_seconds','windowSeconds','period_seconds','periodSeconds']){const n=nonneg(r[k]);if(n!==null&&n>0)return n;}
    return null;
  }
  function candidate(raw,path,now){
    const r=obj(raw);
    const label=firstText(r,['feature_name','model_slug','model','name','label','limit_name','metered_feature','feature','slug','id']);
    const tier=firstText(r,['model_tier','product_tier','subscription_tier','tier']);
    const pathText=path.join(' ');
    const explicitPro=proToken(label)||proToken(tier)||proToken(pathText)||r.is_pro===true||r.pro===true;
    if(!explicitPro)return null;
    let remaining=nonneg(r.remaining??r.remaining_messages??r.messages_remaining??r.remaining_count??r.remainingCount);
    let limit=nonneg(r.limit??r.total??r.message_limit??r.messages_limit??r.max??r.capacity);
    const used=nonneg(r.used??r.used_count??r.messages_used??r.count_used);
    let usedPercent=pct(r.used_percent??r.usedPercent??r.percent_used??r.percentage_used);
    let remainingPercent=pct(r.remaining_percent??r.remainingPercent??r.percent_remaining??r.percentage_remaining);
    if(remaining===null&&limit!==null&&used!==null)remaining=Math.max(0,limit-used);
    if(remainingPercent===null&&usedPercent!==null)remainingPercent=100-usedPercent;
    if(remainingPercent===null&&remaining!==null&&limit!==null&&limit>0)remainingPercent=Math.max(0,Math.min(100,100*remaining/limit));
    if(usedPercent===null&&remainingPercent!==null)usedPercent=100-remainingPercent;
    const reset=resetAt(r,now),win=windowSeconds(r);
    if([remaining,limit,usedPercent,remainingPercent,reset,win].every(v=>v===null))return null;
    const id=clean(r.id||r.slug||r.model_slug||r.feature_name||r.limit_name||label||path.slice(-2).join(':'),140)||'pro';
    return {id,label:label||'Pro',remaining,limit,usedPercent,remainingPercent,resetAt:reset,windowSeconds:win};
  }
  function extract(data,now){
    const meters=[],seen=new Set();let nodes=0;
    function walk(v,path,depth){
      if(depth>7||nodes++>MAX_NODES||v==null)return;
      if(Array.isArray(v)){for(let i=0;i<Math.min(v.length,60);i++)walk(v[i],path.concat(String(i)),depth+1);return;}
      if(typeof v!=='object')return;
      const c=candidate(v,path,now);
      if(c){const key=[c.id,c.label,c.resetAt,c.remaining,c.remainingPercent].join('|');if(!seen.has(key)){seen.add(key);meters.push(c);if(meters.length>=MAX_METERS)return;}}
      for(const [k,x] of Object.entries(v)){if(meters.length>=MAX_METERS)break;if(/^(?:messages?|conversation|content|text|prompt|response_text|transcript)$/i.test(k))continue;walk(x,path.concat(clean(k,60)),depth+1);}
    }
    walk(data,[],0);return meters;
  }
  function sameOriginUrl(raw){try{const u=new URL(raw,location.href);return u.origin===location.origin?u:null;}catch{return null;}}
  function eligible(url){
    const u=sameOriginUrl(url);if(!u)return false;const p=u.pathname.toLowerCase();
    if(/conversation|responses|chat\/completions|\/messages(?:\/|$)/.test(p))return false;
    return /backend-api|\/api\//.test(p);
  }
  function emit(meters,url){
    if(!meters.length)return;const now=Date.now();const snapshot={meters,updatedAt:now,source:sameOriginUrl(url)?.pathname||''};
    const sig=JSON.stringify(snapshot.meters.map(m=>[m.id,m.remaining,m.limit,m.remainingPercent,m.resetAt,m.windowSeconds]));
    lastSnapshot=snapshot;if(sig===lastSignature&&now-lastEmit<60000)return;lastSignature=sig;lastEmit=now;
    try{window.postMessage({source:SOURCE,type:'PRO_USAGE_OBSERVED',at:now,snapshot},location.origin);}catch{}
  }
  async function inspectResponse(res,url){
    try{
      if(!eligible(url)||!res||!res.ok)return;
      const type=(res.headers?.get?.('content-type')||'').toLowerCase();if(type&&!type.includes('json'))return;
      const len=Number(res.headers?.get?.('content-length')||0);if(len>MAX_BYTES)return;
      const text=await res.text();if(!text||text.length>MAX_BYTES)return;
      const data=JSON.parse(text),meters=extract(data,Date.now());emit(meters,url);
    }catch{}
  }
  const originalFetch=window.fetch;
  if(typeof originalFetch==='function'){
    window.fetch=function(input,init){
      const url=typeof input==='string'?input:input?.url||String(input||'');
      const p=originalFetch.apply(this,arguments);
      try{p.then(res=>{try{void inspectResponse(res.clone(),url);}catch{}},()=>{});}catch{}
      return p;
    };
  }
  if(typeof XMLHttpRequest!=='undefined'){
    const meta=new WeakMap(),open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open=function(method,url){try{meta.set(this,{url:String(url||'')});}catch{}return open.apply(this,arguments);};
    XMLHttpRequest.prototype.send=function(){
      try{this.addEventListener('loadend',()=>{const m=meta.get(this)||{};if(!eligible(m.url)||this.status<200||this.status>=300)return;try{const data=this.responseType==='json'?this.response:JSON.parse(this.responseText||'');const meters=extract(data,Date.now());emit(meters,m.url);}catch{}},{once:true});}catch{}
      return send.apply(this,arguments);
    };
  }
  window.addEventListener('message',e=>{
    if(e.source!==window||e.origin!==location.origin)return;const d=e.data;
    if(d?.source===SOURCE&&d?.type==='PRO_USAGE_PING'&&lastSnapshot){try{window.postMessage({source:SOURCE,type:'PRO_USAGE_OBSERVED',at:Date.now(),snapshot:lastSnapshot},location.origin);}catch{}}
  },false);
})();