/* SakuraMeter model resolver: request/runtime metadata first, DOM only as fallback. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else Object.defineProperty(root,'SakuraModelResolver',{value:api,configurable:true});
})(globalThis,function(){
  'use strict';
  const clean=(v,n=120)=>typeof v==='string'?v.replace(/[\u0000-\u001f]/g,'').replace(/\s+/g,' ').trim().slice(0,n):'';
  const tokenPro=v=>/(^|[-_\s])pro($|[-_\s])/.test(clean(v).toLowerCase());
  const ambiguousModel=v=>!v||/^(auto|automatic|default|current|unknown)$/i.test(clean(v));
  function tierValue(raw){
    if(raw===true||raw===1)return 'pro';
    const v=clean(raw,48).toLowerCase();
    if(!v)return '';
    if(v==='pro'||tokenPro(v))return 'pro';
    if(/^(standard|free|plus|go|basic|default|regular)$/.test(v))return 'standard';
    return '';
  }
  function snapshot(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    return {
      model:clean(raw.model,120),
      tier:tierValue(raw.tier||raw.modelTier||raw.productTier||raw.subscriptionTier)||(raw.isPro===true||raw.pro===true?'pro':''),
      effort:clean(raw.effort,48).toLowerCase(),
      at:Number.isFinite(raw.at)?raw.at:0
    };
  }
  function resolve(input={}){
    const req=snapshot(input.request), domModel=clean(input.domModel,120), domEffort=clean(input.domEffort,48).toLowerCase();
    const reqHasSignal=!!(req.model||req.tier);
    // Explicit request tier is authoritative. A model id containing a standalone
    // `pro` token is also authoritative. But an unfamiliar request model id that
    // merely lacks the word `pro` is NOT proof of a non-Pro tier; future model
    // slugs may be opaque. In that case the DOM may supply only the missing tier.
    if(req.tier){
      return {model:req.model||domModel,tier:req.tier,effort:req.effort||domEffort,source:'request_tier',confidence:'high'};
    }
    if(req.model&&!ambiguousModel(req.model)&&tokenPro(req.model)){
      return {model:req.model,tier:'pro',effort:req.effort||domEffort,source:'request_model',confidence:'high'};
    }
    if(req.model&&!ambiguousModel(req.model)){
      return {
        model:req.model,
        tier:domModel&&tokenPro(domModel)?'pro':'',
        effort:req.effort||domEffort,
        source:domModel?'request_model+dom_tier_fallback':'request_model',
        confidence:domModel?'medium':'medium'
      };
    }
    if(domModel){
      return {
        model:domModel,
        tier:tokenPro(domModel)?'pro':'',
        effort:req.effort||domEffort,
        source:reqHasSignal?'dom_fallback_after_ambiguous_request':'dom_fallback',
        confidence:reqHasSignal?'medium':'low'
      };
    }
    return {
      model:req.model,
      tier:req.tier,
      effort:req.effort||domEffort,
      source:reqHasSignal?'request_ambiguous':'unknown',
      confidence:'low'
    };
  }
  return {clean,tokenPro,tierValue,snapshot,resolve};
});