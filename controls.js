/* The native fields remain the source of truth for validation and saved data. */
(()=>{
  'use strict';
  const bindings=new Map();let open=null,scheduled=false;
  const t=k=>GPTTrackerI18n.t(k),lang=()=>document.documentElement.lang||'en';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function label(field){return field.closest('label')?.querySelector('span')?.textContent||field.getAttribute('aria-label')||t('year');}
  function close(focus=false){if(!open)return;const {popup,trigger}=open;open=null;popup.remove();trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  function position(){if(!open)return;const {popup,trigger}=open,r=trigger.getBoundingClientRect();popup.style.maxHeight=Math.max(160,innerHeight-24)+'px';if(!popup.classList.contains('date-popover'))popup.style.width=Math.min(innerWidth-24,Math.max(180,r.width))+'px';const w=popup.offsetWidth,h=popup.offsetHeight;popup.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px';popup.style.top=Math.max(12,r.bottom+h+8<innerHeight?r.bottom+6:r.top-h-6)+'px';}
  function begin(field,trigger,kind){close();const popup=el('div','control-popover '+(kind==='date'?'date-popover':''));popup.id='control-popup';popup.setAttribute('role',kind==='date'?'dialog':'listbox');popup.setAttribute('aria-label',label(field));document.body.append(popup);open={field,trigger,popup};trigger.setAttribute('aria-controls',popup.id);trigger.setAttribute('aria-expanded','true');return popup;}
  function commit(field,value){field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));sync();}
  function dropdown(field,trigger){
    if(open?.field===field){close(true);return;}
    const popup=begin(field,trigger,'select'),options=[...field.options].filter(o=>!o.hidden);let search='',searchAt=0;
    const buttons=options.map(o=>{const b=el('button','control-option',o.textContent);b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(o.selected));b.disabled=o.disabled||o.parentElement?.disabled;b.tabIndex=o.selected?0:-1;b.addEventListener('click',()=>{commit(field,o.value);close(true);});popup.append(b);return b;});
    function focus(index){const b=buttons[index];if(!b||b.disabled)return;buttons.forEach(x=>x.tabIndex=-1);b.tabIndex=0;b.focus();b.scrollIntoView({block:'nearest'});}
    popup.addEventListener('keydown',e=>{const enabled=buttons.filter(x=>!x.disabled),index=enabled.indexOf(document.activeElement);let b;
      if(e.key==='ArrowDown')b=enabled[Math.min(index+1,enabled.length-1)];if(e.key==='ArrowUp')b=enabled[Math.max(0,index-1)];if(e.key==='Home')b=enabled[0];if(e.key==='End')b=enabled.at(-1);
      if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&e.key!==' '){search=Date.now()-searchAt>700?e.key:search+e.key;searchAt=Date.now();b=enabled.find(x=>x.textContent.toLocaleLowerCase().startsWith(search.toLocaleLowerCase()));}
      if(b){e.preventDefault();focus(buttons.indexOf(b));}
    });position();focus(Math.max(0,buttons.findIndex(b=>b.getAttribute('aria-selected')==='true'&&!b.disabled)));
  }
  function calendar(field,trigger){
    if(open?.field===field){close(true);return;}
    const popup=begin(field,trigger,'date'),parsed=new Date(field.value),fallback=new Date(Date.now()+3600000);fallback.setMinutes(0,0,0);const initial=Number.isFinite(parsed.getTime())?parsed:fallback;
    let draft=new Date(initial),view=new Date(draft.getFullYear(),draft.getMonth(),1),hour=draft.getHours(),minute=draft.getMinutes();
    function render(focusDate,focusAction){
      popup.replaceChildren();const heading=el('div','calendar-heading');
      for(const direction of [-1,1]){const b=el('button','',direction<0?'‹':'›');b.type='button';b.dataset.action=direction<0?'previous':'next';b.setAttribute('aria-label',t(direction<0?'calendar_previous':'calendar_next'));b.addEventListener('click',()=>{view.setMonth(view.getMonth()+direction);render(null,b.dataset.action);});heading.append(b);}
      heading.insertBefore(el('strong','',view.toLocaleDateString(lang(),{year:'numeric',month:'long'})),heading.lastChild);popup.append(heading);
      const weekdays=el('div','calendar-weekdays');weekdays.setAttribute('aria-hidden','true');for(let i=0;i<7;i++)weekdays.append(el('span','',new Date(2024,0,1+i).toLocaleDateString(lang(),{weekday:'narrow'})));popup.append(weekdays);
      const days=el('div','calendar-days'),start=new Date(view);start.setDate(1-(start.getDay()+6)%7);
      for(let i=0;i<42;i++){const d=new Date(start);d.setDate(d.getDate()+i);const b=el('button',d.getMonth()!==view.getMonth()?'other-month':'',String(d.getDate()));b.type='button';b.dataset.day=iso(d);b.setAttribute('aria-label',d.toLocaleDateString(lang(),{dateStyle:'full'}));b.setAttribute('aria-pressed',String(iso(d)===iso(draft)));b.tabIndex=iso(d)===iso(draft)?0:-1;if(iso(d)===iso(new Date()))b.classList.add('today');
        b.addEventListener('click',()=>{draft=new Date(d);view=new Date(d.getFullYear(),d.getMonth(),1);render(iso(d));});
        b.addEventListener('keydown',e=>{const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};const next=new Date(d);if(e.key in moves)next.setDate(d.getDate()+moves[e.key]);else if(e.key==='Home')next.setDate(d.getDate()-(d.getDay()+6)%7);else if(e.key==='End')next.setDate(d.getDate()+6-(d.getDay()+6)%7);else if(e.key==='PageUp'||e.key==='PageDown'){next.setDate(1);next.setMonth(d.getMonth()+(e.key==='PageUp'?-1:1));}else return;e.preventDefault();view=new Date(next.getFullYear(),next.getMonth(),1);render(iso(next));});days.append(b);
      }popup.append(days);
      const time=el('div','calendar-time');
      for(const part of ['hour','minute']){const group=el('div','time-step'),input=el('input');input.type='number';input.min='0';input.max=part==='hour'?'23':'59';input.value=String(part==='hour'?hour:minute).padStart(2,'0');input.setAttribute('aria-label',t(part==='hour'?'calendar_hour':'calendar_minute'));input.inputMode='numeric';
        const update=()=>{const value=Number(input.value);if(Number.isInteger(value)&&value>=0&&value<=Number(input.max)){if(part==='hour')hour=value;else minute=value;}};input.addEventListener('input',update);
        for(const delta of [-1,1]){const b=el('button','',delta<0?'−':'+');b.type='button';b.setAttribute('aria-label',t(part==='hour'?'calendar_hour':'calendar_minute')+' '+(delta>0?'+':'−'));b.addEventListener('click',()=>{const value=((part==='hour'?hour:minute)+delta+Number(input.max)+1)%(Number(input.max)+1);if(part==='hour')hour=value;else minute=value;input.value=String(value).padStart(2,'0');});group.append(b);if(delta<0)group.append(input);}time.append(group);if(part==='hour')time.append(el('span','time-colon',':'));
      }popup.append(time);
      const actions=el('div','calendar-actions');
      for(const action of ['today','clear','cancel','apply']){const b=el('button',action,t(`calendar_${action}`));b.type='button';b.addEventListener('click',()=>{
        if(action==='cancel')close(true);
        if(action==='clear'){commit(field,'');close(true);}
        if(action==='today'){draft=new Date();view=new Date(draft.getFullYear(),draft.getMonth(),1);render(iso(draft));}
        if(action==='apply'){const invalid=[...time.querySelectorAll('input')].find(x=>x.value===''||!x.checkValidity());if(invalid){invalid.reportValidity();invalid.focus();return;}commit(field,iso(draft)+'T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0'));close(true);}
      });actions.append(b);}popup.append(actions);position();
      if(focusAction)popup.querySelector(`[data-action="${focusAction}"]`)?.focus();else popup.querySelector(`[data-day="${focusDate||iso(draft)}"]`)?.focus();
    }render();
  }
  function sync(){
    for(const [field,trigger] of bindings){if(!field.isConnected){trigger.remove();bindings.delete(field);continue;}const date=field.type==='datetime-local';const value=date?(field.value?new Date(field.value).toLocaleString(lang(),{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):t('calendar_placeholder')):(field.selectedOptions[0]?.textContent||'—');
      if(trigger.firstChild.textContent!==value)trigger.firstChild.textContent=value;trigger.disabled=field.disabled;trigger.classList.toggle('is-empty',date&&!field.value);trigger.setAttribute('aria-label',label(field)+': '+value);
    }
  }
  function enhance(){
    document.querySelectorAll('.container select,#calReset').forEach(field=>{if(bindings.has(field))return;const date=field.type==='datetime-local',trigger=el('button','control-trigger'+(date?' date-trigger':''));trigger.type='button';trigger.id=field.id+'Control';trigger.append(el('span'));trigger.setAttribute('aria-haspopup',date?'dialog':'listbox');trigger.setAttribute('aria-expanded','false');if(!date)trigger.setAttribute('role','combobox');field.classList.add('control-native');field.tabIndex=-1;field.setAttribute('aria-hidden','true');field.after(trigger);bindings.set(field,trigger);
      trigger.addEventListener('click',()=>date?calendar(field,trigger):dropdown(field,trigger));trigger.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();date?calendar(field,trigger):dropdown(field,trigger);}});
      field.addEventListener('input',sync);field.addEventListener('change',sync);field.addEventListener('invalid',e=>{e.preventDefault();trigger.focus();});new MutationObserver(()=>{if(open?.field===field)close();sync();}).observe(field,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','label'],characterData:true});
    });sync();
  }
  document.addEventListener('DOMContentLoaded',()=>{enhance();new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance();});}}).observe(document.querySelector('.container'),{childList:true,subtree:true});});
  document.addEventListener('pointerdown',e=>{if(open&&!open.popup.contains(e.target)&&!open.trigger.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}},true);
  document.addEventListener('focusin',e=>{if(open&&!open.popup.contains(e.target)&&!open.trigger.contains(e.target))close();});
  document.addEventListener('gpt-language-changed',()=>{close();sync();});window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  window.GPTControls={sync};
})();