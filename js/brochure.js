(() => {
  'use strict';
  const app=window.Lioravenn,model=window.LioravennBrochure,form=document.getElementById('brochure-form');
  if(!app||!model||!form)return;
  const units=app.units,escape=model.escapeHtml,storageKey='lioravenn-brochure-homes';
  const params=new URLSearchParams(location.search),requested=params.has('units')?params.get('units').split(','):params.has('unit')?[params.get('unit')]:[];
  const fromUrl=model.unitIds(requested,units),saved=model.unitIds(app.storage.get('aurelle-favourites',[]),units),previous=app.storage.get(storageKey,null);
  const hasSiteLink=['block','level','view'].some(key=>params.has(key));
  const retained=Array.isArray(previous)?model.unitIds(previous,units):saved;
  let selection=new Set(fromUrl.length?(hasSiteLink?[...retained,...fromUrl]:fromUrl):Array.isArray(previous)?retained:saved.length?saved:units.map(unit=>unit.id));
  app.storage.set(storageKey,[...selection]);
  const initial=model.assumptions(app.storage.get('aurelle-calculator',null))||model.defaults;
  const deposit=document.getElementById('brochure-deposit'),rate=document.getElementById('brochure-rate'),years=document.getElementById('brochure-years'),notes=document.getElementById('brochure-notes'),includeSite=document.getElementById('brochure-include-site');
  const preview=document.getElementById('brochure-preview'),error=document.getElementById('brochure-error'),status=document.getElementById('brochure-export-status'),download=document.getElementById('brochure-download');
  deposit.value=initial.depositPercent;rate.value=initial.annualRate;years.value=initial.years;
  const linkedSite=hasSiteLink?{blockId:params.get('block'),floor:params.get('level'),view:params.get('view'),unitId:params.get('unit')}:null;
  let site=model.siteSelection(hasSiteLink?linkedSite:app.storage.get('lioravenn-site-selection',null),units),busy=false;
  document.getElementById('brochure-choices').innerHTML=units.map(unit=>`<label class="brochure-choice"><input type="checkbox" name="brochure-home" value="${escape(unit.id)}" ${selection.has(unit.id)?'checked':''}><img src="${escape(unit.image)}" alt="" width="65" height="54"><span><strong>${escape(unit.name)}</strong><small>${unit.bedrooms} bed · ${unit.area.toLocaleString('en-MY')} sq ft · ${escape(unit.label)}</small></span></label>`).join('');
  function data(){return{units:units.filter(unit=>selection.has(unit.id)),assumptions:model.assumptions({depositPercent:deposit.value,annualRate:rate.value,years:years.value}),notes:notes.value.slice(0,600),site:site&&includeSite.checked&&selection.has(site.unitId)?site:null};}
  function render(){
    const current=data(),count=current.units.length;
    error.hidden=true;if(!busy)status.textContent='';
    document.getElementById('brochure-selection-status').textContent=`${count} ${count===1?'home':'homes'} selected`;
    document.getElementById('brochure-page-count').textContent=count?`${count} ${count===1?'home':'homes'} · A4 PDF`:'';
    const canInclude=site&&selection.has(site.unitId);
    document.getElementById('brochure-site-choice').hidden=!canInclude;
    document.getElementById('brochure-site-description').textContent=canInclude?`${site.label}. Illustrative placement only; no availability or view guarantee.`:'';
    download.disabled=busy||!count||!current.assumptions;
    if(!count){preview.innerHTML='<div class="brochure-empty"><p class="eyebrow">A fresh beginning</p><h2>Choose a home<br>to begin.</h2><p>Select one or more residences to create your personal collection.</p></div>';return;}
    const a=current.assumptions;
    preview.innerHTML=`<section class="brochure-cover"><p class="eyebrow">Lioravenn Residences</p><h2>Your next chapter.<br><em>Beautifully considered.</em></h2><img src="img/enhanced/living_room.webp" alt="A bright, thoughtfully furnished living space" width="1537" height="1023"><p>${count} ${count===1?'home':'homes'} to imagine your life in.</p><p class="brochure-cover-label">YOUR PERSONAL COLLECTION / CONCEPT EDITION</p></section>`+current.units.map(unit=>{
      const estimate=a?model.estimate(unit.price,a):null;
      return`<section class="brochure-home-preview"><div class="brochure-home-top"><div><p class="eyebrow">${escape(unit.label)}</p><h3>${escape(unit.name)}</h3></div><p class="eyebrow">Your shortlist</p></div><div class="brochure-home-specs">${unit.bedrooms} bedroom${unit.bedrooms>1?'s':''} · ${unit.bathrooms} bathroom${unit.bathrooms>1?'s':''} · ${unit.area.toLocaleString('en-MY')} sq ft</div><p>${escape(unit.description)}</p><div class="brochure-plan-and-price"><img src="${escape(unit.plan)}" alt="${escape(unit.label)} original floor plan" loading="lazy"><div class="brochure-price-box"><small>Illustrative price</small><strong>${escape(app.money(unit.price))}</strong><small>Estimated monthly payment</small><strong>${estimate?escape(app.money(estimate.monthly)):'—'}</strong><p>${a?`${a.depositPercent}% down · ${a.annualRate}% p.a.<br>${a.years}-year term`:'Enter valid assumptions to see an estimate.'}</p></div></div></section>`;
    }).join('')+`<section class="brochure-summary"><p class="eyebrow">A little perspective</p><h3>Your possibilities.</h3>${current.site?`<p><strong>Concept site selection</strong><br>${escape(units.find(u=>u.id===current.site.unitId).name)} · ${escape(current.site.label)}</p><p class="small-print">Illustrative placement only. Not an allocation, confirmed view or availability statement.</p>`:''}<p><strong>Questions to take with you</strong><br>${escape(current.notes.trim()||'What would make this space feel like home?')}</p><p class="small-print">Lioravenn is a fictional university concept. Prices, imagery and placements are illustrative. Loan estimates assume a fixed rate and exclude fees, insurance and ownership costs. No booking or enquiry is made.</p></section>`;
    if(!a){error.hidden=false;error.textContent='Use a down payment from 0–100%, an annual rate from 0–15%, and a whole-number term from 1–35 years.';}
  }
  function syncChoices(){document.querySelectorAll('[name="brochure-home"]').forEach(input=>{input.checked=selection.has(input.value);});app.storage.set(storageKey,[...selection]);render();}
  form.addEventListener('input',event=>{
    if(event.target.name==='brochure-home'){if(event.target.checked)selection.add(event.target.value);else selection.delete(event.target.value);app.storage.set(storageKey,[...selection]);}
    render();
  });
  document.getElementById('brochure-select-all').addEventListener('click',()=>{selection=new Set(units.map(unit=>unit.id));syncChoices();});
  document.getElementById('brochure-use-saved').addEventListener('click',()=>{selection=new Set(model.unitIds(app.storage.get('aurelle-favourites',[]),units));syncChoices();if(!selection.size)document.getElementById('brochure-selection-status').textContent='No saved favourites yet. Choose homes above, or save them in Our Homes.';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const current=data();if(!current.units.length||!current.assumptions){render();return;}
    busy=true;download.disabled=true;status.textContent='Preparing your personal brochure…';error.hidden=true;
    try{
      const pdf=await window.LioravennBrochurePdf.create(current);
      await pdf.save('lioravenn-personal-brochure.pdf',{returnPromise:true});
      status.textContent='Your PDF is ready. Check your browser downloads to keep or share it.';
    }catch(problem){error.hidden=false;error.textContent='The brochure could not be prepared. Check that the page images have loaded, then try again.';status.textContent='';}
    finally{busy=false;download.disabled=!data().units.length||!data().assumptions;}
  });
  window.addEventListener('storage',event=>{if(event.key==='lioravenn-site-selection'||event.key===null){site=model.siteSelection(app.storage.get('lioravenn-site-selection',null),units);render();}});
  render();
})();
