// ===== student page: task sheet only, no key and no scripts =====
const KEY='degen.student.v1';
let S=Object.assign({lv:'X',num:1,mask:ALLTRAPS,os:'astra',train:false},store.get(KEY,{}));
const hc=parseCode(location.hash); if(hc){ S.lv=hc.lv; S.num=hc.num; S.mask=hc.mask }
let C=null, R=null;
mountTheme($('#themeSeg'));
function load(lv,num,mask){ S.lv=lv; S.num=Math.max(1,Math.min(9999,parseInt(num,10)||1)); S.mask=lv==='H'?(mask==null?ALLTRAPS:mask):ALLTRAPS; store.set(KEY,S);
  try{ history.replaceState(null,'','#'+codeOf({lv:S.lv,num:S.num,mask:S.mask})) }catch(e){} render() }
function renderEntry(){
  const e=$('#entry'), dd = S.train && C.lv==='H' ? trapsDD(S.mask,m=>load('H',S.num,m)) : null;
  e.innerHTML='<div class="cur lv-'+C.lv+'"><small>Вариант</small><b>'+esc(codeOf(C))+'</b></div>'+
    '<div class="ef"><label class="sr" for="codeIn">Код варианта от преподавателя</label><input id="codeIn" class="bigin" placeholder="X-12" spellcheck="false" autocomplete="off"><button type="button" class="btn primary" id="codeGo">Открыть</button></div>'+
    '<span class="hint" style="flex:1 1 220px">Введите код, который дал преподаватель, например X-12.</span>'+
    '<div class="ef"><label for="osSel" style="font-weight:600;font-size:.8rem;color:var(--muted)">ОС роутеров</label><select id="osSel" style="width:auto"><option value="astra">Astra Linux CE</option><option value="alt">Альт Сервер</option></select>'+
    '<button type="button" class="btn ghost" id="trainBtn" aria-expanded="'+S.train+'">'+(S.train?'Скрыть тренировку':'Тренироваться самому')+'</button></div>'+
    (S.train?'<div class="train"><div class="seg" role="group" aria-label="Сложность">'+Object.entries(LEVELS).map(([k,v])=>'<button type="button" class="lv-'+k+'" data-lv="'+k+'" aria-pressed="'+(C.lv===k)+'" title="'+esc(v.desc)+'"><span class="dot"></span>'+v.name+'</button>').join('')+'</div>'+
      '<div class="codef lv-'+C.lv+'"><button type="button" id="prevBtn" aria-label="Предыдущий номер">‹</button><input id="numIn" inputmode="numeric" aria-label="Номер варианта" value="'+S.num+'" style="font-family:var(--mono);font-size:.95rem;width:5em"><button type="button" id="nextBtn" aria-label="Следующий номер">›</button></div>'+
      (dd?dd.html:'')+'<button type="button" class="btn" id="rndBtn">'+ICON.dice+'Случайный</button><span class="hint">'+esc(LEVELS[C.lv].desc)+'</span></div>':'');
  $('#osSel').value=S.os;
  const go=()=>{ const p=parseCode($('#codeIn').value); if(!p){ toast('Код выглядит так: X-12, E-3 или H-7'); $('#codeIn').focus(); return } load(p.lv,p.num,p.mask); toast('Открыт вариант '+codeOf(C)) };
  $('#codeGo').addEventListener('click',go);
  $('#codeIn').addEventListener('keydown',ev=>{ if(ev.key==='Enter') go() });
  $('#osSel').addEventListener('change',ev=>{ S.os=ev.target.value; store.set(KEY,S); render() });
  $('#trainBtn').addEventListener('click',()=>{ S.train=!S.train; store.set(KEY,S); renderEntry() });
  if(S.train){
    if(dd) dd.wire(e);
    e.querySelectorAll('[data-lv]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.lv,S.num,S.mask)));
    $('#prevBtn').addEventListener('click',()=>load(S.lv,S.num-1,S.mask));
    $('#nextBtn').addEventListener('click',()=>load(S.lv,S.num+1,S.mask));
    $('#numIn').addEventListener('change',ev=>load(S.lv,ev.target.value,S.mask));
    $('#rndBtn').addEventListener('click',()=>load(S.lv,1+Math.floor(Math.random()*999),S.mask));
  }
}
function render(){
  C=makeVariant(S.lv,S.num,S.mask); R=compute(C);
  renderEntry();
  const M=taskModel(C,R,S.os);
  $('#main').innerHTML='<div class="bar"><p>Выполните задание на стенде, адреса и настройки опишите в отчёте.</p><div class="acts">'+
    '<button type="button" class="btn" id="cpTask">'+ICON.copy+'<span class="lbl">Скопировать для Word</span></button>'+
    (canSave()?'<button type="button" class="btn primary" id="dxTask">'+ICON.down+'<span class="lbl">.docx</span></button>':'')+
    (framed?'':'<button type="button" class="btn" id="prTask">'+ICON.print+'<span class="lbl">Печать</span></button>')+'</div></div><article class="sheet" id="sheet">'+modelHtml(M)+'</article>';
  $('#cpTask').addEventListener('click',()=>copyRich($('#sheet').innerHTML,modelText(M),$('#sheet')));
  const dx=$('#dxTask'); if(dx) dx.addEventListener('click',async()=>{ try{ toast('Собираю документ…'); await saveFile('module1_'+codeOf(C).replace('.','_')+'.docx',await buildDocx([M])) }catch(e){ toast('Не удалось собрать документ') } });
  const pr=$('#prTask'); if(pr) pr.addEventListener('click',()=>printSheets([modelHtml(M)]));
}
onSaveReady(()=>{ if(DL) render() });
render();
