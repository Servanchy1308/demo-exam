// ===== wiki layer: маршруты, страницы, категории, поиск, оглавление =====
// Маршруты (location.hash): #home · #m1 · #m1/3 · #talk/m1 · #cat/Название
const WCATS=[
  ['Сетевая адресация и маршрутизация',/адрес|ISP|VLAN|коммутац|туннел|OSPF|NAT|DHCP|проброс|IPsec|межсетевой|экран/i],
  ['Безопасность и доступ',/учётн|SSH|аутентиф|Samba|сертификац|HTTPS|IPsec|межсетевой|fail2ban|пользовател/i],
  ['Службы имён и времени',/DNS|chrony|времен|часовой|Samba/i],
  ['Хранение данных',/RAID|NFS/i],
  ['Автоматизация и контейнеры',/Ansible|Docker|Веб-прилож|nginx|Инвентаризац/i],
  ['Мониторинг и журналирование',/rsyslog|журнал|Prometheus|Grafana|мониторинг/i],
  ['Рабочее место пользователя',/браузер|часовой|CUPS|принт/i]
];
const wCatsOf=t=>{ const r=WCATS.filter(([,re])=>re.test(t)).map(x=>x[0]); return r.length?r:['Прочее'] };
let wRT={p:'home'}, wIDX=null, wSpyOn=false;
const wH2=(id,n,t)=>'<h2 class="wk-h2" id="'+id+'"><span class="num">'+n+'</span>'+t+'</h2>';
const wRef=n=>'<sup class="ref"><a href="#n'+n+'" data-to="n'+n+'">['+n+']</a></sup>';
const wCatLink=c=>'<a href="#cat/'+encodeURIComponent(c)+'">'+esc(c)+'</a>';
const wPlural=n=>(n%10===1&&n%100!==11)?'статья':([2,3,4].includes(n%10)&&![12,13,14].includes(n%100))?'статьи':'статей';

