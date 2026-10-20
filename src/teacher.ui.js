// ---------- state ----------
const STAND_DEF={ifIspWan:'eth0',ifIspHq:'eth1',ifIspBr:'eth2',ifHqWan:'eth0',ifHqLan:'eth1',ifBrWan:'eth0',ifBrLan:'eth1',ifSrv:'enp0s3',ifCli:'enp0s3',
  vmIsp:'ISP',vmHqRtr:'HQ-RTR',vmBrRtr:'BR-RTR',vmHqSrv:'HQ-SRV',vmBrSrv:'BR-SRV',vmHqCli:'HQ-CLI',autoReboot:'no',rtrOs:'astra',weights:WEIGHTS_DEF.slice()};
const VIEWS=['variant','solve','group','settings'];
let S = Object.assign({lv:'X',num:1,mask:ALLTRAPS,custom:null,view:'variant',sub:'task',editing:false,sel:'isp',step:0,mode:'auto',group:'students',student:null,prevView:'variant'}, store.get(KEY,{}));
if(!VIEWS.includes(S.view)) S.view='variant';
let ST = Object.assign({},STAND_DEF,store.get(KEY+'.stand',{}));
if(!Array.isArray(ST.weights)||ST.weights.length!==11) ST.weights=WEIGHTS_DEF.slice();
const hc=parseCode(location.hash);
if(hc){ S.lv=hc.lv; S.num=hc.num; S.mask=hc.mask; S.custom=null; S.student=null }
S.customOn=!!S.custom;
let C = S.custom || makeVariant(S.lv,S.num,S.mask), R=null, G=null, A=null, CK=null;
function save(){ S.custom = S.customOn ? C : null; store.set(KEY,S) }
const totalW = () => ST.weights.reduce((a,b)=>a+(+b||0),0);
const fmt = x => (Math.round(x*100)/100).toString().replace('.',',');
const fname = s => 'module1_'+codeOf(C).replace('.','_')+s;
const B_=(id,icon,label,cls,title)=>'<button type="button" class="btn'+(cls?' '+cls:'')+'" id="'+id+'"'+(title?' title="'+title+'"':'')+'>'+(icon?ICON[icon]:'')+'<span class="lbl">'+label+'</span></button>';

// ---------- toolbar ----------
function renderToolbar(){
  const t=$('#toolbar'), dd = C.lv==='H' && !S.customOn ? trapsDD(S.mask,m=>load('H',S.num,m)) : null;
  t.innerHTML='<div class="codef lv-'+C.lv+'"><button type="button" id="prevBtn" aria-label="Предыдущий вариант">‹</button>'+
    '<input id="codeIn" value="'+esc(codeOf(C))+'" spellcheck="false" autocomplete="off" aria-label="Код варианта" title="Впишите код и нажмите Enter"><button type="button" id="nextBtn" aria-label="Следующий вариант">›</button></div>'+
    '<div class="seg lvseg" role="group" aria-label="Сложность">'+Object.entries(LEVELS).map(([k,v])=>'<button type="button" class="lv-'+k+'" data-lv="'+k+'" aria-pressed="'+(C.lv===k)+'" title="'+esc(v.desc)+'"><span class="dot"></span>'+v.name+'</button>').join('')+'</div>'+
    (dd?dd.html:'')+'<span class="grow"></span>'+
    (S.customOn?'<button type="button" class="pill warn" id="unedit" title="Вернуть параметры, которые даёт код">Изменён вручную · вернуть</button>':'')+
    B_('rndBtn','dice','Случайный','','Случайный номер той же сложности');
  if(dd) dd.wire(t);
  t.querySelectorAll('[data-lv]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.lv,S.num,S.mask)));
  $('#prevBtn').addEventListener('click',()=>load(C.lv,S.num-1,S.mask));
  $('#nextBtn').addEventListener('click',()=>load(C.lv,S.num+1,S.mask));
  const ci=$('#codeIn'); const apply=()=>{ const p=parseCode(ci.value); if(!p){ toast('Код выглядит так: X-12, E-3 или H-7'); ci.value=codeOf(C); return } if(p.lv+p.num+p.mask!==C.lv+C.num+C.mask) load(p.lv,p.num,p.mask) };
  ci.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); apply(); ci.blur() } else if(e.key==='Escape'){ ci.value=codeOf(C); ci.blur() } });
  ci.addEventListener('change',apply);
  $('#rndBtn').addEventListener('click',()=>{ let n; do{ n=1+Math.floor(Math.random()*999) }while(n===S.num); load(C.lv,n,S.mask); toast('Вариант '+codeOf(C)) });
  const u=$('#unedit'); if(u) u.addEventListener('click',()=>{ load(S.lv,S.num,S.mask); toast('Вернул параметры варианта '+codeOf(C)) });
}
function load(lv,num,mask){
  num=Math.max(1,Math.min(9999,parseInt(num,10)||1)); S.lv=lv; S.num=num; S.mask=lv==='H'?(mask==null?ALLTRAPS:mask):ALLTRAPS; S.customOn=false; S.editing=false;
  C=makeVariant(lv,num,S.mask); if(S.student){ const st=J.rows.find(x=>x.id===S.student); if(!st||st.code!==codeOf(C)) S.student=null }
  try{ history.replaceState(null,'','#'+codeOf(C)) }catch(e){}
  render();
}

