// ===== solve page: parameters → commands for modules 1, 2 and 3 =====
const SKEY='degen.solve.v2';
const STAND_DEF={ifIspWan:'eth0',ifIspHq:'eth1',ifIspBr:'eth2',ifHqWan:'eth0',ifHqLan:'eth1',ifBrWan:'eth0',ifBrLan:'eth1',ifSrv:'enp0s3',ifCli:'enp0s3',
  vmIsp:'ISP',vmHqRtr:'HQ-RTR',vmBrRtr:'BR-RTR',vmHqSrv:'HQ-SRV',vmBrSrv:'BR-SRV',vmHqCli:'HQ-CLI',autoReboot:'no',rtrOs:'astra'};
let S=Object.assign({mod:1,c:null,rep:null,text:'',paste:false,stand:false,mode:'auto',sel:'isp',step:0,view23:'scripts',sel23:{}},store.get(SKEY,{}));
if(!MODS[S.mod]) S.mod=1; if(!S.sel23) S.sel23={};
let ST=Object.assign({},STAND_DEF,store.get('degen.v3.stand',{}));
let C=null, REP=S.rep, R=null, A=null, G=null;
const save=()=>{ S.c=C; S.rep=REP; store.set(SKEY,S) };
const saveST=()=>{ const all=store.get('degen.v3.stand',{}); store.set('degen.v3.stand',Object.assign(all,ST)) };
const B_=(id,icon,label,cls)=>'<button type="button" class="btn'+(cls?' '+cls:'')+'" id="'+id+'">'+(icon?ICON[icon]:'')+'<span class="lbl">'+label+'</span></button>';
const fname = s => 'module'+S.mod+'_'+(C&&C.num?codeOf(C):'demo')+s;
mountTheme($('#themeSeg'));
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

// ---------- parse report (only after a pasted text) ----------
function repHtml(){
  if(!REP||S.mod!==1) return '';
  if(REP.src==='code') return '';
  const show=k=>k==='tun'?(C.tun==='gre'?'GRE':'IP-in-IP'):k==='dockerTo'?'в сторону '+(C.dockerTo==='br'?'BR':'HQ'):k==='tz'?C.tz.split('/')[1]:/N$/.test(k)?(C[k.replace('N','Rule')]==='ge'?'≥ ':'≤ ')+C[k]:C[k];
  const keys=SHOWN.filter(k=>!(C.addrMode==='vlsm'&&/Base$/.test(k)));
  const f=keys.filter(k=>REP.found.includes(k)), free=REP.miss.filter(k=>FREE.has(k)), warn=REP.miss.filter(k=>!FREE.has(k));
  const pill=(k,cls,tip)=>'<button type="button" class="pill '+cls+'" data-goto="'+k+'" title="'+tip+'">'+esc(LBL[k])+': <b>'+esc(show(k))+'</b></button>';
  return '<div class="card"><h3>Что найдено в тексте <small>'+f.length+' из '+keys.length+' · <button type="button" class="lnk" id="hideRep">скрыть</button></small></h3>'+
    '<div class="prsum"><span class="k-ok">найдено в задании</span><span>не задано в задании — выбрано по умолчанию</span><span class="k-warn">не найдено — проверьте</span></div>'+
    '<div class="pr">'+warn.map(k=>pill(k,'warn','Не нашёл в тексте')).join('')+f.map(k=>pill(k,'ok','Взято из текста')).join('')+free.map(k=>pill(k,'free','В задании не указано')).join('')+'</div></div>';
}

