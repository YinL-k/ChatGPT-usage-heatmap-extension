/* MAIN-world, read-only request observer. Extracts model metadata + user message id only; never exports message content. */
(()=>{
  'use strict';
  if(globalThis.__sakuraRequestModelObserverV2)return;
  Object.defineProperty(globalThis,'__sakuraRequestModelObserverV2',{value:true,configurable:true});
  const SOURCE='SAKURA_MODEL_OBSERVER_V2',MAX_BODY=2*1024*1024;
  const clean=(v,n=160)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,n):'';
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const value=(...xs)=>xs.find(v=>typeof v==='string'&&clean(v))||'';
  const effort=(...xs)=>{
    for(const raw of xs){const v=clean(raw,64),m=v.match(/(?:extra[\s_-]*high|high|medium|instant|low|minimal)/i);if(m)return clean(m[0],48).toLowerCase().replace(/[_-]+/g,' ');}
    return '';
  };
  const tier=(...xs)=>{
    for(const raw of xs){if(raw===true||raw===1)return 'pro';const v=clean(raw,64).toLowerCase();if(!v)continue;if(v==='pro'||/(^|[-_\s])pro($|[-_\s])/.test(v))return 'pro';if(/^(standard|free|plus|go|basic|default|regular)$/.test(v))return 'standard';}
    return '';
  };
  function roleOf(m){return clean(obj(obj(m).author).role||obj(m).role,32).toLowerCase();}
  function idOf(m){
    m=obj(m);
    return clean(m.id||m.message_id||m.messageId||m.client_id||m.clientId||obj(m.metadata).message_id||obj(m.metadata).messageId,160);
  }
  function lastUserMessageId(body){
    const b=obj(body),messages=Array.isArray(b.messages)?b.messages:[];
    for(let i=messages.length-1;i>=0;i--){if(roleOf(messages[i])==='user'){const id=idOf(messages[i]);if(id)return id;}}
    return clean(b.message_id||b.messageId||b.client_message_id||b.clientMessageId,160);
  }
  function looksLikeSendBody(body,url){
    const b=obj(body),action=clean(b.action,40).toLowerCase();
    const messages=Array.isArray(b.messages)?b.messages:[];
    const hasUser=messages.some(m=>roleOf(m)==='user');
    let path='';try{path=new URL(url,location.href).pathname.toLowerCase();}catch{}
    return action==='next'||hasUser||/(conversation|responses|chat\/completions|\/messages(?:\/|$))/.test(path);
  }
  function extract(body){
    const b=obj(body),cfg=obj(b.model_configuration||b.model_config),meta=obj(b.metadata),runtime=obj(b.runtime||b.runtime_config);
    const model=value(
      b.model,b.model_slug,b.model_id,b.selected_model,b.resolved_model,b.resolved_model_slug,
      cfg.model,cfg.model_slug,cfg.model_id,cfg.slug,cfg.selected_model,cfg.resolved_model,
      runtime.model,runtime.model_slug,runtime.model_id,meta.model_slug,meta.model,meta.model_id
    );
    const modelTier=tier(
      b.model_tier,b.product_tier,b.subscription_tier,b.tier,b.is_pro,b.pro,
      cfg.model_tier,cfg.product_tier,cfg.tier,cfg.is_pro,cfg.pro,
      runtime.model_tier,runtime.tier,runtime.is_pro,runtime.pro,
      meta.model_tier,meta.product_tier,meta.tier,meta.is_pro,meta.pro
    );
    const thinking=effort(
      b.reasoning_effort,b.thinking_effort,cfg.reasoning_effort,cfg.thinking_effort,
      runtime.reasoning_effort,runtime.thinking_effort,meta.reasoning_effort,meta.thinking_effort
    );
    return {model:clean(model,120),tier:modelTier,effort:thinking,messageId:lastUserMessageId(b)};
  }
  function emit(body,url){
    if(!looksLikeSendBody(body,url))return;
    const snapshot=extract(body);if(!snapshot.model&&!snapshot.tier&&!snapshot.effort&&!snapshot.messageId)return;
    try{window.postMessage({source:SOURCE,type:'MODEL_OBSERVED',at:Date.now(),snapshot},location.origin);}catch{}
  }
  function inspect(raw,url){
    try{
      if(raw==null)return;
      if(typeof raw==='string'){
        if(raw.length>MAX_BODY)return;
        const s=raw.trim();if(!s||!['{','['].includes(s[0]))return;
        emit(JSON.parse(s),url);return;
      }
      if(typeof URLSearchParams!=='undefined'&&raw instanceof URLSearchParams){
        const s=raw.toString();if(s.length<=MAX_BODY){try{emit(JSON.parse(raw.get('payload')||raw.get('data')||''),url);}catch{}}
        return;
      }
      if(typeof FormData!=='undefined'&&raw instanceof FormData){
        const small={};for(const [k,v] of raw.entries()){if(typeof v==='string'&&v.length<2000&&/(model|tier|effort|action|message.*id|client.*id)/i.test(k))small[k]=v;}emit(small,url);return;
      }
      if(raw&&typeof raw==='object'&&!('arrayBuffer' in raw))emit(raw,url);
    }catch{}
  }
  function schedule(raw,url){try{queueMicrotask(()=>inspect(raw,url));}catch{}}
  const originalFetch=window.fetch;
  if(typeof originalFetch==='function'){
    window.fetch=function(input,init){
      try{
        const url=typeof input==='string'?input:input?.url||String(input||'');
        const method=clean(init?.method||input?.method||'GET',16).toUpperCase();
        if(!['GET','HEAD','OPTIONS'].includes(method)){
          if(init&&Object.prototype.hasOwnProperty.call(init,'body'))schedule(init.body,url);
          else if(typeof Request!=='undefined'&&input instanceof Request){try{input.clone().text().then(t=>inspect(t,url),()=>{});}catch{}}
        }
      }catch{}
      return originalFetch.apply(this,arguments);
    };
  }
  if(typeof XMLHttpRequest!=='undefined'){
    const meta=new WeakMap(),open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open=function(method,url){try{meta.set(this,{method:clean(method,16).toUpperCase(),url:String(url||'')});}catch{}return open.apply(this,arguments);};
    XMLHttpRequest.prototype.send=function(body){try{const m=meta.get(this)||{};if(!['GET','HEAD','OPTIONS'].includes(m.method))schedule(body,m.url);}catch{}return send.apply(this,arguments);};
  }
})();