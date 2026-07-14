import { chromium } from 'playwright';
const base='http://localhost:5173';
const PAGES=['/slice','/animation','/timeseries','/profile','/crosssection','/hovmoller','/zonalmean','/windrose','/difference','/temporal-profile','/explore'];
const rawRe=/\b(nav|page|selector|viz|export|common|explore|home|solar|carousel|location|variable)\.[a-z][a-zA-Z0-9_.]+\b/g;
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:1440,height:900}}); const p=await ctx.newPage();
const jsErrs={};
async function scan(){ const t=await p.innerText('body').catch(()=>''); return [...new Set((t.match(rawRe)||[]))]; }

console.log('=== 5 LOCALES × 11 PAGES (clés brutes) ===');
for(const lng of ['en','fr','nl','de','es']){
  await p.goto(base,{waitUntil:'domcontentloaded'}); await p.evaluate(l=>localStorage.setItem('mcv-language',l),lng);
  let totalRaw=0, badPages=[]; let htmlLang='';
  for(const path of PAGES){
    await p.goto(base+path,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(650);
    if(!htmlLang) htmlLang=await p.getAttribute('html','lang');
    const raw=await scan(); if(raw.length){ totalRaw+=raw.length; badPages.push(path+':'+raw.slice(0,3).join(',')); }
  }
  console.log(`${lng}: html=${htmlLang} rawKeysTotal=${totalRaw} ${badPages.length?JSON.stringify(badPages):'✓ 0 clé brute sur 11 pages'}`);
}

console.log('\n=== THÈME LIGHT × 11 PAGES ===');
await p.evaluate(()=>{localStorage.setItem('mcv-language','en');localStorage.setItem('mcv-theme-mode','light');});
let lightBad=[];
for(const path of PAGES){
  const errs=[]; const h=m=>{if(m.type()==='error'&&!/textAlign/.test(m.text()))errs.push(1);}; p.on('console',h);
  await p.goto(base+path,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  const raw=await scan(); p.off('console',h);
  if(raw.length||errs.length) lightBad.push(`${path}(raw=${raw.length},err=${errs.length})`);
}
console.log('light:', lightBad.length?lightBad.join(' '):'✓ 11 pages OK (0 clé brute, 0 erreur)');

console.log('\n=== MOBILE 390×844 × 11 PAGES (scroll horizontal) ===');
await p.setViewportSize({width:390,height:844}); await p.evaluate(()=>localStorage.setItem('mcv-theme-mode','dark'));
let mobBad=[];
for(const path of PAGES){
  await p.goto(base+path,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(700);
  const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:window.innerWidth}));
  if(o.sw>o.iw+2) mobBad.push(`${path}(sw=${o.sw})`);
}
console.log('mobile:', mobBad.length?('SCROLL H sur: '+mobBad.join(' ')):'✓ 11 pages sans scroll horizontal');
await b.close();
