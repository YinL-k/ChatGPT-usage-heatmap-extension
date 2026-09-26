/* Presentation only: totals and averaging rules remain in heatmap.js. */
window.renderSummaryColumns=function(list,entries,kind){
  const t=window.GPTTrackerI18n.t,fmt=n=>new Intl.NumberFormat(document.documentElement.lang).format(n);
  let frame=list.closest('.column-frame');
  if(!frame){frame=document.createElement('div');frame.className='column-frame';list.before(frame);const axis=document.createElement('div');axis.className='column-axis';axis.setAttribute('aria-hidden','true');frame.append(axis);const scroll=document.createElement('div');scroll.className='column-scroll';frame.append(scroll);scroll.append(list);const readout=document.createElement('p');readout.className='column-readout';frame.after(readout);}
  const peak=Math.max(1,...entries.map(x=>x.total)),magnitude=10**Math.max(0,Math.floor(Math.log10(peak))-1),step=Math.max(1,Math.ceil(peak/3/magnitude)*magnitude),ceiling=step*3;
  frame.querySelector('.column-axis').replaceChildren(...[3,2,1,0].map(i=>{const el=document.createElement('span');el.textContent=fmt(step*i);return el;}));
  list.className='column-bars '+kind;list.replaceChildren();list.style.setProperty('--columns',Math.max(1,entries.length));
  const readout=frame.nextElementSibling;readout.textContent=t(entries.length?'column_hint':'text_no_data');
  for(const e of entries){
    const li=document.createElement('li'),b=document.createElement('button'),bar=document.createElement('span'),label=document.createElement('span');
    b.type='button';b.className='column-button';b.dataset.total=String(e.total);b.dataset.current=String(!!e.current);
    const description=e.full+' · '+t('messages_count').replace('{n}',fmt(e.total));b.setAttribute('aria-label',description);b.title=description;
    bar.className='column-fill';bar.style.height=(100*e.total/ceiling)+'%';bar.dataset.zero=String(e.total===0);b.append(bar);
    label.className='column-label';label.textContent=e.label;li.append(b,label);list.append(li);
    const show=()=>{readout.textContent=description;};b.addEventListener('pointerenter',show);b.addEventListener('focus',show);b.addEventListener('click',()=>{list.querySelectorAll('[aria-pressed]').forEach(x=>x.removeAttribute('aria-pressed'));b.setAttribute('aria-pressed','true');show();});
    b.addEventListener('keydown',event=>{const buttons=[...list.querySelectorAll('button')],index=buttons.indexOf(b);let next;if(event.key==='ArrowRight')next=Math.min(buttons.length-1,index+1);if(event.key==='ArrowLeft')next=Math.max(0,index-1);if(event.key==='Home')next=0;if(event.key==='End')next=buttons.length-1;if(next!==undefined){event.preventDefault();buttons[next].focus();}});
  }
};