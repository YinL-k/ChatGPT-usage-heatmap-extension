/* Public third-party forecast only. Never reads or changes personal usage. */
(function (root) {
  'use strict';
  const ENDPOINT='https://codex-reset.com/api/forecast', KEY='gptTrackerResetForecastV1';
  const INTERVAL=15*60*1000, STALE=60*60*1000;
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
  const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
  const percent=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?Math.round(v):null;
  function safeURL(v){try{const u=new URL(v);return u.protocol==='https:'&&['x.com','twitter.com','codex-reset.com'].includes(u.hostname)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
  function normalize(raw,now=Date.now()){
    const r=obj(raw),p=obj(r.probabilities),updated=date(r.updated_at),last=date(r.last_reset_at);
    if(!updated||updated>now+300000)throw new Error('invalid_response');
    const probability=(rounded,rawValue)=>percent(rounded)??(typeof rawValue==='number'&&rawValue>=0&&rawValue<=1?percent(rawValue*100):null);
    const h24=probability(p.rounded_24h,p.raw_24h),h48=probability(p.rounded_48h,p.raw_48h);
    if(h24===null&&h48===null)throw new Error('invalid_response');
    if(h24!==null&&h48!==null&&h48<h24)throw new Error('invalid_response');
    const context=obj(r.context),post=obj(context.primary_post),alert=obj(r.latest_alert),window=obj(alert.window);
    // A watch/announcement is never a confirmed reset; banked credits are separate.
    let signal='none',url=null,expires=null;
    if(alert.kind==='watch'&&alert.state==='active'&&date(alert.source_at)<=now){
      expires=date(window.end_at);signal=expires&&expires<now?'expired':'watch';url=safeURL(alert.url);
    }else if(context.state==='TEASE'&&date(post.at)<=now){signal='hint';url=safeURL(post.url);}
    return {updated,h24,h48,last:last&&last<=now?last:null,confidence:['low','medium','high'].includes(r.confidence)?r.confidence:'unknown',signal,url,expires};
  }
  const api={normalize,safeURL,ENDPOINT,INTERVAL,STALE};
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  root.GPTResetForecast=api;
  document.addEventListener('DOMContentLoaded',()=>{
    const card=document.getElementById('resetForecast'),panel=document.getElementById('overviewView');if(!card||!panel)return;
    const $=id=>document.getElementById(id),tr=k=>root.GPTTrackerI18n.t(`rf_${k}`);
    let data=null,fetched=0,next=0,failures=0,busy=false,error=false,timer=null,controller=null,ready=false;
    const active=()=>!document.hidden&&!panel.hidden;
    function read(){try{
      const c=JSON.parse(localStorage.getItem(KEY)||'null'),d=obj(c?.data);
      if(c?.version!==1||!Number.isFinite(c.fetched)||c.fetched>Date.now()+300000)return;
      next=Number.isFinite(c.next)?Math.min(c.next,Date.now()+STALE):0;failures=Number.isInteger(c.failures)?Math.max(0,Math.min(7,c.failures)):0;error=!!c.error;
      if(!c.data)return;
      // Revalidate cached public fields, never trust arbitrary storage as markup.
      data=normalize({updated_at:new Date(d.updated).toISOString(),last_reset_at:d.last?new Date(d.last).toISOString():null,probabilities:{rounded_24h:d.h24,rounded_48h:d.h48},confidence:d.confidence});
      data.signal=['none','hint','watch','expired'].includes(d.signal)?d.signal:'none';data.url=safeURL(d.url);data.expires=Number.isFinite(d.expires)?d.expires:null;
      fetched=c.fetched;
    }catch{/* Invalid cache is ignored. */}}
    function save(){try{localStorage.setItem(KEY,JSON.stringify({version:1,data,fetched,next,failures,error}));}catch{/* Forecast remains usable when storage is full. */}}
    function format(ts,full=false){return ts?new Date(ts).toLocaleString(document.documentElement.lang,{month:'short',day:'numeric',...(full?{hour:'2-digit',minute:'2-digit'}:{year:'numeric'})}):'—';}
    function render(){
      const stale=data&&Date.now()-data.updated>STALE;
      const status=busy?'loading':error?(data?(stale?'stale':'cached'):'error'):stale?'stale':data?(Date.now()-fetched<60000?'live':'cached'):'unavailable';
      card.dataset.state=status;$('rfStatus').textContent=tr(status);$('rfRefresh').disabled=busy||Date.now()<next&&error;
      $('rfRefresh').setAttribute('aria-busy',String(busy));$('rfRefresh').setAttribute('aria-label',tr('refresh'));$('rfRefresh').title=tr(error&&Date.now()<next?'backoff':'refresh');
      for(const h of [24,48]){const v=data?.['h'+h];$('rf'+h).textContent=v==null?'—':v+'%';$('rfBar'+h).style.width=(v??0)+'%';}
      $('rfLast').textContent=format(data?.last);$('rfLast').title=format(data?.last,true);
      const state=data?.signal==='watch'&&data.expires&&data.expires<Date.now()?'expired':data?.signal||'none';
      $('rfSignal').textContent=tr(data?'signal_'+state:'signal_unknown');
      $('rfSignalLink').href=data?.url||'https://codex-reset.com/';
      $('rfConfidence').textContent=tr('confidence_'+(data?.confidence||'unknown'));
      $('rfUpdated').textContent=tr('updated')+' '+format(data?.updated,true);
      $('rfError').textContent=error?tr(data?'cache_error':'fetch_error'):stale?tr('stale_note'):tr('note');
    }
    function schedule(){clearTimeout(timer);if(active())timer=setTimeout(()=>{render();void refresh(false);},Math.max(1000,Math.min(60000,next-Date.now())));}
    async function request(force){
      read();if(!active()||(!force&&Date.now()<next)||(error&&Date.now()<next))return;
      if(force&&Date.now()-fetched<60000)return;
      controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),10000);
      try{
        const res=await fetch(ENDPOINT,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal});
        if(!res.ok){const retry=res.headers.get('retry-after');const delay=retry?(Number.isFinite(Number(retry))?Number(retry)*1000:Date.parse(retry)-Date.now()):0;next=Date.now()+Math.max(0,Math.min(STALE,delay||0));throw new Error('http_'+res.status);}
        data=normalize(await res.json());fetched=Date.now();failures=0;error=false;next=fetched+INTERVAL;save();
      }catch(e){
        if(!active()&&e.name==='AbortError')return;
        failures=Math.min(failures+1,7);error=true;next=Math.max(next,Date.now()+Math.min(STALE,60000*2**(failures-1)));save();
      }finally{clearTimeout(timeout);controller=null;}
    }
    async function refresh(force=false){
      if(!ready||busy||!active())return;
      if(!force&&Date.now()<next){schedule();return;}
      busy=true;render();
      try{
        if(navigator.locks)await navigator.locks.request(KEY,{ifAvailable:true},async lock=>{if(lock)await request(force);else{read();next=Math.max(next,Date.now()+60000);}});
        else await request(force);
      }finally{busy=false;render();schedule();}
    }
    function visibility(){if(!ready)return;if(active()){read();render();void refresh();}else{clearTimeout(timer);controller?.abort();}}
    $('rfRefresh').addEventListener('click',()=>void refresh(true));
    document.addEventListener('visibilitychange',visibility);
    new MutationObserver(visibility).observe(panel,{attributes:true,attributeFilter:['hidden']});
    document.addEventListener('gpt-language-changed',render);
    window.addEventListener('storage',e=>{if(e.key===KEY){read();render();schedule();}});
    window.addEventListener('pagehide',()=>{clearTimeout(timer);controller?.abort();});
    // Wait for the dashboard to restore its selected tab before any request.
    document.addEventListener('gpt-heatmap-ready',()=>{ready=true;read();render();void refresh();});
    render();
  });
})(typeof window==='object'?window:globalThis);