function wParse(){
  const p=decodeURIComponent((location.hash||'').replace(/^#\/?/,'')).split('/');
  if(/^m[123]$/.test(p[0])) return p[1]?{p:'topic',mod:+p[0][1],n:+p[1]}:{p:'mod',mod:+p[0][1]};
  if(p[0]==='talk'&&/^m[123]$/.test(p[1]||'')) return {p:'talk',mod:+p[1][1]};
  if(p[0]==='cat'&&p[1]) return {p:'cat',cat:p.slice(1).join('/')};
  return {p:'home'};
}
function wRoute(){ wRT=wParse(); if(wRT.mod&&S.mod!==wRT.mod){ S.mod=wRT.mod; save() } }

// статьи модуля = пункты задания
function wArts(mod){
  if(!R||!R.ok) return [];
  try{ return (mod===1?manualItems(C,ST,R):items23(mod,C,ST,R)).map((it,i)=>({mod,i,it,cats:wCatsOf(it.title),mach:[...new Set(it.blocks.map(b=>b[0].replace('#2','')))]})) }
  catch(e){ return [] }
}
const wAll=()=>[1,2,3].flatMap(wArts);
const wLink=(a,txt)=>'<a href="#m'+a.mod+'/'+(a.i+1)+'">'+esc(txt||a.it.title)+'</a>';

// ---------- общие куски ----------
function wPark(){ const t=$('#toolbar'), p=$('#tbPark'); if(t&&p&&t.parentNode!==p) p.appendChild(t) }
function wStand(){
  if(!R||!R.ok) return '<div class="msg err">Параметры заданы с ошибкой — исправьте их в разделе «Параметры».</div>';
  const role={router:'Маршрутизатор',server:'Сервер',client:'Рабочая станция'};
  return '<table class="wikitable"><thead><tr><th>Машина</th><th>Роль</th><th>ОС</th><th>Адрес</th></tr></thead><tbody>'+
    MACH.map(mm=>'<tr><td><b>'+mm.name+'</b></td><td>'+role[mm.role]+'</td><td>'+(mm.os||(ST.rtrOs==='alt'?'Альт Сервер':'Astra Linux CE'))+'</td><td class="mono">'+esc(mainIp(mm.key))+'</td></tr>').join('')+'</tbody></table>';
}
function wArtTable(mod){
  const a=wArts(mod); if(!a.length) return '<div class="msg err">Статьи не собираются: исправьте параметры.</div>';
  return '<table class="wikitable"><thead><tr><th>№</th><th>Статья</th><th>Машины</th><th>Категории</th></tr></thead><tbody>'+
    a.map(x=>'<tr><td>'+(x.i+1)+'</td><td>'+wLink(x)+'</td><td>'+esc(x.mach.join(', '))+'</td><td>'+x.cats.map(wCatLink).join(', ')+'</td></tr>').join('')+'</tbody></table>';
}
function wNavbox(){
  const rows=[1,2,3].map(m=>{ const a=wArts(m); return a.length?'<tr><th><a href="#m'+m+'">Модуль '+m+'</a></th><td>'+a.map(x=>wLink(x)).join(' · ')+'</td></tr>':'' }).join('');
  return rows?'<table class="navbox"><tbody><tr><th colspan="2" class="nb-t">Настройка сетевой инфраструктуры</th></tr>'+rows+'</tbody></table>':'';
}
function wCatLinks(cats){ return cats.length?'<div class="catlinks"><b>Категории:</b> '+cats.map(wCatLink).join(' <span>·</span> ')+'</div>':'' }
const wNotes=()=>'<ol class="notes"><li id="n1">Адреса и команды рассчитываются в браузере по заданным параметрам и никуда не отправляются.</li>'+
  '<li id="n2">Параметры можно подставить по коду варианта, из текста задания или вручную — статьи и сценарии пересчитаются сразу.</li>'+
  '<li id="n3">Сценарии рассчитаны на повторный запуск; порядок запуска указан по шагам.</li></ol>';
const wLinks=()=>'<ul><li><a href="index.html">Задания варианта</a> — страница студента</li><li><a href="teacher.html">Генератор вариантов</a> — страница преподавателя</li><li><a href="https://github.com/Servanchy1308/demo-exam">Исходный код проекта</a></li></ul>';

// ---------- страницы ----------
function renderMain(){
  wPark();
  ({home:pageHome,mod:pageModule,topic:pageTopic,talk:pageTalk,cat:pageCat}[wRT.p]||pageHome)();
  wHead(); wToc();
}
function pageHome(){
  const m=$('#main'), all=wAll();
  if(!all.length){ m.innerHTML='<div class="msg err">Параметры заданы с ошибкой. Откройте любой модуль и исправьте их в разделе «Параметры».</div><p><a href="#m1">Перейти к модулю 1</a></p>'; return }
  const f=all[Math.floor(Date.now()/864e5)%all.length];
  const modBox=mod=>{ const a=wArts(mod);
    return '<section class="pbox"><h3><a href="#m'+mod+'">Модуль '+mod+'</a> · '+esc(MODS[mod].title)+'</h3><div class="pb"><ol>'+a.map(x=>'<li>'+wLink(x)+'</li>').join('')+'</ol><p class="more"><a href="#m'+mod+'">Подробнее о модуле →</a></p></div></section>' };
  const counts=WCATS.map(([c])=>[c,all.filter(a=>a.cats.includes(c)).length]);
  m.innerHTML='<div class="portal-banner"><h2>Добро пожаловать в ДЭ·Вики</h2><p>Справочник по настройке сетевой инфраструктуры стенда из шести машин. Сейчас в нём <b>'+all.length+'</b> '+wPlural(all.length)+' в трёх модулях. Выберите модуль, категорию или воспользуйтесь поиском.</p></div>'+
    '<div class="portal-grid">'+[1,2,3].map(modBox).join('')+
    '<section class="pbox"><h3>Избранная статья</h3><div class="pb"><p><b>'+wLink(f)+'</b> <small>(модуль '+f.mod+')</small></p><p>'+esc(f.it.why)+'</p><p class="more"><a href="#" data-rnd>Случайная статья →</a></p></div></section>'+
    '<section class="pbox"><h3>Категории</h3><div class="pb"><ul>'+counts.map(([c,n])=>'<li>'+wCatLink(c)+' <small>('+n+')</small></li>').join('')+'</ul></div></section>'+
    '<section class="pbox"><h3>Полезные советы</h3><div class="pb"><ul><li>Имена интерфейсов проверяйте командой <code>ip -br a</code> и при необходимости меняйте в настройках стенда.</li><li>Сценарии запускаются по номерам шагов, повторный запуск безопасен.</li><li>Параметры и настройки хранятся только в этом браузере.</li></ul><p class="more"><a href="#talk/m'+S.mod+'">Обсуждение →</a></p></div></section></div>';
}
function pageCat(){
  const all=wAll().filter(a=>a.cats.includes(wRT.cat)), m=$('#main');
  if(!WCATS.some(c=>c[0]===wRT.cat)&&wRT.cat!=='Прочее'){ m.innerHTML='<div class="msg warn">Такой категории нет. <a href="#home">На заглавную страницу</a>.</div>'; return }
  m.innerHTML='<p>Всего в категории <b>'+all.length+'</b> '+wPlural(all.length)+'.</p>'+[1,2,3].map(mod=>{ const a=all.filter(x=>x.mod===mod);
    return a.length?'<h3 class="wk-h3">Модуль '+mod+'</h3><ul class="catlist">'+a.map(x=>'<li>'+wLink(x)+' <small>— '+esc(x.mach.join(', '))+'</small></li>').join('')+'</ul>':'' }).join('');
}
function pageTalk(){
  const t=(n,h,p)=>wH2('t'+n,n,h)+p;
  $('#main').innerHTML='<p class="hint">Здесь собраны замечания по работе со стендом — как на странице обсуждения в вики.</p>'+
    t(1,'Перед началом','<ul class="talk"><li>Имена интерфейсов по умолчанию — <code>eth0</code>, <code>eth1</code>, <code>eth2</code> и <code>enp0s3</code>. Сверьтесь с <code>ip -br a</code> и поправьте их в настройках стенда.</li><li>Имена виртуальных машин в VirtualBox тоже задаются в настройках стенда.</li></ul>')+
    t(2,'Порядок запуска','<ul class="talk"><li>Сценарии запускаются по номерам шагов; повторный запуск безопасен.</li><li>После базового шага машине нужна перезагрузка: можно перезагружать сразу или набрать <code>reboot</code> самостоятельно.</li></ul>')+
    t(3,'Передача сценария в виртуальную машину','<ul class="talk"><li>Сохраните сценарий в <code>C:\\1.txt</code>, в виртуалке войдите под root с английской раскладкой и выполните <code>VBoxManage controlvm "…" keyboardputfile C:\\1.txt</code> из папки VirtualBox.</li></ul>')+
    (S.mod!==1?t(4,'Адреса и учётные записи','<ul class="talk"><li>Адреса, домен и логины для модулей 2 и 3 берутся из параметров модуля 1.</li></ul>'):'');
}
function pageTopic(){
  const a=wArts(wRT.mod)[wRT.n-1], m=$('#main');
  if(!a){ m.innerHTML='<div class="msg warn"><b>Такой статьи нет.</b> Воспользуйтесь поиском или вернитесь на <a href="#m'+wRT.mod+'">страницу модуля</a>.</div>'; return }
  const list=wArts(wRT.mod), prev=list[a.i-1], next=list[a.i+1], it=a.it;
  const byM=[]; it.blocks.forEach(([mm,code],j)=>{ byM.push([mm.replace('#2',''),code,j]) });
  m.innerHTML=wH2('sCfg',1,'Конфигурирование')+byM.map(([mm,code,j])=>'<h3 class="wk-h3">'+esc(mm)+'</h3><div class="blk"><div class="mh"><span></span><button type="button" class="lnk" data-tc="'+j+'">Копировать</button></div><pre id="tc'+j+'" tabindex="0">'+hl(code)+'</pre></div>').join('')+
    wH2('sChk',2,'Проверка')+(it.check&&it.check.length?'<ul class="chklist">'+it.check.map(([c])=>'<li><code>'+esc(c)+'</code></li>').join('')+'</ul>':'<p>Отдельных проверок нет.</p>')+
    wH2('sSee',3,'См. также')+'<ul>'+(prev?'<li>Предыдущая: '+wLink({mod:a.mod,i:a.i-1,it:prev.it})+'</li>':'')+(next?'<li>Следующая: '+wLink({mod:a.mod,i:a.i+1,it:next.it})+'</li>':'')+'<li><a href="#m'+a.mod+'">Модуль '+a.mod+': '+esc(MODS[a.mod].title)+'</a></li></ul>'+
    wH2('sNote',4,'Примечания')+'<ol class="notes"><li id="n1">Значения подставлены из параметров: изменить их можно на <a href="#m'+a.mod+'">странице модуля</a>.</li></ol>';
  m.querySelectorAll('[data-tc]').forEach(b=>b.addEventListener('click',()=>{ const j=+b.dataset.tc; copyText(it.blocks[j][1],$('#tc'+j)) }));
}
function pageModule(){
  const m=$('#main'), ok=R&&R.ok;
  m.innerHTML=wH2('sStand',1,'Стенд')+wStand()+
    wH2('sArt',2,'Статьи раздела')+wArtTable(S.mod)+
    wH2('sPar',3,'Параметры')+'<div id="tbSlot"></div>'+
    (S.stand?'<details class="mi" open id="standBox"><summary><b>Стенд: ОС, интерфейсы, имена ВМ</b>'+ICON.chev+'</summary><div class="fb">'+standHtml()+'</div></details>':'')+repHtml()+
    '<details class="mi" open id="pbox"><summary><span class="num">3.1</span><b>Параметры '+MODS[S.mod].name.replace('Модуль','модуля')+'</b><span class="hint" style="margin-left:8px">правки сразу меняют команды</span>'+ICON.chev+'</summary><div class="fb"><div id="pmsgs"></div>'+paramsHtml()+'</div></details>'+
    wH2('sSol',4,'Сценарии автоматизации')+'<section id="sol" class="panel" aria-label="Сценарии"></section>'+
    wH2('sSee',5,'См. также')+'<ul>'+[1,2,3].filter(x=>x!==S.mod).map(x=>'<li><a href="#m'+x+'">Модуль '+x+': '+esc(MODS[x].title)+'</a></li>').join('')+'<li><a href="#talk/m'+S.mod+'">Обсуждение</a></li></ul>'+
    wH2('sNote',6,'Примечания')+wNotes()+
    wH2('sLink',7,'Ссылки')+wLinks();
  $('#tbSlot').appendChild($('#toolbar'));
  wireParams($('#pbox')); if(S.stand) wireStand($('#standBox'));
  const h=$('#hideRep'); if(h) h.addEventListener('click',()=>{ REP=null; save(); renderMain() });
  m.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{ const el=$('#p_'+b.dataset.goto); if(el){ el.scrollIntoView({block:'center',behavior:'smooth'}); el.focus({preventScroll:true}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1500) } }));
  updCalc(); renderSol();
}

