(()=>{
'use strict';
const C=GPTUsageCore,SCOPE=C.LOCAL_SCOPE;
const t=(key,fallback)=>window.GPTTrackerI18n?.t(key,fallback)||fallback||key;
const send=message=>chrome.runtime.sendMessage(message).catch(()=>({ok:false,error:'extension_reloaded'}));
const $=id=>document.getElementById(id);
const TRUST_KINDS=['live','cached','stale','unavailable','estimated','tracking','calibrated','error'];
let state=C.freshState(),stats={today:0,week:0,month:0,total:0},activity={todayHours:Array(24).fill(0),avg7:null},live=null,liveError=null,refreshing=false;

function fmt(n){return Number.isFinite(n)?new Intl.NumberFormat(document.documentElement.lang).format(n):'—';}
function formatShortDate(ts){if(!Number.isFinite(ts))return '';return new Date(ts).toLocaleString(document.documentElement.lang,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function formatSince(ts){if(!Number.isFinite(ts))return '';return new Date(ts).toLocaleDateString(document.documentElement.lang,{month:'short',day:'numeric'});}
function setText(id,value=''){const el=$(id);if(el)el.textContent=value;}
function setTrust(el,kind,label){if(!el)return;el.classList.remove(...TRUST_KINDS);el.classList.add(kind);const labelEl=el.querySelector('.trust-label');if(labelEl)labelEl.textContent=label;else el.textContent=label;}
function manualPlan(){const p=C.obj(state.settings[SCOPE]).plan||'auto';return p==='auto'?'':p;}
function selectedPlan(){return manualPlan()||live?.plan||'';}
function chooseRule(rules){return rules.find(r=>r.id==='combined_day')||rules.find(r=>r.id.startsWith('shared_'))||rules[0]||null;}
function freshLabel(kind){if(kind==='error')return t('trust_error');return kind==='live'?t('trust_live','Live'):kind==='cached'?t('trust_cached','Cached'):kind==='stale'?t('trust_stale','Stale'):t('trust_unavailable','Unavailable');}
function meter(id){return live?.meters?.find(m=>m.id===id)||null;}
function setProgress(id,pct,labelId){
  const track=$(id),fill=track?.querySelector('.progress-fill');if(!track||!fill)return;
  const label=$(labelId);
  if(!Number.isFinite(pct)){fill.style.width='0%';track.setAttribute('aria-disabled','true');track.removeAttribute('aria-valuenow');if(label)label.textContent='';return;}
  const clean=Math.max(0,Math.min(100,pct));fill.style.width=`${clean}%`;track.removeAttribute('aria-disabled');track.setAttribute('aria-valuenow',String(clean));if(label)label.textContent=`${fmt(clean)}%`;
}
function renderPlanStatus(freshness){
  const b=$('planTrust');if(!b)return;
  if(refreshing){b.disabled=true;b.classList.add('is-refreshing');setTrust(b,'cached',t('refresh_refreshing','Refreshing…'));return;}
  b.classList.remove('is-refreshing');
  if(freshness.kind==='live'){b.disabled=true;setTrust(b,'live',t('trust_live','Live'));b.title=t('compact_server_reported','Reported by ChatGPT');return;}
  b.disabled=false;
  if(freshness.kind==='error'){setTrust(b,'error',t('trust_error'));b.title=t('error_cached');return;}
  if(freshness.kind==='cached'){setTrust(b,'cached',`${t('trust_cached','Cached')} ↻`);b.title=t('refresh_action','Refresh');return;}
  if(freshness.kind==='stale'){setTrust(b,'stale',`${t('trust_stale','Stale')} ↻`);b.title=t('refresh_action','Refresh');return;}
  setTrust(b,'unavailable',`${t('refresh_retry','Retry')} ↻`);b.title=t('refresh_retry','Retry');
}
function renderLocal(){
  const today=Number(stats.today)||0,week=Number(stats.week)||0,avg=Number(activity?.avg7);
  setText('compactToday',fmt(today));setText('compactWeek',fmt(week));
  setText('todayCaption',today?`${fmt(today)} ${t('popup_messages_tracked','messages tracked')}`:t('popup_no_usage','No usage yet'));
  setText('weekCaption',week?`${fmt(week)} ${t('popup_messages_tracked','messages tracked')}`:t('popup_still_quiet','Still quiet'));
  if(today===0){setText('compactActivityContext',t('popup_keeping_light','Keeping it light'));setText('activityContextCaption',t('popup_essentials','Just the essentials.'));return;}
  if(Number.isFinite(avg)&&avg>0){const pct=Math.round(((today-avg)/avg)*100),sign=pct>0?'+':'';setText('compactActivityContext',`${sign}${pct}% ${t('compact_vs_7d_avg','vs 7-day avg')}`);setText('activityContextCaption',`${fmt(week)} ${t('compact_this_week','this week')}`);return;}
  setText('compactActivityContext',`${fmt(today)} ${t('compact_messages','messages')}`);setText('activityContextCaption',`${fmt(week)} ${t('compact_this_week','this week')}`);
}
function render(){
  const freshness=C.liveStatus(live,liveError),planKey=selectedPlan(),plan=C.plans[planKey];
  if(freshness.kind==='live')GPTFeedback.clearRefreshNotice(live.updatedAt);
  setText('compactPlan',plan?.label||t('u_unknown','Not identified yet'));
  if(manualPlan()){
    setText('compactStatus',t('first_manual_plan','Using a manual plan override from Dashboard settings.'));
    const b=$('planTrust');b.disabled=true;setTrust(b,'tracking',t('compact_local','Local'));
  }else if(live?.plan){
    setText('compactStatus',t('popup_detected_source'));renderPlanStatus(freshness);
  }else{
    setText('compactStatus',t('first_no_tab','Open ChatGPT to connect automatically.'));renderPlanStatus(liveError?{kind:'error'}:{kind:'unavailable'});
  }
  renderLocal();
  let saved=$('popupCacheNote');
  if(!saved){saved=document.createElement('p');saved.id='popupCacheNote';saved.className='popup-cache-note';saved.setAttribute('role','status');document.querySelector('.codex .card-bottom').append(saved);}
  saved.textContent=GPTFeedback.savedUsage(live,freshness.kind);saved.hidden=!saved.textContent;
  document.querySelector('.codex').classList.toggle('has-saved-data',!!saved.textContent);

  const resetPro=()=>{setText('proPrimary','—');setText('proSuffix','');setText('proTrackingText','');setText('proResetText','');setProgress('proProgress',null,'proPercentLabel');};
  if(!plan){resetPro();setText('proTrackingText',t('compact_plan_unknown','Plan not identified'));setTrust($('proTrust'),'unavailable',t('trust_unavailable','Unavailable'));}
  else if(plan.rules===null){resetPro();setText('proTrackingText',t('release_managed','Allowance depends on workspace settings'));setTrust($('proTrust'),'unavailable',t('trust_unavailable','Unavailable'));}
  else if(!plan.rules.length){resetPro();setText('proTrackingText',t('release_no_pro','No Pro allowance preset for this plan'));setTrust($('proTrust'),'unavailable',t('trust_unavailable','Unavailable'));}
  else{
    const rule=chooseRule(C.allowance(state,SCOPE,planKey));
    if(rule?.remaining!==null){
      setText('proPrimary',fmt(rule.remaining));setText('proSuffix',`/ ${fmt(rule.cap)} ${t('popup_left','left')}`);setProgress('proProgress',100*Math.max(0,rule.remaining)/rule.cap,'proPercentLabel');
      setText('proTrackingText',`${t('compact_tracking_since','Tracking since')} ${formatSince(state.coverageStart)}`);
      setText('proResetText',Number.isFinite(rule.resetAt)?`${t('compact_resets','Resets')} ${formatShortDate(rule.resetAt)}`:t('compact_synced','Synced from your known balance'));
      setTrust($('proTrust'),'estimated',t('trust_estimated','Estimated'));
    }else if(rule){
      setText('proPrimary',fmt(rule.observed));setText('proSuffix',t('compact_used','used'));setProgress('proProgress',null,'proPercentLabel');
      setText('proTrackingText',`${t('compact_tracking_since','Tracking since')} ${formatSince(state.coverageStart)}`);setText('proResetText',`${fmt(rule.cap)} ${t('compact_plan_cap','plan cap')}`);
      setTrust($('proTrust'),'tracking',t('trust_tracking','Tracking'));
    }else{resetPro();setText('proTrackingText',t('compact_no_data','No data yet'));setTrust($('proTrust'),'unavailable',t('trust_unavailable','Unavailable'));}
  }

  const primary=meter('main:primary_window');
  const codexTitle=$('codex-title');codexTitle.textContent='Codex';
  const duration=document.createElement('span');duration.className='window-duration';duration.dataset.known=String(Number.isFinite(primary?.windowSeconds)&&primary.windowSeconds>0);duration.textContent=` · ${C.windowLabel(primary?.windowSeconds,document.documentElement.lang)}`;codexTitle.append(duration);codexTitle.title=codexTitle.textContent;
  if(primary&&Number.isFinite(primary.remainingPercent)){
    setText('codexPrimary',`${fmt(primary.remainingPercent)}%`);setText('codexSuffix',t('popup_left','left'));setProgress('codexProgress',primary.remainingPercent,'codexPercentLabel');
    setText('codexResetText',primary.resetAt?`${t('compact_resets','Resets')} ${formatShortDate(primary.resetAt)}`:t('compact_server_reported','Reported by ChatGPT'));
    setTrust($('codexTrust'),freshness.kind,freshLabel(freshness.kind));
  }else{
    setText('codexPrimary','—');setText('codexSuffix','');setText('codexResetText',t('compact_no_server','No live server meter'));setProgress('codexProgress',null,'codexPercentLabel');setTrust($('codexTrust'),liveError?'error':'unavailable',freshLabel(liveError?'error':'unavailable'));
  }
}
async function load({refresh=false}={}){const r=await send({type:'UG_STATE'});if(r.ok){state=C.state(r.state);stats=r.stats||stats;activity=r.activity||activity;live=r.liveUsage||null;liveError=r.liveError||null;}else GPTFeedback.status(t('state_error'),true);render();if(refresh&&(!live||C.freshness(live.updatedAt).kind!=='live'))void refreshLive();}
async function refreshLive(){
  if(refreshing)return;
  const b=$('planTrust');if(!b)return;
  refreshing=true;GPTFeedback.busy(true);renderPlanStatus(C.liveStatus(live,liveError));
  try{
    const r=await send({type:'UG_REFRESH_LIVE'});
    if(!r.refreshed)GPTFeedback.refreshStatus(r);else GPTFeedback.clearRefreshNotice();
    await load();
  }finally{refreshing=false;GPTFeedback.busy(false);render();}
}
function openDashboard(hash='usage'){chrome.tabs.create({url:chrome.runtime.getURL(`heatmap.html#${hash}`)});}
function syncLanguageButtons(lang){document.querySelectorAll('[data-language]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.language===lang)));}
function applyPopupTheme(theme){theme=theme==='light'?'light':'dark';const artboard=$('artboard'),toggle=$('popupThemeToggle');if(artboard)artboard.dataset.theme=theme;document.body.dataset.popupTheme=theme;document.dispatchEvent(new CustomEvent('gpt-popup-theme-changed'));if(toggle){toggle.setAttribute('aria-checked',String(theme==='dark'));toggle.setAttribute('aria-label',theme==='dark'?t('tooltip_switch_to_light'):t('tooltip_switch_to_dark'));}localStorage.setItem('gptTrackerTheme',theme);}
function fitReference(){const viewport=$('viewport'),artboard=$('artboard');if(!viewport||!artboard)return;const scale=Math.min(338/941,600/1672);artboard.style.setProperty('--scale',String(scale));viewport.style.width=`${941*scale}px`;viewport.style.height=`${1672*scale}px`;}

document.addEventListener('DOMContentLoaded',async()=>{
  fitReference();
  const prefersDark=window.matchMedia?.('(prefers-color-scheme: dark)').matches!==false;applyPopupTheme(localStorage.getItem('gptTrackerTheme')||(prefersDark?'dark':'light'));
  $('popupThemeToggle')?.addEventListener('click',()=>applyPopupTheme($('artboard').dataset.theme==='dark'?'light':'dark'));
  const langPref=await chrome.storage.sync.get('gptTrackerLang'),lang=langPref.gptTrackerLang||((navigator.language||'').toLowerCase().startsWith('zh')?'zh':'en');
  await window.GPTTrackerI18n.initI18n(lang);syncLanguageButtons(lang);
  document.querySelectorAll('[data-language]').forEach(btn=>btn.addEventListener('click',async()=>{const next=btn.dataset.language;await chrome.storage.sync.set({gptTrackerLang:next});await window.GPTTrackerI18n.initI18n(next);syncLanguageButtons(next);render();}));
  $('openDashboard')?.addEventListener('click',()=>openDashboard('usage'));
  $('openProDetails')?.addEventListener('click',()=>openDashboard('usage'));
  $('openCodexDetails')?.addEventListener('click',()=>openDashboard('usage'));
  $('openActivityDetails')?.addEventListener('click',()=>openDashboard('activity'));
  $('planTrust')?.addEventListener('click',()=>void refreshLive());
  document.addEventListener('gpt-notice-retry',()=>void refreshLive());
  document.addEventListener('gpt-language-changed',()=>{render();applyPopupTheme($('artboard').dataset.theme);});
  window.addEventListener('storage',e=>{if(e.key==='gptTrackerTheme')applyPopupTheme(e.newValue);});
  setInterval(()=>{if(!document.hidden)render();},30000);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='sync'&&changes.gptTrackerLang){void GPTTrackerI18n.initI18n(changes.gptTrackerLang.newValue).then(()=>syncLanguageButtons(GPTTrackerI18n.currentLang));}if(area==='local'&&(changes[C.KEY]||changes.__gptLiveUsageV1||changes.__gptLiveUsageErrorV1||Object.keys(changes).some(C.dateFromKey)))void load();});
  await load({refresh:true});
});
})();
