/* Same content and geometry across themes, with persistent actionable notices. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const{chromium}=require('playwright');const source=path.join(__dirname,'browser.cjs');let code=fs.readFileSync(source,'utf8');code=code.slice(0,code.lastIndexOf('\nrun().catch'))+'\nmodule.exports={setup,server,report};';
const harness=new Module(source,module);harness.filename=source;harness.paths=Module._nodeModulePaths(__dirname);harness._compile(code,source);const{setup,server,report}=harness.exports;
const out=process.env.TEST_OUTPUT||path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const snap=()=>({height:document.documentElement.scrollHeight,scroll:scrollY,focus:document.activeElement?.id,items:[...document.querySelectorAll('body *')].filter(e=>e instanceof HTMLElement&&e.getBoundingClientRect().width&&e.getBoundingClientRect().height&&!e.closest('.tooltip')&&!e.matches('.toggle-knob')).map(e=>{const b=e.getBoundingClientRect();return{tag:e.tagName,id:e.id,x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height};})});
function equal(a,b,name){assert.equal(b.height,a.height,name+' page height');assert.ok(Math.abs(b.scroll-a.scroll)<1,name+' scroll');assert.equal(b.focus,a.focus,name+' focus');assert.equal(b.items.length,a.items.length,name+' element count');for(let i=0;i<a.items.length;i++){assert.equal(a.items[i].tag,b.items[i].tag);assert.equal(a.items[i].id,b.items[i].id);for(const key of ['x','y','w','h'])assert.ok(Math.abs(a.items[i][key]-b.items[i][key])<.6,`${name}: ${a.items[i].tag}#${a.items[i].id} ${key}: ${a.items[i][key]} vs ${b.items[i][key]}`);}}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({reducedMotion:'reduce'});await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():(report.externalRequests.push(r.request().url()),r.abort()));const checks=[];
 for(const lang of ['en','zh'])for(const width of [1280,390])for(const state of ['data','empty','error'])for(const tab of ['overview','activity','usage']){
  const p=await ctx.newPage();await p.setViewportSize({width,height:900});await p.clock.install({time:new Date('2026-09-23T03:00:00Z')});await setup(p,{lang,theme:'dark',state});await p.goto(base+'/heatmap.html');await p.locator('#tab-'+tab).click();await p.waitForTimeout(100);
  // Opening forms and keeping an unsaved value must survive a palette change.
  if(tab==='usage'&&state==='data'){await p.locator('#calibrateDetails').evaluate(e=>e.open=true);await p.locator('#calRemaining').fill('37');await p.locator('#calRemaining').focus();}
  await p.evaluate(()=>scrollTo(0,Math.min(180,document.documentElement.scrollHeight-innerHeight)));
  const label=`${lang}/${width}/${state}/${tab}`,before=await p.evaluate(snap);
  await p.evaluate(()=>applyTheme('light'));await p.waitForTimeout(60);equal(before,await p.evaluate(snap),label);
  if(tab==='activity'&&state!=='empty'){assert.equal(await p.locator('#dailyChart').evaluate(e=>e.getBoundingClientRect().height),220);assert.equal(await p.evaluate(()=>timeDistributionState.innerRadius/timeDistributionState.radius),.55);}
  if(tab==='usage'&&state==='data'){assert.equal(await p.locator('#calRemaining').inputValue(),'37');assert.equal(await p.locator('#calibrateDetails').getAttribute('open'),'');}
  await p.evaluate(()=>applyTheme('dark'));await p.waitForTimeout(60);equal(before,await p.evaluate(snap),label+' return');checks.push(label);await p.close();
 }
 for(const lang of ['en','zh'])for(const state of ['data','empty','error']){
  const p=await ctx.newPage();await p.setViewportSize({width:338,height:600});await p.clock.install({time:new Date('2026-09-23T03:00:00Z')});await setup(p,{lang,theme:'dark',state});await p.goto(base+'/popup.html');await p.waitForTimeout(100);
  await p.evaluate(()=>GPTFeedback.refreshStatus({status:'page-not-ready'}));const text=await p.locator('.notice-message').textContent();await p.locator('#noticeRetry').focus();const before=await p.evaluate(snap);
  for(let i=0;i<3;i++){await p.locator('#popupThemeToggle').evaluate(e=>e.click());await p.waitForTimeout(50);equal(before,await p.evaluate(snap),`${lang}/${state}/notice toggle${i}`);assert.equal(await p.locator('.notice-message').textContent(),text);}
  await p.clock.runFor(16000);assert.equal(await p.locator('#actionStatus').isVisible(),true,'actionable notice never times out');
  const bounds=await p.evaluate(()=>{const n=document.getElementById('actionStatus').getBoundingClientRect(),a=document.querySelector('.membership').getBoundingClientRect(),b=document.querySelector('.pro').getBoundingClientRect();return n.top>=a.bottom&&n.bottom<=b.top;});assert.ok(bounds);
  await p.screenshot({path:path.join(out,`notice-${lang}-${state}.png`),fullPage:true});
  await p.locator('#openDashboard').scrollIntoViewIfNeeded();const scroll=await p.evaluate(()=>scrollY);assert.ok(scroll>0);await p.locator('#popupThemeToggle').evaluate(e=>e.click());assert.equal(await p.evaluate(()=>scrollY),scroll);
  await p.locator('.notice-close').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#actionStatus').isVisible(),false);assert.equal(await p.evaluate(()=>document.documentElement.scrollHeight),600);
  await p.evaluate(()=>{const old=chrome.runtime.sendMessage;fixture.retryCalls=0;chrome.runtime.sendMessage=async m=>{if(m.type==='UG_REFRESH_LIVE'){fixture.retryCalls++;return await new Promise(resolve=>fixture.finishRetry=()=>resolve({ok:true,refreshed:true,status:'ok'}));}return old(m);};GPTFeedback.refreshStatus({status:'page-not-ready'});});
  await p.locator('#noticeRetry').click();await p.waitForFunction(()=>fixture.retryCalls===1);assert.equal(await p.locator('#noticeRetry').isDisabled(),true);
  await p.locator('#noticeRetry').evaluate(e=>e.click());assert.equal(await p.evaluate(()=>fixture.retryCalls),1);await p.evaluate(()=>fixture.finishRetry());await p.waitForFunction(()=>document.getElementById('actionStatus').hidden);
  checks.push(`${lang}/${state}/persistent notice, geometry, scroll, dismiss, single retry, recovery`);await p.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);fs.writeFileSync(path.join(out,'themes-report.json'),JSON.stringify({checks,errors:report.errors,externalRequests:report.externalRequests},null,2));console.log(checks.length+' theme/state checks passed');await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();setTimeout(()=>process.exit(1),500);});
