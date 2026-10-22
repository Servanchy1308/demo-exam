// ===== solve page: paste a task text → parameters → scripts =====
const SKEY='degen.solve.v1';
const STAND_DEF={ifIspWan:'eth0',ifIspHq:'eth1',ifIspBr:'eth2',ifHqWan:'eth0',ifHqLan:'eth1',ifBrWan:'eth0',ifBrLan:'eth1',ifSrv:'enp0s3',ifCli:'enp0s3',
  vmIsp:'ISP',vmHqRtr:'HQ-RTR',vmBrRtr:'BR-RTR',vmHqSrv:'HQ-SRV',vmBrSrv:'BR-SRV',vmHqCli:'HQ-CLI',autoReboot:'no',rtrOs:'astra'};
let S=Object.assign({text:'',c:null,rep:null,tab:'solve',sel:'isp',step:0,mode:'auto'},store.get(SKEY,{}));
let ST=Object.assign({},STAND_DEF,store.get('degen.v3.stand',{}));
let C=S.c, REP=S.rep, R=null, A=null, G=null;
const save=()=>{ S.c=C; S.rep=REP; store.set(SKEY,S) };
const saveST=()=>{ const all=store.get('degen.v3.stand',{}); store.set('degen.v3.stand',Object.assign(all,ST)) };
const B_=(id,icon,label,cls)=>'<button type="button" class="btn'+(cls?' '+cls:'')+'" id="'+id+'">'+(icon?ICON[icon]:'')+'<span class="lbl">'+label+'</span></button>';
const fname = s => 'module1_solve'+s;
mountTheme($('#themeSeg'));
mountTimer($('#timerBox'),60);

// ---------- defaults: official demo of 09.02.06 ----------
const DEF={lv:'E',num:0,mask:ALLTRAPS,addrMode:'given',block:'',
  srvRule:'le',srvN:'32',cliRule:'ge',cliN:'16',mgmtRule:'le',mgmtN:'8',brRule:'le',brN:'16',
  srvBase:'192.168.100.0',cliBase:'192.168.200.0',mgmtBase:'192.168.99.0',brBase:'192.168.1.0',
  srvVid:'100',cliVid:'200',mgmtVid:'999',netIspHq:'172.16.1.0/28',netIspBr:'172.16.2.0/28',netTun:'10.10.10.0/30',tun:'gre',
  adm:'net_admin',admPass:'P@ssw0rd',su:'sshuser',suPass:'P@ssw0rd',uid:'2026',sshPort:'2026',maxTries:'2',banner:'Authorized access only',
  ospfPass:'P@ssw0rd',dom:'au-team.irpo',tz:'Europe/Moscow',fwd1:'77.88.8.8',fwd2:'77.88.8.1',dockerTo:'hq'};
// fields the official text leaves to the student: shown as «на выбор», not as a warning
const FREE=new Set(['srvBase','cliBase','mgmtBase','brBase','netTun','tun','ospfPass','fwd1','fwd2','tz','block']);
const LBL={srvN:'Размер HQ-SRV',cliN:'Размер HQ-CLI',mgmtN:'Размер сети управления',brN:'Размер BR-SRV',srvBase:'Сеть HQ-SRV',cliBase:'Сеть HQ-CLI',mgmtBase:'Сеть управления',brBase:'Сеть BR-SRV',
  block:'Блок VLSM',srvVid:'VLAN HQ-SRV',cliVid:'VLAN HQ-CLI',mgmtVid:'VLAN управления',netIspHq:'ISP ↔ HQ-RTR',netIspBr:'ISP ↔ BR-RTR',netTun:'Сеть туннеля',tun:'Туннель',
  adm:'Логин роутеров',admPass:'Пароль роутеров',su:'Логин серверов',suPass:'Пароль серверов',uid:'UID',sshPort:'Порт SSH',maxTries:'Попыток входа',banner:'Баннер',
  ospfPass:'Пароль OSPF',dom:'Домен',tz:'Часовой пояс',fwd1:'DNS пересылки 1',fwd2:'DNS пересылки 2',dockerTo:'docker указывает'};
const SHOWN=['srvN','cliN','mgmtN','brN','srvVid','cliVid','mgmtVid','srvBase','cliBase','mgmtBase','brBase','netIspHq','netIspBr','netTun','tun','adm','admPass','su','suPass','uid','sshPort','maxTries','banner','ospfPass','dom','tz','fwd1','fwd2','dockerTo'];