// ---------- заголовок, вступление, инфобокс, вкладки, подвал, сайдбар ----------
function wHead(){
  const T=$('#wkTitle'); if(!T) return;
  wIDX=null;
  const md=MODS[S.mod], code=C&&C.num?codeOf(C):null, variant=code?'вариант '+code:'демоверсия';
  let title='Заглавная страница', hat='', lead='', info='', cats=[], showNav=false;
  const row=(k,v)=>'<tr><th scope="row">'+esc(k)+'</th><td>'+v+'</td></tr>';
  const sec=t=>'<tr class="ib-s"><th colspan="2">'+t+'</th></tr>';
  if(wRT.p==='mod'){
    title=md.title; showNav=true;
    hat='«Модуль '+S.mod+'» — часть ДЭ 09.02.06. О других модулях см. '+[1,2,3].filter(x=>x!==S.mod).map(x=>'<a href="#m'+x+'">модуль '+x+'</a>').join(' и ')+'.';
    lead='<p><b>'+esc(md.title)+'</b> — тема модуля '+S.mod+' демонстрационного экзамена 09.02.06: настройка стенда из шести машин — ISP, HQ-RTR, BR-RTR, HQ-SRV, BR-SRV и HQ-CLI.'+wRef(1)+' На выполнение отводится '+md.min+' мин.</p>'+
      '<p>Каждая тема описана в отдельной статье (раздел «Статьи раздела»), а готовые сценарии по машинам собраны в разделе «Сценарии автоматизации». Значения подставлены для: <b>'+esc(variant)+'</b>.'+wRef(2)+'</p>';
    let rows=sec('Общие сведения')+row('Модуль',esc(md.name)+' · '+md.min+' мин')+row('Вариант',esc(code||'демоверсия'))+row('ОС роутеров',ST.rtrOs==='alt'?'Альт Сервер':'Astra Linux CE');
    if(R&&R.ok) rows+=sec('Адресация')+row('Домен',esc(C.dom))+row('ISP — HQ-RTR',esc(C.netIspHq))+row('ISP — BR-RTR',esc(C.netIspBr))+row('Туннель',esc((C.tun||'gre').toUpperCase()+' · '+C.netTun))+row('HQ-SRV',esc(A.hqSrv+'/'+R.lans.srv.p))+row('BR-SRV',esc(A.brSrv+'/'+R.lans.br.p));
    info='<div class="ib-t">'+esc(md.name)+' · '+esc(code||'демо')+'</div><table>'+rows+'</table>';
    cats=[...new Set(wArts(S.mod).flatMap(a=>a.cats))];
  } else if(wRT.p==='topic'){
    const a=wArts(wRT.mod)[wRT.n-1], tot=wArts(wRT.mod).length; showNav=true;
    if(a){ title=a.it.title;
      hat='Статья входит в модуль '+a.mod+' «'+esc(MODS[a.mod].title)+'». О модуле см. <a href="#m'+a.mod+'">здесь</a>.';
      lead='<p>'+esc(a.it.why)+'</p>';
      info='<div class="ib-t">'+esc(a.it.title)+'</div><table>'+row('Модуль',esc(MODS[a.mod].name))+row('Раздел',(a.i+1)+' из '+tot)+row('Машины',esc(a.mach.join(', ')))+row('Вариант',esc(code||'демоверсия'))+'</table>';
      cats=a.cats;
    } else title='Статья не найдена';
  } else if(wRT.p==='talk'){ title='Обсуждение: '+md.title; hat='Страница обсуждения модуля '+S.mod+'. <a href="#m'+S.mod+'">К статье</a>.' }
  else if(wRT.p==='cat'){ title='Категория: '+wRT.cat; cats=[] }
  T.textContent=title; document.title=title+' — ДЭ·Вики';
  $('#wkHat').innerHTML=hat; $('#wkHat').hidden=!hat;
  const L=$('#wkLead'); L.innerHTML=lead?'<div>'+lead+'</div>'+(info?'<aside class="infobox" aria-label="Карточка">'+info+'</aside>':''):''; L.hidden=!lead;
  // вкладки
  const mt='m'+(wRT.mod||S.mod), tab=(h,t,on)=>on?'<span class="tab on">'+t+'</span>':'<a class="tab" href="#'+h+'">'+t+'</a>';
  const art=wRT.p==='topic'?'m'+wRT.mod+'/'+wRT.n:(wRT.p==='talk'?mt:(wRT.p==='mod'?mt:'home'));
  $('#wkTabs').innerHTML=(wRT.p==='cat'||wRT.p==='home')?'<span class="tab on">'+(wRT.p==='cat'?'Категория':'Статья')+'</span>':tab(art,'Статья',wRT.p!=='talk')+tab('talk/'+mt,'Обсуждение',wRT.p==='talk');
  // подвал
  const date=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
  $('#wkFoot').innerHTML=wCatLinks(cats)+(showNav?wNavbox():'')+'<p>Страница сформирована '+date+' по текущим параметрам. Команды рассчитаны в браузере и никуда не отправляются.</p>';
  wNav();
}
function wNav(){
  const on=(c,h,t)=>'<li'+(c?' class="on"':'')+'><a href="#'+h+'">'+t+'</a></li>';
  const mc=m=>wRT.p!=='home'&&wRT.p!=='cat'&&S.mod===m;
  $('#navBox').innerHTML='<h3>Навигация</h3><ul>'+on(wRT.p==='home','home','Заглавная страница')+[1,2,3].map(m=>on(mc(m),'m'+m,'Модуль '+m)).join('')+
    '<li><a href="#" data-rnd>Случайная статья</a></li><li><a href="#talk/m'+S.mod+'">Обсуждение</a></li></ul>';
  const all=wAll();
  $('#catBox').innerHTML='<h3>Категории</h3><ul>'+WCATS.map(([c])=>{ const n=all.filter(a=>a.cats.includes(c)).length; return '<li'+(wRT.p==='cat'&&wRT.cat===c?' class="on"':'')+'><a href="#cat/'+encodeURIComponent(c)+'">'+esc(c)+(all.length?' <small>'+n+'</small>':'')+'</a></li>' }).join('')+'</ul>';
  $('#toolBox').innerHTML='<h3>Инструменты</h3><ul><li><a href="#" data-copylink>Ссылка на эту страницу</a></li><li><a href="index.html">Задания варианта</a></li><li><a href="teacher.html">Генератор вариантов</a></li></ul>';
}

