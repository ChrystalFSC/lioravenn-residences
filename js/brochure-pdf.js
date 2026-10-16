(() => {
  'use strict';
  const ink = [24,60,48], brass = [170,137,85], ivory = [246,244,237], muted = [103,113,104];
  const clean = value => String(value).replace(/[–—−]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/·/g,' / ').replace(/\u00a0/g,' ');
  const money = value => `RM ${Math.round(value).toLocaleString('en-MY')}`;
  function loadImage(path) {
    return new Promise((resolve,reject) => {
      const image = new Image();
      const timer = setTimeout(()=>{image.onload=image.onerror=null;reject(new Error('Image timed out'));},15000);
      image.onload = () => {
        clearTimeout(timer);
        try {
          const scale = Math.min(1,1800/image.naturalWidth), canvas = document.createElement('canvas');
          canvas.width = Math.round(image.naturalWidth*scale); canvas.height = Math.round(image.naturalHeight*scale);
          const context = canvas.getContext('2d');
          context.fillStyle = '#fff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(image,0,0,canvas.width,canvas.height);
          resolve({src:canvas.toDataURL('image/jpeg',.94),width:canvas.width,height:canvas.height});
        } catch (error) { reject(error); }
      };
      image.onerror = () => {clearTimeout(timer);reject(new Error('Image unavailable'));};
      image.src = path;
    });
  }
  async function create(data, options = {}) {
    const model = options.model || window.LioravennBrochure;
    const PDF = options.jsPDF || window.jspdf?.jsPDF;
    const a = model.assumptions(data.assumptions);
    if (!PDF || !a || !Array.isArray(data.units) || !data.units.length) throw new Error('Select a home and valid assumptions first.');
    const notes = String(data.notes || '').slice(0,600), units = data.units, site = data.site && units.some(u=>u.id===data.site.unitId) ? model.siteSelection(data.site,units) : null;
    const paths = [...new Set(['img/enhanced/living_room.webp',...units.flatMap(unit=>[unit.image,unit.plan])])];
    const images = new Map(await Promise.all(paths.map(async path=>[path,await (options.loadImage || loadImage)(path)])));
    const doc = new PDF({unit:'mm',format:'a4',compress:true});
    doc.setProperties({title:'Your Lioravenn Residences brochure',subject:'Personal home shortlist - fictional concept',author:'Lioravenn Residences',creator:'Lioravenn personal brochure builder'});
    function text(value,x,y,size=10,color=ink,font='helvetica',style='normal',width=null) {
      doc.setFont(font,style);doc.setFontSize(size);doc.setTextColor(...color);
      const content = width ? doc.splitTextToSize(clean(value),width) : clean(value);
      doc.text(content,x,y,{lineHeightFactor:1.4});
      return Array.isArray(content) ? content.length * size * .3528 * 1.4 : size*.3528*1.4;
    }
    function rect(x,y,w,h,color){doc.setFillColor(...color);doc.rect(x,y,w,h,'F');}
    function header() {
      rect(0,0,210,297,ivory);
      doc.setDrawColor(...brass);doc.setLineWidth(.25);
      for(const points of [[[20,24.5],[20,16],[22,14],[26,14],[28,16],[28,24.5],[20,24.5]],[[21.25,23.25],[21.25,16.75],[22.75,15.25],[25.25,15.25],[26.75,16.75],[26.75,23.25],[21.25,23.25]]]) {
        for(let index=1;index<points.length;index++)doc.line(...points[index-1],...points[index]);
      }
      rect(22.75,17,1,5.5,brass);rect(22.75,21.5,3.25,1,brass);
      text('L I O R A V E N N',33,19,12,ink,'times');text('R E S I D E N C E S',33,24,5.7,muted);
      doc.setDrawColor(218,220,210);doc.line(20,32,190,32);
    }
    function picture(path,x,y,w,h,cover=false) {
      const image=images.get(path), scale=(cover?Math.max:Math.min)(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale;
      if(cover){doc.saveGraphicsState();doc.rect(x,y,w,h,null);doc.clip();doc.discardPath();}
      doc.addImage(image.src,'JPEG',x+(w-iw)/2,y+(h-ih)/2,iw,ih,undefined,'FAST');
      if(cover)doc.restoreGraphicsState();
    }
    header();
    text('YOUR PERSONAL COLLECTION',20,46,8,brass);
    text('Your next chapter.',20,66,35,ink,'times');text('Beautifully considered.',20,82,29,brass,'times','italic');
    picture('img/enhanced/living_room.webp',20,96,170,96,true);
    text(`${units.length} ${units.length===1?'home':'homes'} to imagine your life in.`,20,207,13,ink,'times');
    text('SELECTED HOME',20,219,7,muted);text('ILLUSTRATIVE PRICE',130,219,7,muted);
    units.forEach((unit,index)=>{
      const y=231+index*13;text(`${unit.name}  /  ${unit.label}`,20,y,12,ink,'times');text(money(unit.price),130,y,10);
      doc.setDrawColor(218,220,210);doc.line(20,y+5,190,y+5);
    });
    for(const unit of units){
      doc.addPage();header();
      const estimate=model.estimate(unit.price,a);
      text(`${unit.label.toUpperCase()} / THE RESIDENCE COLLECTION`,20,43,8,brass);
      text(unit.name,20,58,34,ink,'times');text(`${unit.bedrooms} bedroom${unit.bedrooms>1?'s':''} / ${unit.bathrooms} bathroom${unit.bathrooms>1?'s':''} / ${unit.area.toLocaleString('en-MY')} sq ft`,20,68,10,muted);
      picture(unit.image,20,77,65,43,true);
      text(unit.description,95,81,9.5,muted,'helvetica','normal',95);
      unit.features.forEach((feature,index)=>text(`- ${feature}`,95,108+index*5.5,8.5,ink));
      text('YOUR ORIGINAL FLOOR PLAN',20,130,7.5,brass);
      rect(20,136,102,128,[255,255,255]);picture(unit.plan,25,141,92,118);
      rect(130,136,60,128,[232,237,227]);
      text('ILLUSTRATIVE PRICE',136,147,7,muted);text(money(unit.price),136,157,16,ink,'times');
      text('DOWN PAYMENT',136,171,7,muted);text(`${money(estimate.deposit)} (${a.depositPercent}%)`,136,180,10);
      text('LOAN PRINCIPAL',136,193,7,muted);text(money(estimate.principal),136,202,11);
      text('ESTIMATED MONTHLY',136,217,7,muted);text(money(estimate.monthly),136,229,20,ink,'times');
      text(`${a.annualRate}% p.a. / ${a.years} years`,136,241,9,muted);
      text('Principal and interest only.',136,251,7.5,muted,'helvetica','normal',47);
      text('Original academic layout. Furniture, imagery and prices are illustrative.',20,274,7.5,muted);
    }
    doc.addPage();header();
    text('A LITTLE PERSPECTIVE',20,45,8,brass);text('Your possibilities.',20,62,33,ink,'times');
    rect(20,75,170,29,[232,237,227]);
    for(const [index,label,value] of [[0,'DOWN PAYMENT',`${a.depositPercent}%`],[1,'ANNUAL RATE',`${a.annualRate}%`],[2,'LOAN TERM',`${a.years} years`]]) {
      const x=26+index*55;text(label,x,85,7.5,muted);text(value,x,97,19,ink,'times');
    }
    text('SELECTED HOME',20,118,7.5,muted);text('DEPOSIT',91,118,7.5,muted);text('ESTIMATED / MONTH',141,118,7.5,muted);
    units.forEach((unit,index)=>{const y=130+index*13,estimate=model.estimate(unit.price,a);text(unit.name,20,y,12,ink,'times');text(money(estimate.deposit),91,y,10);text(money(estimate.monthly),141,y,10);doc.setDrawColor(218,220,210);doc.line(20,y+5,190,y+5);});
    let next=141+units.length*13;
    if(site){text('YOUR CONCEPT SITE SELECTION',20,next,7.5,brass);next+=8;const unit=units.find(u=>u.id===site.unitId);text(`${unit.name} / ${site.label}`,20,next,9,ink,'helvetica','normal',170);next+=13;text('Illustrative placement only; not a real allocation, view guarantee or availability statement.',20,next,7.5,muted,'helvetica','normal',170);next+=15;}
    text('QUESTIONS TO TAKE WITH YOU',20,next,7.5,brass);next+=9;
    const noteText=(notes.trim()||'What would make this space feel like home?').replace(/\r\n?/g,'\n').replace(/\n{3,}/g,'\n\n');
    const unicode=/[^\x20-\x7e\r\n\t]/.test(clean(noteText)) && typeof document!=='undefined';
    let lines;
    if(unicode){
      const measure=document.createElement('canvas').getContext('2d');measure.font='33px Arial, sans-serif';
      lines=[];let line='';
      for(const character of noteText){
        if(character==='\n'){lines.push(line);line='';}
        else if(measure.measureText(line+character).width>1660){lines.push(line);line=character;}
        else line+=character;
      }
      lines.push(line);
    }else{
      doc.setFont('helvetica','normal');doc.setFontSize(9.5);lines=doc.splitTextToSize(clean(noteText),170);
    }
    while(lines.length){
      if(next>262){doc.addPage();header();text('YOUR VIEWING QUESTIONS',20,45,8,brass);text('Room for your thoughts.',20,62,30,ink,'times');next=80;}
      const rows=Math.max(1,Math.floor((270-next)/4.8)),chunk=lines.splice(0,rows);
      if(unicode){
        const canvas=document.createElement('canvas');canvas.width=1700;canvas.height=chunk.length*48+8;
        const context=canvas.getContext('2d');context.fillStyle='#f6f4ed';context.fillRect(0,0,canvas.width,canvas.height);context.fillStyle='#183c30';context.font='33px Arial, sans-serif';
        chunk.forEach((line,index)=>context.fillText(line,0,34+index*48));
        doc.addImage(canvas.toDataURL('image/png'),'PNG',20,next-3.4,170,canvas.height/10);
      }else{doc.setFont('helvetica','normal');doc.setFontSize(9.5);doc.setTextColor(...ink);doc.text(chunk,20,next,{lineHeightFactor:1.4});}
      next+=chunk.length*4.8;if(lines.length)next=271;
    }
    const pages=doc.getNumberOfPages();
    for(let page=1;page<=pages;page++){
      doc.setPage(page);doc.setDrawColor(218,220,210);doc.line(20,281,190,281);
      text('LIORAVENN / FICTIONAL UNIVERSITY CONCEPT',20,286,6.5,muted);text(`${page} / ${pages}`,180,286,7,muted);
      text('Illustrative estimates exclude fees, insurance and ownership costs. No booking or enquiry is made.',20,291,6.2,muted);
    }
    return doc;
  }
  const api={create,loadImage};
  if(typeof window!=='undefined')window.LioravennBrochurePdf=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