// ---------- nav ----------
function renderNav(){
  const items=[['variant','Вариант'],['solve','Решение'],['group','Группа',J.rows.length||'']];
  $('#nav').innerHTML=items.map(([k,n,c])=>'<button type="button" data-v="'+k+'"'+(S.view===k?' aria-current="page"':'')+'>'+n+(c!==''&&c!=null?'<span class="cnt">'+c+'</span>':'')+'</button>').join('');
  $('#nav').querySelectorAll('[data-v]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.v)));
  const g=$('#gearBtn'); g.setAttribute('aria-pressed',S.view==='settings');
}
function go(v){ if(v==='settings'&&S.view!=='settings') S.prevView=S.view; S.view=v; save(); renderNav(); renderMain(); }
$('#gearBtn').addEventListener('click',()=>go(S.view==='settings'?(S.prevView||'variant'):'settings'));
mountTheme($('#themeSeg'));

function msgsHtml(){ if(!R) return ''; let h='';
  R.E.forEach(t=>h+='<div class="msg err">'+esc(t)+'</div>'); R.W.forEach(t=>h+='<div class="msg warn">'+esc(t)+'</div>');
  return h?'<div class="msgs">'+h+'</div>':'' }
function brokenHtml(){ return msgsHtml()+'<div class="empty"><b>Вариант не собирается</b>Исправьте ошибки в параметрах или выберите другой номер.<button type="button" class="btn" id="fixBtn">'+ICON.edit+'Открыть параметры</button></div>' }
function wireBroken(){ const b=$('#fixBtn'); if(b) b.addEventListener('click',()=>{ S.view='variant'; S.editing=true; save(); renderNav(); renderMain() }) }
function renderMain(){
  const m=$('#main');
  if(S.view==='variant') renderVariant(m);
  else if(S.view==='solve') renderSolve(m);
  else if(S.view==='group') renderGroup(m);
  else renderSettings(m);
}

// ---------- variant: task / key / edit ----------
function renderVariant(m){
  if(S.editing) return renderParams(m);
  const stu = S.student ? J.rows.find(x=>x.id===S.student) : null;
  const subSeg='<div class="seg" role="group" aria-label="Что показать"><button type="button" data-s="task" aria-pressed="'+(S.sub==='task')+'">Задание</button><button type="button" data-s="key" aria-pressed="'+(S.sub==='key')+'">Ключ и проверка</button></div>';
  const acts = S.sub==='task'
    ? B_('cpTask','copy','Скопировать для Word')+(canSave()?B_('dxTask','down','.docx','primary','Скачать задание в Word'):'')+(framed?'':B_('prTask','print','Печать'))
    : B_('cpKey','copy','Скопировать ключ')+(canSave()?B_('dlKey','down','.txt','','Скачать ключ и текст отчёта'):'');
  m.innerHTML=(stu&&S.sub==='key'?'<div class="who"><span>Проверяете: <b>'+esc(stu.name)+'</b> · вариант '+esc(stu.code)+'. Отметки сохраняются в журнал.</span><button type="button" class="btn ghost" id="noStu">Проверять без студента</button></div>':'')+
    '<div class="bar"><div class="l">'+subSeg+'<button type="button" class="btn ghost" id="editBtn">'+ICON.edit+'<span class="lbl">Изменить вариант</span></button></div><div class="acts">'+(R.ok?acts:'')+'</div></div><div id="vbody" class="panel"></div>';
  m.querySelectorAll('[data-s]').forEach(b=>b.addEventListener('click',()=>{ S.sub=b.dataset.s; save(); renderVariant(m) }));
  $('#editBtn').addEventListener('click',()=>{ S.editing=true; save(); renderVariant(m) });
  const ns=$('#noStu'); if(ns) ns.addEventListener('click',()=>{ S.student=null; save(); renderVariant(m) });
  const body=$('#vbody');
  if(!R.ok){ body.innerHTML=brokenHtml(); wireBroken(); return }
  if(S.sub==='task'){
    const M=taskModel(C,R,ST.rtrOs);
    body.innerHTML='<p class="hint">Лист для студента, ответов в нём нет. Студенты могут открыть этот же вариант сами по коду <b>'+esc(codeOf(C))+'</b>'+(S.customOn?', но только без ваших правок':'')+'.</p><article class="sheet" id="sheet">'+modelHtml(M)+'</article>';
    $('#cpTask').addEventListener('click',()=>copyRich($('#sheet').innerHTML,modelText(M),$('#sheet')));
    const dx=$('#dxTask'); if(dx) dx.addEventListener('click',()=>docx([M],fname('_task.docx')));
    const pr=$('#prTask'); if(pr) pr.addEventListener('click',()=>printSheets([modelHtml(M)]));
  } else renderKey(body,stu);
  if(S.sub==='key'){ const rep=reportText(C,ST,R,A);
    $('#cpKey').addEventListener('click',()=>copyText(keyPlain(C,R,A)));
    const dk=$('#dlKey'); if(dk) dk.addEventListener('click',()=>saveFile(fname('_key.txt'),keyPlain(C,R,A)+'\n\n'+rep)) }
}
async function docx(models,name){ try{ toast(models.length>1?'Собираю '+models.length+' заданий…':'Собираю документ…'); await saveFile(name,await buildDocx(models)) }catch(e){ toast('Не удалось собрать документ') } }

function renderKey(body,stu){
  const L=R.lans, code=codeOf(C)+(S.customOn?'*':''), tr=traps(C,R), ck=CK, D=C.dom, rep=reportText(C,ST,R,A);
  const done = stu ? (stu.done||[]) : store.get(KEY+'.chk.'+code,[]);
  const ar=(name,tag,val,small)=>'<div class="ar"><span class="an">'+name+(tag?' <i>'+tag+'</i>':'')+'</span><b>'+val+'</b>'+(small?'<small>'+small+'</small>':'')+'</div>';
  const answers=LANS.map(([k,n])=>ar(n==='сеть управления'?'Управление':n,k==='br'?'':'VLAN '+esc(C[k+'Vid']),L[k].cidr,'шлюз '+L[k].h(1)+(k==='mgmt'?'':' · '+(k==='cli'?'клиент ':'сервер ')+L[k].h(2))+'<br><em>'+esc(ruleTxt(C[k+'Rule'])+' '+C[k+'N'])+'</em>: '+why(C,k,L[k].p))).join('')+
    ar('ISP ↔ HQ-RTR','',R.ispHq.cidr,'ISP '+A.ispHq+' · HQ-RTR '+A.hqWan)+ar('ISP ↔ BR-RTR','',R.ispBr.cidr,'ISP '+A.ispBr+' · BR-RTR '+A.brWan)+
    ar('Туннель',C.tun==='gre'?'GRE':'IP-in-IP',R.tun.cidr,'HQ-RTR '+A.tHq+' · BR-RTR '+A.tBr)+
    ar('DHCP','',A.dhcpFrom.split('.').pop()+'–'+A.dhcpTo.split('.').pop(),A.dhcpFrom+' – '+A.dhcpTo+'<br>HQ-CLI '+A.hqCli+' · DNS '+A.hqSrv)+
    ar('SSH','',esc(C.sshPort),esc(C.su)+' · uid '+esc(C.uid)+' · попыток '+esc(C.maxTries)+'<br>«'+esc(C.banner)+'»');
  const dns=[['hq-rtr.'+D,'A, PTR',A.hqSrvGw],['br-rtr.'+D,'A',A.brGw],['hq-srv.'+D,'A, PTR',A.hqSrv],['hq-cli.'+D,'A, PTR',A.hqCli],['br-srv.'+D,'A',A.brSrv],['docker.'+D,'A',A.docker],['web.'+D,'A',A.web]];
  const fold=(title,small,inner)=>'<details class="fold"><summary>'+title+(small?'<small>'+small+'</small>':'')+ICON.chev+'</summary><div class="fb">'+inner+'</div></details>';
  body.innerHTML='<div class="keygrid"><section class="card"><h3>Проверка по пунктам <small>баллы меняются в настройках</small></h3>'+
    '<div class="score"><span class="big" id="scoreBig"></span><div class="meter"><i id="meter"></i></div><button type="button" class="lnk" id="ckReset">Снять отметки</button></div>'+
    '<div class="checks">'+ck.map((rows,i)=>'<div class="ck"><input type="checkbox" id="ck'+i+'" data-i="'+i+'"'+(done.includes(i)?' checked':'')+'><label class="h" for="ck'+i+'"><span class="num">'+(i+1)+'</span>'+ITEM_NAMES[i]+'</label><span class="pts">'+fmt(+ST.weights[i]||0)+' б.</span><div class="rows">'+
      rows.map(([cmd,exp])=>'<div class="cr"><code>'+esc(cmd)+'</code><span class="exp">'+exp+'</span></div>').join('')+'</div></div>').join('')+'</div>'+
    '<p class="hint">Быстрее проверять скриптами: раздел «Решение» → «Проверка». Если студент выбрал другие адреса внутри верной подсети, пункт можно засчитать.</p></section>'+
    '<aside class="side"><section class="card"><h3>Ответы</h3><div class="ans">'+answers+'</div></section>'+
    (tr.length?'<section class="card"><h3>Подвохи <small>'+tr.length+'</small></h3><ul class="tlist">'+tr.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></section>':'')+'</aside></div>'+
    fold('Таблица 2. IP-адресация','имена интерфейсов из настроек',dtable(['Устройство','Интерфейс','IP-адрес','Шлюз'],addrRows(C,ST,R,A)))+
    fold('Таблица 3. Записи DNS','пересылка на '+esc(C.fwd1)+' и '+esc(C.fwd2),dtable(['Имя','Тип','Адрес'],dns))+
    fold('Текст для отчёта','образец по пунктам 1, 4, 6–10',termHtml('report.txt',rep,true,'rep'));
  const upd=(write)=>{ const on=[...body.querySelectorAll('.ck input')].filter(x=>x.checked).map(x=>+x.dataset.i);
    const sc=on.reduce((a,i)=>a+(+ST.weights[i]||0),0);
    $('#meter').style.width=(totalW()?sc/totalW()*100:0)+'%'; $('#scoreBig').innerHTML=fmt(sc)+' <small>из '+fmt(totalW())+' б. · пунктов '+on.length+' из 11</small>';
    if(!write) return;
    if(stu) J.update(stu.id,{done:on,score:sc,updated:new Date().toISOString()}).catch(()=>toast('Не удалось сохранить в журнал'));
    else store.set(KEY+'.chk.'+code,on) };
  body.querySelectorAll('.ck input').forEach(x=>x.addEventListener('change',()=>upd(true))); upd(false);
  $('#ckReset').addEventListener('click',()=>{ body.querySelectorAll('.ck input').forEach(x=>x.checked=false); upd(true) });
  wireTerm('rep',rep,'report.txt');
}
const dtable=(head,rows)=>'<div class="tbl"><table class="dt"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';

// ---------- params (edit variant) ----------
const PF=[
  ['Провайдер и туннель','Пункты 2, 6 и 7',[['netIspHq','ISP ↔ HQ-RTR',1],['netIspBr','ISP ↔ BR-RTR',1],['netTun','Сеть туннеля',1],['tun','Технология туннеля',0,[['gre','GRE'],['ipip','IP-in-IP']]],['ospfPass','Пароль OSPF',1]]],
  ['Пользователи и SSH','Пункты 3 и 5',[['adm','Логин на роутерах',1],['admPass','Пароль на роутерах',1],['su','Логин на серверах',1],['suPass','Пароль на серверах',1],['uid','UID на серверах',1],['sshPort','Порт SSH',1],['maxTries','Попыток входа',1],['banner','Текст баннера',1,null,1]]],
  ['Домен, время и DNS','Пункты 9, 10 и 11',[['dom','Домен',1],['tz','Часовой пояс',0,Object.keys(TZ).map(k=>[k,k])],['fwd1','Внешний DNS 1',1],['fwd2','Внешний DNS 2',1],['dockerTo','Куда указывает docker',0,[['hq','ISP в сторону HQ-RTR, web — в сторону BR'],['br','ISP в сторону BR-RTR, web — в сторону HQ']],1]]]
];
function field(k,l,mono,opts,full){
  const v=C[k]??'';
  return '<div class="f'+(full?' full':'')+'"><label for="p_'+k+'">'+l+'</label>'+(opts?'<select id="p_'+k+'" data-k="'+k+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select>'
    :'<input id="p_'+k+'" data-k="'+k+'"'+(mono?' class="mono"':'')+' value="'+esc(v)+'" spellcheck="false">')+'</div>';
}
function renderParams(m){
  const lanBox=([k,n])=>'<div class="lan"><div class="lt"><b>'+(k==='mgmt'?'Сеть управления':'Сеть '+n)+'</b><span class="calc" id="calc_'+k+'"></span></div><div class="sentence">'+
    (C.addrMode==='given'?'Адрес <input class="mono w-ip" id="p_'+k+'Base" data-k="'+k+'Base" aria-label="Адрес сети '+n+'" value="'+esc(C[k+'Base'])+'">,':'')+' вмещать '+
    '<select id="p_'+k+'Rule" data-k="'+k+'Rule" aria-label="Правило '+n+'"><option value="le"'+(C[k+'Rule']==='le'?' selected':'')+'>не более</option><option value="ge"'+(C[k+'Rule']==='ge'?' selected':'')+'>не менее</option></select> '+
    '<input class="mono w-n" id="p_'+k+'N" data-k="'+k+'N" aria-label="Число адресов '+n+'" inputmode="numeric" value="'+esc(C[k+'N'])+'"> адресов'+
    (k==='br'?'':', VLAN <input class="mono w-v" id="p_'+k+'Vid" data-k="'+k+'Vid" aria-label="VLAN '+n+'" inputmode="numeric" value="'+esc(C[k+'Vid'])+'">')+'</div></div>';
  m.innerHTML='<div class="bar"><div class="l"><button type="button" class="btn" id="doneP">'+ICON.back+'Готово</button><p>Правки сразу меняют задание, ключ и скрипты. Изменённый вариант нельзя открыть по коду, поэтому группе лучше раздавать варианты без правок.</p></div><div class="acts"><button type="button" class="btn ghost" id="resetP">Вернуть значения кода '+esc(codeOf(C))+'</button></div></div><div id="pmsgs"></div>'+
    '<div class="form"><div class="card"><h3>Локальные сети <small>пункты 1 и 4</small></h3>'+
    field('addrMode','Как заданы адреса',0,[['given','Адрес каждой сети указан в задании'],['vlsm','Нарезать из общего блока (VLSM)']],1)+
    (C.addrMode==='vlsm'?field('block','Общий блок',1):'')+LANS.map(lanBox).join('')+'</div>'+
    PF.map(([t,sub,fs])=>'<div class="card"><h3>'+t+' <small>'+sub.toLowerCase()+'</small></h3><div class="row">'+fs.map(f=>field(...f)).join('')+'</div></div>').join('')+'</div>';
  const upd=()=>{ $('#pmsgs').innerHTML=msgsHtml(); LANS.forEach(([k])=>{ const e=$('#calc_'+k), n=R.lans[k]; e.textContent=n?n.cidr+' · маска '+n.mask+' · '+n.size+' адр.':'—' }) };
  m.querySelectorAll('[data-k]').forEach(el=>{
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
      const k=el.dataset.k; C=Object.assign({},C,{[k]:el.value.trim()});
      if(k==='addrMode'&&C.addrMode==='vlsm'&&!parseCidr(C.block)){ const p=String(C.srvBase).split('.'); C.block=p.slice(0,3).join('.')+'.0/24' }
      if(k==='addrMode'&&C.addrMode==='given'&&R.ok) fillBases(C,R);
      S.customOn=true; S.student=null; recompute(); save(); renderToolbar();
      if(k==='addrMode') renderParams(m); else upd();
    });
  });
  $('#doneP').addEventListener('click',()=>{ S.editing=false; save(); renderVariant(m) });
  $('#resetP').addEventListener('click',()=>{ load(S.lv,S.num,S.mask); S.editing=true; renderMain(); toast('Вернул значения варианта '+codeOf(C)) });
  upd();
}