// ---------- parser ----------
const NUMW={'один':1,'одна':1,'одной':1,'одного':1,'одну':1,'два':2,'две':2,'двух':2,'три':3,'трёх':3,'трех':3,'четыре':4,'четырёх':4,'четырех':4,'пять':5,'пяти':5,'шесть':6,'шести':6,'семь':7,'семи':7,'восемь':8,'восьми':8,'девять':9,'девяти':9,'десять':10,'десяти':10};
const IP='(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3})', CIDR='(\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\s*\\/\\s*\\d{1,2})';
const tidy = v => String(v).replace(/\s+/g,'');
const tok = v => String(v).replace(/^["'(]+/,'').replace(/["')]+$/,'').replace(/[.,;:]+$/,'');
const TZKEYS=[['калининград','Europe/Kaliningrad',2],['москов','Europe/Moscow',3],['москв','Europe/Moscow',3],['самар','Europe/Samara',4],['екатеринбург','Asia/Yekaterinburg',5],
  ['омск','Asia/Omsk',6],['новосибирск','Asia/Novosibirsk',7],['красноярск','Asia/Krasnoyarsk',7],['иркутск','Asia/Irkutsk',8],['якутск','Asia/Yakutsk',9],
  ['владивосток','Asia/Vladivostok',10],['магадан','Asia/Magadan',11],['камчат','Asia/Kamchatka',12]];

function parseTask(raw){
  const s0=String(raw).trim().replace(/^.*#/,''), code=s0.length<12?parseCode(s0):null;
  if(code){ const c=makeVariant(code.lv,code.num,code.mask); return {c,rep:{src:'code',code:codeOf(c),found:SHOWN.slice(),miss:[]}} }
  const t=String(raw).replace(/\r/g,'').replace(/\u00a0/g,' ').replace(/[«»“”„]/g,'"').replace(/[‐‑‒–—−]/g,'-').replace(/[ \t]+/g,' ');
  const lines=t.split(/\n|[●•▪■◦]|(?:^|\s)[o]\s(?=[А-ЯA-Z])/).map(x=>x.trim()).filter(Boolean);
  const c=Object.assign({},DEF), found=new Set(), set=(k,v)=>{ if(v==null||v==='') return; c[k]=String(v); found.add(k) };
  const lineWith = re => lines.filter(l=>re.test(l));

  // 1. local networks: size, rule, VLAN, network address
  const LRE=/(HQ-SRV|HQ-CLI|BR-SRV|управлени[а-я]*)\s*(?:\(\s*VLAN\s*(\d{1,4})\s*\))?[^\n]{0,90}?вмещать\s+(не\s+более|не\s+больше|не\s+менее|не\s+меньше|до|максимум|минимум|как\s+минимум)?\s*(\d{1,5})\s*(?:ip-?)?адрес/gi;
  let m; while((m=LRE.exec(t))){ const w=m[1].toLowerCase(), k=w==='hq-srv'?'srv':w==='hq-cli'?'cli':w==='br-srv'?'br':'mgmt';
    if(found.has(k+'N')) continue;
    const rr=(m[3]||'').toLowerCase(); set(k+'Rule',/мен|минимум/.test(rr)?'ge':'le'); found.add(k+'Rule'); set(k+'N',m[4]);
    if(m[2]&&k!=='br') set(k+'Vid',m[2]);
    const after=t.slice(LRE.lastIndex,LRE.lastIndex+80), b=new RegExp('^[^\\n]{0,30}?адрес\\s+сети\\s+'+IP).exec(after); if(b) set(k+'Base',b[1]) }
  // VLAN from the switching item, if not given next to the sizes
  [['srv',/HQ-SRV[^\n.]{0,45}?VLAN\s*(\d{1,4})/i],['cli',/HQ-CLI[^\n.]{0,45}?VLAN\s*(\d{1,4})/i],['mgmt',/управлени[^\n.]{0,45}?VLAN\s*(\d{1,4})/i]]
    .forEach(([k,re])=>{ if(!found.has(k+'Vid')){ const x=re.exec(t); if(x) set(k+'Vid',x[1]) } });
  // VLSM
  const vb=new RegExp('блок[а-я]*\\s+'+CIDR,'i').exec(t); if(vb&&/VLSM|нареж/i.test(t)){ set('addrMode','vlsm'); set('block',tidy(vb[1])) }

  // 2. provider networks
  const PRE=new RegExp('(HQ|BR)-RTR([^\\d]{0,80}?)сет[ьи]\\s+'+CIDR,'gi');
  while((m=PRE.exec(t))){ if(/туннел|GRE|IP-?in/i.test(m[2])) continue; const k=m[1].toUpperCase()==='HQ'?'netIspHq':'netIspBr'; if(!found.has(k)) set(k,tidy(m[3])); PRE.lastIndex=m.index+6 }

  // 6. tunnel
  const tn=new RegExp('туннел[а-я]*[^\\n]{0,40}?'+CIDR,'i').exec(t); if(tn) set('netTun',tidy(tn[1]));
  const gre=/\bGRE\b/i.test(t), ipip=/IP[\s-]*in[\s-]*IP|\bIPIP\b/i.test(t);
  if(ipip&&!gre) set('tun','ipip'); else if(gre&&!ipip) set('tun','gre');

  // 3. users
  const NAME='"?([a-z_][a-z0-9_-]{2,31})"?';
  lines.forEach(l=>{ const u=new RegExp('пользовател[а-я]*\\s+'+NAME,'i').exec(l); if(!u||/^(sudo|root)$/.test(u[1])) return;
    if(/сервер|HQ-SRV|BR-SRV/i.test(l)&&!found.has('su')) set('su',u[1]);
    else if(/маршрутизатор|роутер|HQ-RTR|BR-RTR/i.test(l)&&!found.has('adm')) set('adm',u[1]) });
  lines.forEach(l=>{ const p=/парол[а-яё]*\s*:?\s*("[^"]+"|\S+)/i.exec(l.replace(/^.*?(с\s+паролем|паролем|пароль\s*:)/i,'$1')); if(!p) return;
    const v=tok(p[1]); if(!v||/^(пользовател|для|на|в|и|с|защит)/i.test(v)) return;
    if(/ospf|протокол|маршрутизац|link.?state/i.test(l)){ if(!found.has('ospfPass')) set('ospfPass',v); return }
    const isSu = new RegExp('\\b'+c.su+'\\b').test(l)||/сервер/i.test(l), isAdm = new RegExp('\\b'+c.adm+'\\b').test(l)||/маршрутизатор|роутер/i.test(l);
    if(isSu&&!isAdm&&!found.has('suPass')) set('suPass',v); else if(isAdm&&!isSu&&!found.has('admPass')) set('admPass',v) });
  const uid=/(?:идентификатор[а-я]*(?:\s+пользователя)?|\buid)\s*[:=]?\s*(\d{3,5})/i.exec(t); if(uid) set('uid',uid[1]);

  // 5. SSH
  const port=/порт[а-я]*\s*:?\s*(\d{2,5})/i.exec(t); if(port) set('sshPort',port[1]);
  const tr=/попыт[а-я]*\s+(?:входа|авторизац[а-я]*|подключен[а-я]*)\D{0,25}?(?:^|\s)до\s+(\d+|[а-яё]+)/i.exec(t)||/попыт[а-я]*\s+(?:входа|авторизац[а-я]*)\s*[:=-]?\s*(\d+)/i.exec(t);
  if(tr){ const v=/^\d+$/.test(tr[1])?tr[1]:NUMW[tr[1].toLowerCase()]; if(v) set('maxTries',v) }
  const bn=/баннер[а-я]*\s*:?\s*(?:с\s+текстом\s*)?"([^"\n]+)"/i.exec(t)||/баннер[а-я]*\s*:?\s+([A-Za-z][A-Za-z0-9 ,!'-]*[A-Za-z0-9!])/i.exec(t); if(bn) set('banner',bn[1].trim());

  // 7. OSPF password, if written as «пароль X» without «паролем»
  if(!found.has('ospfPass')){ const op=/(?:ospf|протокол[а-я]*)[^\n]{0,60}?парол[а-я]*\s+("[^"]+"|[^\s,.;]+)/i.exec(t); if(op&&!/^(защит|аутент)/i.test(op[1])) set('ospfPass',tok(op[1])) }

  // domain
  const dm=/домен[а-я]*\s+"?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i.exec(t)||/(?:hq|br)-(?:rtr|srv|cli)\.([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i.exec(t)||/суффикс[^\n]{0,25}?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i.exec(t);
  if(dm) set('dom',dm[1].replace(/\.$/,'').toLowerCase());

  // 10. DNS forwarders
  const fw=new RegExp('(?:пересыл|forward)[^\\n]{0,80}?'+IP+'(?:[^\\n\\d]{1,12}'+IP+')?','i').exec(t);
  if(fw){ set('fwd1',fw[1]); if(fw[2]) set('fwd2',fw[2]) }

  // 11. time zone
  const tzl=lineWith(/час[а-я]*\s+пояс|времен[а-я]*\s+зон|timezone/i).join(' ')||'';
  const iana=/\b((?:Europe|Asia)\/[A-Za-z_]+)\b/.exec(tzl+' '+t);
  if(iana&&TZ[iana[1]]) set('tz',iana[1]);
  else { const lo=tzl.toLowerCase(), hit=TZKEYS.find(([w])=>lo.includes(w)); if(hit) set('tz',hit[1]);
    else { const u=/(?:UTC|GMT)\s*\+\s*(\d{1,2})|MSK\s*\+\s*(\d)/i.exec(tzl); if(u){ const h=u[1]?+u[1]:3+(+u[2]); const z=TZKEYS.find(x=>x[2]===h); if(z) set('tz',z[1]) } } }

  // docker / web side
  const dl=(t.match(/docker[^\n;]{0,90}/gi)||[]).map(x=>x.split(/\bweb\b/i)[0]).join(' ');
  if(/BR-RTR|сторону\s+BR/i.test(dl)) set('dockerTo','br'); else if(/HQ-RTR|сторону\s+HQ/i.test(dl)) set('dockerTo','hq');
  else { const di=new RegExp(IP).exec(dl), ib=parseCidr(c.netIspBr); if(di&&ib){ set('dockerTo',ip2n(di[1])===ib.net+1?'br':'hq') } }

  const miss=SHOWN.filter(k=>!found.has(k)&&!(c.addrMode==='vlsm'&&/Base$/.test(k)));
  if(c.addrMode==='vlsm') { const r=compute(c); if(r.ok) fillBases(c,r) }
  return {c,rep:{src:'text',found:[...found],miss}};
}

// ---------- sample: official-style wording ----------
const SAMPLE=`Модуль 1. Настройка сетевой инфраструктуры
1. Произведите базовую настройку устройств
● Настройте имена устройств согласно топологии. Используйте полное доменное имя
● На всех устройствах необходимо сконфигурировать IPv4
● IP-адрес должен быть из приватного диапазона, в случае, если сеть локальная, согласно RFC1918
● Локальная сеть в сторону HQ-SRV(VLAN 100) должна вмещать не более 32 адресов
● Локальная сеть в сторону HQ-CLI(VLAN 200) должна вмещать не менее 16 адресов
● Локальная сеть для управления(VLAN 999) должна вмещать не более 8 адресов
● Локальная сеть в сторону BR-SRV должна вмещать не более 16 адресов
2. Настройка ISP
● Интерфейс, подключенный к магистральному провайдеру, получает адрес по DHCP
● Интерфейс, к которому подключен HQ-RTR, подключен к сети 172.16.1.0/28
● Интерфейс, к которому подключен BR-RTR, подключен к сети 172.16.2.0/28
● На ISP настройте динамическую сетевую трансляцию в сторону HQ-RTR и BR-RTR для доступа к сети Интернет
3. Создание локальных учетных записей
● Создайте пользователя sshuser на серверах HQ-SRV и BR-SRV
o Пароль пользователя sshuser с паролем P@ssw0rd
o Идентификатор пользователя 2026
o Пользователь sshuser должен иметь возможность запускать sudo без ввода пароля
● Создайте пользователя net_admin на маршрутизаторах HQ-RTR и BR-RTR
o Пароль пользователя net_admin с паролем P@ssw0rd
4. Настройте коммутацию в сегменте HQ
● Трафик HQ-SRV должен принадлежать VLAN 100
● Трафик HQ-CLI должен принадлежать VLAN 200
● Предусмотреть возможность передачи трафика управления в VLAN 999
5. Настройка безопасного удаленного доступа на серверах HQ-SRV и BR-SRV
● Для подключения используйте порт 2026
● Разрешите подключения только пользователю sshuser
● Ограничьте количество попыток входа до двух
● Настройте баннер «Authorized access only»
6. Между офисами HQ и BR необходимо сконфигурировать ip туннель. На выбор технологии GRE или IP in IP
7. Обеспечьте динамическую маршрутизацию: используйте link state протокол на ваше усмотрение. Обеспечьте защиту выбранного протокола посредством парольной защиты
8. Настройте динамическую трансляцию адресов для обоих офисов
9. Настройка DHCP: сервер — HQ-RTR, клиент — HQ-CLI. DNS-суффикс для офисов HQ – au-team.irpo
10. Основной DNS-сервер реализован на HQ-SRV. В качестве DNS сервера пересылки используйте любой общедоступный DNS сервер
Таблица: docker.au-team.irpo — A — ISP, адрес в сторону HQ-RTR; web.au-team.irpo — A — ISP, адрес в сторону BR-RTR
11. Настройте часовой пояс на всех устройствах (согласно месту проведения экзамена)`;

// ---------- parse report ----------
function repHtml(){
  if(!REP) return '';
  if(REP.src==='code') return '<div class="msgs"><div class="msg" style="background:var(--ok-bg);color:var(--ok)">Открыт вариант '+esc(REP.code)+' этого сайта: все параметры взяты по коду.</div></div>';
  const show=k=>k==='tun'?(C.tun==='gre'?'GRE':'IP-in-IP'):k==='dockerTo'?'в сторону '+(C.dockerTo==='br'?'BR':'HQ'):k==='tz'?C.tz.split('/')[1]:/N$/.test(k)?(C[k.replace('N','Rule')]==='ge'?'≥ ':'≤ ')+C[k]:C[k];
  const keys=SHOWN.filter(k=>!(C.addrMode==='vlsm'&&/Base$/.test(k)));
  const f=keys.filter(k=>REP.found.includes(k)), free=REP.miss.filter(k=>FREE.has(k)), warn=REP.miss.filter(k=>!FREE.has(k));
  const pill=(k,cls,tip)=>'<button type="button" class="pill '+cls+'" data-goto="'+k+'" title="'+tip+'">'+esc(LBL[k])+': <b>'+esc(show(k))+'</b></button>';
  return '<div class="card"><h3>Что найдено в тексте <small>'+f.length+' из '+keys.length+'</small></h3>'+
    '<div class="prsum"><span class="k-ok">найдено в задании</span><span>не задано в задании — выбрано по умолчанию</span><span class="k-warn">не найдено — проверьте</span></div>'+
    '<div class="pr">'+warn.map(k=>pill(k,'warn','Не нашёл в тексте. Нажмите, чтобы исправить')).join('')+f.map(k=>pill(k,'ok','Взято из текста')).join('')+free.map(k=>pill(k,'free','В задании не указано, значение на ваш выбор')).join('')+'</div></div>';
}

// ---------- parameters (same fields as the teacher page) ----------
const PF=[
  ['Провайдер и туннель','Пункты 2, 6 и 7',[['netIspHq','ISP ↔ HQ-RTR',1],['netIspBr','ISP ↔ BR-RTR',1],['netTun','Сеть туннеля',1],['tun','Технология туннеля',0,[['gre','GRE'],['ipip','IP-in-IP']]],['ospfPass','Пароль OSPF',1]]],
  ['Пользователи и SSH','Пункты 3 и 5',[['adm','Логин на роутерах',1],['admPass','Пароль на роутерах',1],['su','Логин на серверах',1],['suPass','Пароль на серверах',1],['uid','UID на серверах',1],['sshPort','Порт SSH',1],['maxTries','Попыток входа',1],['banner','Текст баннера',1,null,1]]],
  ['Домен, время и DNS','Пункты 9, 10 и 11',[['dom','Домен',1],['tz','Часовой пояс',0,Object.keys(TZ).map(k=>[k,k+' · '+TZ[k].replace(/^.*\(/,'(')])],['fwd1','Внешний DNS 1',1],['fwd2','Внешний DNS 2',1],['dockerTo','Куда указывает docker',0,[['hq','ISP в сторону HQ-RTR, web — в сторону BR'],['br','ISP в сторону BR-RTR, web — в сторону HQ']],1]]]
];
function field(k,l,mono,opts,full){
  const v=C[k]??'';
  return '<div class="f'+(full?' full':'')+'"><label for="p_'+k+'">'+l+'</label>'+(opts?'<select id="p_'+k+'" data-k="'+k+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select>'
    :'<input id="p_'+k+'" data-k="'+k+'"'+(mono?' class="mono"':'')+' value="'+esc(v)+'" spellcheck="false">')+'</div>';
}
function msgsHtml(){ if(!R) return ''; let h='';
  R.E.forEach(t=>h+='<div class="msg err">'+esc(t)+'</div>'); R.W.forEach(t=>h+='<div class="msg warn">'+esc(t)+'</div>');
  return h?'<div class="msgs">'+h+'</div>':'' }
function renderParams(m){
  const lanBox=([k,n])=>'<div class="lan"><div class="lt"><b>'+(k==='mgmt'?'Сеть управления':'Сеть '+n)+'</b><span class="calc" id="calc_'+k+'"></span></div><div class="sentence">'+
    (C.addrMode==='given'?'Адрес <input class="mono w-ip" id="p_'+k+'Base" data-k="'+k+'Base" aria-label="Адрес сети '+n+'" value="'+esc(C[k+'Base'])+'">,':'')+' вмещать '+
    '<select id="p_'+k+'Rule" data-k="'+k+'Rule" aria-label="Правило '+n+'"><option value="le"'+(C[k+'Rule']==='le'?' selected':'')+'>не более</option><option value="ge"'+(C[k+'Rule']==='ge'?' selected':'')+'>не менее</option></select> '+
    '<input class="mono w-n" id="p_'+k+'N" data-k="'+k+'N" aria-label="Число адресов '+n+'" inputmode="numeric" value="'+esc(C[k+'N'])+'"> адресов'+
    (k==='br'?'':', VLAN <input class="mono w-v" id="p_'+k+'Vid" data-k="'+k+'Vid" aria-label="VLAN '+n+'" inputmode="numeric" value="'+esc(C[k+'Vid'])+'">')+'</div></div>';
  m.innerHTML='<div id="pmsgs"></div><div class="form"><div class="card"><h3>Локальные сети <small>пункты 1 и 4</small></h3>'+
    field('addrMode','Как заданы адреса',0,[['given','Адрес каждой сети указан или выбран вручную'],['vlsm','Нарезать из общего блока (VLSM)']],1)+
    (C.addrMode==='vlsm'?field('block','Общий блок',1):'')+LANS.map(lanBox).join('')+'</div>'+
    PF.map(([t,sub,fs])=>'<div class="card"><h3>'+t+' <small>'+sub.toLowerCase()+'</small></h3><div class="row">'+fs.map(f=>field(...f)).join('')+'</div></div>').join('')+'</div>';
  const upd=()=>{ $('#pmsgs').innerHTML=msgsHtml(); LANS.forEach(([k])=>{ const e=$('#calc_'+k), n=R.lans[k]; e.textContent=n?n.cidr+' · маска '+n.mask+' · '+n.size+' адр.':'—' }) };
  m.querySelectorAll('[data-k]').forEach(el=>{
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
      const k=el.dataset.k; C=Object.assign({},C,{[k]:el.value.trim()});
      if(REP&&REP.miss.includes(k)){ REP.miss=REP.miss.filter(x=>x!==k); REP.found.push(k) }
      if(k==='addrMode'&&C.addrMode==='vlsm'&&!parseCidr(C.block)){ const p=String(C.srvBase).split('.'); C.block=p.slice(0,3).join('.')+'.0/24' }
      if(k==='addrMode'&&C.addrMode==='given'&&R.ok) fillBases(C,R);
      recompute(); save(); renderTabs();
      if(k==='addrMode') renderParams(m); else upd();
    });
  });
  upd();
}

// ---------- stand ----------
function renderStand(m){
  const f=(k,l)=>'<div class="f"><label for="s_'+k+'">'+l+'</label><input class="mono" id="s_'+k+'" data-s="'+k+'" value="'+esc(ST[k])+'" spellcheck="false"></div>';
  m.innerHTML='<div class="form"><div class="card"><h3>Стенд</h3><div class="f"><label for="s_rtrOs">ОС на ISP, HQ-RTR и BR-RTR</label><select id="s_rtrOs" data-s="rtrOs"><option value="astra"'+(ST.rtrOs==='astra'?' selected':'')+'>Astra Linux CE</option><option value="alt"'+(ST.rtrOs==='alt'?' selected':'')+'>Альт Сервер</option></select><span class="hint">Серверы и клиент — Альт. Настройки общие со страницей преподавателя.</span></div>'+
    '<div class="f"><label for="s_autoReboot">После шага «База»</label><select id="s_autoReboot" data-s="autoReboot"><option value="no"'+(ST.autoReboot==='no'?' selected':'')+'>Не перезагружать, reboot наберу сам</option><option value="yes"'+(ST.autoReboot==='yes'?' selected':'')+'>Сразу перезагрузить машину</option></select></div></div>'+
    '<div class="card"><h3>Имена интерфейсов <small>смотрите командой ip -br a</small></h3><div class="row">'+
    f('ifIspWan','ISP → интернет')+f('ifIspHq','ISP → HQ')+f('ifIspBr','ISP → BR')+f('ifHqWan','HQ-RTR → ISP')+f('ifHqLan','HQ-RTR → офис')+f('ifBrWan','BR-RTR → ISP')+f('ifBrLan','BR-RTR → офис')+f('ifSrv','HQ-SRV и BR-SRV')+f('ifCli','HQ-CLI')+'</div></div>'+
    '<div class="card"><h3>Имена ВМ в VirtualBox</h3><div class="row">'+f('vmIsp','ISP')+f('vmHqRtr','HQ-RTR')+f('vmBrRtr','BR-RTR')+f('vmHqSrv','HQ-SRV')+f('vmBrSrv','BR-SRV')+f('vmHqCli','HQ-CLI')+'</div>'+
    '<button type="button" class="btn ghost" id="resetS" style="align-self:flex-start">Сбросить стенд</button></div></div>';
  m.querySelectorAll('[data-s]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ ST[el.dataset.s]=el.value.trim(); saveST(); recompute() }));
  $('#resetS').addEventListener('click',()=>{ ST=Object.assign({},STAND_DEF); saveST(); recompute(); renderStand(m); toast('Стенд сброшен') });
}

// ---------- solution (same scripts as the teacher page) ----------
const MACH=[
  {key:'isp',name:'ISP',role:'router',steps:['isp']},
  {key:'hqrtr',name:'HQ-RTR',role:'router',steps:['hqrtr','hqrtr2']},
  {key:'brrtr',name:'BR-RTR',role:'router',steps:['brrtr','brrtr2']},
  {key:'hqsrv',name:'HQ-SRV',os:'Альт Сервер',role:'server',steps:['hqsrv','hqsrv2']},
  {key:'brsrv',name:'BR-SRV',os:'Альт Сервер',role:'server',steps:['brsrv']},
  {key:'hqcli',name:'HQ-CLI',os:'Альт РС',role:'client',steps:['hqcli']}
];
const STEPNAME={isp:'База',hqrtr:'База',hqrtr2:'OSPF и DHCP',brrtr:'База',brrtr2:'OSPF',hqsrv:'База',hqsrv2:'DNS',brsrv:'База',hqcli:'Сеть и имя'};
function hl(t){ return esc(t).split('\n').map(l=>/^\s*#/.test(l)?'<span class="cm">'+l+'</span>':/(EOF_FINAL|&lt;&lt;\s*'?EOF'?|^EOF$)/.test(l)?'<span class="hd">'+l+'</span>':l).join('\n') }
function termHtml(fn,text,id){ id=id||'t';
  return '<div class="term"><div class="tbar"><span class="fn">'+esc(fn)+'</span><div class="acts"><button type="button" class="tb primary" id="'+id+'Copy">Копировать</button>'+
    (canSave()?'<button type="button" class="tb" id="'+id+'Dl">Скачать .txt</button>':'')+'</div></div><pre id="'+id+'Code" tabindex="0">'+hl(text)+'</pre></div>' }
function wireTerm(id,text,file){ const c=$('#'+id+'Copy'); if(c) c.addEventListener('click',()=>copyText(text,$('#'+id+'Code'))); const d=$('#'+id+'Dl'); if(d) d.addEventListener('click',()=>saveFile(file,text)) }
function mainIp(key){ const L=R.lans;
  return {isp:A.ispHq+' · '+A.ispBr, hqrtr:A.hqWan, brrtr:A.brWan, hqsrv:A.hqSrv+'/'+L.srv.p, brsrv:A.brSrv+'/'+L.br.p, hqcli:A.hqCli+' DHCP'}[key] }
function renderSolve(m){
  if(!G){ m.innerHTML=msgsHtml()+'<div class="empty"><b>По этим параметрам решение не собирается</b>Исправьте ошибки во вкладке «Параметры».<button type="button" class="btn" id="fixBtn">'+ICON.edit+'Открыть параметры</button></div>';
    $('#fixBtn').addEventListener('click',()=>{ S.tab='params'; save(); renderTabs(); renderBody() }); return }
  const modes=[['auto','Скрипты'],['manual','Команды по пунктам'],['check','Проверка']];
  const descr={auto:'Готовые скрипты для каждой машины. Запускайте по номерам шагов, повторный запуск безопасен.',
    check:'Скрипты ничего не меняют: проверяют машину и печатают [ OK ] или [FAIL] с номером пункта.',
    manual:'Те же команды, разложенные по пунктам задания, с пояснениями. Удобно вводить руками.'};
  m.innerHTML='<div class="bar"><div class="l"><div class="seg" role="group" aria-label="Вид решения">'+modes.map(([k,n])=>'<button type="button" data-m="'+k+'" aria-pressed="'+(S.mode===k)+'">'+n+'</button>').join('')+'</div><p>'+descr[S.mode]+'</p></div><div class="acts" id="solveActs"></div></div>'+(R.W.length?msgsHtml():'')+'<div id="solveBody" class="panel"></div>';
  m.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{ S.mode=b.dataset.m; save(); renderSolve(m) }));
  if(S.mode==='manual') return renderManual($('#solveBody'));
  const isChk=S.mode==='check', list=isChk?checkScripts(C,ST,R):G.out;
  if(canSave()){ $('#solveActs').innerHTML=B_('zipBtn','down','Все скрипты .zip'); $('#zipBtn').addEventListener('click',()=>downloadZip(isChk)) }
  if(!MACH.find(x=>x.key===S.sel)) S.sel='isp';
  const orderOf = id => list.findIndex(x=>x.id===id)+1;
  const body=$('#solveBody');
  body.innerHTML='<div class="mlist" role="group" aria-label="Машина">'+MACH.map(mm=>{ const os = mm.os || (ST.rtrOs==='alt'?'Альт':'Astra');
      const chips = isChk ? '<span class="chip">'+list.find(x=>x.id===mm.key).count+' проверок</span>' : mm.steps.map(s=>'<span class="chip">шаг '+orderOf(s)+'</span>').join('');
      return '<button type="button" class="mc '+mm.role+'" data-mc="'+mm.key+'" aria-pressed="'+(S.sel===mm.key)+'"><span class="top2"><span class="ic">'+ICON[mm.role]+'</span><span class="nm">'+mm.name+'</span></span><span class="ip">'+os+' · '+esc(mainIp(mm.key))+'</span><span class="steps">'+chips+'</span></button>' }).join('')+'</div>'+
    (isChk?'':'<details class="fold"><summary>Порядок запуска<small>9 шагов на 6 машинах</small>'+ICON.chev+'</summary><div class="fb"><ol class="order">'+G.out.map(x=>'<li><b>'+x.machine+'</b> · '+esc(x.title)+' <span>— '+esc(x.when)+'</span></li>').join('')+'</ol></div></details>')+
    '<section class="viewer" id="viewer"></section>';
  body.querySelectorAll('[data-mc]').forEach(b=>b.addEventListener('click',()=>{ S.sel=b.dataset.mc; S.step=0; save(); renderSolve(m) }));
  const mm=MACH.find(x=>x.key===S.sel); let x, seg='', sub;
  if(isChk){ x=list.find(o=>o.id===mm.key); sub=x.count+' проверок · запускать после выполнения задания' }
  else { const sid=mm.steps[Math.min(S.step,mm.steps.length-1)]; x=list.find(o=>o.id===sid); sub='Шаг '+orderOf(sid)+' из '+list.length+' · '+x.when;
    if(mm.steps.length>1) seg='<div class="seg" role="group" aria-label="Шаг">'+mm.steps.map((s,i)=>'<button type="button" data-i="'+i+'" aria-pressed="'+(s===sid)+'"><span class="n">'+orderOf(s)+'</span>'+STEPNAME[s]+'</button>').join('')+'</div>' }
  const cmd='VBoxManage controlvm "'+x.vm+'" keyboardputfile C:\\1.txt';
  $('#viewer').innerHTML='<div class="vh"><div><h2>'+esc(x.title)+'</h2><p>'+esc(sub)+'</p></div>'+seg+'</div>'+
    '<div class="send"><span>Сохраните скрипт в C:\\1.txt и выполните в cmd в папке VirtualBox:</span><code id="vbCmd">'+esc(cmd)+'</code><button type="button" class="lnk" id="vbCopy">Скопировать</button>'+
    '<details><summary>Как это работает</summary><ol><li>В виртуалке войдите под root и включите английскую раскладку.</li><li>Откройте C:\\Program Files\\Oracle\\VirtualBox, в адресной строке проводника наберите cmd.</li><li>Выполните команду выше. VirtualBox «напечатает» скрипт в консоль, он сохранится в /root/'+esc(x.sh)+' и сразу запустится.</li><li>Перезапустить вручную: bash /root/'+esc(x.sh)+'</li></ol></details></div>'+
    termHtml('/root/'+x.sh+' · '+x.text.split('\n').length+' строк', x.text);
  $('#viewer').querySelectorAll('.vh .seg button').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.i; save(); renderSolve(m) }));
  $('#vbCopy').addEventListener('click',()=>copyText(cmd,$('#vbCmd')));
  wireTerm('t',x.text,(isChk?'':String(orderOf(x.id)).padStart(2,'0')+'_')+x.sh.replace('.sh','')+'.txt');
}
function renderManual(body){
  const items=manualItems(C,ST,R);
  const plain=items.map(it=>'=== '+it.n+'. '+it.title+' ===\n'+it.why+'\n\n'+it.blocks.map(([mm,code])=>'# '+mm+'\n'+code).join('\n\n')).join('\n\n\n');
  if(canSave()){ $('#solveActs').innerHTML=B_('dlMan','down','Решение .txt'); $('#dlMan').addEventListener('click',()=>saveFile(fname('_solution.txt'),plain)) }
  body.innerHTML='<div class="manual">'+items.map((it,i)=>'<details class="mi"'+(i===0?' open':'')+'><summary><span class="num">'+it.n+'</span><b>'+esc(it.title)+'</b>'+ICON.chev+'</summary><div class="fb"><p>'+esc(it.why)+'</p>'+
    it.blocks.map(([mm,code],j)=>'<div class="blk"><div class="mh"><span>'+esc(mm)+'</span><button type="button" class="lnk" data-c="'+i+'_'+j+'">Копировать</button></div><pre id="mc'+i+'_'+j+'" tabindex="0">'+hl(code)+'</pre></div>').join('')+
    '<div class="chk">Проверка: '+it.check.map(([cmd])=>'<code>'+esc(cmd)+'</code>').join('')+'</div></div></details>').join('')+'</div>';
  body.querySelectorAll('[data-c]').forEach(b=>b.addEventListener('click',()=>{ const [i,j]=b.dataset.c.split('_').map(Number); copyText(items[i].blocks[j][1],$('#mc'+b.dataset.c)) }));
}
function downloadZip(isChk){
  if(!window.JSZip){ toast('Архиватор не загрузился'); return }
  const z=new JSZip();
  if(isChk) checkScripts(C,ST,R).forEach(x=>z.file(x.sh.replace('.sh','')+'.txt',x.text));
  else { G.out.forEach((x,i)=>z.file(String(i+1).padStart(2,'0')+'_'+x.sh.replace('.sh','')+'.txt',x.text)); z.file('00_order.txt',orderText(G.out)); z.file('report.txt',reportText(C,ST,R,A)) }
  z.generateAsync({type:'blob'}).then(bl=>saveFile(fname(isChk?'_check.zip':'_scripts.zip'),bl));
}
function renderReport(m){
  const txt=reportText(C,ST,R,A);
  m.innerHTML='<div class="bar"><p>Таблица адресов и описание настроек для отчёта по заданию.</p></div>'+termHtml('Отчёт',txt,'rp');
  wireTerm('rp',txt,fname('_report.txt'));
}

