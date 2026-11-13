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
const wU=()=>{ try{ return sessionStorage.getItem('wk.u')==='1' }catch(e){ return false } };
const wRed=t=>'<a class="new" href="#x/'+encodeURIComponent(t)+'" title="Такой статьи пока нет">'+esc(t)+'</a>';
const RED=['Настройка Cisco IOS','Пакетный фильтр nftables','Протокол BGP','Система LDAP','Виртуализация KVM','Резервное копирование','Протокол SNMP','Балансировка нагрузки','Прокси-сервер Squid','Протокол VRRP','Сетевая подсистема ядра','Файловая система Btrfs'];
let wRT={p:'home'}, wIDX=null, wSpyOn=false;
const wH2=(id,n,t)=>'<h2 class="wk-h2" id="'+id+'"><span class="num">'+n+'</span>'+t+'</h2>';
const wRef=n=>'<sup class="ref"><a href="#n'+n+'" data-to="n'+n+'">['+n+']</a></sup>';
const wCatLink=c=>'<a href="#cat/'+encodeURIComponent(c)+'">'+esc(c)+'</a>';
const wPlural=n=>(n%10===1&&n%100!==11)?'статья':([2,3,4].includes(n%10)&&![12,13,14].includes(n%100))?'статьи':'статей';

function wParse(){
  let raw=decodeURIComponent((location.hash||'').replace(/^#\/?/,'')), sec=null;
  const at=raw.lastIndexOf('@'); if(at>=0){ sec=raw.slice(at+1); raw=raw.slice(0,at) }
  const r=wParse0(raw.split('/')); if(sec) r.sec=sec; return r;
}
function wParse0(p){
  if(/^m[123]$/.test(p[0])) return p[1]?{p:'topic',mod:+p[0][1],n:+p[1]}:{p:'mod',mod:+p[0][1]};
  if(p[0]==='a'&&p[1]) return {p:'lx',id:p[1]};
  if(p[0]==='sol'&&!p[1]) return {p:'hub'};
  if(p[0]==='sol'&&/^m[123]$/.test(p[1]||'')) return p[2]?{p:'sol',mod:+p[1][1],n:+p[2]}:{p:'solmod',mod:+p[1][1]};
  if(p[0]==='x'&&p[1]) return {p:'stub',t:p.slice(1).join('/')};
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
const wTags=a=>a.map(x=>'<span class="mtag">'+esc(x)+'</span>').join('');
const wTbl=h=>'<div class="tblx">'+h+'</div>';
// текущая страница как строка маршрута
function wHash(){ const r=wRT;
  return r.p==='lx'?'a/'+r.id:r.p==='hub'?'sol':r.p==='mod'?'m'+r.mod:r.p==='topic'?'m'+r.mod+'/'+r.n:r.p==='sol'?'sol/m'+r.mod+'/'+r.n:r.p==='solmod'?'sol/m'+r.mod:r.p==='talk'?'talk/m'+r.mod:r.p==='cat'?'cat/'+encodeURIComponent(r.cat):r.p==='stub'?'x/'+encodeURIComponent(r.t):'home' }
// закладки и недавние страницы (только в этом браузере); страницы решений видны лишь при включённых решениях
const FAVK='degen.wiki.fav.v1', RECK='degen.wiki.recent.v1', UIK='degen.wiki.ui.v1';
const wVis=l=>l.filter(x=>x&&x.h&&(wU()||x.h.indexOf('sol/')!==0));
const wFavs=()=>wVis(store.get(FAVK,[]));
const wRecent=()=>wVis(store.get(RECK,[]));
const wIsFav=h=>store.get(FAVK,[]).some(x=>x.h===h);
function wFavToggle(h,t){ let l=store.get(FAVK,[]); const on=l.some(x=>x.h===h);
  l=on?l.filter(x=>x.h!==h):[{h,t}].concat(l).slice(0,30); store.set(FAVK,l); toast(on?'Закладка убрана':'Добавлено в закладки'); return !on }
function wTrack(h,t){ if(wRT.p==='home'||wRT.p==='stub'||wRT.p==='cat') return; const l=store.get(RECK,[]).filter(x=>x.h!==h); l.unshift({h,t}); store.set(RECK,l.slice(0,12)) }
let WUI=Object.assign({fs:'m',wide:false,wrap:false},store.get(UIK,{}));
function wApplyUI(){ const r=document.documentElement, set=(k,v)=>{ if(v) r.setAttribute(k,v); else r.removeAttribute(k) };
  set('data-fs',WUI.fs==='m'?'':WUI.fs); set('data-wide',WUI.wide?'1':''); set('data-wrap',WUI.wrap?'1':'') }
wApplyUI();
const wSvg=(d,sw)=>'<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+(sw||2)+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
const WI={
  home:wSvg('<path d="M3 11l9-8 9 8M5 10v10h14V10"/>'),
  chev:wSvg('<path d="m9 6 6 6-6 6"/>',2.4),
  star:wSvg('<path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>'),
  link:wSvg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  print:wSvg('<path d="M7 9V3h10v6M7 17H4v-8h16v8h-3M7 14h10v7H7z"/>'),
  dice:wSvg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h.01M15 15h.01M12 12h.01" stroke-width="3"/>'),
  talk:wSvg('<path d="M4 5h16v11H9l-5 4z"/>'),
  book:wSvg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>')
};
const wPager=(prev,next,href,lp,ln)=>(prev||next)?'<nav class="pager" aria-label="Соседние статьи">'+(prev?'<a class="pv" href="'+href(prev)+'"><small>← '+lp+'</small><b>'+esc(prev.it.title)+'</b></a>':'')+(next?'<a class="nx" href="'+href(next)+'"><small>'+ln+' →</small><b>'+esc(next.it.title)+'</b></a>':'')+'</nav>':'';
const wLink=(a,txt)=>'<a href="#m'+a.mod+'/'+(a.i+1)+'">'+esc(txt||a.it.title)+'</a>';

// ---------- общие куски ----------
function wPark(){ const t=$('#toolbar'), p=$('#tbPark'); if(t&&p&&t.parentNode!==p) p.appendChild(t) }
function wStand(){
  if(!R||!R.ok) return '<div class="msg err">Параметры заданы с ошибкой — исправьте их в разделе «Параметры».</div>';
  const role={router:'Маршрутизатор',server:'Сервер',client:'Рабочая станция'};
  return wTbl('<table class="wikitable"><thead><tr><th>Машина</th><th>Роль</th><th>ОС</th><th>Адрес</th></tr></thead><tbody>'+
    MACH.map(mm=>'<tr><td><b>'+mm.name+'</b></td><td>'+role[mm.role]+'</td><td>'+(mm.os||(ST.rtrOs==='alt'?'Альт Сервер':'Astra Linux CE'))+'</td><td class="mono">'+esc(mainIp(mm.key))+'</td></tr>').join('')+'</tbody></table>');
}
function wArtTable(mod){
  const a=wArts(mod); if(!a.length) return '<div class="msg err">Статьи не собираются: исправьте параметры.</div>';
  return wTbl('<table class="wikitable"><thead><tr><th>№</th><th>Статья</th><th>Машины</th><th>Категории</th>'+(wU()?'<th>Решение</th>':'')+'</tr></thead><tbody>'+
    a.map(x=>'<tr><td>'+(x.i+1)+'</td><td>'+wLink(x)+'</td><td>'+wTags(x.mach)+'</td><td>'+x.cats.map(wCatLink).join(', ')+'</td>'+(wU()?'<td><a class="btn" href="'+solHref(x)+'">Решение</a></td>':'')+'</tr>').join('')+'</tbody></table>');
}
function wNavbox(){
  const rows=[1,2,3].map(m=>{ const a=wArts(m); return a.length?'<tr><th><a href="#m'+m+'">Модуль '+m+'</a>'+(wU()?'<br><a class="nb-sol" href="#sol/m'+m+'">решения</a>':'')+'</th><td>'+a.map(x=>wLink(x)).join(' · ')+'</td></tr>':'' }).join('');
  return rows?'<table class="navbox"><tbody><tr><th colspan="2" class="nb-t">Настройка сетевой инфраструктуры</th></tr>'+rows+'<tr><th>Смежные темы</th><td>'+RED.slice(0,6).map(wRed).join(' · ')+'</td></tr></tbody></table>':'';
}
function wCatLinks(cats){ return cats.length?'<div class="catlinks"><b>Категории:</b> '+cats.map(wCatLink).join(' <span>·</span> ')+'</div>':'' }
const wNotes=()=>'<ol class="notes"><li id="n1">Адреса и команды рассчитываются в браузере по заданным параметрам и никуда не отправляются.</li>'+
  '<li id="n2">Параметры можно подставить по коду варианта, из текста задания или вручную — статьи и сценарии пересчитаются сразу.</li>'+
  '<li id="n3">Сценарии рассчитаны на повторный запуск; порядок запуска указан по шагам.</li></ol>';
const wLinks=()=>'<ul>'+RED.slice(0,5).map(t=>'<li>'+wRed(t)+'</li>').join('')+'</ul>';

// ---------- страницы ----------
function renderMain(){
  wPark();
  ({home:pageHome,mod:pageModule,topic:pageTopic,talk:pageTalk,cat:pageCat,stub:pageStub,sol:pageSol,solmod:pageSolMod,lx:pageLx,hub:pageHub}[wRT.p]||pageHome)();
  wHead(); wToc();
}
const WFACTS=[
  'Ядро Linux впервые опубликовал Линус Торвальдс в 1991 году; талисман системы — пингвин Tux — появился в 1996-м.',
  'Linux — это только ядро. Привычная система получается, когда к нему добавляют утилиты GNU, менеджер пакетов и службы; такой набор называют дистрибутивом.',
  'Astra Linux основана на Debian и использует пакеты <code>.deb</code>. Альт ведёт собственный репозиторий «Сизиф» с пакетами <code>.rpm</code>, но ставятся они тоже командой <code>apt-get</code>.',
  'Суперпользователь root всегда имеет идентификатор 0: система смотрит на число, а не на имя.',
  'Порты с номерами ниже 1024 считаются привилегированными: открыть их может только root. Поэтому SSH по умолчанию слушает порт 22, а DNS — 53.',
  'Первым процессом с номером 1 запускается <code>systemd</code>; он поднимает остальные службы, и им же управляет команда <code>systemctl</code>.',
  'Почти все настройки системы — обычные текстовые файлы в каталоге <code>/etc</code>, поэтому их можно править любым редактором и переносить между машинами.',
  'Адреса <code>127.0.0.0/8</code> никогда не уходят в сеть: это петля (loopback), по которой машина обращается сама к себе.',
  'Файл <code>/etc/hosts</code> старше DNS: до 1983 года имена всех узлов сети хранились в одном таком файле.',
  'Маршрутизатором Linux становится после одной настройки ядра — <code>net.ipv4.ip_forward=1</code>. Без неё пакеты между интерфейсами не пересылаются.'
];
const WBASE=[
  ['Имя машины','hostnamectl set-hostname hq-srv.au-team.irpo','Полное имя; проверка — <code>hostname -f</code>'],
  ['Адреса интерфейсов','ip -br a','Короткая таблица: имя, состояние, адреса'],
  ['Таблица маршрутов','ip r','Строка <code>default via</code> — шлюз по умолчанию'],
  ['Часовой пояс','timedatectl set-timezone Europe/Moscow','Список поясов — <code>timedatectl list-timezones</code>'],
  ['Запуск службы','systemctl enable --now sshd','<code>enable</code> — автозапуск, <code>--now</code> — старт сразу'],
  ['Состояние службы','systemctl status sshd','Журнал службы — <code>journalctl -u sshd -e</code>'],
  ['Установка пакета','apt-get update && apt-get install -y chrony','Одинаково в Astra Linux и в Альт'],
  ['Новый пользователь','useradd -m -s /bin/bash sshuser && passwd sshuser','<code>-m</code> создаёт домашний каталог'],
  ['Пересылка пакетов','sysctl -w net.ipv4.ip_forward=1','Навсегда — строка в <code>/etc/sysctl.conf</code>'],
  ['Открытые порты','ss -tlnp','Кто и на каком порту слушает'],
  ['Проверка связи','ping -c 3 77.88.8.8','<code>-c 3</code> — три пакета и выход'],
  ['Проверка имён','host hq-srv.au-team.irpo','Или <code>nslookup</code>, <code>dig</code>'],
  ['Диски и разделы','lsblk','Свободное место — <code>df -h</code>']
];
const WDIRS=[['/etc','настройки системы и служб'],['/etc/network/interfaces','сеть в Astra Linux'],['/etc/net/ifaces/','сеть в Альт: каталог на каждый интерфейс'],['/etc/resolv.conf','адреса серверов DNS'],['/etc/hosts','локальная таблица имён'],['/etc/ssh/sshd_config','настройки сервера SSH'],['/var/log','журналы'],['/home, /root','домашние каталоги пользователей и root'],['/srv, /opt','данные служб и стороннее ПО']];
const WOS=[['Основа','Debian','собственная ветка, репозиторий «Сизиф»'],['Пакеты','.deb (dpkg, apt)','.rpm (rpm, apt-get)'],['Настройка сети','/etc/network/interfaces','/etc/net/ifaces/&lt;интерфейс&gt;/'],['Перезапуск сети','systemctl restart networking','systemctl restart network'],['Служба SSH','ssh','sshd'],['Права администратора','sudo, группа astra-admin','su -, группа wheel']];
const lxLink=x=>'<a href="#a/'+x.id+'">'+esc(x.t)+'</a>';
function pageHome(){
  const m=$('#main'), day=Math.floor(Date.now()/864e5), f=LX[day%LX.length];
  const facts=WFACTS.map((_,i)=>WFACTS[(day+i)%WFACTS.length]).slice(0,6);
  const cp=c=>'<code data-cp title="Нажмите, чтобы скопировать">'+esc(c)+'</code>';
  const lst=(l,empty)=>l.length?'<ul class="plain">'+l.map(x=>'<li><a href="#'+x.h+'">'+esc(x.t)+'</a></li>').join('')+'</ul>':'<p class="empty-s">'+empty+'</p>';
  m.innerHTML='<div class="hero"><h2>Всё об линуксе и точка.</h2><p>справочник по Linux и сетевому администрированию, который может дополнять каждый. Сейчас в нём <b>'+LX.length+'</b> '+wPlural(LX.length)+' об Astra Linux, Альт и системе в целом.</p></div>'+
    '<div class="portal-grid two">'+
    '<section class="pbox b1"><h3>Знаете ли вы, что…</h3><div class="pb"><ul class="facts">'+facts.map(x=>'<li>'+x+'</li>').join('')+'</ul></div></section>'+
    '<section class="pbox b2"><h3>Статья дня</h3><div class="pb"><p><b>'+lxLink(f)+'</b> <small>('+esc(f.g)+')</small></p><p>'+f.lead+'</p><p class="more"><a href="#a/'+f.id+'">Читать статью →</a> · <a href="#" data-rnd>Случайная статья</a></p></div>'+
      '<h3>Совет дня</h3><div class="pb"><p>Перед настройкой сети выполните <code>ip -br a</code>: имена интерфейсов на стенде могут отличаться от тех, что в примерах.</p></div></section></div>'+
    wH2('hArts',1,'Статьи')+'<div class="portal-grid">'+LXG.map((g,i)=>'<section class="pbox'+(i%2?' b2':'')+'"><h3>'+esc(g)+'</h3><div class="pb"><ul>'+LX.filter(x=>x.g===g).map(x=>'<li>'+lxLink(x)+'</li>').join('')+'</ul></div></section>').join('')+'</div>'+
    wH2('hBase',2,'Базовые настройки Linux')+'<p>Команды, с которых начинается настройка любой машины. Нажмите на команду, чтобы скопировать её.</p>'+
    wTbl('<table class="wikitable"><thead><tr><th>Задача</th><th>Команда</th><th>Пояснение</th></tr></thead><tbody>'+WBASE.map(([t,c,n])=>'<tr><td><b>'+t+'</b></td><td>'+cp(c)+'</td><td>'+n+'</td></tr>').join('')+'</tbody></table>')+
    wH2('hDirs',3,'Где что лежит')+
    wTbl('<table class="wikitable"><thead><tr><th>Путь</th><th>Что там</th></tr></thead><tbody>'+WDIRS.map(([p,t])=>'<tr><td class="mono">'+p+'</td><td>'+t+'</td></tr>').join('')+'</tbody></table>')+
    wH2('hOs',4,'Astra Linux и Альт: в чём разница')+
    wTbl('<table class="wikitable"><thead><tr><th></th><th>Astra Linux</th><th>Альт</th></tr></thead><tbody>'+WOS.map(([k,a,b])=>'<tr><td><b>'+k+'</b></td><td class="mono">'+a+'</td><td class="mono">'+b+'</td></tr>').join('')+'</tbody></table>')+
    wH2('hMore',5,'Разное')+'<div class="portal-grid">'+
    '<section class="pbox"><h3>Недавно открытые</h3><div class="pb">'+lst(wRecent().slice(0,6),'Здесь появятся страницы, которые вы открывали.')+'</div></section>'+
    '<section class="pbox"><h3>Закладки</h3><div class="pb">'+lst(wFavs().slice(0,8),'Нажмите «В закладки» на любой статье.')+'</div></section>'+
    '<section class="pbox"><h3>Требуются статьи</h3><div class="pb"><ul>'+RED.slice(0,7).map(t=>'<li>'+wRed(t)+'</li>').join('')+'</ul></div></section></div>'+
    '';
}
// статья о Linux
function pageLx(){
  const x=lxById(wRT.id), m=$('#main');
  if(!x){ m.innerHTML='<div class="msg warn"><b>Такой статьи нет.</b> Воспользуйтесь поиском или вернитесь на <a href="#home">заглавную страницу</a>.</div>'; return }
  const i=LX.indexOf(x), prev=LX[i-1], next=LX[i+1], same=LX.filter(y=>y.g===x.g&&y!==x), pg=y=>({it:{title:y.t},id:y.id});
  m.innerHTML=x.secs.map(([t,h],k)=>wH2('s'+(k+1),k+1,esc(t))+h).join('')+
    wH2('sSee',x.secs.length+1,'См. также')+'<ul>'+same.map(y=>'<li>'+lxLink(y)+'</li>').join('')+'<li><a href="#home">Заглавная страница</a></li></ul>'+
    wPager(prev&&pg(prev),next&&pg(next),y=>'#a/'+y.id,'Предыдущая статья','Следующая статья');
}
// «Решение»: все статьи заданий в одном месте
function pageHub(){
  const m=$('#main'), all=wAll();
  if(!all.length){ m.innerHTML='<div class="msg err">Параметры заданы с ошибкой. Откройте <a href="#m1">модуль 1</a> и исправьте их в разделе «Параметры».</div>'; return }
  const counts=WCATS.map(([c])=>[c,all.filter(a=>a.cats.includes(c)).length]);
  m.innerHTML=[1,2,3].map(mod=>wH2('hM'+mod,mod,'<a href="#m'+mod+'">Модуль '+mod+'</a>. '+esc(MODS[mod].title))+
      '<p>На выполнение — '+MODS[mod].min+' мин. <a href="#m'+mod+'">Параметры варианта и сценарии по машинам →</a>'+(wU()?' · <a href="#sol/m'+mod+'"><b>Решения модуля по шагам</b></a>':'')+'</p>'+wArtTable(mod)).join('')+
    wH2('hCats',4,'Категории')+'<ul class="catlist">'+counts.map(([c,n])=>'<li>'+wCatLink(c)+' <small>('+n+')</small></li>').join('')+'</ul>';
}
function pageCat(){
  const all=wAll().filter(a=>a.cats.includes(wRT.cat)), m=$('#main');
  if(!WCATS.some(c=>c[0]===wRT.cat)&&wRT.cat!=='Прочее'){ m.innerHTML='<div class="msg warn">Такой категории нет. <a href="#home">На заглавную страницу</a>.</div>'; return }
  m.innerHTML='<p>Всего в категории <b>'+all.length+'</b> '+wPlural(all.length)+'.</p>'+[1,2,3].map(mod=>{ const a=all.filter(x=>x.mod===mod);
    return a.length?'<h3 class="wk-h3">Модуль '+mod+'</h3><ul class="catlist">'+a.map(x=>'<li>'+wLink(x)+' <small>— '+esc(x.mach.join(', '))+'</small></li>').join('')+'</ul>':'' }).join('');
}

// ---------- решения: отдельные страницы и кнопки перехода ----------
const SOLK='degen.wiki.done.v1';
const solVar=()=>(C&&C.num?codeOf(C):'demo');
const solKey=(mod,i,j)=>solVar()+':'+mod+':'+i+':'+j;
const solDone=()=>store.get(SOLK,{});
const solCount=a=>{ const d=solDone(); const tot=a.it.blocks.length; return [a.it.blocks.filter((_,j)=>d[solKey(a.mod,a.i,j)]).length,tot] };
// машины шага -> имена ВМ из настроек стенда
function solVms(name){
  const map={'ISP':ST.vmIsp,'HQ-RTR':ST.vmHqRtr,'BR-RTR':ST.vmBrRtr,'HQ-SRV':ST.vmHqSrv,'BR-SRV':ST.vmBrSrv,'HQ-CLI':ST.vmHqCli};
  let l=name.match(/ISP|HQ-RTR|BR-RTR|HQ-SRV|BR-SRV|HQ-CLI/g)||[];
  if(/все машины/i.test(name)) l=Object.keys(map); else if(/оба роутера/i.test(name)&&!l.length) l=['HQ-RTR','BR-RTR'];
  return [...new Set(l)].map(k=>[k,map[k]||k]);
}
function solSend(name){ const v=solVms(name); if(!v.length) return '';
  return '<div class="vbsend"><div class="vb-t"><b>Вставка в виртуальную машину</b><span>1) «Копировать» → сохраните в <code>C:\\1.txt</code> · 2) в ВМ войдите под root, раскладка английская · 3) вставьте в cmd (Win+R → cmd):</span></div>'+
    v.map(([k,vm])=>'<div class="vb-r"><span class="mtag">'+esc(k)+'</span><code data-cp title="Нажмите, чтобы скопировать">'+esc(vbCmd(vm))+'</code></div>').join('')+'</div>' }
const SOLICON='<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 6"/></svg>';
const solHref=a=>'#sol/m'+a.mod+'/'+(a.i+1);
function solCta(a){
  const [d,t]=solCount(a), lines=a.it.blocks.reduce((n,b)=>n+b[1].split('\n').filter(l=>l.trim()&&!/^\s*#/.test(l)).length,0);
  return '<div class="sol-cta"><div class="sc-t"><b>Готовое решение</b><span>'+t+' '+(t%10===1&&t!==11?'шаг':[2,3,4].includes(t%10)&&![12,13,14].includes(t)?'шага':'шагов')+' · '+lines+' команд · '+esc(a.mach.join(', '))+(d?' · выполнено '+d+' из '+t:'')+'</span></div>'+
    '<a class="btn primary big" href="'+solHref(a)+'">'+SOLICON+' '+(d&&d<t?'Продолжить решение':'Перейти к решению')+'</a></div>';
}
function pageSol(){
  const list=wArts(wRT.mod), a=list[wRT.n-1], m=$('#main');
  if(!a){ m.innerHTML='<div class="msg warn"><b>Такого решения нет.</b> Откройте <a href="#sol/m'+wRT.mod+'">список решений модуля</a>.</div>'; return }
  const it=a.it, done=solDone(), prev=list[a.i-1], next=list[a.i+1];
  const steps=it.blocks.map(([mm,code,j0],j)=>{ const k=solKey(a.mod,a.i,j), on=!!done[k], name=mm.replace('#2','');
    return '<section class="step'+(on?' done':'')+'" id="st'+j+'"><div class="st-h"><span class="st-n">'+(j+1)+'</span><h3 class="wk-h3">'+esc(name)+'</h3>'+
      '<label class="st-ok"><input type="checkbox" data-done="'+j+'"'+(on?' checked':'')+'> выполнено</label></div>'+
      '<div class="blk"><div class="mh"><span>Выполните на машине <b>'+esc(name)+'</b></span><button type="button" class="lnk" data-tc="'+j+'">Копировать</button></div><pre id="tc'+j+'" tabindex="0">'+hl(code)+'</pre></div>'+solSend(name)+'</section>' }).join('');
  const chk=it.check&&it.check.length?'<ul class="chklist">'+it.check.map(([c])=>'<li><code>'+esc(c)+'</code></li>').join('')+'</ul>':'<p>Отдельных проверок нет.</p>';
  m.innerHTML='<div class="sol-bar" id="solBar"></div>'+wH2('sSteps',1,'Порядок выполнения')+'<div class="steps">'+steps+'</div>'+
    wH2('sChk',2,'Проверка результата')+chk+
    wH2('sSee',3,'Дальше')+'<div class="sol-nav">'+(prev?'<a class="btn" href="'+solHref(prev)+'">← '+esc(prev.it.title)+'</a>':'<span></span>')+'<a class="btn" href="#m'+a.mod+'/'+(a.i+1)+'">К статье</a>'+(next?'<a class="btn primary" href="'+solHref(next)+'">'+esc(next.it.title)+' →</a>':'<a class="btn" href="#sol/m'+a.mod+'">Все решения модуля</a>')+'</div>';
  const upd=()=>{ const d=solDone(), n=it.blocks.filter((_,j)=>d[solKey(a.mod,a.i,j)]).length, pc=Math.round(n/it.blocks.length*100);
    $('#solBar').innerHTML='<div class="pg"><div class="pg-l"><b>Прогресс</b> <span>выполнено '+n+' из '+it.blocks.length+'</span></div><div class="pg-bar"><i style="width:'+pc+'%"></i></div></div><div class="pg-acts"><button type="button" class="btn" id="solAll">Копировать всё решение</button><button type="button" class="btn ghost" id="solReset">Сбросить отметки</button></div>';
    $('#solAll').onclick=()=>copyText(it.blocks.map(([mm,c])=>'# ===== '+mm.replace('#2','')+' =====\n'+c).join('\n\n'));
    $('#solReset').onclick=()=>{ const d2=solDone(); it.blocks.forEach((_,j)=>delete d2[solKey(a.mod,a.i,j)]); store.set(SOLK,d2); pageSol(); wHead(); wToc() };
    if(n===it.blocks.length&&next){ const b=document.createElement('a'); b.className='btn primary'; b.href=solHref(next); b.textContent='Дальше: '+next.it.title+' →'; $('#solBar .pg-acts').appendChild(b) }
    if($('#navBox').firstChild) wHead() };
  upd();
  m.querySelectorAll('[data-tc]').forEach(b=>b.addEventListener('click',()=>{ const j=+b.dataset.tc; copyText(it.blocks[j][1],$('#tc'+j)) }));
  m.querySelectorAll('[data-done]').forEach(c=>c.addEventListener('change',()=>{ const j=+c.dataset.done, d2=solDone(), k=solKey(a.mod,a.i,j);
    if(c.checked) d2[k]=1; else delete d2[k]; store.set(SOLK,d2); c.closest('.step').classList.toggle('done',c.checked); upd();
    if(c.checked){ const nx=$('#st'+(j+1)); if(nx&&!nx.classList.contains('done')) nx.scrollIntoView({behavior:'smooth',block:'start'}) } }));
}
function pageSolMod(){
  const m=$('#main'), list=wArts(wRT.mod);
  if(!list.length){ m.innerHTML='<div class="msg err">Решения не собираются: исправьте параметры на <a href="#m'+wRT.mod+'">странице модуля</a>.</div>'; return }
  const sum=list.reduce((n,a)=>{ const [d,t]=solCount(a); return [n[0]+d,n[1]+t] },[0,0]), pc=Math.round(sum[0]/sum[1]*100);
  m.innerHTML='<div class="sol-bar"><div class="pg"><div class="pg-l"><b>Прогресс модуля</b> <span>выполнено '+sum[0]+' из '+sum[1]+'</span></div><div class="pg-bar"><i style="width:'+pc+'%"></i></div></div></div>'+
    wH2('sList',1,'Решения по темам')+
    '<div class="tblx"><table class="wikitable"><thead><tr><th>№</th><th>Тема</th><th>Машины</th><th>Прогресс</th><th></th></tr></thead><tbody>'+
    list.map(a=>{ const [d,t]=solCount(a); return '<tr><td>'+(a.i+1)+'</td><td>'+wLink(a)+'</td><td>'+wTags(a.mach)+'</td><td>'+(d===t?'<span class="okb">✔ готово</span>':d+' / '+t)+'</td><td><a class="btn'+(d?'':' primary')+'" href="'+solHref(a)+'">Решение</a></td></tr>' }).join('')+'</tbody></table></div>'+
    wH2('sSee',2,'См. также')+'<ul><li><a href="#m'+wRT.mod+'">Модуль '+wRT.mod+': '+esc(MODS[wRT.mod].title)+'</a> — параметры и сценарии по машинам</li></ul>';
}
function pageStub(){
  $('#main').innerHTML='<div class="msg warn"><b>В вики пока нет статьи с таким названием.</b> Вы можете проверить название в поиске или вернуться на <a href="#home">заглавную страницу</a>.</div><p>Статья «'+esc(wRT.t)+'» ещё не создана. Если вы знаете эту тему, ею можно дополнить вики.</p>'+wCatLinks([]);
}
function pageTalk(){
  const t=(n,h,p)=>wH2('t'+n,n,h)+p+'<p class="hint">Автор: Servanchy1308</p>';
  $('#main').innerHTML='<p class="hint">Здесь собраны замечания. Все замечания написаны Servanchy1308.</p>'+
    t(1,'Перед началом','<ul class="talk"><li>Имена интерфейсов по умолчанию — <code>eth0</code>, <code>eth1</code>, <code>eth2</code> и <code>enp0s3</code>. Сверьтесь с <code>ip -br a</code> и поправьте их в настройках стенда.</li><li>Имена виртуальных машин в VirtualBox тоже задаются в настройках стенда.</li></ul>')+
    t(2,'Порядок запуска','<ul class="talk"><li>Сценарии запускаются по номерам шагов; повторный запуск безопасен.</li><li>После базового шага машине нужна перезагрузка: можно перезагружать сразу или набрать <code>reboot</code> самостоятельно.</li></ul>')+
    t(3,'Передача сценария в виртуальную машину','<ul class="talk"><li>Сохраните сценарий в <code>C:\\1.txt</code>, в виртуалке войдите под root с английской раскладкой и вставьте в cmd команду со страницы решения, например <code>'+esc(vbCmd(ST.vmIsp))+'</code>. Путь к VBoxManage указан полностью, поэтому папка, из которой открыт cmd, не важна.</li></ul>')+
    (S.mod!==1?t(4,'Адреса и учётные записи','<ul class="talk"><li>Адреса, домен и логины для модулей 2 и 3 берутся из параметров модуля 1.</li></ul>'):'');
}
function pageTopic(){
  const a=wArts(wRT.mod)[wRT.n-1], m=$('#main');
  if(!a){ m.innerHTML='<div class="msg warn"><b>Такой статьи нет.</b> Воспользуйтесь поиском или вернитесь на <a href="#m'+wRT.mod+'">страницу модуля</a>.</div>'; return }
  const list=wArts(wRT.mod), prev=list[a.i-1], next=list[a.i+1], it=a.it;
  m.innerHTML=(wU()?solCta(a):'')+wH2('sCfg',1,'Что настраивается')+
    '<div class="tblx"><table class="wikitable"><thead><tr><th>Шаг</th><th>Машина</th><th>Команд</th><th></th></tr></thead><tbody>'+it.blocks.map(([mm,code],j)=>'<tr><td>'+(j+1)+'</td><td>'+wTags([mm.replace('#2','')])+'</td><td>'+code.split('\n').filter(l=>l.trim()&&!/^\s*#/.test(l)).length+'</td><td>'+(wU()?'<a href="'+solHref(a)+'@st'+j+'">к шагу →</a>':'')+'</td></tr>').join('')+'</tbody></table></div>'+
    wH2('sChk',2,'Проверка')+(it.check&&it.check.length?'<ul class="chklist">'+it.check.map(([c])=>'<li><code>'+esc(c)+'</code></li>').join('')+'</ul>':'<p>Отдельных проверок нет.</p>')+
    wH2('sSee',3,'См. также')+'<ul>'+(wU()?'<li><b><a href="'+solHref(a)+'">Решение этой статьи</a></b></li>':'<li>'+wRed(RED[(a.i+a.mod)%RED.length])+'</li>')+(prev?'<li>Предыдущая: '+wLink({mod:a.mod,i:a.i-1,it:prev.it})+'</li>':'')+(next?'<li>Следующая: '+wLink({mod:a.mod,i:a.i+1,it:next.it})+'</li>':'')+'<li><a href="#m'+a.mod+'">Модуль '+a.mod+': '+esc(MODS[a.mod].title)+'</a></li></ul>'+
    wH2('sNote',4,'Примечания')+'<ol class="notes"><li id="n1">Значения подставлены из параметров: изменить их можно на <a href="#m'+a.mod+'">странице модуля</a>.</li></ol>'+
    wPager(prev,next,x=>'#m'+x.mod+'/'+(x.i+1),'Предыдущая статья','Следующая статья');
}
function pageModule(){
  const m=$('#main'), ok=R&&R.ok;
  m.innerHTML=wH2('sStand',1,'Стенд')+wStand()+
    (wU()?'<div class="sol-cta"><div class="sc-t"><b>Решения модуля '+S.mod+'</b><span>Отдельная страница с командами по шагам для каждой темы</span></div><a class="btn primary big" href="#sol/m'+S.mod+'">'+SOLICON+' Перейти к решениям</a></div>':'')+wH2('sArt',2,'Статьи раздела')+wArtTable(S.mod)+
    wH2('sPar',3,'Параметры')+'<div id="tbSlot"></div>'+
    (S.stand?'<details class="mi" open id="standBox"><summary><b>Стенд: ОС, интерфейсы, имена ВМ</b>'+ICON.chev+'</summary><div class="fb">'+standHtml()+'</div></details>':'')+repHtml()+
    '<details class="mi" open id="pbox"><summary><span class="num">3.1</span><b>Параметры '+MODS[S.mod].name.replace('Модуль','модуля')+'</b><span class="hint" style="margin-left:8px">правки сразу меняют команды</span>'+ICON.chev+'</summary><div class="fb"><div id="pmsgs"></div>'+paramsHtml()+'</div></details>'+
    wH2('sSol',4,'Сценарии автоматизации')+'<section id="sol" class="panel" aria-label="Сценарии"></section>'+
    wH2('sSee',5,'См. также')+'<ul>'+[1,2,3].filter(x=>x!==S.mod).map(x=>'<li><a href="#m'+x+'">Модуль '+x+': '+esc(MODS[x].title)+'</a></li>').join('')+'<li><a href="#talk/m'+S.mod+'">Обсуждение</a></li></ul>'+
    wH2('sNote',6,'Примечания')+wNotes()+
    wH2('sLink',7,'Смотрите также')+wLinks();
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
  if(wRT.p==='lx'){ const x=lxById(wRT.id);
    if(x){ title=x.t; lead='<p>'+x.lead+'</p>';
      info='<div class="ib-t">'+esc(x.t)+'</div><table>'+row('Раздел',esc(x.g))+row('Разделов',String(x.secs.length))+row('Относится к','Astra Linux, Альт')+'</table>' }
    else title='Статья не найдена';
  } else if(wRT.p==='hub'){ title='Решение';
    hat='Здесь собраны все статьи заданий демонстрационного экзамена. Общие статьи о Linux — в боковой панели.';
    lead='<p>Задания разбиты на три модуля. Каждая статья описывает одну тему: что настраивается, на каких машинах и чем проверить результат. Значения подставлены для: <b>'+esc(variant)+'</b> — изменить их можно на странице любого модуля.</p>';
  } else if(wRT.p==='mod'){
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
  } else if(wRT.p==='sol'){
    const a=wArts(wRT.mod)[wRT.n-1], tot=wArts(wRT.mod).length; showNav=true;
    if(a){ const [d,t]=solCount(a); title='Решение: '+a.it.title;
      hat='Решение к статье «'+wLink(a)+'» (модуль '+a.mod+'). Вернуться: <a href="#m'+a.mod+'/'+(a.i+1)+'">к статье</a> · <a href="#sol/m'+a.mod+'">все решения модуля</a>.';
      lead='<p>'+esc(a.it.why)+'</p><p>Выполняйте шаги по порядку, отмечая выполненные: отметки хранятся только в этом браузере отдельно для каждого варианта.</p>';
      info='<div class="ib-t">Решение · '+esc(a.it.title)+'</div><table>'+row('Модуль',esc(MODS[a.mod].name))+row('Тема',(a.i+1)+' из '+tot)+row('Шагов',String(t))+row('Выполнено',d+' из '+t)+row('Машины',esc(a.mach.join(', ')))+row('Вариант',esc(code||'демоверсия'))+'</table>';
      cats=a.cats;
    } else title='Решение не найдено';
  } else if(wRT.p==='solmod'){
    title='Решения: '+md.title; showNav=true;
    hat='Все решения модуля '+wRT.mod+'. Теория и параметры — на <a href="#m'+wRT.mod+'">странице модуля</a>.';
    lead='<p>Для каждой темы модуля <b>'+esc(MODS[wRT.mod].title)+'</b> подготовлено отдельное решение: команды по машинам, порядок выполнения и проверка. Значения подставлены для: <b>'+esc(variant)+'</b>.</p>';
    cats=[...new Set(wArts(wRT.mod).flatMap(a=>a.cats))];
  } else if(wRT.p==='stub'){ title=wRT.t; hat='Статья «'+esc(wRT.t)+'» пока не создана.';
  } else if(wRT.p==='talk'){ title='Обсуждение: '+md.title; hat='Страница обсуждения модуля '+S.mod+'. <a href="#m'+S.mod+'">К статье</a>.' }
  else if(wRT.p==='cat'){ title='Категория: '+wRT.cat; cats=[] }
  T.textContent=title; document.title=title+' — Всё об линуксе и точка';
  // хлебные крошки
  const cr=[['home','Главная']], mm=wRT.mod, at=(wRT.p==='topic'||wRT.p==='sol')?wArts(mm)[wRT.n-1]:null;
  if(mm&&wRT.p!=='home'){ cr.push(['sol','Решение']); cr.push(['m'+mm,'Модуль '+mm]) }
  if(wRT.p==='hub') cr.push([null,'Решение']);
  if(wRT.p==='lx'){ const x=lxById(wRT.id); if(x){ cr.push([null,x.g]); cr.push([null,x.t]) } }
  if(wRT.p==='solmod') cr.push([null,'Решения']);
  if(wRT.p==='talk') cr.push([null,'Обсуждение']);
  if(at){ if(wRT.p==='sol'){ cr.push(['m'+mm+'/'+wRT.n,at.it.title]); cr.push([null,'Решение']) } else cr.push([null,at.it.title]) }
  if(wRT.p==='cat') cr.push([null,'Категория: '+wRT.cat]);
  if(wRT.p==='stub') cr.push([null,wRT.t]);
  $('#wkCrumbs').innerHTML=cr.length>1?cr.map(([h,t],i)=>(i?'<span class="sep">›</span>':'')+(h&&i<cr.length-1?'<a href="#'+h+'">'+esc(t)+'</a>':'<span class="here">'+esc(t)+'</span>')).join(''):'';
  // действия страницы и строка сведений
  const hh=wHash(), favable=(['mod','topic','sol','solmod'].includes(wRT.p)&&(at||wRT.p==='mod'||wRT.p==='solmod'))||wRT.p==='hub'||(wRT.p==='lx'&&!!lxById(wRT.id));
  $('#wkActs').innerHTML=(favable?'<button type="button" class="abtn" id="wkFav" aria-pressed="'+wIsFav(hh)+'" title="Закладка (B)">'+WI.star+'<span>'+(wIsFav(hh)?'В закладках':'В закладки')+'</span></button>':'')+
    '<button type="button" class="abtn" data-copylink title="Скопировать ссылку на страницу">'+WI.link+'<span>Ссылка</span></button>'+
    (wRT.p!=='home'?'<button type="button" class="abtn" data-print title="Версия для печати">'+WI.print+'<span>Печать</span></button>':'');
  const fb=$('#wkFav'); if(fb) fb.onclick=()=>{ wFavToggle(hh,title); wHead() };
  const words=Math.round(($('#main').textContent||'').trim().split(/\s+/).length), mins=Math.max(1,Math.round(words/180));
  $('#wkSub').innerHTML='<span>Всё об линуксе и точка</span>'+(wRT.p==='home'?'':'<span>'+esc(variant)+'</span><span>чтение ≈ '+mins+' мин</span>');
  if(favable) wTrack(hh,title);
  $('#wkHat').innerHTML=hat; $('#wkHat').hidden=!hat;
  const L=$('#wkLead'); L.innerHTML=lead?'<div>'+lead+'</div>'+(info?'<aside class="infobox" aria-label="Карточка">'+info+'</aside>':''):''; L.hidden=!lead;
  // вкладки
  const mt='m'+(wRT.mod||S.mod), tab=(h,t,on)=>on?'<span class="tab on">'+t+'</span>':'<a class="tab" href="#'+h+'">'+t+'</a>';
  const sp=wRT.p==='sol'||wRT.p==='solmod', art=(wRT.p==='topic'||wRT.p==='sol')?'m'+wRT.mod+'/'+wRT.n:(wRT.p==='solmod'||wRT.p==='talk'||wRT.p==='mod'?mt:'home');
  const sol=wRT.p==='topic'||wRT.p==='sol'?'sol/m'+wRT.mod+'/'+wRT.n:'sol/'+mt, solOn=wRT.p==='sol'||wRT.p==='solmod';
  $('#wkTabs').innerHTML=(wRT.p==='cat'||wRT.p==='home'||wRT.p==='lx'||wRT.p==='hub')?'<span class="tab on">'+(wRT.p==='cat'?'Категория':wRT.p==='hub'?'Решение':'Статья')+'</span>':tab(art,'Статья',wRT.p!=='talk'&&!sp)+(wU()||solOn?'<a class="tab sol'+(solOn?' on':'')+'" href="#'+sol+'">'+SOLICON+' Решение</a>':'')+tab('talk/'+mt,'Обсуждение',wRT.p==='talk');
  // подвал
  const date=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
  $('#wkFoot').innerHTML=wCatLinks(cats)+(showNav?wNavbox():'')+'<p>Страница сформирована '+date+' по текущим параметрам. Команды рассчитаны в браузере и никуда не отправляются.</p><p style="margin-top:8px"><a href="#sol" style="color:var(--faint);font-size:.75rem;text-decoration:none">'+SOLICON+' Решение</a></p>';
  wNav();
}
const wOpen={};
function wNav(){
  const cur=wRT.p==='lx'?lxById(wRT.id):null, inSol=['hub','mod','topic','sol','solmod','talk'].includes(wRT.p);
  const grp=(g,i)=>{ const a=LX.filter(x=>x.g===g), open=(i in wOpen)?wOpen[i]:(cur?cur.g===g:i===0);
    return '<li class="grp'+(open?' open':'')+'"><div class="gh"><button type="button" class="tw" data-tw="'+i+'" aria-expanded="'+open+'" aria-label="Развернуть раздел «'+esc(g)+'»">'+WI.chev+'</button><a href="#" data-twl="'+i+'">'+esc(g)+'<small>'+a.length+'</small></a></div><ul>'+
      a.map(x=>'<li'+(x===cur?' class="on"':'')+'><a href="#a/'+x.id+'"><span>'+esc(x.t)+'</span></a></li>').join('')+'</ul></li>' };
  $('#navBox').innerHTML='<h3>Навигация</h3><ul class="tree"><li'+(wRT.p==='home'?' class="on"':'')+'><a href="#home">'+WI.home+'Заглавная страница</a></li>'+LXG.map(grp).join('')+
    '</ul>';
  const fav=wFavs(), fbx=$('#favBox');
  fbx.hidden=!fav.length;
  fbx.innerHTML='<h3>Закладки</h3><ul>'+fav.map(x=>'<li'+(x.h===wHash()?' class="on"':'')+'><a href="#'+x.h+'">'+WI.star+'<span>'+esc(x.t)+'</span></a></li>').join('')+'</ul>';
  const cb=$('#catBox'); cb.hidden=true; cb.innerHTML='';
  $('#toolBox').innerHTML='<h3>Инструменты</h3><ul><li><a href="#" data-rnd>'+WI.dice+'Случайная статья</a></li><li><a href="#" data-copylink>'+WI.link+'Ссылка на эту страницу</a></li><li><a href="#" data-print>'+WI.print+'Версия для печати</a></li></ul>';
}

// ---------- оглавление ----------
function wToc(){
  const box=$('#tocBox'), ol=$('#toc'); if(!box||!ol) return;
  const els=[...document.querySelectorAll('#main h2.wk-h2, #main h3.wk-h3, #solveBody details.mi')];
  const secs=[]; let cur=null, k=0;
  els.forEach((el,i)=>{
    if(el.tagName==='H2'){ const nm=el.querySelector('.num'); el.id=el.id||('h'+i);
      cur={id:el.id,num:nm?nm.textContent:'',title:el.textContent.replace(nm?nm.textContent:'','').replace(/#$/,'').trim(),kids:[]}; secs.push(cur); k=0 }
    else if(cur){ k++; el.id=el.id||('t'+i); cur.kids.push({id:el.id,num:cur.num+'.'+k,title:el.tagName==='DETAILS'?(el.querySelector('b')?el.querySelector('b').textContent:''):el.textContent}) }
  });
  document.querySelectorAll('#main h2.wk-h2').forEach(h=>{ if(h.id&&!h.querySelector('.anc')){ const b=document.createElement('button'); b.type='button'; b.className='anc'; b.textContent='#'; b.title='Скопировать ссылку на раздел'; b.setAttribute('aria-label','Ссылка на раздел'); b.dataset.anc=h.id; h.appendChild(b) } });
  if(secs.length<2){ box.hidden=true; return }
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
  const out=[{t:'Заглавная страница',h:'home',s:'',x:''},{t:'Решение',h:'sol',s:'Все статьи заданий демонстрационного экзамена',x:''}];
  LX.forEach(x=>out.push({t:x.t,h:'a/'+x.id,s:x.lead.replace(/<[^>]+>/g,''),k:x.g,x:lxText(x)}));
  const xo=a=>(a.it.check||[]).map(c=>c[0]).join(' ')+' '+a.mach.join(' ')+' '+a.cats.join(' ');
  [1,2,3].forEach(m=>{ out.push({t:'Модуль '+m+': '+MODS[m].title,h:'m'+m,s:'',x:''}); wArts(m).forEach(a=>out.push({t:a.it.title,h:'m'+m+'/'+(a.i+1),s:a.it.why,k:'Модуль '+m,x:xo(a)})) });
  if(wU()) [1,2,3].forEach(m=>{ out.push({t:'Решения модуля '+m,h:'sol/m'+m,s:'Все решения модуля',k:'Решение',x:''}); wArts(m).forEach(a=>out.push({t:'Решение: '+a.it.title,h:'sol/m'+m+'/'+(a.i+1),s:a.it.why,k:'Решение · модуль '+m,x:a.it.blocks.map(b=>b[1]).join(' ')})) });
  RED.forEach(t=>out.push({t:t,h:'x/'+encodeURIComponent(t),s:'',k:'Статья не создана',x:''}));
  WCATS.forEach(([c])=>out.push({t:'Категория: '+c,h:'cat/'+encodeURIComponent(c),s:'',x:''}));
  return out;
}
function wToggle(on){ try{ sessionStorage.setItem('wk.u',on?'1':'0') }catch(e){} wIDX=null; render() }
const wMarkQ=(t,v)=>{ const i=t.toLowerCase().indexOf(v); return i<0?esc(t):esc(t.slice(0,i))+'<mark>'+esc(t.slice(i,i+v.length))+'</mark>'+esc(t.slice(i+v.length)) };
const wSnip=(t,v,n)=>{ const i=t.toLowerCase().indexOf(v); if(i<0) return t.length>n?t.slice(0,n)+'…':t; const a=Math.max(0,i-30); return (a?'…':'')+t.slice(a,a+n)+(a+n<t.length?'…':'') };
function wNeighbor(d){ if(wRT.p==='lx'){ const y=LX[LX.indexOf(lxById(wRT.id))+d]; if(y) location.hash='#a/'+y.id; return }
  if(wRT.p!=='topic'&&wRT.p!=='sol') return; const l=wArts(wRT.mod), x=l[wRT.n-1+d]; if(x) location.hash='#'+(wRT.p==='sol'?'sol/':'')+'m'+x.mod+'/'+(x.i+1) }
function wDrawer(on){ const sd=$('#wkSide'); sd.classList.toggle('open',on); $('#wkScrim').hidden=!on; $('#wkMenu').setAttribute('aria-expanded',on) }
function wPop(on){ const p=$('#wkPop'); p.hidden=!on; $('#wkAa').setAttribute('aria-expanded',on); if(!on) return;
  const seg=(k,opts)=>'<div class="seg">'+opts.map(([v,t])=>'<button type="button" data-ui="'+k+'" data-v="'+v+'" aria-pressed="'+(String(WUI[k])===v)+'">'+t+'</button>').join('')+'</div>';
  p.innerHTML='<div class="pr2"><span>Размер текста</span>'+seg('fs',[['s','А−'],['m','А'],['l','А+']])+'</div>'+
    '<div class="pr2"><span>Ширина</span>'+seg('wide',[['false','Обычная'],['true','Широкая']])+'</div>'+
    '<label class="sw"><input type="checkbox" id="uiWrap"'+(WUI.wrap?' checked':'')+'> Переносить длинные строки в коде</label>';
  p.querySelectorAll('[data-ui]').forEach(b=>b.onclick=()=>{ const k=b.dataset.ui, v=b.dataset.v; WUI[k]=k==='wide'?v==='true':v; store.set(UIK,WUI); wApplyUI(); wPop(true) });
  $('#uiWrap').onchange=e=>{ WUI.wrap=e.target.checked; store.set(UIK,WUI); wApplyUI() };
}
function wHelp(){ const d=$('#wkDlg'); const k=(...a)=>a.map(x=>'<kbd>'+x+'</kbd>').join('');
  d.innerHTML='<div class="dh"><span>Горячие клавиши</span><button type="button" aria-label="Закрыть" data-close>×</button></div><dl>'+
    [[k('/'),'Поиск по вики'],[k('↑','↓','Enter'),'Выбор в результатах поиска'],[k('N')+' / '+k('P'),'Следующая и предыдущая статья'],[k('H'),'Заглавная страница'],[k('B'),'Добавить страницу в закладки'],[k('T'),'Сменить тему оформления'],[k('?'),'Это окно'],[k('Esc'),'Закрыть поиск, меню или окно']].map(([a,b])=>'<dt>'+a+'</dt><dd>'+b+'</dd>').join('')+'</dl>';
  d.querySelector('[data-close]').onclick=()=>d.close(); if(d.showModal) d.showModal(); else d.setAttribute('open','') }
function wAfter(){ // после смены страницы: прокрутка к разделу из ссылки вида #m1/3@sChk
  if(wRT.sec){ const el=document.getElementById(wRT.sec); if(el){ if(el.tagName==='DETAILS') el.open=true; el.scrollIntoView({block:'start'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1500); return } }
  window.scrollTo(0,0) }
function wInit(){
  let clicks=[]; document.addEventListener('click',e=>{ const w=e.target.closest('.wordmark span'); if(!w) return; const t=Date.now(); clicks=clicks.filter(x=>t-x<1500); clicks.push(t); if(clicks.length>=3){ clicks=[]; wToggle(!wU()) } });
  $('#wkSearch').addEventListener('submit',e=>{ if($('#wkQ').value.trim().toLowerCase()==='служебная:решения'){ e.preventDefault(); e.stopImmediatePropagation(); wToggle(true); $('#wkQ').value=''; $('#wkSug').hidden=true; location.hash='#sol/m'+S.mod } },true);
  const q=$('#wkQ'), sug=$('#wkSug'); let act=-1, last=[];
  const paint=()=>sug.querySelectorAll('a.sg').forEach((a,i)=>{ a.classList.toggle('act',i===act); if(i===act) a.scrollIntoView({block:'nearest'}) });
  const run=()=>{ const v=q.value.trim().toLowerCase(); act=-1; if(!v){ sug.hidden=true; last=[]; return [] }
    if(!wIDX) wIDX=wBuildIdx();
    const res=wIDX.map(x=>({x,s:(x.t.toLowerCase().includes(v)?4:0)+(x.s.toLowerCase().includes(v)?2:0)+((x.x||'').toLowerCase().includes(v)?1:0)})).filter(r=>r.s).sort((a,b)=>b.s-a.s).slice(0,10).map(r=>r.x);
    sug.innerHTML=res.length?res.map(x=>{ const inX=!x.t.toLowerCase().includes(v)&&!x.s.toLowerCase().includes(v), sn=inX?wSnip(x.x,v,90):(x.s?wSnip(x.s,v,90):'');
        return '<a class="sg" role="option" href="#'+x.h+'"><b>'+wMarkQ(x.t,v)+'</b>'+(x.k?' <small>'+esc(x.k)+'</small>':'')+(sn?'<span'+(inX?' class="mono"':'')+'>'+wMarkQ(sn,v)+'</span>':'')+'</a>' }).join('')+'<div class="sgf"><span>↑↓ выбрать</span><span>Enter открыть</span><span>Esc закрыть</span></div>'
      :'<div class="sg none">Ничего не найдено. Попробуйте название службы или команду, например <b>ospf</b> или <b>chrony</b>.</div>';
    sug.hidden=false; last=res; return res };
  q.addEventListener('input',run);
  q.addEventListener('focus',()=>{ if(q.value.trim()) run() });
  q.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ sug.hidden=true; q.blur() }
    else if(e.key==='ArrowDown'||e.key==='ArrowUp'){ if(!last.length) return; e.preventDefault(); act=(act+(e.key==='ArrowDown'?1:-1)+last.length)%last.length; paint() } });
  $('#wkSearch').addEventListener('submit',e=>{ e.preventDefault(); const r=last.length?last:run(), x=r[act>=0?act:0]; if(x){ location.hash='#'+x.h; sug.hidden=true; q.value=''; q.blur() } });
  sug.addEventListener('click',e=>{ if(e.target.closest('a.sg')){ sug.hidden=true; q.value='' } });
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-to]');
    if(a){ e.preventDefault(); const el=document.getElementById(a.dataset.to); if(el){ if(el.tagName==='DETAILS') el.open=true; el.scrollIntoView({behavior:'smooth',block:'start'}); wMark(a.dataset.to) } return }
    if(e.target.closest('[data-rnd]')){ e.preventDefault(); let r; do{ r=LX[Math.floor(Math.random()*LX.length)] }while(LX.length>1&&wRT.p==='lx'&&r.id===wRT.id); location.hash='#a/'+r.id; return }
    if(e.target.closest('[data-copylink]')){ e.preventDefault(); copyText(location.href.split('#')[0]+'#'+wHash()); return }
    if(e.target.closest('[data-print]')){ e.preventDefault(); window.print(); return }
    if(e.target.closest('[data-focus-search]')){ e.preventDefault(); q.focus(); return }
    const an=e.target.closest('[data-anc]'); if(an){ e.preventDefault(); copyText(location.href.split('#')[0]+'#'+wHash()+'@'+an.dataset.anc); return }
    const twl=e.target.closest('[data-twl]'); if(twl) e.preventDefault();
    const tw=twl?twl.closest('.gh').querySelector('[data-tw]'):e.target.closest('[data-tw]'); if(tw){ const li=tw.closest('.grp'), on=!li.classList.contains('open'); wOpen[tw.dataset.tw]=on; li.classList.toggle('open',on); tw.setAttribute('aria-expanded',on); return }
    const cc=e.target.closest('.chklist code,code[data-cp]'); if(cc){ copyText(cc.textContent,cc); return }
    if(!e.target.closest('#wkSearch')) sug.hidden=true;
    if(!e.target.closest('.popw')) wPop(false);
    if(e.target.closest('#wkSide a:not([data-twl])')||e.target.closest('#wkScrim')) wDrawer(false);
  });
  $('#wkMenu').addEventListener('click',()=>wDrawer(!$('#wkSide').classList.contains('open')));
  $('#wkAa').addEventListener('click',()=>wPop($('#wkPop').hidden));
  $('#wkHelp').addEventListener('click',wHelp);
  $('#wkTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  // горячие клавиши: по физическим клавишам, чтобы работали и в русской раскладке
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){ wPop(false); wDrawer(false); return }
    if(e.ctrlKey||e.metaKey||e.altKey) { if((e.ctrlKey||e.metaKey)&&e.code==='KeyK'){ e.preventDefault(); q.focus(); q.select() } return }
    const t=e.target; if(t&&(t.isContentEditable||/^(TEXTAREA|SELECT)$/.test(t.tagName)||(t.tagName==='INPUT'&&!/^(checkbox|radio|button)$/.test(t.type)))) return;
    if($('#wkDlg').open) return;
    if(e.code==='Slash'&&e.shiftKey||e.key==='?'){ e.preventDefault(); wHelp() }
    else if(e.code==='Slash'||e.key==='/'){ e.preventDefault(); q.focus(); q.select() }
    else if(e.shiftKey) return;
    else if(e.code==='KeyN') wNeighbor(1);
    else if(e.code==='KeyP') wNeighbor(-1);
    else if(e.code==='KeyH') location.hash='#home';
    else if(e.code==='KeyB'){ const b=$('#wkFav'); if(b) b.click() }
    else if(e.code==='KeyT'){ const o=['light','dark','auto'], b=$('#themeSeg [data-th="'+o[(o.indexOf(THEME)+1)%3]+'"]'); if(b) b.click() }
  });
  // полоса прогресса чтения и кнопка «Наверх»
  let tick=false; const onScroll=()=>{ tick=false; const h=document.documentElement, max=h.scrollHeight-h.clientHeight;
    $('#wkProg').style.width=(max>0?Math.min(100,h.scrollTop/max*100):0)+'%'; $('#wkTop').hidden=h.scrollTop<600 };
  window.addEventListener('scroll',()=>{ if(!tick){ tick=true; requestAnimationFrame(onScroll) } },{passive:true});
  // печать статьи: если лист задания для печати не подготовлен, печатается сама страница
  window.addEventListener('beforeprint',()=>{ if(!$('#printArea').innerHTML.trim()) document.documentElement.setAttribute('data-wkprint','1') });
  window.addEventListener('afterprint',()=>document.documentElement.removeAttribute('data-wkprint'));
  window.addEventListener('hashchange',()=>{ render(); wDrawer(false); wAfter(); onScroll(); wArmSurprise() });
  if(wParse().sec) setTimeout(wAfter,0);
  wArmSurprise();
}
// сюрприз: после первого открытия любого «Решения» через 15–30 минут весь экран мигает красно-жёлтым со словом «СПИСЫВАЕШЬ»
let wSurpriseArmed=false;
function wArmSurprise(){
  if(wSurpriseArmed||!/^#sol/.test(location.hash)) return;
  wSurpriseArmed=true;
  setTimeout(wSurprise,Math.round((10+Math.random()*10)*60000));
}
function wSurprise(){
  const d=document.createElement('div'), W=()=>innerWidth, H=()=>innerHeight, items=[];
  let stop=false;
  d.className='cheat-scr'; d.setAttribute('role','alert');
  for(let i=0;i<14;i++){
    const s=document.createElement('div'); s.className='cheat-txt'; s.textContent='СПИСЫВАЕШЬ';
    d.appendChild(s);
    items.push({el:s,x:Math.random()*Math.max(1,W()-300),y:Math.random()*Math.max(1,H()-100),
      vx:(Math.random()<.5?-1:1)*(2+Math.random()*2),vy:(Math.random()<.5?-1:1)*(2+Math.random()*2),close:false});
  }
  // первый клик запускает смену цветов, второй закрывает; полный экран запрашиваем (браузер может отказать без действия пользователя)
  let rainbow=false;
  d.addEventListener('click',()=>{ if(!rainbow){ rainbow=true; d.classList.add('rainbow') } });
  // крестик бегает по экрану: закрыть можно только поймав его
  const x=document.createElement('button');
  x.type='button'; x.className='cheat-x'; x.textContent='×'; x.setAttribute('aria-label','Закрыть');
  d.appendChild(x);
  items.push({el:x,x:W()/2,y:H()/2,vx:4,vy:3,close:true});
  x.addEventListener('click',e=>{ e.stopPropagation(); stop=true; d.remove() });
  document.body.appendChild(d);
  try{ const fs=document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen(); if(fs&&fs.catch) fs.catch(()=>{}) }catch(e){}
  // как заставка: надписи отскакивают от краёв экрана
  const step=()=>{
    if(stop||!d.isConnected) return;
    for(const o of items){
      const w=o.el.offsetWidth, h=o.el.offsetHeight;
      o.x+=o.vx; o.y+=o.vy;
      if(o.x<0||o.x+w>W()){ o.vx=-o.vx; o.x=Math.max(0,Math.min(o.x,W()-w)) }
      if(o.y<0||o.y+h>H()){ o.vy=-o.vy; o.y=Math.max(0,Math.min(o.y,H()-h)) }
      o.el.style.transform='translate('+o.x+'px,'+o.y+'px)';
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