// ---------- solve ----------
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
function termHtml(fn,text,wrapL,id){ id=id||'t';
  return '<div class="term"><div class="tbar"><span class="fn">'+esc(fn)+'</span><div class="acts"><button type="button" class="tb primary" id="'+id+'Copy">Копировать</button>'+
    (canSave()?'<button type="button" class="tb" id="'+id+'Dl">Скачать .txt</button>':'')+'</div></div><pre id="'+id+'Code"'+(wrapL?' class="wrap"':'')+' tabindex="0">'+hl(text)+'</pre></div>' }
function wireTerm(id,text,file){ const c=$('#'+id+'Copy'); if(c) c.addEventListener('click',()=>copyText(text,$('#'+id+'Code'))); const d=$('#'+id+'Dl'); if(d) d.addEventListener('click',()=>saveFile(file,text)) }
function mainIp(key){ const L=R.lans;
  return {isp:A.ispHq+' · '+A.ispBr, hqrtr:A.hqWan, brrtr:A.brWan, hqsrv:A.hqSrv+'/'+L.srv.p, brsrv:A.brSrv+'/'+L.br.p, hqcli:A.hqCli+' DHCP'}[key] }
function renderSolve(m){
  if(!G){ m.innerHTML=brokenHtml(); wireBroken(); return }
  const modes=[['auto','Настройка'],['check','Проверка'],['manual','Вручную']];
  const descr={auto:'Скрипты выполняют задание за студента. Запускайте по номерам шагов, повторный запуск безопасен.',
    check:'Скрипты ничего не меняют. Они проверяют машину и печатают [ OK ] или [FAIL] с номером пункта задания.',
    manual:'Те же действия, что делают скрипты, но разложенные по пунктам задания и с пояснениями.'};
  m.innerHTML='<div class="bar"><div class="l"><div class="seg" role="group" aria-label="Режим">'+modes.map(([k,n])=>'<button type="button" data-m="'+k+'" aria-pressed="'+(S.mode===k)+'">'+n+'</button>').join('')+'</div><p>'+descr[S.mode]+'</p></div><div class="acts" id="solveActs"></div></div>'+(R.W.length?msgsHtml():'')+'<div id="solveBody" class="panel"></div>';
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
    termHtml('/root/'+x.sh+' · '+x.text.split('\n').length+' строк', x.text, false);
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
  else { G.out.forEach((x,i)=>z.file(String(i+1).padStart(2,'0')+'_'+x.sh.replace('.sh','')+'.txt',x.text)); z.file('00_order.txt',orderText(G.out)); z.file('key.txt',keyPlain(C,R,A)); z.file('report.txt',reportText(C,ST,R,A)) }
  z.generateAsync({type:'blob'}).then(bl=>saveFile(fname(isChk?'_check.zip':'_scripts.zip'),bl));
}