// ---------- оглавление ----------
function wToc(){
  const box=$('#tocBox'), ol=$('#toc'); if(!box||!ol) return;
  const els=[...document.querySelectorAll('#main h2.wk-h2, #main h3.wk-h3, #solveBody details.mi')];
  const secs=[]; let cur=null, k=0;
  els.forEach((el,i)=>{
    if(el.tagName==='H2'){ const nm=el.querySelector('.num'); el.id=el.id||('h'+i);
      cur={id:el.id,num:nm?nm.textContent:'',title:el.textContent.replace(nm?nm.textContent:'','').trim(),kids:[]}; secs.push(cur); k=0 }
    else if(cur){ k++; el.id=el.id||('t'+i); cur.kids.push({id:el.id,num:cur.num+'.'+k,title:el.tagName==='DETAILS'?(el.querySelector('b')?el.querySelector('b').textContent:''):el.textContent}) }
  });
  if(!secs.length){ box.hidden=true; return }
  const li=x=>'<li data-t="'+x.id+'"><a href="#'+x.id+'" data-to="'+x.id+'"><span class="tn">'+esc(x.num)+'</span><span>'+esc(x.title)+'</span></a>'+(x.kids&&x.kids.length?'<ol>'+x.kids.map(li).join('')+'</ol>':'')+'</li>';
  ol.innerHTML=secs.map(li).join(''); box.hidden=false;
  wSpy();
}
function wMark(id){ document.querySelectorAll('#toc li').forEach(l=>l.classList.toggle('cur',l.dataset.t===id)) }
function wSpy(){
  if(wSpyOn) return; wSpyOn=true; let tick=false;
  const run=()=>{ tick=false; let cur=null;
    document.querySelectorAll('#toc [data-to]').forEach(a=>{ const el=document.getElementById(a.dataset.to); if(el&&el.getBoundingClientRect().top<140) cur=a.dataset.to });
    wMark(cur) };
  window.addEventListener('scroll',()=>{ if(!tick){ tick=true; requestAnimationFrame(run) } },{passive:true}); run();
}