// ---------- page ----------
function recompute(){ if(!C){ R=A=G=null; return } R=compute(C); A=R.ok?addrs(C,R):null; G=R.ok?gen(C,ST,R):null }
const TABS=[['solve','Решение'],['params','Параметры'],['report','Отчёт'],['stand','Стенд']];
function renderTabs(){
  const t=$('#tabs'); if(!t) return;
  const w=REP?REP.miss.filter(k=>!FREE.has(k)).length:0, e=R&&R.E.length;
  t.innerHTML=TABS.map(([k,n])=>'<button type="button" data-t="'+k+'" aria-pressed="'+(S.tab===k)+'">'+n+(k==='params'&&(w||e)?' <span class="pill warn" style="padding:0 7px">'+(e?'ошибка':w)+'</span>':'')+'</button>').join('');
  t.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>{ S.tab=b.dataset.t; save(); renderTabs(); renderBody() }));
}
function renderBody(){
  const b=$('#tabBody');
  if(S.tab==='params') renderParams(b); else if(S.tab==='stand') renderStand(b);
  else if(S.tab==='report'){ if(G) renderReport(b); else { S.tab='solve'; renderSolve(b) } }
  else renderSolve(b);
}
function render(){
  recompute(); const m=$('#main');
  if(!C){ m.innerHTML='<div class="empty"><b>Здесь появится решение</b>Вставьте текст задания выше и нажмите «Решить». Получите скрипты для каждой машины, команды по пунктам и текст для отчёта.</div>'; return }
  m.innerHTML=repHtml()+'<div class="bar"><div class="seg" id="tabs" role="group" aria-label="Раздел"></div></div><div id="tabBody" class="panel"></div>';
  m.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.goto; S.tab='params'; save(); renderTabs(); renderBody();
    const el=$('#p_'+k)||$('#p_'+k.replace(/N$/,'N')); if(el){ el.scrollIntoView({block:'center',behavior:'smooth'}); el.focus({preventScroll:true}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1500) } }));
  renderTabs(); renderBody();
}
const ta=$('#taskIn'); ta.value=S.text||'';
$('#parseBtn').addEventListener('click',()=>{ const v=ta.value.trim(); if(!v){ toast('Сначала вставьте текст задания'); ta.focus(); return }
  const p=parseTask(v); C=p.c; REP=p.rep; S.text=ta.value; S.tab='solve'; S.sel='isp'; S.step=0; save(); render();
  const w=REP.miss.filter(k=>!FREE.has(k)).length;
  toast(REP.src==='code'?'Открыт вариант '+REP.code:w?'Готово. Проверьте '+w+' параметр(а), которых не было в тексте':'Готово: все параметры найдены');
  $('#main').scrollIntoView({behavior:'smooth',block:'start'}) });
$('#sampleBtn').addEventListener('click',()=>{ ta.value=SAMPLE; S.text=SAMPLE; save(); ta.focus(); toast('Вставлен пример. Нажмите «Решить»') });
$('#clearBtn').addEventListener('click',()=>{ ta.value=''; S.text=''; C=null; REP=null; save(); render(); ta.focus() });
ta.addEventListener('input',()=>{ S.text=ta.value; store.set(SKEY,Object.assign({},S,{c:C,rep:REP})) });
onSaveReady(()=>{ if(DL&&C) renderBody() });
render();