// ---------- parameter forms ----------
const PF=[
  ['Провайдер и туннель','Пункты 2, 6 и 7',[['netIspHq','ISP ↔ HQ-RTR',1],['netIspBr','ISP ↔ BR-RTR',1],['netTun','Сеть туннеля',1],['tun','Технология туннеля',0,[['gre','GRE'],['ipip','IP-in-IP']]],['ospfPass','Пароль OSPF',1]]],
  ['Пользователи и SSH','Пункты 3 и 5',[['adm','Логин на роутерах',1],['admPass','Пароль на роутерах',1],['su','Логин на серверах',1],['suPass','Пароль на серверах',1],['uid','UID на серверах',1],['sshPort','Порт SSH',1],['maxTries','Попыток входа',1],['banner','Текст баннера',1,null,1]]],
  ['Домен, время и DNS','Пункты 9, 10 и 11',[['dom','Домен',1],['tz','Часовой пояс',0,Object.keys(TZ).map(k=>[k,k+' · '+TZ[k].replace(/^.*\(/,'(')])],['fwd1','Внешний DNS 1',1],['fwd2','Внешний DNS 2',1],['dockerTo','Куда указывает docker',0,[['hq','ISP в сторону HQ-RTR, web — в сторону BR'],['br','ISP в сторону BR-RTR, web — в сторону HQ']],1]]]
];
const PF2=[
  ['Домен Samba','Пункт 1',[['usrN','Сколько пользователей',1],['grp','Группа',1],['usrPre','Имя: начало',1],['usrSuf','Имя: суффикс после точки',1],['usrPass','Пароль пользователей',1],['dcPass','Пароль administrator',1],['sudoCmds','Команды sudo для группы',1,null,1]]],
  ['Хранилище','Пункт 2',[['raidLvl','Уровень RAID',0,[['0','RAID 0'],['1','RAID 1'],['5','RAID 5']]],['raidMnt','Куда монтировать RAID',1],['raidDisks','Диски',1,null,1],['nfsDir','Каталог NFS',1],['nfsMnt','Куда монтировать на HQ-CLI',1]]],
  ['Время и Docker','Пункты 3 и 5',[['ntpStratum','Стратум ISP',1],['dockApp','Контейнер приложения',1],['dockPort','Порт приложения',1],['dockDb','База',1],['dockUser','Пользователь базы',1],['dockPass','Пароль базы',1]]],
  ['Веб, порты и прокси','Пункты 6–9',[['webDb','База веб-приложения',1],['webUser','Пользователь базы',1],['webPass','Пароль базы',1,null,1],['hqFwd','Порт на HQ-RTR → HQ-SRV:80',1],['brFwd','Порт на BR-RTR → приложение',1],['authUser','Логин web-аутентификации',1],['authPass','Пароль web-аутентификации',1]]]
];
const PF3=[
  ['Пользователи и сертификаты','Пункты 1 и 2',[['csv','Файл пользователей',1,null,1],['caName','Имя корневого ЦС',1],['certDays','Срок сертификатов, дней',1]]],
  ['IPsec и экран','Пункты 3 и 4',[['psk','Ключ IPsec',1,null,1],['fwAllow','Разрешить снаружи',0,'fw',1]]],
  ['Печать и журналы','Пункты 5 и 6',[['printer','Имя принтера',1],['logLvl','Уровень журналов и выше',0,LOGLV.map(([k])=>[k,k])],['logDir','Каталог журналов',1],['rotate','Ротация',0,[['daily','ежедневно'],['weekly','еженедельно'],['monthly','ежемесячно']]],['rotSize','Размер для ротации',1]]],
  ['Мониторинг, Ansible, fail2ban','Пункты 7–9',[['monName','Имя Grafana (без домена)',1],['monUser','Логин Grafana',1],['monPass','Пароль Grafana',1],['pcDir','Каталог инвентаризации',1,null,1],['f2bTries','Попыток до блокировки',1],['f2bBan','Блокировка, секунд',1]]]
];
function field(k,l,mono,opts,full){
  const v=C[k]??'';
  return '<div class="f'+(full?' full':'')+'"><label for="p_'+k+'">'+l+'</label>'+(opts?'<select id="p_'+k+'" data-k="'+k+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select>'
    :'<input id="p_'+k+'" data-k="'+k+'"'+(mono?' class="mono"':'')+' value="'+esc(v)+'" spellcheck="false">')+'</div>';
}
function field2(mk,k,l,mono,opts,full){
  const v=C[mk][k]??'', id='p_'+mk+'_'+k;
  if(opts==='fw'){ const on=v.split(/[,\s]+/);
    return '<div class="f full"><span style="font-size:.78rem;font-weight:600">'+l+'</span><div class="pr">'+FW_ALL.map(x=>'<label class="pill" style="cursor:pointer"><input type="checkbox" data-fw="'+x+'"'+(on.includes(x)?' checked':'')+' style="width:auto;margin:0"> '+x+'</label>').join('')+'</div><span class="hint">Туннель, IPsec и проброшенные порты открыты всегда.</span></div>' }
  return '<div class="f'+(full?' full':'')+'"><label for="'+id+'">'+l+'</label>'+(opts?'<select id="'+id+'" data-m="'+mk+'" data-k="'+k+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select>'
    :'<input id="'+id+'" data-m="'+mk+'" data-k="'+k+'"'+(mono?' class="mono"':'')+' value="'+esc(v)+'" spellcheck="false">')+'</div>';
}
function msgsHtml(){ if(!R) return ''; let h='';
  R.E.forEach(t=>h+='<div class="msg err">'+esc(t)+'</div>'); R.W.forEach(t=>h+='<div class="msg warn">'+esc(t)+'</div>');
  return h?'<div class="msgs">'+h+'</div>':'' }
const lanBox=([k,n])=>'<div class="lan"><div class="lt"><b>'+(k==='mgmt'?'Сеть управления':'Сеть '+n)+'</b><span class="calc" id="calc_'+k+'"></span></div><div class="sentence">'+
  (C.addrMode==='given'?'Адрес <input class="mono w-ip" id="p_'+k+'Base" data-k="'+k+'Base" aria-label="Адрес сети '+n+'" value="'+esc(C[k+'Base'])+'">,':'')+' вмещать '+
  '<select id="p_'+k+'Rule" data-k="'+k+'Rule" aria-label="Правило '+n+'"><option value="le"'+(C[k+'Rule']==='le'?' selected':'')+'>не более</option><option value="ge"'+(C[k+'Rule']==='ge'?' selected':'')+'>не менее</option></select> '+
  '<input class="mono w-n" id="p_'+k+'N" data-k="'+k+'N" aria-label="Число адресов '+n+'" inputmode="numeric" value="'+esc(C[k+'N'])+'"> адресов'+
  (k==='br'?'':', VLAN <input class="mono w-v" id="p_'+k+'Vid" data-k="'+k+'Vid" aria-label="VLAN '+n+'" inputmode="numeric" value="'+esc(C[k+'Vid'])+'">')+'</div></div>';
function fromM1(){
  if(!R||!R.ok) return '<div class="msg err">Параметры Модуля 1 с ошибкой — откройте вкладку «Модуль 1» и исправьте.</div>';
  const a=A, row=(k,v)=>'<span class="pill">'+k+': <b class="mono">'+esc(v)+'</b></span>';
  return '<div class="card"><h3>Из Модуля 1 <small><button type="button" class="lnk" data-go1>изменить</button></small></h3><div class="pr">'+
    row('Домен',C.dom)+row('HQ-SRV',a.hqSrv)+row('BR-SRV',a.brSrv)+row('HQ-CLI',a.hqCli)+row('HQ-RTR внешний',a.hqWan)+row('BR-RTR внешний',a.brWan)+row('SSH',C.su+' : '+C.sshPort)+row('Роутеры',C.adm)+'</div></div>';
}
function paramsHtml(){
  if(S.mod===1) return '<div class="form"><div class="card"><h3>Локальные сети <small>пункты 1 и 4</small></h3>'+
    field('addrMode','Как заданы адреса',0,[['given','Адрес каждой сети указан или выбран вручную'],['vlsm','Нарезать из общего блока (VLSM)']],1)+
    (C.addrMode==='vlsm'?field('block','Общий блок',1):'')+LANS.map(lanBox).join('')+'</div>'+
    PF.map(([t,sub,fs])=>'<div class="card"><h3>'+t+' <small>'+sub.toLowerCase()+'</small></h3><div class="row">'+fs.map(f=>field(...f)).join('')+'</div></div>').join('')+'</div>';
  const mk='m'+S.mod, list=S.mod===2?PF2:PF3;
  return fromM1()+'<div class="form" style="margin-top:14px">'+list.map(([t,sub,fs])=>'<div class="card"><h3>'+t+' <small>'+sub.toLowerCase()+'</small></h3><div class="row">'+fs.map(f=>field2(mk,...f)).join('')+'</div></div>').join('')+'</div>';
}
function updCalc(){ const pm=$('#pmsgs'); if(pm) pm.innerHTML=S.mod===1?msgsHtml():'';
  if(S.mod===1&&R) LANS.forEach(([k])=>{ const e=$('#calc_'+k), n=R.lans[k]; if(e) e.textContent=n?n.cidr+' · маска '+n.mask+' · '+n.size+' адр.':'—' }) }
let solT=null;
function changed(){ recompute(); save(); updCalc(); clearTimeout(solT); solT=setTimeout(renderSol,250) }
function wireParams(root){
  root.querySelectorAll('[data-k]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
    const k=el.dataset.k, mk=el.dataset.m, v=el.value.trim();
    if(mk){ C=Object.assign({},C,{[mk]:Object.assign({},C[mk],{[k]:v})});
      if(mk==='m2'&&k==='raidLvl'){ const d=v==='1'?'/dev/sdb /dev/sdc':'/dev/sdb /dev/sdc /dev/sdd'; C.m2.raidDisks=d; const i=$('#p_m2_raidDisks'); if(i) i.value=d } }
    else { C=Object.assign({},C,{[k]:v});
      if(REP&&REP.miss&&REP.miss.includes(k)){ REP.miss=REP.miss.filter(x=>x!==k); REP.found.push(k) }
      if(k==='addrMode'&&C.addrMode==='vlsm'&&!parseCidr(C.block)){ const p=String(C.srvBase).split('.'); C.block=p.slice(0,3).join('.')+'.0/24' }
      if(k==='addrMode'&&C.addrMode==='given'&&R&&R.ok) fillBases(C,R) }
    changed(); if(k==='addrMode') renderMain() }));
  root.querySelectorAll('[data-fw]').forEach(el=>el.addEventListener('change',()=>{
    const on=[...root.querySelectorAll('[data-fw]')].filter(x=>x.checked).map(x=>x.dataset.fw);
    C=Object.assign({},C,{m3:Object.assign({},C.m3,{fwAllow:on.join(', ')})}); changed() }));
  root.querySelectorAll('[data-go1]').forEach(b=>b.addEventListener('click',()=>{ S.mod=1; save(); render() }));
}

