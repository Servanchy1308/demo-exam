// ===== student page: task sheet only, no key and no scripts =====
const KEY='degen.student.v1';
let S=Object.assign({lv:'X',num:1,mask:ALLTRAPS,os:'astra'},store.get(KEY,{}));
const hc=parseCode(location.hash); if(hc){ S.lv=hc.lv; S.num=hc.num; S.mask=hc.mask }
let C=null, R=null;
function load(lv,num,mask){ S.lv=lv; S.num=Math.max(1,Math.min(9999,parseInt(num,10)||1)); S.mask=lv==='H'?(mask==null?ALLTRAPS:mask):ALLTRAPS; store.set(KEY,S);
  try{ history.replaceState(null,'','#'+codeOf({lv:S.lv,num:S.num,mask:S.mask})) }catch(e){} render() }
function render(){
  C=makeVariant(S.lv,S.num,S.mask); R=compute(C);
  $('#codeBox').className='code lv-'+C.lv;
  $('#codeBox').innerHTML='<small>Вариант</small><div class="big"><span class="let">'+C.lv+'</span>'+esc(codeOf(C).slice(1))+'</div><div class="lvname"><span class="dot"></span>'+LEVELS[C.lv].name+'</div>';
  $('#levels').innerHTML=Object.entries(LEVELS).map(([k,v])=>'<button type="button" class="lvb lv-'+k+'" data-lv="'+k+'" aria-pressed="'+(S.lv===k)+'"><b><span class="dot"></span>'+v.name+'</b><span>'+v.desc+'</span></button>').join('');
  $('#levels').querySelectorAll('.lvb').forEach(b=>b.addEventListener('click',()=>load(b.dataset.lv,S.num,S.mask)));
  if(document.activeElement!==$('#numIn')) $('#numIn').value=S.num;
  $('#osSel').value=S.os;
  const tr=$('#trapRow'); tr.hidden=S.lv!=='H';
  if(S.lv==='H'){ tr.innerHTML='<span>Подвохи</span>'+TRAPS.map((t,i)=>'<button type="button" class="tchip" data-b="'+i+'" aria-pressed="'+!!(S.mask&(1<<i))+'">'+t[1]+'</button>').join('');
    tr.querySelectorAll('.tchip').forEach(b=>b.addEventListener('click',()=>load('H',S.num,S.mask^(1<<+b.dataset.b)))) }
  const M=taskModel(C,R,S.os);
  $('#main').innerHTML='<div class="bar"><p>Ответы вводите на стенде, а адреса и настройку описывайте в отчёте.</p><div class="acts"><button type="button" class="btn" id="cpTask">Скопировать для Word</button>'+
    (canSave()?'<button type="button" class="btn primary" id="dxTask">Скачать .docx</button>':'')+(framed?'':'<button type="button" class="btn" id="prTask">Печать</button>')+'</div></div><article class="sheet" id="sheet">'+modelHtml(M)+'</article>';
  $('#cpTask').addEventListener('click',()=>copyRich($('#sheet').innerHTML,modelText(M),$('#sheet')));
  const dx=$('#dxTask'); if(dx) dx.addEventListener('click',async()=>{ try{ toast('Собираю документ…'); await saveFile('module1_'+codeOf(C).replace('.','_')+'.docx',await buildDocx([M])) }catch(e){ toast('Не удалось собрать документ') } });
  if(!framed) $('#prTask').addEventListener('click',()=>printSheets([modelHtml(M)]));
}
$('#prevBtn').addEventListener('click',()=>load(S.lv,S.num-1,S.mask));
$('#nextBtn').addEventListener('click',()=>load(S.lv,S.num+1,S.mask));
$('#numIn').addEventListener('change',e=>load(S.lv,e.target.value,S.mask));
$('#rndBtn').addEventListener('click',()=>load(S.lv,1+Math.floor(Math.random()*999),S.mask));
const go=()=>{ const p=parseCode($('#codeIn').value); if(!p){ toast('Код выглядит как X-12 или H-7'); return } $('#codeIn').value=''; load(p.lv,p.num,p.mask); toast('Открыт вариант '+codeOf(C)) };
$('#codeGo').addEventListener('click',go);
$('#codeIn').addEventListener('keydown',e=>{ if(e.key==='Enter') go() });
$('#osSel').addEventListener('change',e=>{ S.os=e.target.value; store.set(KEY,S); render() });
onSaveReady(()=>{ if(DL) render() });
render();