// ---------- поиск и общие обработчики ----------
function wBuildIdx(){
  const out=[{t:'Заглавная страница',h:'home',s:''}];
  [1,2,3].forEach(m=>{ out.push({t:'Модуль '+m+': '+MODS[m].title,h:'m'+m,s:''}); wArts(m).forEach(a=>out.push({t:a.it.title,h:'m'+m+'/'+(a.i+1),s:a.it.why,k:'Модуль '+m})) });
  WCATS.forEach(([c])=>out.push({t:'Категория: '+c,h:'cat/'+encodeURIComponent(c),s:''}));
  return out;
}
function wInit(){
  const q=$('#wkQ'), sug=$('#wkSug');
  const run=()=>{ const v=q.value.trim().toLowerCase(); if(!v){ sug.hidden=true; return [] }
    if(!wIDX) wIDX=wBuildIdx();
    const res=wIDX.map(x=>({x,s:(x.t.toLowerCase().includes(v)?2:0)+(x.s.toLowerCase().includes(v)?1:0)})).filter(r=>r.s).sort((a,b)=>b.s-a.s).slice(0,8).map(r=>r.x);
    sug.innerHTML=res.length?res.map(x=>'<a class="sg" href="#'+x.h+'"><b>'+esc(x.t)+'</b>'+(x.k?' <small>'+esc(x.k)+'</small>':'')+(x.s?'<span>'+esc(x.s.length>90?x.s.slice(0,90)+'…':x.s)+'</span>':'')+'</a>').join(''):'<div class="sg none">Ничего не найдено</div>';
    sug.hidden=false; return res };
  q.addEventListener('input',run);
  q.addEventListener('keydown',e=>{ if(e.key==='Escape'){ sug.hidden=true; q.blur() } });
  $('#wkSearch').addEventListener('submit',e=>{ e.preventDefault(); const r=run(); if(r[0]){ location.hash='#'+r[0].h; sug.hidden=true; q.blur() } });
  sug.addEventListener('click',()=>{ sug.hidden=true; q.value='' });
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-to]');
    if(a){ e.preventDefault(); const el=document.getElementById(a.dataset.to); if(el){ if(el.tagName==='DETAILS') el.open=true; el.scrollIntoView({behavior:'smooth',block:'start'}); wMark(a.dataset.to) } return }
    if(e.target.closest('[data-rnd]')){ e.preventDefault(); const all=wAll(); if(all.length){ const r=all[Math.floor(Math.random()*all.length)]; location.hash='#m'+r.mod+'/'+(r.i+1) } return }
    if(e.target.closest('[data-copylink]')){ e.preventDefault(); copyText(location.href); return }
    if(!e.target.closest('#wkSearch')) sug.hidden=true;
  });
  window.addEventListener('hashchange',()=>{ render(); window.scrollTo(0,0) });
}