// ---------- stand ----------
function standHtml(){
  const f=(k,l)=>'<div class="f"><label for="s_'+k+'">'+l+'</label><input class="mono" id="s_'+k+'" data-s="'+k+'" value="'+esc(ST[k])+'" spellcheck="false"></div>';
  return '<div class="form"><div class="card"><h3>Стенд</h3><div class="f"><label for="s_rtrOs">ОС на ISP, HQ-RTR и BR-RTR</label><select id="s_rtrOs" data-s="rtrOs"><option value="astra"'+(ST.rtrOs==='astra'?' selected':'')+'>Astra Linux CE</option><option value="alt"'+(ST.rtrOs==='alt'?' selected':'')+'>Альт Сервер</option></select><span class="hint">Серверы и клиент — Альт. Настройки общие со страницей преподавателя.</span></div>'+
    '<div class="f"><label for="s_autoReboot">После шага «База»</label><select id="s_autoReboot" data-s="autoReboot"><option value="no"'+(ST.autoReboot==='no'?' selected':'')+'>Не перезагружать, reboot наберу сам</option><option value="yes"'+(ST.autoReboot==='yes'?' selected':'')+'>Сразу перезагрузить машину</option></select></div></div>'+
    '<div class="card"><h3>Имена интерфейсов <small>смотрите командой ip -br a</small></h3><div class="row">'+
    f('ifIspWan','ISP → интернет')+f('ifIspHq','ISP → HQ')+f('ifIspBr','ISP → BR')+f('ifHqWan','HQ-RTR → ISP')+f('ifHqLan','HQ-RTR → офис')+f('ifBrWan','BR-RTR → ISP')+f('ifBrLan','BR-RTR → офис')+f('ifSrv','HQ-SRV и BR-SRV')+f('ifCli','HQ-CLI')+'</div></div>'+
    '<div class="card"><h3>Имена ВМ в VirtualBox</h3><div class="row">'+f('vmIsp','ISP')+f('vmHqRtr','HQ-RTR')+f('vmBrRtr','BR-RTR')+f('vmHqSrv','HQ-SRV')+f('vmBrSrv','BR-SRV')+f('vmHqCli','HQ-CLI')+'</div>'+
    '<button type="button" class="btn ghost" id="resetS" style="align-self:flex-start">Сбросить стенд</button></div></div>';
}
function wireStand(root){
  root.querySelectorAll('[data-s]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ ST[el.dataset.s]=el.value.trim(); saveST(); changed() }));
  const r=$('#resetS'); if(r) r.addEventListener('click',()=>{ ST=Object.assign({},STAND_DEF); saveST(); recompute(); renderMain(); toast('Стенд сброшен') });
}

// ---------- solution views ----------
const MACH=[
  {key:'isp',name:'ISP',role:'router',steps:['isp']},
  {key:'hqrtr',name:'HQ-RTR',role:'router',steps:['hqrtr','hqrtr2']},
  {key:'brrtr',name:'BR-RTR',role:'router',steps:['brrtr','brrtr2']},
  {key:'hqsrv',name:'HQ-SRV',os:'Альт Сервер',role:'server',steps:['hqsrv','hqsrv2']},
  {key:'brsrv',name:'BR-SRV',os:'Альт Сервер',role:'server',steps:['brsrv']},
  {key:'hqcli',name:'HQ-CLI',os:'Альт РС',role:'client',steps:['hqcli']}
];
const ROLE={'ISP':'router','HQ-RTR':'router','BR-RTR':'router','HQ-SRV':'server','BR-SRV':'server','HQ-CLI':'client'};
const STEPNAME={isp:'База',hqrtr:'База',hqrtr2:'OSPF и DHCP',brrtr:'База',brrtr2:'OSPF',hqsrv:'База',hqsrv2:'DNS',brsrv:'База',hqcli:'Сеть и имя'};
function hl(t){ return esc(t).split('\n').map(l=>/^\s*#/.test(l)?'<span class="cm">'+l+'</span>':/(EOF_FINAL|&lt;&lt;\s*'?EOF'?|^EOF$)/.test(l)?'<span class="hd">'+l+'</span>':l).join('\n') }
function termHtml(fn,text,id){ id=id||'t';
  return '<div class="term"><div class="tbar"><span class="fn">'+esc(fn)+'</span><div class="acts"><button type="button" class="tb primary" id="'+id+'Copy">Копировать</button>'+
    (canSave()?'<button type="button" class="tb" id="'+id+'Dl">Скачать .txt</button>':'')+'</div></div><pre id="'+id+'Code" tabindex="0">'+hl(text)+'</pre></div>' }
function wireTerm(id,text,file){ const c=$('#'+id+'Copy'); if(c) c.addEventListener('click',()=>copyText(text,$('#'+id+'Code'))); const d=$('#'+id+'Dl'); if(d) d.addEventListener('click',()=>saveFile(file,text)) }
function mainIp(key){ const L=R.lans;
  return {isp:A.ispHq+' · '+A.ispBr, hqrtr:A.hqWan, brrtr:A.brWan, hqsrv:A.hqSrv+'/'+L.srv.p, brsrv:A.brSrv+'/'+L.br.p, hqcli:A.hqCli+' DHCP'}[key] }
const ipOf = m => ({'ISP':A.ispHq+' · '+A.ispBr,'HQ-RTR':A.hqWan,'BR-RTR':A.brWan,'HQ-SRV':A.hqSrv,'BR-SRV':A.brSrv,'HQ-CLI':A.hqCli}[m]);
function sendBox(x){ const cmd='VBoxManage controlvm "'+x.vm+'" keyboardputfile C:\\1.txt';
  return {cmd,html:'<div class="send"><span>Сохраните скрипт в C:\\1.txt и выполните в cmd в папке VirtualBox:</span><code id="vbCmd">'+esc(cmd)+'</code><button type="button" class="lnk" id="vbCopy">Скопировать</button>'+
    '<details><summary>Как это работает</summary><ol><li>В виртуалке войдите под root и включите английскую раскладку.</li><li>Откройте C:\\Program Files\\Oracle\\VirtualBox, в адресной строке проводника наберите cmd.</li><li>Выполните команду выше. VirtualBox «напечатает» скрипт, он сохранится в /root/'+esc(x.sh)+' и сразу запустится.</li><li>Перезапустить вручную: bash /root/'+esc(x.sh)+'</li></ol></details></div>'} }
function viewsFor(){ return S.mod===1?[['auto','Сценарии по машинам'],['manual','Все разделы подряд'],['check','Диагностика'],['report','Приложение: таблица адресов']]:[['scripts','Сценарии по машинам'],['items','Все разделы подряд']] }
const DESCR={manual:'Все статьи раздела на одной странице. Копируйте блок и вставляйте на нужной машине.',
  auto:'Готовые скрипты для каждой машины. Запускайте по номерам шагов, повторный запуск безопасен.',
  check:'Скрипты ничего не меняют: проверяют машину и печатают [ OK ] или [FAIL] с номером пункта.',
  report:'Таблица адресов и описание настроек для отчёта.',
  items:'Все статьи раздела на одной странице. Адреса, домен и логины берутся из модуля 1.',
  scripts:'Все команды модуля, собранные в один скрипт на машину, в порядке запуска.'};
function curView(){ const v=S.mod===1?S.mode:S.view23; return viewsFor().some(x=>x[0]===v)?v:viewsFor()[0][0] }
function renderSol(){ renderSol0(); wHead(); wToc() }
function renderSol0(){
  const m=$('#sol'); if(!m) return;
  if(!R||!R.ok){ m.innerHTML=msgsHtml()+'<div class="empty"><b>По этим параметрам раздел не собирается</b>Исправьте ошибки в параметрах'+(S.mod!==1?' Модуля 1':'')+'.</div>'; return }
  const v=curView();
  m.innerHTML='<div class="bar"><div class="l"><div class="seg" role="group" aria-label="Вид решения">'+viewsFor().map(([k,n])=>'<button type="button" data-v="'+k+'" aria-pressed="'+(v===k)+'">'+n+'</button>').join('')+'</div><p>'+DESCR[v]+'</p></div><div class="acts" id="solveActs"></div></div>'+(S.mod===1&&R.W.length?msgsHtml():'')+'<div id="solveBody" class="panel"></div>';
  m.querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click',()=>{ if(S.mod===1) S.mode=b.dataset.v; else S.view23=b.dataset.v; save(); renderSol() }));
  const body=$('#solveBody');
  if(v==='manual') return renderItems(body,manualItems(C,ST,R));
  if(v==='items') return renderItems(body,items23(S.mod,C,ST,R));
  if(v==='scripts') return renderScripts23(body);
  if(v==='report'){ const txt=reportText(C,ST,R,A); body.innerHTML=termHtml('Отчёт · Модуль 1',txt,'rp'); wireTerm('rp',txt,fname('_report.txt')); return }
  renderScripts1(body,v==='check');
}
function renderItems(body,items){
  const plain=items.map(it=>'=== '+it.n+'. '+it.title+' ===\n'+it.why+'\n\n'+it.blocks.map(([mm,code])=>'# '+mm.replace('#2','')+'\n'+code).join('\n\n')).join('\n\n\n');
  $('#solveActs').innerHTML=B_('cpAll','copy','Скопировать всё')+(canSave()?B_('dlMan','down','.txt'):'');
  $('#cpAll').addEventListener('click',()=>copyText(plain)); const d=$('#dlMan'); if(d) d.addEventListener('click',()=>saveFile(fname('_solution.txt'),plain));
  body.innerHTML='<div class="manual">'+items.map((it,i)=>'<details class="mi"><summary><span class="num">'+it.n+'</span><b>'+esc(it.title)+'</b>'+ICON.chev+'</summary><div class="fb"><p>'+esc(it.why)+'</p>'+
    it.blocks.map(([mm,code],j)=>'<div class="blk"><div class="mh"><span>'+esc(mm.replace('#2',''))+'</span><button type="button" class="lnk" data-c="'+i+'_'+j+'">Копировать</button></div><pre id="mc'+i+'_'+j+'" tabindex="0">'+hl(code)+'</pre></div>').join('')+
    '<div class="chk">Проверка: '+it.check.map(([cmd])=>'<code>'+esc(cmd)+'</code>').join('')+'</div></div></details>').join('')+'</div>';
  body.querySelectorAll('[data-c]').forEach(b=>b.addEventListener('click',()=>{ const [i,j]=b.dataset.c.split('_').map(Number); copyText(items[i].blocks[j][1],$('#mc'+b.dataset.c)) }));
}
function renderScripts1(body,isChk){
  const list=isChk?checkScripts(C,ST,R):G.out;
  if(canSave()){ $('#solveActs').innerHTML=B_('zipBtn','down','Все скрипты .zip'); $('#zipBtn').addEventListener('click',()=>downloadZip(list,isChk)) }
  if(!MACH.find(x=>x.key===S.sel)) S.sel='isp';
  const orderOf = id => list.findIndex(x=>x.id===id)+1;
  body.innerHTML='<div class="mlist" role="group" aria-label="Машина">'+MACH.map(mm=>{ const os = mm.os || (ST.rtrOs==='alt'?'Альт':'Astra');
      const chips = isChk ? '<span class="chip">'+list.find(x=>x.id===mm.key).count+' проверок</span>' : mm.steps.map(s=>'<span class="chip">шаг '+orderOf(s)+'</span>').join('');
      return '<button type="button" class="mc '+mm.role+'" data-mc="'+mm.key+'" aria-pressed="'+(S.sel===mm.key)+'"><span class="top2"><span class="ic">'+ICON[mm.role]+'</span><span class="nm">'+mm.name+'</span></span><span class="ip">'+os+' · '+esc(mainIp(mm.key))+'</span><span class="steps">'+chips+'</span></button>' }).join('')+'</div>'+
    (isChk?'':'<details class="fold"><summary>Порядок запуска<small>'+list.length+' шагов на 6 машинах</small>'+ICON.chev+'</summary><div class="fb"><ol class="order">'+list.map(x=>'<li><b>'+x.machine+'</b> · '+esc(x.title)+' <span>— '+esc(x.when)+'</span></li>').join('')+'</ol></div></details>')+
    '<section class="viewer" id="viewer"></section>';
  body.querySelectorAll('[data-mc]').forEach(b=>b.addEventListener('click',()=>{ S.sel=b.dataset.mc; S.step=0; save(); renderScripts1(body,isChk) }));
  const mm=MACH.find(x=>x.key===S.sel); let x, seg='', sub;
  if(isChk){ x=list.find(o=>o.id===mm.key); sub=x.count+' проверок · запускать после выполнения задания' }
  else { const sid=mm.steps[Math.min(S.step,mm.steps.length-1)]; x=list.find(o=>o.id===sid); sub='Шаг '+orderOf(sid)+' из '+list.length+' · '+x.when;
    if(mm.steps.length>1) seg='<div class="seg" role="group" aria-label="Шаг">'+mm.steps.map((s,i)=>'<button type="button" data-i="'+i+'" aria-pressed="'+(s===sid)+'"><span class="n">'+orderOf(s)+'</span>'+STEPNAME[s]+'</button>').join('')+'</div>' }
  const sb=sendBox(x);
  $('#viewer').innerHTML='<div class="vh"><div><h2>'+esc(x.title)+'</h2><p>'+esc(sub)+'</p></div>'+seg+'</div>'+sb.html+termHtml('/root/'+x.sh+' · '+x.text.split('\n').length+' строк', x.text);
  $('#viewer').querySelectorAll('.vh .seg button').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.i; save(); renderScripts1(body,isChk) }));
  $('#vbCopy').addEventListener('click',()=>copyText(sb.cmd,$('#vbCmd')));
  wireTerm('t',x.text,(isChk?'':String(orderOf(x.id)).padStart(2,'0')+'_')+x.sh.replace('.sh','')+'.txt');
}
function renderScripts23(body){
  const list=scripts23(S.mod,C,ST,R); let sel=S.sel23[S.mod]; if(!list.find(x=>x.id===sel)) sel=list[0].id;
  if(canSave()){ $('#solveActs').innerHTML=B_('zipBtn','down','Все скрипты .zip'); $('#zipBtn').addEventListener('click',()=>downloadZip(list,false)) }
  body.innerHTML='<div class="mlist" role="group" aria-label="Скрипт">'+list.map((x,i)=>'<button type="button" class="mc '+ROLE[x.machine]+'" data-s23="'+esc(x.id)+'" aria-pressed="'+(x.id===sel)+'"><span class="top2"><span class="ic">'+ICON[ROLE[x.machine]]+'</span><span class="nm">'+x.machine+'</span></span><span class="ip">'+esc(ipOf(x.machine))+'</span><span class="steps"><span class="chip">шаг '+(i+1)+'</span></span></button>').join('')+'</div>'+
    '<details class="fold"><summary>Порядок запуска<small>'+list.length+' шагов</small>'+ICON.chev+'</summary><div class="fb"><ol class="order">'+list.map(x=>'<li><b>'+x.machine+'</b> · '+esc(x.title)+' <span>— '+esc(x.when)+'</span></li>').join('')+'</ol></div></details><section class="viewer" id="viewer"></section>';
  body.querySelectorAll('[data-s23]').forEach(b=>b.addEventListener('click',()=>{ S.sel23[S.mod]=b.dataset.s23; save(); renderScripts23(body) }));
  const i=list.findIndex(x=>x.id===sel), x=list[i], sb=sendBox(x);
  $('#viewer').innerHTML='<div class="vh"><div><h2>'+esc(x.title)+'</h2><p>Шаг '+(i+1)+' из '+list.length+' · '+esc(x.when)+'</p></div></div>'+sb.html+termHtml('/root/'+x.sh+' · '+x.text.split('\n').length+' строк',x.text);
  $('#vbCopy').addEventListener('click',()=>copyText(sb.cmd,$('#vbCmd')));
  wireTerm('t',x.text,String(i+1).padStart(2,'0')+'_'+x.sh.replace('.sh','')+'.txt');
}
function downloadZip(list,isChk){
  if(!window.JSZip){ toast('Архиватор не загрузился'); return }
  const z=new JSZip();
  if(isChk) list.forEach(x=>z.file(x.sh.replace('.sh','')+'.txt',x.text));
  else { list.forEach((x,i)=>z.file(String(i+1).padStart(2,'0')+'_'+x.sh.replace('.sh','')+'.txt',x.text)); z.file('00_order.txt',orderText(list)); if(S.mod===1) z.file('report.txt',reportText(C,ST,R,A)) }
  z.generateAsync({type:'blob'}).then(bl=>saveFile(fname(isChk?'_check.zip':'_scripts.zip'),bl));
}