// ---------- group: students + batch ----------
let jConfirm=false, B=Object.assign({lv:'X',count:15,start:1},store.get(KEY+'.batch',{}));
function renderGroup(m){
  const prevNames=$('#jNames')?$('#jNames').value:'';
  m.innerHTML='<div class="bar"><div class="l"><div class="seg" role="group" aria-label="Раздел группы"><button type="button" data-g="students" aria-pressed="'+(S.group==='students')+'">Студенты</button><button type="button" data-g="batch" aria-pressed="'+(S.group==='batch')+'">Пакет вариантов</button></div></div><div class="acts" id="gActs"></div></div>'+
    (STUDENT_URL.startsWith('http')?'<div class="linkbox"><span>Страница для студентов, без ключа и скриптов:</span><code id="stuUrl">'+esc(STUDENT_URL)+'</code><button type="button" class="lnk" id="jLink">Скопировать</button></div>':'')+
    '<div id="gBody" class="panel"></div>';
  m.querySelectorAll('[data-g]').forEach(b=>b.addEventListener('click',()=>{ S.group=b.dataset.g; save(); renderGroup(m) }));
  const lk=$('#jLink'); if(lk) lk.addEventListener('click',()=>copyText(STUDENT_URL,$('#stuUrl')));
  if(S.group==='batch') return renderBatch($('#gBody'));
  renderStudents($('#gBody'),prevNames);
}
function addForm(open,prevNames){
  const next = J.rows.length ? Math.max(...J.rows.map(r=>(parseCode(r.code)||{num:0}).num))+1 : 1;
  const inner='<div class="f"><label for="jNames">Список группы, по одному на строку</label><textarea id="jNames" placeholder="Иванов Иван&#10;Петрова Анна&#10;Сидоров Пётр">'+esc(prevNames||'')+'</textarea></div>'+
    '<div class="inline"><div class="f"><label for="jLv">Сложность</label><select id="jLv">'+Object.entries(LEVELS).map(([k,v])=>'<option value="'+k+'"'+(S.lv===k?' selected':'')+'>'+v.name+'</option>').join('')+'</select></div>'+
    '<div class="f"><label for="jStart">Первый номер</label><input id="jStart" class="mono w-n" inputmode="numeric" value="'+next+'"></div><button type="button" class="btn primary" id="jAdd">Раздать варианты</button></div>'+
    '<p class="hint">Каждый получит свой вариант, номера идут подряд. Для уровня «С подвохами» берутся подвохи, выбранные сейчас на панели вверху.</p>';
  return '<details class="fold"'+(open?' open':'')+'><summary>Добавить студентов'+ICON.chev+'</summary><div class="fb">'+inner+'</div></details>';
}
function renderStudents(body,prevNames){
  const rows=J.rows, tw=totalW();
  const mode = J.mode==='db' ? 'Журнал общий: его видно с любого устройства, где открыта эта страница.' : J.mode==='local' ? 'Журнал хранится в этом браузере.' : 'Подключаю журнал…';
  const acts=$('#gActs');
  acts.innerHTML=rows.length?((canSave()?B_('jCsv','down','Журнал .csv'):'')+(jConfirm?'<span class="confirm">Удалить весь журнал?<button type="button" class="btn" id="jYes">Да, удалить</button><button type="button" class="btn" id="jNo">Отмена</button></span>':'<button type="button" class="btn ghost" id="jClear">Очистить</button>')):'';
  body.innerHTML=(rows.length?'<section class="card"><h3>Группа <small>'+mode+(J.err?' Ошибка: '+esc(J.err):'')+'</small></h3><div class="tbl"><table class="dt"><thead><tr><th>№</th><th>Студент</th><th>Вариант</th><th>Баллы</th><th>Проверен</th><th></th></tr></thead><tbody>'+
      rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.code)+'</td><td>'+(r.done&&r.done.length?'<span class="pill ok">'+fmt(r.score||0)+' из '+fmt(tw)+'</span>':'<span class="pill">не проверен</span>')+'</td><td>'+(r.updated?esc(new Date(r.updated).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})):'')+'</td>'+
        '<td><div class="act"><button type="button" class="rowbtn" data-k="'+esc(r.id)+'">Проверить</button><button type="button" class="rowbtn" data-t="'+esc(r.id)+'">Задание</button><button type="button" class="rowbtn del" data-d="'+esc(r.id)+'" aria-label="Удалить '+esc(r.name)+'" title="Удалить">×</button></div></td></tr>').join('')+'</tbody></table></div></section>'+addForm(!!prevNames,prevNames)
    : '<div class="empty"><b>В журнале пока никого</b>Вставьте список группы: каждый студент получит свой вариант, а баллы за проверку будут храниться здесь.<br>'+mode+'</div>'+addForm(true,prevNames));
  const open=(id,sub)=>{ const r=J.rows.find(x=>x.id===id); const p=r&&parseCode(r.code); if(!p) return; S.view='variant'; S.sub=sub; load(p.lv,p.num,p.mask); if(sub==='key'){ S.student=id; save(); renderMain() } renderNav(); window.scrollTo({top:0}) };
  body.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.k,'key')));
  body.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.t,'task')));
  body.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>J.remove(b.dataset.d).catch(()=>toast('Не удалось удалить'))));
  $('#jAdd').addEventListener('click',async()=>{
    const names=$('#jNames').value.split('\n').map(s=>s.trim()).filter(Boolean); if(!names.length){ toast('Вставьте хотя бы одно имя'); $('#jNames').focus(); return }
    const lv=$('#jLv').value, start=Math.max(1,parseInt($('#jStart').value,10)||1), base=J.rows.length;
    $('#jNames').value='';
    try{ for(let i=0;i<names.length;i++){ const c=makeVariant(lv,start+i,lv==='H'?S.mask:ALLTRAPS); await J.add({name:names[i].slice(0,120),code:codeOf(c),done:[],score:0,order:base+i+1,created:new Date().toISOString()}) }
      toast('Добавлено студентов: '+names.length) }catch(e){ toast('Не удалось записать в журнал') }
  });
  const cl=$('#jClear'); if(cl) cl.addEventListener('click',()=>{ jConfirm=true; renderStudents(body) });
  const no=$('#jNo'); if(no) no.addEventListener('click',()=>{ jConfirm=false; renderStudents(body) });
  const yes=$('#jYes'); if(yes) yes.addEventListener('click',async()=>{ jConfirm=false; for(const r of J.rows.slice()) await J.remove(r.id).catch(()=>{}); toast('Журнал очищен') });
  const csv=$('#jCsv'); if(csv) csv.addEventListener('click',()=>{ const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
    const lines=[['№','Студент','Вариант'].concat(ITEM_NAMES.map((n,i)=>(i+1)+'. '+n)).concat(['Баллы','Из','Проверен']).map(q).join(';')].concat(J.rows.map((r,i)=>[i+1,r.name,r.code].concat(ITEM_NAMES.map((n,k)=>(r.done||[]).includes(k)?fmt(+ST.weights[k]||0):'0')).concat([fmt(r.score||0),fmt(tw),r.updated||'']).map(q).join(';')));
    saveFile('journal.csv','\ufeff'+lines.join('\r\n')) });
}
function batchList(){ const out=[]; for(let i=0;i<B.count;i++){ const c=makeVariant(B.lv,B.start+i,B.lv==='H'?S.mask:ALLTRAPS), r=compute(c); out.push({c,r,A:r.ok?addrs(c,r):null}) } return out }
function renderBatch(body){
  const list=batchList(), ok=list.filter(x=>x.r.ok), span=B.lv+'_'+B.start+'-'+(B.start+B.count-1);
  $('#gActs').innerHTML=(canSave()?B_('b_dx','down','Задания .docx','primary')+B_('b_keys','down','Ключи .txt'):'')+B_('b_cp','copy','Скопировать задания')+(framed?'':B_('b_pr','print','Печать'));
  body.innerHTML='<section class="card"><h3>Пакет вариантов <small>без привязки к студентам</small></h3><div class="inline">'+
    '<div class="f"><label for="b_lv">Сложность</label><select id="b_lv">'+Object.entries(LEVELS).map(([k,v])=>'<option value="'+k+'"'+(B.lv===k?' selected':'')+'>'+v.name+'</option>').join('')+'</select></div>'+
    '<div class="f"><label for="b_count">Сколько</label><input id="b_count" class="mono w-n" inputmode="numeric" value="'+B.count+'"></div>'+
    '<div class="f"><label for="b_start">С номера</label><input id="b_start" class="mono w-n" inputmode="numeric" value="'+B.start+'"></div></div>'+
    '<div class="tbl"><table class="dt"><thead><tr><th>Вариант</th><th>HQ-SRV</th><th>HQ-CLI</th><th>Управление</th><th>BR-SRV</th><th>Туннель</th><th>SSH</th><th></th></tr></thead><tbody>'+
    list.map(({c,r})=>{ const code=codeOf(c); if(!r.ok) return '<tr><td>'+esc(code)+'</td><td colspan="7">не удалось собрать</td></tr>';
      return '<tr><td><span class="lvtag lv-'+c.lv+'"><span class="dot"></span>'+esc(code)+'</span></td><td>'+r.lans.srv.cidr+'</td><td>'+r.lans.cli.cidr+'</td><td>'+r.lans.mgmt.cidr+'</td><td>'+r.lans.br.cidr+'</td><td>'+(c.tun==='gre'?'GRE ':'IPIP ')+r.tun.cidr+'</td><td>'+esc(c.sshPort)+'</td><td><div class="act"><button type="button" class="rowbtn" data-code="'+esc(code)+'">Открыть</button></div></td></tr>' }).join('')+'</tbody></table></div></section>';
  const upd=()=>{ B={lv:$('#b_lv').value,count:Math.max(1,Math.min(40,parseInt($('#b_count').value,10)||1)),start:Math.max(1,Math.min(9960,parseInt($('#b_start').value,10)||1))}; store.set(KEY+'.batch',B); renderBatch(body) };
  ['#b_lv','#b_count','#b_start'].forEach(s=>$(s).addEventListener('change',upd));
  body.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>{ const p=parseCode(b.dataset.code); S.view='variant'; S.sub='task'; load(p.lv,p.num,p.mask); renderNav(); window.scrollTo({top:0}) }));
  const models=()=>ok.map(x=>taskModel(x.c,x.r,ST.rtrOs));
  $('#b_cp').addEventListener('click',()=>{ const ms=models(); copyRich(ms.map(modelHtml).join('<br style="page-break-before:always">'),ms.map(modelText).join('\n\n════════\n\n')) });
  const dx=$('#b_dx'); if(dx) dx.addEventListener('click',()=>docx(models(),'module1_'+span+'_tasks.docx'));
  const dk=$('#b_keys'); if(dk) dk.addEventListener('click',()=>saveFile('module1_'+span+'_keys.txt',ok.map(x=>keyPlain(x.c,x.r,x.A)+'\n'+reportText(x.c,ST,x.r,x.A)).join('\n════════════════════\n\n')));
  const pr=$('#b_pr'); if(pr) pr.addEventListener('click',()=>printSheets(models().map(modelHtml)));
}

