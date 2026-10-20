// ===== shared: used by the teacher page and the student page =====
const $ = s => document.querySelector(s);
const framed = (function(){ try { return window.self !== window.top } catch(e){ return true } })();
const store={ get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v) }catch(e){ return d } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} } };
function esc(s){ return String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])) }
let tt; function toast(t){ const e=$('#toast'); if(!e) return; e.textContent=t; e.classList.add('on'); clearTimeout(tt); tt=setTimeout(()=>e.classList.remove('on'),2200) }

// ---------- IP math ----------
function ip2n(s){ const p=String(s).trim().split('.'); if(p.length!==4) return null; let n=0;
  for(const x of p){ if(!/^\d{1,3}$/.test(x)||+x>255) return null; n=n*256+(+x) } return n }
function n2ip(n){ return [n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join('.') }
function maskN(p){ return p===0?0:((0xFFFFFFFF<<(32-p))>>>0) }
function mkNet(ipn,p){ const m=maskN(p); const net=(ipn&m)>>>0; const size=Math.pow(2,32-p);
  return {net, p, size, bc:net+size-1, mask:n2ip(m), aligned:net===ipn, h:i=>n2ip(net+i), cidr:n2ip(net)+'/'+p} }
function parseCidr(s){ const [a,b]=String(s||'').split('/'); const n=ip2n(a||''); const p=+b;
  if(n===null||!Number.isInteger(p)||p<8||p>30) return null; return mkNet(n,p) }
function prefixFor(n,rule){ n=+n; if(!(n>=4)) return null;
  let k = rule==='le' ? Math.floor(Math.log2(n)) : Math.ceil(Math.log2(n)); if(k<2) k=2; if(k>24) return null; return 32-k }
function isPrivate(n){ return (n>>>24)===10 || ((n>>>24)===172 && ((n>>>16)&255)>=16 && ((n>>>16)&255)<=31) || ((n>>>24)===192 && ((n>>>16)&255)===168) }

// ---------- reference data ----------
const LEVELS={
  E:{name:'Лёгкий',desc:'Как в демоверсии: ровные маски, стандартные логины и порты'},
  X:{name:'Экзамен',desc:'Случайные адреса, VLAN, порты, пароли и часовой пояс'},
  H:{name:'С подвохами',desc:'Подвохи на выбор: VLSM, «неровные» числа, IP-in-IP и другие'}
};
const TRAPS=[['vlsm','VLSM из общего блока'],['odd','«Неровные» числа адресов'],['ipip','Туннель IP-in-IP'],['m29','Маски /29 у провайдера и туннеля'],
  ['off','Сети провайдера и туннеля не с нуля'],['login','Свои логины'],['dom','Свой домен'],['docker','docker на стороне BR'],['ssh','Необычный порт и попытки SSH']];
const ALLTRAPS=(1<<TRAPS.length)-1;
const LANS=[['srv','HQ-SRV'],['cli','HQ-CLI'],['mgmt','сеть управления'],['br','BR-SRV']];
const TZ={'Europe/Kaliningrad':'калининградское время (UTC+2)','Europe/Moscow':'московское время (UTC+3)','Europe/Samara':'самарское время (UTC+4)',
  'Asia/Yekaterinburg':'екатеринбургское время (UTC+5)','Asia/Omsk':'омское время (UTC+6)','Asia/Novosibirsk':'новосибирское время (UTC+7)',
  'Asia/Krasnoyarsk':'красноярское время (UTC+7)','Asia/Irkutsk':'иркутское время (UTC+8)','Asia/Yakutsk':'якутское время (UTC+9)',
  'Asia/Vladivostok':'владивостокское время (UTC+10)','Asia/Magadan':'магаданское время (UTC+11)','Asia/Kamchatka':'камчатское время (UTC+12)'};
const DNSP=[['77.88.8.8','77.88.8.1'],['77.88.8.88','77.88.8.2'],['77.88.8.7','77.88.8.3'],['77.88.8.8','77.88.8.3']];
const BANNERS=['Authorized access only','Restricted area','Unauthorized access is prohibited','Authorized personnel only','Access is monitored'];
const PASS=['P@ssw0rd','P@$$word','Pa$$w0rd','Adm1n@2026','N3t@dm1n','S3cur3$Pass','Qwerty@123'];
const OSPFP=['P@ssw0rd','0spfKey26','Rout3Key','Ospf@Pass','Area0Key'];
const ADM=['rtr_admin','netadmin','net_adm','router_adm'];
const SU=['srv_user','remote_user','sshadmin','srv_admin'];
const DOMS=['it-lab.irpo','net-team.irpo','demo-exam.irpo','corp-net.irpo'];
const OSNAME={astra:'Astra Linux CE',alt:'Альт Сервер'};

// ---------- variant codes ----------
function parseCode(s){ const m=/^([EXH])-(\d{1,4})(?:\.(\d{1,3}))?$/.exec(String(s||'').trim().toUpperCase().replace(/^#/,''));
  if(!m) return null; const mask = m[1]==='H' ? (m[3]!=null ? Math.min(ALLTRAPS,+m[3]) : ALLTRAPS) : ALLTRAPS;
  return {lv:m[1],num:Math.max(1,+m[2]),mask} }
const codeOf = c => c.lv+'-'+c.num+(c.lv==='H'&&c.mask!=null&&c.mask!==ALLTRAPS?'.'+c.mask:'');

// ---------- seeded variants ----------
function rngFor(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0 }
  let a=h; return function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296 } }
function build(lv,num,att,mask){
  if(mask==null) mask=ALLTRAPS;
  const rnd=rngFor(lv+'-'+num+(att?'/'+att:''));
  const int=(a,b)=>a+Math.floor(rnd()*(b-a+1)), pick=a=>a[Math.floor(rnd()*a.length)];
  const distinct=(n,f)=>{ const s=new Set(); let g=0; while(s.size<n&&g++<500) s.add(f()); return [...s] };
  const T = key => lv==='H' && !!(mask & (1<<TRAPS.findIndex(t=>t[0]===key)));
  const c={lv,num:+num,mask:lv==='H'?mask:ALLTRAPS,addrMode:'given',block:''};
  const K = lv==='E'?{srv:pick([5,6]),cli:pick([4,5]),mgmt:3,br:pick([4,5])}
    : lv==='X'?{srv:pick([5,6,7]),cli:pick([4,5,6]),mgmt:pick([3,4]),br:pick([4,5,6])}
    : {srv:pick([5,6]),cli:pick([4,5,6]),mgmt:pick([3,4]),br:pick([4,5,6])};
  const ER={srv:'le',cli:'ge',mgmt:'le',br:'le'};
  for(const k in K){ const e=K[k], rule = lv==='E'?ER[k]:pick(['le','ge']); c[k+'Rule']=rule;
    c[k+'N']=String(T('odd') ? (rule==='le' ? 2**e+int(1,2**e-1) : int(2**(e-1)+1,2**e-1)) : 2**e) }
  let v; if(lv==='E'){ const a=int(1,4); v=[a*100,a*100+100,999] } else if(lv==='X') v=distinct(3,()=>int(100,899)); else v=distinct(3,()=>int(2,4094));
  [c.srvVid,c.cliVid,c.mgmtVid]=v.map(String);
  if(T('vlsm')){ c.addrMode='vlsm'; const f=pick([0,1,2]);
    c.block = f===0 ? '10.'+int(1,254)+'.'+int(0,255)+'.0/24' : f===1 ? '172.'+int(17,31)+'.'+int(0,255)+'.0/24' : '192.168.'+int(1,254)+'.0/24' }
  else { const fam = lv!=='E'&&rnd()<.3 ? '10.'+int(1,254)+'.' : '192.168.';
    const th = lv==='E' ? distinct(4,()=>int(1,25)*10) : distinct(4,()=>int(1,254));
    ['srv','cli','mgmt','br'].forEach((k,i)=>c[k+'Base']=fam+th[i]+'.0') }
  if(lv==='E'){ const x=int(1,8); c.netIspHq='172.16.'+x+'.0/28'; c.netIspBr='172.16.'+(x+1)+'.0/28' }
  else { const p=T('m29')?29:28, sz=2**(32-p), off=()=>T('off')?int(1,256/sz-1)*sz:0; const [a,b]=distinct(2,()=>int(1,250));
    c.netIspHq='172.16.'+a+'.'+off()+'/'+p; c.netIspBr='172.16.'+b+'.'+off()+'/'+p }
  if(lv==='E'){ c.netTun=pick(['10.10.10.0/30','10.5.5.0/30','10.0.0.0/30']); c.tun='gre' }
  else { const p=T('m29')?29:30, sz=2**(32-p); const pre=rnd()<.6?'10.'+int(0,255)+'.'+int(0,255):'192.168.255';
    c.netTun=pre+'.'+(T('off')?int(1,256/sz-1)*sz:0)+'/'+p;
    c.tun = lv==='X' ? pick(['gre','gre','ipip']) : (T('ipip')?'ipip':'gre') }
  const tzs=Object.keys(TZ);
  if(lv==='E') Object.assign(c,{adm:'net_admin',admPass:'P@$$word',su:'sshuser',suPass:'P@ssw0rd',uid:'1010',sshPort:'2024',maxTries:'2',
    banner:'Authorized access only',ospfPass:'P@ssw0rd',dom:'au-team.irpo',tz:'Europe/Moscow',fwd1:'77.88.8.8',fwd2:'77.88.8.1',dockerTo:'hq'});
  else { const d=pick(DNSP);
    Object.assign(c,{adm:T('login')?pick(ADM):'net_admin',admPass:pick(PASS),su:T('login')?pick(SU):'sshuser',suPass:pick(PASS),
      uid:String(lv==='H'?int(1100,4999):int(1010,2099)),
      sshPort:String(T('ssh')?pick([int(2200,2999),int(4000,4999),int(6100,6999)]):int(2020,2099)),
      maxTries:String(T('ssh')?int(3,5):pick([2,3])),banner:pick(BANNERS),ospfPass:pick(OSPFP),
      dom:T('dom')?pick(DOMS):'au-team.irpo',tz:pick(tzs),fwd1:d[0],fwd2:d[1],
      dockerTo: lv==='X' ? pick(['hq','br']) : (T('docker')?'br':'hq')}) }
  return c;
}
function fillBases(c,r){ LANS.forEach(([k])=>{ if(r.lans[k]) c[k+'Base']=n2ip(r.lans[k].net) }) }
function makeVariant(lv,num,mask){
  for(let a=0;a<40;a++){ const c=build(lv,num,a,mask), r=compute(c); if(r.ok){ if(c.addrMode==='vlsm') fillBases(c,r); return c } }
  return build('E',1,0);
}
const variantFromCode = code => { const p=parseCode(code); return p ? makeVariant(p.lv,p.num,p.mask) : null };

// ---------- compute ----------
function compute(c){
  const W=[], E=[];
  const ispHq=parseCidr(c.netIspHq), ispBr=parseCidr(c.netIspBr), tun=parseCidr(c.netTun);
  if(!ispHq) E.push('Сеть ISP — HQ-RTR задана неверно. Формат: 172.16.4.0/28');
  if(!ispBr) E.push('Сеть ISP — BR-RTR задана неверно. Формат: 172.16.5.0/28');
  if(!tun) E.push('Сеть туннеля задана неверно. Формат: 10.10.10.0/30');
  [['ISP — HQ-RTR',ispHq],['ISP — BR-RTR',ispBr],['туннеля',tun]].forEach(([n,x])=>{ if(x&&!x.aligned) W.push('Адрес сети '+n+' не на границе /'+x.p+', используется '+x.cidr) });
  const lans={}, pre={};
  LANS.forEach(([k,name])=>{ const p=prefixFor(c[k+'N'],c[k+'Rule']); if(p===null) E.push(name+': число адресов должно быть от 4'); else pre[k]=p });
  let block=null;
  if(c.addrMode==='vlsm'){
    block=parseCidr(c.block);
    if(!block) E.push('Общий блок задан неверно. Формат: 10.20.30.0/24');
    else if(Object.keys(pre).length===4){
      if(!block.aligned) W.push('Блок выровнен до '+block.cidr);
      const order=LANS.map(([k],i)=>({k,i,p:pre[k]})).sort((a,b)=>a.p-b.p||a.i-b.i);
      let cur=block.net;
      order.forEach(o=>{ const size=2**(32-o.p); cur=Math.ceil(cur/size)*size; lans[o.k]=mkNet(cur,o.p); cur+=size });
      if(cur-1>block.bc) E.push('Сети не помещаются в блок '+block.cidr+': нужно '+(cur-block.net)+' адресов из '+block.size);
    }
  } else {
    LANS.forEach(([k,name])=>{ if(pre[k]==null) return; const base=ip2n(c[k+'Base']);
      if(base===null){ E.push(name+': адрес сети задан неверно'); return }
      const net=mkNet(base,pre[k]); lans[k]=net; if(!net.aligned) W.push(name+': адрес не на границе /'+net.p+', используется '+net.cidr) });
  }
  LANS.forEach(([k,name])=>{ const n=lans[k]; if(n&&!isPrivate(n.net)) W.push(name+': сеть '+n.cidr+' не из частного диапазона RFC 1918') });
  if(lans.cli && lans.cli.size<8) E.push('HQ-CLI: в сети меньше 8 адресов, диапазону DHCP не хватит места');
  const all=[['ISP — HQ-RTR',ispHq],['ISP — BR-RTR',ispBr],['туннель',tun],['HQ-SRV',lans.srv],['HQ-CLI',lans.cli],['управление',lans.mgmt],['BR-SRV',lans.br]].filter(x=>x[1]);
  for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){ const a=all[i][1],b=all[j][1];
    if(a.net<=b.bc && b.net<=a.bc) E.push('Сети «'+all[i][0]+'» и «'+all[j][0]+'» пересекаются') }
  const vids=[c.srvVid,c.cliVid,c.mgmtVid];
  vids.forEach(v=>{ if(!(/^\d+$/.test(v)&&+v>=1&&+v<=4094)) E.push('VLAN '+v+': номер должен быть от 1 до 4094') });
  if(new Set(vids).size<3) E.push('Номера VLAN должны различаться');
  [['adm','Логин на роутерах'],['su','Логин на серверах'],['admPass','Пароль на роутерах'],['suPass','Пароль на серверах'],['ospfPass','Пароль OSPF'],['dom','Домен'],['banner','Баннер']]
    .forEach(([k,n])=>{ if(!String(c[k]||'').trim()) E.push(n+': поле пустое') });
  if(/['"`\\]/.test(c.admPass+c.suPass+c.ospfPass)) E.push('Пароли не должны содержать кавычки и обратную косую черту');
  if(/['"`\\$]/.test(c.banner)) E.push('Баннер не должен содержать кавычки, $ и обратную косую черту');
  if(String(c.ospfPass).length>16) E.push('Пароль OSPF (MD5) не длиннее 16 символов');
  if(!/^[a-z_][a-z0-9_-]*$/.test(c.adm)||!/^[a-z_][a-z0-9_-]*$/.test(c.su)) E.push('Логины: только маленькие латинские буквы, цифры, _ и -');
  if(!(+c.sshPort>=1&&+c.sshPort<=65535)) E.push('Порт SSH должен быть от 1 до 65535');
  if(!(/^\d+$/.test(c.uid)&&+c.uid>=1000&&+c.uid<=60000)) E.push('UID должен быть числом от 1000 до 60000');
  if(!(+c.maxTries>=1&&+c.maxTries<=10)) E.push('Число попыток входа: от 1 до 10');
  if(/[^\x00-\x7F]/.test([c.adm,c.su,c.admPass,c.suPass,c.ospfPass,c.banner,c.dom].join(''))) W.push('В логинах, паролях, баннере или домене есть русские буквы. VirtualBox печатает только латиницу.');
  const ok=!!(ispHq&&ispBr&&tun&&lans.srv&&lans.cli&&lans.mgmt&&lans.br)&&E.length===0;
  return {W,E,ok,ispHq,ispBr,tun,lans,pre,block};
}
function addrs(c,r){
  const {ispHq,ispBr,tun,lans}=r; const s=lans.srv, cl=lans.cli, m=lans.mgmt, b=lans.br;
  const A={ ispHq:ispHq.h(1), hqWan:ispHq.h(2), ispBr:ispBr.h(1), brWan:ispBr.h(2), tHq:tun.h(1), tBr:tun.h(2),
    hqSrvGw:s.h(1), hqSrv:s.h(2), hqCliGw:cl.h(1), hqCli:cl.h(2), hqMg:m.h(1), brGw:b.h(1), brSrv:b.h(2),
    dhcpFrom:cl.h(3), dhcpTo:n2ip(cl.bc-1) };
  A.docker = c.dockerTo==='br'?A.ispBr:A.ispHq; A.web = c.dockerTo==='br'?A.ispHq:A.ispBr;
  return A;
}

// ---------- task sheet (one model → HTML and DOCX) ----------
// Text markup inside the model: **bold** and {{value}} (monospace value)
const ruleTxt = r => r==='le'?'не более':'не менее';
const V = t => '{{'+t+'}}';
function topoSvg(c,r,forExport){
  const tl=c.tun==='gre'?'GRE':'IP-in-IP', ros=c._os==='alt'?'Альт':'Astra';
  const box=(x,y,w,cls,name,sub)=>`<rect class="nd ${cls}" x="${x-w/2}" y="${y-19}" width="${w}" height="38" rx="9"/><text class="nm" x="${x}" y="${y+(sub?-1:5)}" text-anchor="middle">${name}</text>`+(sub?`<text class="lb" x="${x}" y="${y+13}" text-anchor="middle">${sub}</text>`:'');
  const st = forExport ? `<style>.ln{stroke:#56686e;stroke-width:1.6;fill:none}.tn{stroke:#0a7a70;stroke-width:2;stroke-dasharray:7 5;fill:none}.nd{fill:#ffffff;stroke-width:1.6}.r{stroke:#0a7a70}.s{stroke:#b0640f}.c{stroke:#6d4fc9}.w{stroke:#56686e}text{font-family:Arial,Helvetica,sans-serif;fill:#1b1d1f}.nm{font-size:14px;font-weight:700}.lb{font-size:11.5px;fill:#56686e;font-family:Consolas,monospace}.tl{font-size:12px;fill:#0a7a70;font-weight:700}.cloud{fill:#f4f7f7;stroke:#d9e1e3;stroke-width:1.4}</style><rect width="760" height="410" fill="#ffffff"/>` : '';
  return `<svg class="topo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 410" width="760" height="410" role="img" aria-label="Топология сети: ISP соединяет офисы HQ и BR, между HQ-RTR и BR-RTR туннель">${st}
  <path class="ln" d="M380 52 V 96"/><path class="ln" d="M380 115 L 170 196"/><path class="ln" d="M380 115 L 590 196"/>
  <path class="ln" d="M170 215 V 276"/><path class="ln" d="M170 295 L 85 356"/><path class="ln" d="M170 295 L 255 356"/><path class="ln" d="M590 215 V 336"/>
  <path class="tn" d="M222 214 Q 380 290 538 214"/>
  <ellipse class="cloud" cx="380" cy="34" rx="78" ry="20"/><text class="nm" x="380" y="39" text-anchor="middle">Интернет</text>
  ${box(380,115,120,'r','ISP',ros)}
  ${box(170,215,130,'r','HQ-RTR',ros)}${box(590,215,130,'r','BR-RTR',ros)}
  ${box(170,295,110,'w','HQ-SW','')}
  ${box(85,375,120,'s','HQ-SRV','Альт Сервер')}${box(255,375,120,'c','HQ-CLI','Альт РС')}${box(590,355,120,'s','BR-SRV','Альт Сервер')}
  <text class="lb" x="262" y="146" text-anchor="end">${esc(r.ispHq?r.ispHq.cidr:c.netIspHq)}</text>
  <text class="lb" x="498" y="146">${esc(r.ispBr?r.ispBr.cidr:c.netIspBr)}</text>
  <text class="tl" x="380" y="262" text-anchor="middle">туннель ${tl}</text>
  <text class="lb" x="380" y="279" text-anchor="middle">${esc(r.tun?r.tun.cidr:c.netTun)}</text>
  <text class="lb" x="112" y="330" text-anchor="end">VLAN ${esc(c.srvVid)}</text>
  <text class="lb" x="228" y="330">VLAN ${esc(c.cliVid)}</text>
  <text class="lb" x="232" y="300">упр. VLAN ${esc(c.mgmtVid)}</text>
</svg>`;
}
function taskModel(c,r,os){
  const D=c.dom, tl=c.tun==='gre'?'GRE':'IP-in-IP', ro=OSNAME[os]||OSNAME.astra;
  const cc=Object.assign({},c,{_os:os});
  const lanDesc={srv:['HQ-SRV',c.srvVid],cli:['HQ-CLI',c.cliVid],mgmt:['сети управления',c.mgmtVid],br:['BR-SRV',null]};
  const lan = k => { const [nm,vid]=lanDesc[k];
    const head = k==='mgmt' ? 'Сеть управления (VLAN '+V(vid)+')' : 'Локальная сеть в сторону '+nm+(vid?' (VLAN '+V(vid)+')':'');
    return head+' должна вмещать '+ruleTxt(c[k+'Rule'])+' '+V(c[k+'N'])+' адресов*'+(c.addrMode==='given'?'; адрес сети '+V(c[k+'Base']):'')+'.' };
  const dockerSide = c.dockerTo==='br' ? 'BR-RTR' : 'HQ-RTR', webSide = c.dockerTo==='br' ? 'HQ-RTR' : 'BR-RTR';
  const s1=['Настройте имена устройств согласно топологии. Используйте полное доменное имя, например '+V('hq-rtr.'+D)+'.',
    'На всех устройствах сконфигурируйте IPv4. Адреса локальных сетей выберите из частных диапазонов RFC 1918.'];
  if(c.addrMode==='vlsm') s1.push('Все четыре локальные сети нарежьте из блока '+V(c.block)+' методом VLSM: по убыванию размера, при равном размере — в порядке HQ-SRV, HQ-CLI, сеть управления, BR-SRV. Каждая следующая сеть начинается сразу за предыдущей.');
  s1.push(lan('srv'),lan('cli'),lan('mgmt'),lan('br'),'Маршрутизатору назначьте первый адрес подсети, серверу и рабочему месту — второй.',
    'Сведения об адресах занесите в отчёт по образцу таблицы 2: устройство, интерфейс, IP-адрес, шлюз по умолчанию.');
  return [
    {t:'meta',l:'Тренировочный вариант · ДЭ 09.02.06 · Модуль 1',r:'Вариант **'+codeOf(c)+'** · '+LEVELS[c.lv].name},
    {t:'h1',x:'Модуль 1. Настройка сетевой инфраструктуры'},
    {t:'p',x:'Топология сети показана на рисунке 1, операционные системы устройств перечислены в таблице 1. Все устройства входят в домен '+V(D)+'.'},
    {t:'img',svg:topoSvg(cc,r,false),svgx:topoSvg(cc,r,true)},
    {t:'cap',x:'Рисунок 1. Топология сети'},
    {t:'cap',x:'Таблица 1. Устройства'},
    {t:'table',head:['Устройство','Операционная система','Назначение'],rows:[['ISP',ro,'Маршрутизатор провайдера'],['HQ-RTR',ro,'Маршрутизатор офиса HQ'],['BR-RTR',ro,'Маршрутизатор офиса BR'],
      ['HQ-SRV','Альт Сервер','Сервер офиса HQ'],['BR-SRV','Альт Сервер','Сервер офиса BR'],['HQ-CLI','Альт Рабочая станция','Рабочее место офиса HQ']]},
    {t:'h2',x:'Задания'},
    {t:'ol',items:[
      {x:'**Произведите базовую настройку устройств.**',sub:s1},
      {x:'**Настройте ISP.**',sub:['Интерфейс, подключённый к магистральному провайдеру, получает адрес и маршрут по умолчанию по DHCP.',
        'Интерфейс в сторону HQ-RTR подключён к сети '+V(c.netIspHq)+', в сторону BR-RTR — к сети '+V(c.netIspBr)+'. ISP получает первый адрес сети, маршрутизатор офиса — второй.',
        'Настройте динамическую сетевую трансляцию в сторону HQ-RTR и BR-RTR для доступа к сети Интернет.']},
      {x:'**Создайте локальные учётные записи.**',sub:['На серверах HQ-SRV и BR-SRV: пользователь '+V(c.su)+' с паролем '+V(c.suPass)+' и идентификатором '+V(c.uid)+'. Пользователь запускает sudo без дополнительной аутентификации.',
        'На маршрутизаторах HQ-RTR и BR-RTR: пользователь '+V(c.adm)+' с паролем '+V(c.admPass)+' и правами sudo без пароля.']},
      {x:'**Настройте коммутацию в офисе HQ.** На интерфейсе HQ-RTR в сторону офиса создайте подынтерфейсы 802.1Q: HQ-SRV в VLAN '+V(c.srvVid)+', HQ-CLI в VLAN '+V(c.cliVid)+', сеть управления в VLAN '+V(c.mgmtVid)+'. Трафик HQ-SRV и HQ-CLI должен быть тегирован. Опишите схему коммутации в отчёте.'},
      {x:'**Настройте безопасный удалённый доступ на HQ-SRV и BR-SRV.**',sub:['SSH принимает подключения на порту '+V(c.sshPort)+'.','Входить разрешено только пользователю '+V(c.su)+'.',
        'Количество попыток входа ограничьте до '+V(c.maxTries)+'.','При подключении выводится баннер '+V(c.banner)+'.']},
      {x:'**Между HQ-RTR и BR-RTR настройте туннель '+tl+'.** Сеть туннеля '+V(c.netTun)+': HQ-RTR получает первый адрес, BR-RTR — второй. Сведения о туннеле занесите в отчёт.'},
      {x:'**Обеспечьте динамическую маршрутизацию.** Используйте протокол link-state (OSPF). Соседство устанавливается только через туннель, все локальные сети офисов доступны друг другу. Защитите протокол паролем '+V(c.ospfPass)+'. Опишите настройку в отчёте.'},
      {x:'**Настройте динамическую трансляцию адресов на HQ-RTR и BR-RTR,** чтобы все устройства офисов имели доступ в Интернет.'},
      {x:'**Настройте DHCP на HQ-RTR для HQ-CLI.**',sub:['Адрес маршрутизатора исключите из выдачи, HQ-CLI всегда получает второй адрес своей сети.','Шлюз по умолчанию — HQ-RTR, DNS-сервер — HQ-SRV, DNS-суффикс — '+V(D)+'.']},
      {x:'**Настройте DNS-сервер на HQ-SRV.** Создайте записи по таблице 3. Внешние запросы пересылайте на '+V(c.fwd1)+' и '+V(c.fwd2)+'.'},
      {x:'**На всех устройствах установите часовой пояс:** '+(TZ[c.tz]||c.tz)+'.'}
    ]},
    {t:'cap',x:'Таблица 3. Записи DNS'},
    {t:'table',head:['Имя','Тип записи','На что указывает'],rows:[['hq-rtr.'+D,'A, PTR','HQ-RTR, адрес в сети HQ-SRV'],['br-rtr.'+D,'A','BR-RTR, адрес в сети BR-SRV'],
      ['hq-srv.'+D,'A, PTR','HQ-SRV'],['hq-cli.'+D,'A, PTR','HQ-CLI'],['br-srv.'+D,'A','BR-SRV'],['docker.'+D,'A','ISP, адрес в сторону '+dockerSide],['web.'+D,'A','ISP, адрес в сторону '+webSide]]},
    {t:'note',x:'* Адресами считается полный размер подсети вместе с адресом сети и широковещательным адресом.'}
  ];
}
function runsOf(x){ return String(x).split(/(\*\*[^*]+\*\*|\{\{[^}]+\}\})/).filter(Boolean).map(p=>
  p.startsWith('**')?{b:1,t:p.slice(2,-2)}:p.startsWith('{{')?{m:1,t:p.slice(2,-2)}:{t:p}) }
function mdHtml(x){ return runsOf(x).map(r=>r.b?'<b>'+esc(r.t)+'</b>':r.m?'<b class="v">'+esc(r.t)+'</b>':esc(r.t)).join('') }
function modelHtml(M){
  const tbl=b=>'<div class="tblw"><table border="1" cellpadding="4" style="border-collapse:collapse"><thead><tr>'+b.head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+b.rows.map(r=>'<tr>'+r.map(x=>'<td>'+mdHtml(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  return M.map(b=>{
    if(b.t==='meta') return '<div class="dochead"><span>'+mdHtml(b.l)+'</span><span>'+mdHtml(b.r)+'</span></div>';
    if(b.t==='h1') return '<h2>'+mdHtml(b.x)+'</h2>';
    if(b.t==='h2') return '<h3>'+mdHtml(b.x)+'</h3>';
    if(b.t==='p') return '<p>'+mdHtml(b.x)+'</p>';
    if(b.t==='cap') return '<p class="cap">'+mdHtml(b.x)+'</p>';
    if(b.t==='note') return '<p class="note">'+mdHtml(b.x)+'</p>';
    if(b.t==='img') return b.svg;
    if(b.t==='table') return tbl(b);
    if(b.t==='ol') return '<ol class="items">'+b.items.map(i=>'<li>'+mdHtml(i.x)+(i.sub?'<ul>'+i.sub.map(s=>'<li>'+mdHtml(s)+'</li>').join('')+'</ul>':'')+'</li>').join('')+'</ol>';
    return '';
  }).join('\n');
}
function modelText(M){
  const pl=x=>runsOf(x).map(r=>r.t).join('');
  return M.map(b=>{
    if(b.t==='meta') return pl(b.l)+'   '+pl(b.r)+'\n';
    if(b.t==='img') return '[Рисунок: топология сети]';
    if(b.t==='table') return [b.head.join(' | ')].concat(b.rows.map(r=>r.map(pl).join(' | '))).join('\n')+'\n';
    if(b.t==='ol') return b.items.map((i,n)=>(n+1)+'. '+pl(i.x)+(i.sub?'\n'+i.sub.map(s=>'   – '+pl(s)).join('\n'):'')).join('\n')+'\n';
    return pl(b.x)+(b.t==='h1'||b.t==='h2'?'\n':'');
  }).join('\n');
}

// ---------- DOCX writer (Word, LibreOffice, Google Docs) ----------
const xe = s => String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
function svgToPng(svg,w,h){ return new Promise(res=>{ try{ const img=new Image();
  img.onload=()=>{ try{ const cv=document.createElement('canvas'); cv.width=w*2; cv.height=h*2; const x=cv.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,cv.width,cv.height); x.drawImage(img,0,0,cv.width,cv.height); cv.toBlob(b=>res(b),'image/png') }catch(e){ res(null) } };
  img.onerror=()=>res(null); img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg) }catch(e){ res(null) } }) }
function dRun(r,o){ o=o||{}; const sz=o.sz||24, mono=r.m;
  const f = mono ? 'Consolas' : 'Times New Roman';
  return '<w:r><w:rPr><w:rFonts w:ascii="'+f+'" w:hAnsi="'+f+'" w:cs="'+f+'"/>'+((r.b||mono||o.b)?'<w:b/>':'')+(o.i?'<w:i/>':'')+(o.color?'<w:color w:val="'+o.color+'"/>':'')+'<w:sz w:val="'+(mono?sz-2:sz)+'"/></w:rPr><w:t xml:space="preserve">'+xe(r.t)+'</w:t></w:r>' }
function dPara(x,o){ o=o||{};
  const pPr='<w:pPr><w:spacing w:after="'+(o.after??120)+'" w:before="'+(o.before??0)+'"/>'+(o.ind?'<w:ind w:left="'+o.ind+'" w:hanging="'+(o.hang||0)+'"/>':'')+(o.jc?'<w:jc w:val="'+o.jc+'"/>':'')+(o.keep?'<w:keepNext/>':'')+'</w:pPr>';
  return '<w:p>'+pPr+(o.prefix?dRun({t:o.prefix},o):'')+runsOf(x).map(r=>dRun(r,o)).join('')+'</w:p>' }
function dTable(b){
  const n=b.head.length, w=Math.floor(9638/n), bd='w:val="single" w:sz="4" w:space="0" w:color="808080"';
  const cell=(x,h)=>'<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+(h?'<w:shd w:val="clear" w:color="auto" w:fill="EDEFF0"/>':'')+'</w:tcPr>'+dPara(x,{after:0,sz:22,b:h})+'</w:tc>';
  return '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top '+bd+'/><w:left '+bd+'/><w:bottom '+bd+'/><w:right '+bd+'/><w:insideH '+bd+'/><w:insideV '+bd+'/></w:tblBorders><w:tblCellMar><w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>'+
    Array(n).fill('<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+
    '<w:tr>'+b.head.map(h=>cell(h,true)).join('')+'</w:tr>'+b.rows.map(r=>'<w:tr>'+r.map(x=>cell(x,false)).join('')+'</w:tr>').join('')+'</w:tbl>'+dPara('',{after:60});
}
function dImage(id,cx,cy){
  return '<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+id+'" name="Picture '+id+'"/>'+
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">'+
    '<pic:nvPicPr><pic:cNvPr id="'+id+'" name="topo'+id+'.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'+
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>' }
// docs: array of models; plain text pages may be passed as {lines:[...]} for keys
async function buildDocx(docs){
  if(!window.JSZip) throw new Error('Архиватор не загрузился');
  const z=new JSZip(); let body='', rels='', img=0;
  for(let i=0;i<docs.length;i++){
    if(i) body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    const M=docs[i];
    if(M.lines){ M.lines.forEach(l=>body+=dPara(l,{after:0,sz:20})); continue }
    for(const b of M){
      if(b.t==='meta') body+=dPara(b.l+'   ·   '+b.r,{sz:18,color:'56686E',after:240});
      else if(b.t==='h1') body+=dPara('**'+b.x+'**',{sz:32,after:160});
      else if(b.t==='h2') body+=dPara('**'+b.x+'**',{sz:26,before:200,after:120,keep:1});
      else if(b.t==='p') body+=dPara(b.x);
      else if(b.t==='cap') body+=dPara(b.x,{i:1,sz:22,before:120,after:60,keep:1});
      else if(b.t==='note') body+=dPara(b.x,{sz:20,before:200,color:'56686E'});
      else if(b.t==='table') body+=dTable(b);
      else if(b.t==='ol') b.items.forEach((it,n)=>{ body+=dPara(it.x,{ind:360,hang:360,prefix:(n+1)+'. ',after:it.sub?40:140});
        (it.sub||[]).forEach((s,k,arr)=>body+=dPara(s,{ind:720,hang:280,prefix:'– ',after:k===arr.length-1?140:40})) });
      else if(b.t==='img'){ const png=await svgToPng(b.svgx,760,410);
        if(png){ img++; z.file('word/media/topo'+img+'.png',png);
          rels+='<Relationship Id="rImg'+img+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/topo'+img+'.png"/>';
          body+=dImage(img,5760720,Math.round(5760720*410/760)) } }
    }
  }
  z.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  z.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  z.file('word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels+'</Relationships>');
  z.file('word/document.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>'+
    body+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>');
  return z.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

// ---------- files & clipboard ----------
let DL=null, dlReady=false; const dlWaiters=[];
(async()=>{ try{ if(window.claude&&window.claude.use) DL=await window.claude.use('downloads') }catch(e){ DL=null } dlReady=true; dlWaiters.forEach(f=>f()) })();
const canSave = () => !!DL || !framed;
function onSaveReady(f){ dlReady?f():dlWaiters.push(f) }
async function saveFile(name,data){
  if(DL){ try{ await DL.save({filename:name,data}); toast('Файл '+name+' сохранён') }
    catch(e){ if(e&&e.code==='declined') return; toast(e&&e.code==='rate_limited'?'Подождите, предыдущее сохранение ещё не закончено':'Не удалось сохранить файл') } return }
  if(!framed){ const bl=data instanceof Blob?data:new Blob([data],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(bl); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); return }
  toast('Сохранение файлов здесь недоступно');
}
function selectEl(el){ if(!el) return; const sel=window.getSelection(), rg=document.createRange(); rg.selectNodeContents(el); sel.removeAllRanges(); sel.addRange(rg) }
function copyText(text,el){
  const fb=()=>{ if(el){ selectEl(el); toast('Текст выделен, нажмите Ctrl+C') } else toast('Браузер не дал скопировать') };
  try{ navigator.clipboard.writeText(text).then(()=>toast('Скопировано'),fb) }catch(e){ fb() }
}
function copyRich(html,text,el){
  const doc='<div style="font-family:\'Times New Roman\',serif;font-size:12pt">'+html+'</div>';
  const plain=()=>copyText(text,el);
  try{
    if(window.ClipboardItem&&navigator.clipboard&&navigator.clipboard.write){
      navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([doc],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})])
        .then(()=>toast('Скопировано с оформлением, вставьте в Word'),plain); return }
  }catch(e){}
  plain();
}
function printSheets(parts){ const p=$('#printArea'); if(!p) return; p.innerHTML=parts.map(x=>'<article class="sheet">'+x+'</article>').join(''); window.print() }
// ---------- theme & icons ----------
const ICON={
  sun:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  moon:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 10.2A5.6 5.6 0 0 1 5.8 2.8a5.6 5.6 0 1 0 7.4 7.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  auto:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 2.2a5.8 5.8 0 0 1 0 11.6z" fill="currentColor"/></svg>',
  gear:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h6.5M12.5 4H14M2 8h1.5M7.5 8H14M2 12h8.5M14 12h0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><circle cx="10.5" cy="4" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.5" cy="8" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12.5" cy="12" r="1.8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  dice:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.5" cy="5.5" r="1.1" fill="currentColor"/><circle cx="10.5" cy="10.5" r="1.1" fill="currentColor"/><circle cx="8" cy="8" r="1.1" fill="currentColor"/></svg>',
  chev:'<svg class="i chev" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 3.2V3a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 2 3v6A1.5 1.5 0 0 0 3.5 10.5h.3" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  down:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8.5M4.5 7.2 8 10.7l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  print:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V2h7v4M4.5 11.5h-2V6h11v5.5h-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><rect x="4.5" y="9.5" width="7" height="4.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  edit:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.7l2.5 2.5L6 12.5l-3.2.7.7-3.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  back:'<svg class="i" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  router:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  server:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="10" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="9" width="10" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.5" cy="4.5" r=".9" fill="currentColor"/><circle cx="5.5" cy="11.5" r=".9" fill="currentColor"/></svg>',
  client:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 14h6M8 11v3" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>'
};
const HOST_THEME=document.documentElement.getAttribute('data-theme');
let THEME=store.get('degen.theme','auto');
function applyTheme(){ const r=document.documentElement;
  if(THEME==='light'||THEME==='dark') r.setAttribute('data-theme',THEME); else if(HOST_THEME) r.setAttribute('data-theme',HOST_THEME); else r.removeAttribute('data-theme') }
applyTheme();
function mountTheme(el){
  const draw=()=>{ el.innerHTML=[['light','sun','Светлая тема'],['dark','moon','Тёмная тема'],['auto','auto','Как в системе']].map(([k,ic,t])=>'<button type="button" data-th="'+k+'" aria-pressed="'+(THEME===k)+'" aria-label="'+t+'" title="'+t+'">'+ICON[ic]+'</button>').join('');
    el.querySelectorAll('[data-th]').forEach(b=>b.addEventListener('click',()=>{ THEME=b.dataset.th; store.set('degen.theme',THEME); applyTheme(); draw() })) };
  draw();
}
// popover helper: one open dropdown at a time, closes on outside click and Escape
let ddOpen=false;
document.addEventListener('click',e=>{ if(ddOpen&&!e.target.closest('.dd')){ ddOpen=false; const p=document.querySelector('.ddp'); if(p) p.hidden=true; const b=document.querySelector('.dd>button'); if(b) b.setAttribute('aria-expanded','false') } });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&ddOpen){ ddOpen=false; const p=document.querySelector('.ddp'); if(p) p.hidden=true; const b=document.querySelector('.dd>button'); if(b){ b.setAttribute('aria-expanded','false'); b.focus() } } });
function trapsDD(mask,onChange){
  const n=TRAPS.filter((t,i)=>mask&(1<<i)).length;
  const html='<div class="dd"><button type="button" class="btn" id="ddBtn" aria-expanded="'+ddOpen+'" aria-controls="ddPanel">Подвохи: '+n+' из '+TRAPS.length+ICON.chev+'</button>'+
    '<div class="ddp" id="ddPanel" role="group" aria-label="Какие подвохи включить"'+(ddOpen?'':' hidden')+'>'+TRAPS.map((t,i)=>'<label class="ddi"><input type="checkbox" data-b="'+i+'"'+(mask&(1<<i)?' checked':'')+'>'+t[1]+'</label>').join('')+
    '<div class="ddf"><button type="button" class="lnk" data-all="1">Включить все</button><button type="button" class="lnk" data-all="0">Выключить все</button></div></div></div>';
  const wire=root=>{ const b=root.querySelector('#ddBtn'); if(!b) return;
    b.addEventListener('click',()=>{ ddOpen=!ddOpen; root.querySelector('#ddPanel').hidden=!ddOpen; b.setAttribute('aria-expanded',ddOpen) });
    root.querySelectorAll('#ddPanel [data-b]').forEach(x=>x.addEventListener('change',()=>onChange(mask^(1<<+x.dataset.b))));
    root.querySelectorAll('#ddPanel [data-all]').forEach(x=>x.addEventListener('click',()=>onChange(x.dataset.all==='1'?ALLTRAPS:0))) };
  return {html,wire};
}
// ===== end shared =====
