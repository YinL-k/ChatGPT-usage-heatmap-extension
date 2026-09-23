/* Local fixture tests. Public API is intercepted; no extension installation. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const{chromium}=require('playwright');const source=path.join(__dirname,'browser.cjs');let code=fs.readFileSync(source,'utf8');code=code.slice(0,code.lastIndexOf('\nrun().catch'))+'\nmodule.exports={setup,server,report};';
const harness=new Module(source,module);harness.filename=source;harness.paths=Module._nodeModulePaths(__dirname);harness._compile(code,source);const{setup,server,report}=harness.exports;
const out=process.env.TEST_OUTPUT||path.join(__dirname,'artifacts');fs.mkdirSync(out,{recursive:true});
const url='https://codex-reset.com/api/forecast',checks=[],requests=[];
const payload=()=>({updated_at:new Date().toISOString(),probabilities:{rounded_24h:20,rounded_48h:35},last_reset_at:new Date(Date.now()-10*86400000).toISOString(),confidence:'low',latest_alert:{kind:'watch',state:'active',source_at:new Date(Date.now()-3600000).toISOString(),url:'https://x.com/example/status/1',window:{end_at:new Date(Date.now()+7200000).toISOString()}}});
const snapshot=()=>[...document.querySelectorAll('#resetForecast, #resetForecast *')].map(e=>{const b=e.getBoundingClientRect();return{id:e.id,w:b.width,h:b.height,x:b.x,y:b.y+scrollY};});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'chrome',headless:true});const ctx=await browser.newContext({reducedMotion:'reduce'});await ctx.route('**/*',r=>r.request().url().startsWith(base)?r.continue():(report.externalRequests.push(r.request().url()),r.abort()));
 for(const width of [1280,390])for(const lang of ['zh','en']){
  const p=await ctx.newPage();await p.setViewportSize({width,height:900});await setup(p,{state:'data',lang,theme:'dark'});
  await p.addInitScript(()=>localStorage.removeItem('gptTrackerResetForecastV1'));
  await p.route(url,r=>{requests.push({method:r.request().method(),body:r.request().postData(),url:r.request().url()});return r.fulfill({json:payload()});});
  await p.goto(base+'/heatmap.html');await p.waitForFunction(()=>document.querySelector('#rf24').textContent==='20%');await p.waitForTimeout(400);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:path.join(out,`overview-${lang}-${width}-dark.png`),fullPage:true});
  await p.locator('#resetForecast').screenshot({path:path.join(out,`card-${lang}-${width}-dark.png`)});
  await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(400);const a=await p.evaluate(snapshot);
  await p.locator('#themeToggle').click();await p.waitForTimeout(400);const b=await p.evaluate(snapshot);
  assert.equal(a.length,b.length);a.forEach((v,i)=>{for(const k of ['x','y','w','h'])assert.ok(Math.abs(v[k]-b[i][k])<.6,`${lang}/${width}/${v.id}/${k}: ${v[k]} vs ${b[i][k]}`);});
  await p.screenshot({path:path.join(out,`overview-${lang}-${width}-light.png`),fullPage:true});await p.locator('#resetForecast').screenshot({path:path.join(out,`card-${lang}-${width}-light.png`)});
  assert.equal(await p.locator('#rf48').textContent(),'35%');assert.ok(!await p.locator('#resetForecast').textContent().then(s=>s.includes('rf_')));
  checks.push(`${lang}/${width}: valid data, links, localization, no overflow, identical theme geometry`);await p.close();
 }
 // Controlled failure, persisted backoff, cached recovery, visibility and single flight.
 const p=await ctx.newPage();await setup(p,{state:'data',lang:'zh'});await p.addInitScript(()=>localStorage.removeItem('gptTrackerResetForecastV1'));await p.clock.install();
 let calls=0,mode='bad',release;
 await p.route(url,async r=>{calls++;if(mode==='hold')await new Promise(resolve=>release=resolve);await r.fulfill({json:mode==='bad'?{}:payload()}).catch(()=>{});});
 await p.goto(base+'/heatmap.html');await p.waitForFunction(()=>document.querySelector('#resetForecast').dataset.state==='error');
 assert.equal(await p.locator('#rf24').textContent(),'—');assert.ok(await p.locator('#rfRefresh').isDisabled());
 await p.evaluate(()=>document.querySelector('#rfRefresh').click());assert.equal(calls,1);checks.push('invalid response is unavailable; backoff prevents rapid retries');
 mode='good';await p.clock.fastForward(61000);await p.waitForFunction(()=>document.querySelector('#rf24').textContent==='20%');checks.push('automatic retry recovers from failure');
 await p.clock.fastForward(61000);mode='hold';await p.locator('#rfRefresh').click();await p.waitForFunction(()=>document.querySelector('#rfRefresh').disabled);const count=calls;
 await p.evaluate(()=>document.querySelector('#rfRefresh').click());assert.equal(calls,count);release();await p.waitForFunction(()=>!document.querySelector('#rfRefresh').disabled);checks.push('manual refresh uses single flight');
 mode='bad';await p.clock.fastForward(61000);await p.locator('#rfRefresh').click();await p.waitForFunction(()=>document.querySelector('#resetForecast').dataset.state==='cached');assert.equal(await p.locator('#rf24').textContent(),'20%');checks.push('failure preserves last valid cache');
 await p.locator('#tab-activity').click();const before=calls;await p.clock.fastForward(1200000);assert.equal(calls,before);mode='good';await p.locator('#tab-overview').click();await p.waitForFunction(()=>document.querySelector('#resetForecast').dataset.state==='live');assert.equal(calls,before+1);checks.push('inactive Overview stops polling; return resumes');await p.close();
 const s=await ctx.newPage();await setup(s,{state:'empty',lang:'en'});await s.addInitScript(()=>localStorage.removeItem('gptTrackerResetForecastV1'));await s.route(url,r=>r.fulfill({json:{...payload(),updated_at:new Date(Date.now()-7200000).toISOString()}}));await s.goto(base+'/heatmap.html');await s.waitForFunction(()=>document.querySelector('#resetForecast').dataset.state==='stale');checks.push('old upstream timestamp remains stale even after successful fetch');await s.close();
 const timeoutPage=await ctx.newPage();await setup(timeoutPage,{state:'empty',lang:'en'});await timeoutPage.addInitScript(()=>localStorage.removeItem('gptTrackerResetForecastV1'));await timeoutPage.clock.install();await timeoutPage.route(url,()=>{});await timeoutPage.goto(base+'/heatmap.html');await timeoutPage.waitForFunction(()=>document.querySelector('#resetForecast').dataset.state==='loading');await timeoutPage.clock.fastForward(11000);await timeoutPage.waitForFunction(()=>document.querySelector('#resetForecast').dataset.state==='error');checks.push('10-second request timeout produces a recoverable error');await timeoutPage.close();
 // Two dashboards share one origin lock and a public cache.
 const first=await ctx.newPage(),second=await ctx.newPage();let parallelCalls=0,finish;
 for(const tab of [first,second]){await setup(tab,{state:'empty',lang:'en'});await tab.addInitScript(()=>localStorage.removeItem('gptTrackerResetForecastV1'));await tab.route(url,async r=>{parallelCalls++;await new Promise(resolve=>finish=resolve);await r.fulfill({json:payload()});});}
 await first.goto(base+'/heatmap.html');await first.waitForFunction(()=>document.querySelector('#resetForecast').dataset.state==='loading');await second.goto(base+'/heatmap.html');await second.waitForTimeout(500);assert.equal(parallelCalls,1);finish();for(const tab of [first,second])await tab.waitForFunction(()=>document.querySelector('#rf24').textContent==='20%');checks.push('multiple dashboards share single-flight lock and cache');await first.close();await second.close();
 assert.ok(requests.every(r=>r.method==='GET'&&r.body===null));assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,requests,errors:report.errors,externalRequests:report.externalRequests},null,2));console.log(checks.length+' reset browser checks passed');await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();setTimeout(()=>process.exit(1),500);});