// ---------- settings ----------
function renderSettings(m){
  const f=(k,l)=>'<div class="f"><label for="s_'+k+'">'+l+'</label><input class="mono" id="s_'+k+'" data-s="'+k+'" value="'+esc(ST[k])+'" spellcheck="false"></div>';
  m.innerHTML='<div class="bar"><div class="l"><button type="button" class="btn" id="backS">'+ICON.back+'Назад</button><p>Настройки стенда и оценки. Они действуют для всех вариантов и хранятся в этом браузере.</p></div><div class="acts"><button type="button" class="btn ghost" id="resetS">Сбросить</button></div></div>'+
    '<div class="form"><div class="card"><h3>Стенд</h3><div class="f"><label for="s_rtrOs">ОС на ISP, HQ-RTR и BR-RTR</label><select id="s_rtrOs" data-s="rtrOs"><option value="astra"'+(ST.rtrOs==='astra'?' selected':'')+'>Astra Linux CE</option><option value="alt"'+(ST.rtrOs==='alt'?' selected':'')+'>Альт Сервер</option></select><span class="hint">Серверы и клиент всегда на Альт. Выбор меняет скрипты, решение и таблицу 1 в задании.</span></div>'+
    '<div class="f"><label for="s_autoReboot">После шага «База»</label><select id="s_autoReboot" data-s="autoReboot"><option value="no"'+(ST.autoReboot==='no'?' selected':'')+'>Не перезагружать, reboot наберу сам</option><option value="yes"'+(ST.autoReboot==='yes'?' selected':'')+'>Сразу перезагрузить машину</option></select></div></div>'+
    '<div class="card"><h3>Баллы за пункты <small>всего <b id="wTot">'+fmt(totalW())+'</b> б.</small></h3><div class="row">'+
    ITEM_NAMES.map((n,i)=>'<div class="f"><label for="w'+i+'">'+(i+1)+'. '+n+'</label><input class="mono" id="w'+i+'" data-w="'+i+'" inputmode="decimal" value="'+fmt(ST.weights[i])+'"></div>').join('')+'</div></div>'+
    '<div class="card"><h3>Имена интерфейсов <small>смотрите командой ip -br a</small></h3><div class="row">'+
    f('ifIspWan','ISP → интернет')+f('ifIspHq','ISP → HQ')+f('ifIspBr','ISP → BR')+f('ifHqWan','HQ-RTR → ISP')+f('ifHqLan','HQ-RTR → офис')+f('ifBrWan','BR-RTR → ISP')+f('ifBrLan','BR-RTR → офис')+f('ifSrv','HQ-SRV и BR-SRV')+f('ifCli','HQ-CLI')+'</div></div>'+
    '<div class="card"><h3>Имена ВМ в VirtualBox <small>как в списке слева в VirtualBox</small></h3><div class="row">'+
    f('vmIsp','ISP')+f('vmHqRtr','HQ-RTR')+f('vmBrRtr','BR-RTR')+f('vmHqSrv','HQ-SRV')+f('vmBrSrv','BR-SRV')+f('vmHqCli','HQ-CLI')+'</div></div></div>';
  m.querySelectorAll('[data-s]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ ST[el.dataset.s]=el.value.trim(); store.set(KEY+'.stand',ST); recompute() }));
  m.querySelectorAll('[data-w]').forEach(el=>el.addEventListener('input',()=>{ const v=parseFloat(el.value.replace(',','.')); ST.weights[+el.dataset.w]=isFinite(v)&&v>=0?v:0; store.set(KEY+'.stand',ST); $('#wTot').textContent=fmt(totalW()) }));
  $('#backS').addEventListener('click',()=>go(S.prevView||'variant'));
  $('#resetS').addEventListener('click',()=>{ ST=Object.assign({},STAND_DEF,{weights:WEIGHTS_DEF.slice()}); store.set(KEY+'.stand',ST); recompute(); renderSettings(m); toast('Настройки сброшены') });
}

function recompute(){ R=compute(C); A=R.ok?addrs(C,R):null; G=R.ok?gen(C,ST,R):null; CK=R.ok?checks(C,R,A):null }
function render(){ recompute(); save(); renderToolbar(); renderNav(); renderMain() }
J.subs.push(()=>{ renderNav(); if(S.view==='group'||(S.view==='variant'&&S.sub==='key'&&S.student)) renderMain() });
onSaveReady(()=>{ if(DL) renderMain() });
render();