// ---------- toolbar: module, fill from code / demo / pasted text ----------
function renderToolbar(){
  const t=$('#toolbar');
  t.innerHTML=
    '<div class="codef lv-X" title="Подставить параметры варианта с сайта"><input id="codeIn" placeholder="X-12" value="'+(C.num?esc(codeOf(C)):'')+'" spellcheck="false" autocomplete="off" aria-label="Код варианта"><button type="button" id="codeGo" aria-label="Подставить параметры варианта" style="width:auto;padding:0 10px;font-size:.8rem;font-weight:700">Подставить</button></div>'+
    '<button type="button" class="btn ghost" id="demoBtn" title="Значения официальной демоверсии">Демоверсия</button>'+
    '<button type="button" class="btn ghost" id="pasteBtn" aria-expanded="'+!!S.paste+'">'+(S.paste?'Скрыть текст':'Вставить текст задания')+'</button>'+
    '<span class="grow"></span><button type="button" class="btn'+(S.stand?'" aria-pressed="true':'')+'" id="standBtn">'+ICON.gear+'<span class="lbl">Стенд</span></button>'+
    (S.paste?'<div class="paste" style="width:100%;box-shadow:none;padding:0;border:0"><textarea id="taskIn" spellcheck="false" placeholder="Вставьте текст Модуля 1 — с этого сайта или официальный. Параметры подставятся в форму.">'+esc(S.text||'')+'</textarea><div class="pa"><button type="button" class="btn primary" id="parseBtn">Разобрать</button><button type="button" class="btn" id="sampleBtn">Пример</button><span class="hint">Разбор заполняет параметры Модуля 1. Модули 2 и 3 используют его адреса.</span></div></div>':'');
  const ci=$('#codeIn'), go=()=>{ const p=parseCode(ci.value.replace(/^.*#/,'')); if(!p){ toast('Код выглядит так: X-12, E-3 или H-7'); ci.focus(); return }
    C=withM23(makeVariant(p.lv,p.num,p.mask)); REP=null; save(); render(); toast('Подставлены параметры варианта '+codeOf(C)) };
  $('#codeGo').addEventListener('click',go); ci.addEventListener('keydown',e=>{ if(e.key==='Enter') go() });
  $('#demoBtn').addEventListener('click',()=>{ C=withM23(Object.assign({},DEF)); REP=null; save(); render(); toast('Значения демоверсии') });
  $('#pasteBtn').addEventListener('click',()=>{ S.paste=!S.paste; save(); renderToolbar(); const ta=$('#taskIn'); if(ta) ta.focus() });
  $('#standBtn').addEventListener('click',()=>{ S.stand=!S.stand; save(); render() });
  if(S.paste){ const ta=$('#taskIn');
    ta.addEventListener('input',()=>{ S.text=ta.value; save() });
    $('#sampleBtn').addEventListener('click',()=>{ ta.value=SAMPLE; S.text=SAMPLE; save() });
    $('#parseBtn').addEventListener('click',()=>{ const v=ta.value.trim(); if(!v){ toast('Сначала вставьте текст'); ta.focus(); return }
      const p=parseTask(v); C=withM23(p.c); REP=p.rep; S.mod=1; S.paste=false; save(); history.replaceState(null,'','#m1'); render();
      const w=REP.miss.filter(k=>!FREE.has(k)).length; toast(REP.src==='code'?'Подставлен вариант '+REP.code:w?'Проверьте '+w+' параметр(а), которых не было в тексте':'Все параметры найдены') });
  }
}

// ---------- page ----------
function recompute(){ R=compute(C); A=R.ok?addrs(C,R):null; G=R.ok?gen(C,ST,R):null }
function render(){ wRoute(); recompute(); renderToolbar(); renderMain() }
C = S.c ? withM23(S.c) : withM23(Object.assign({},DEF));
onSaveReady(()=>{ if(DL) renderSol() });
wInit();
render();
