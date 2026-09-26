(()=>{
  'use strict';
  const root=document.documentElement;
  root.classList.add('sm-motion-pending');
  const reduced=()=>matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const pop=(el)=>{
    if(!el||reduced())return;
    el.classList.remove('sm-value-updated');
    void el.offsetWidth;
    el.classList.add('sm-value-updated');
    clearTimeout(el.__smMotionTimer);
    el.__smMotionTimer=setTimeout(()=>el.classList.remove('sm-value-updated'),460);
  };
  const observeText=(el)=>{
    if(!el||el.dataset.smMotionObserved)return;
    el.dataset.smMotionObserved='1';
    let previous=el.textContent;
    new MutationObserver(()=>{
      const next=el.textContent;
      if(next!==previous){previous=next;pop(el);}
    }).observe(el,{subtree:true,childList:true,characterData:true});
  };
  const animateNewChildren=(el)=>{
    if(!el||el.dataset.smMotionList)return;
    el.dataset.smMotionList='1';
    const decorate=(nodes)=>nodes.forEach((n,i)=>{
      if(!(n instanceof HTMLElement||n instanceof SVGElement))return;
      n.style.setProperty('--sm-i',String(i));
      n.querySelectorAll?.('.progress-fill,.cycle-progress>span,.window-progress>span,.rf-track>span,.codex-reset-track>span,.summary-bar-fill').forEach(pulseProgress);
      n.classList.add('sm-item-enter');
      setTimeout(()=>n.classList.remove('sm-item-enter'),520+i*20);
    });
    decorate([...el.children]);
    new MutationObserver(records=>{
      for(const r of records)decorate([...r.addedNodes].filter(n=>n.nodeType===1));
    }).observe(el,{childList:true});
  };
  function pulseProgress(el){
    if(!el||el.dataset.smMotionProgress)return;
    el.dataset.smMotionProgress='1';
    let last=el.getAttribute('style')||'';
    new MutationObserver(()=>{
      const next=el.getAttribute('style')||'';
      if(next===last)return;last=next;
      if(reduced())return;
      el.classList.remove('sm-progress-updated');void el.offsetWidth;el.classList.add('sm-progress-updated');
      clearTimeout(el.__smProgressTimer);el.__smProgressTimer=setTimeout(()=>el.classList.remove('sm-progress-updated'),760);
    }).observe(el,{attributes:true,attributeFilter:['style']});
  }
  function watchWelcome(){
    const w=document.getElementById('welcome');if(!w)return;
    const play=()=>{if(w.hidden||reduced())return;w.classList.remove('sm-welcome-live');void w.offsetWidth;w.classList.add('sm-welcome-live');setTimeout(()=>w.classList.remove('sm-welcome-live'),1000)};
    new MutationObserver(play).observe(w,{attributes:true,attributeFilter:['hidden']});
    if(!w.hidden)play();
  }
  function decorateStatic(){
    document.querySelectorAll('.overview-kpi,.overview-panel,.stat-box,.setting-block').forEach((el,i)=>el.style.setProperty('--sm-i',String(i%8)));
    const dots=document.querySelectorAll('#usageTrendDots circle');dots.forEach((el,i)=>el.style.setProperty('--sm-i',String(i)));
    [
      '#compactPlan','#proPrimary','#codexPrimary','#compactToday','#compactWeek','#usageTrendToday','#usageTrendDelta',
      '#overviewWeek','#overviewMonth','#overviewPro','#overviewCodex','#overviewToday','#overviewAvg7','#overviewTrackingSince',
      '#yearTotal','#activeDays','#avgDaily','#currentStreak','#longestStreak','#rf24','#rf48','#rfLast',
      '#selectedPlan','#creditsValue'
    ].forEach(s=>observeText(document.querySelector(s)));
    ['#usageTrendDots','#overviewResets','#monthlyTotals','#weeklyTotals','#codexMeters','#proCycles','#resetHistory'].forEach(s=>animateNewChildren(document.querySelector(s)));
    document.querySelectorAll('.progress-fill,.cycle-progress>span,.window-progress>span,.rf-track>span,.codex-reset-track>span,.summary-bar-fill').forEach(pulseProgress);
    watchWelcome();
    const trendDots=document.getElementById('usageTrendDots');
    if(trendDots&&!trendDots.dataset.smDotWatch){
      trendDots.dataset.smDotWatch='1';
      new MutationObserver(()=>[...trendDots.querySelectorAll('circle')].forEach((el,i)=>el.style.setProperty('--sm-i',String(i)))).observe(trendDots,{childList:true});
    }
  }
  function ready(){
    decorateStatic();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      root.classList.add('sm-motion-ready');
      root.classList.remove('sm-motion-pending');
      setTimeout(()=>root.classList.add('sm-motion-settled'),900);
    }));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();