// ===== modules 2 and 3: parameters from the variant code + task sheets =====
// Network, domain, logins and SSH port come from module 1; the rest is seeded by the same code.
const MODS={1:{name:'Модуль 1',title:'Настройка сетевой инфраструктуры',min:60},2:{name:'Модуль 2',title:'Организация сетевого администрирования',min:90},3:{name:'Модуль 3',title:'Эксплуатация объектов сетевой инфраструктуры',min:90}};
const READ_MIN=15;
const M2DEF={usrN:'5',usrPre:'user',usrSuf:'hq',grp:'hq',usrPass:'P@ssw0rd',dcPass:'P@ssw0rd',sudoCmds:'cat, grep, id',
  raidLvl:'5',raidDisks:'/dev/sdb /dev/sdc /dev/sdd',raidMnt:'/raid5',nfsDir:'/raid5/nfs',nfsMnt:'/mnt/nfs',ntpStratum:'5',
  dockApp:'testapp',dockPort:'8080',dockDb:'testdb',dockUser:'test',dockPass:'P@ssw0rd',
  webDb:'webdb',webUser:'webc',webPass:'P@ssw0rd',hqFwd:'8080',brFwd:'8080',authUser:'WEB',authPass:'P@ssw0rd',cliUser:'user'};
const M3DEF={csv:'/opt/users.csv',caName:'AU-TEAM Root CA',certDays:'30',psk:'P@ssw0rd',fwAllow:'http, https, dns, ntp, icmp',
  printer:'Virtual_PDF',logLvl:'warning',logDir:'/opt',rotate:'weekly',rotSize:'10M',monName:'mon',monUser:'admin',monPass:'P@ssw0rd',
  f2bTries:'3',f2bBan:'60',pcDir:'/etc/ansible/PC_INFO'};
const FW_ALL=['http','https','dns','ntp','icmp','ssh'];
const LOGLV=[['emerg',0],['alert',1],['crit',2],['err',3],['warning',4],['notice',5],['info',6]];
function m23Params(c){
  const m2=Object.assign({},M2DEF), m3=Object.assign({},M3DEF);
  if(c.lv==='E'||!c.num) return {m2,m3};
  const rnd=rngFor(c.lv+'-'+c.num+'/m23'), int=(a,b)=>a+Math.floor(rnd()*(b-a+1)), pick=a=>a[Math.floor(rnd()*a.length)];
  const shuffle=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]] } return a };
  const lvl=pick(['0','1','5']);
  Object.assign(m2,{usrN:String(int(3,6)),usrPre:pick(['user','staff','emp','worker']),usrSuf:pick(['hq','office']),grp:pick(['hq','office','hq_staff']),
    usrPass:pick(PASS),dcPass:pick(PASS),sudoCmds:shuffle(['cat','grep','id','ls','whoami','tail']).slice(0,3).join(', '),
    raidLvl:lvl,raidDisks:lvl==='1'?'/dev/sdb /dev/sdc':'/dev/sdb /dev/sdc /dev/sdd',raidMnt:'/raid'+lvl,ntpStratum:String(int(3,6)),
    dockApp:pick(['testapp','webapp','siteapp']),dockPort:String(pick([8080,8081,8088,8888])),dockDb:pick(['testdb','appdb','sitedb']),dockUser:pick(['test','app','site']),dockPass:pick(PASS),
    webDb:pick(['webdb','sitedb','portaldb']),webUser:pick(['webc','web','portal']),webPass:pick(PASS),hqFwd:String(pick([8080,8081,8090])),brFwd:String(pick([8080,8082,8091])),
    authUser:pick(['WEB','webuser','proxy']),authPass:pick(PASS)});
  m2.nfsDir=m2.raidMnt+pick(['/nfs','/share']); m2.nfsMnt=pick(['/mnt/nfs','/mnt/share','/srv/nfs']);
  Object.assign(m3,{certDays:String(pick([30,60,90,180])),psk:pick(PASS),fwAllow:['http','https','dns','ntp','icmp'].concat(rnd()<.5?['ssh']:[]).join(', '),
    printer:pick(['Virtual_PDF','PDF','Office_PDF']),logLvl:pick(['warning','err','notice']),rotate:pick(['weekly','daily']),rotSize:pick(['10M','5M','20M']),
    monName:pick(['mon','monitor','grafana']),monPass:pick(PASS),f2bTries:String(int(2,5)),f2bBan:String(pick([60,120,300])),caName:pick(['AU-TEAM Root CA','Office CA','Demo Root CA'])});
  if(c.dom!=='au-team.irpo') m3.caName=c.dom.split('.')[0].toUpperCase()+' Root CA';
  return {m2,m3};
}
function withM23(c){ if(!c) return c; if(!c.m2||!c.m3){ const p=m23Params(c); c=Object.assign({},c,{m2:Object.assign(p.m2,c.m2||{}),m3:Object.assign(p.m3,c.m3||{})}) } return c }
const usersOf = m2 => Array.from({length:Math.max(1,Math.min(20,+m2.usrN||1))},(_,i)=>m2.usrPre+(i+1)+(m2.usrSuf?'.'+m2.usrSuf:''));
const workgroup = dom => dom.split('.')[0].toUpperCase().slice(0,15);
const rotRu = r => r==='daily'?'ежедневно':r==='monthly'?'ежемесячно':'еженедельно';
const lvlRu = l => ({emerg:'emerg',alert:'alert',crit:'crit',err:'err (ошибки)',warning:'warning (предупреждения)',notice:'notice',info:'info'}[l]||l);

function taskModel23(mod,c,r,student){
  c=withM23(c); const m2=c.m2, m3=c.m3, D=c.dom, U=usersOf(m2);
  const head=[{t:'meta',l:'Тренировочный вариант · ДЭ 09.02.06 · '+MODS[mod].name,r:'Вариант **'+codeOf(c)+'** · '+LEVELS[c.lv].name},
    ...(student?[{t:'p',x:'Студент: **'+student+'**'}]:[]),
    {t:'h1',x:MODS[mod].name+'. '+MODS[mod].title},
    {t:'p',x:'Работа ведётся на стенде, настроенном в Модуле 1: те же устройства, адреса и домен '+V(D)+'. Дополнительные файлы лежат на диске '+V('Additional.iso')+'.'}];
  if(mod===2) return head.concat([{t:'h2',x:'Задания'},{t:'ol',items:[
    {x:'**Настройте доменный контроллер Samba на BR-SRV.**',sub:['Домен '+V(D)+', NetBIOS-имя '+V(workgroup(D))+', пароль администратора '+V(m2.dcPass)+'.',
      'Создайте '+V(m2.usrN)+' пользователей: '+V(U[0])+' … '+V(U[U.length-1])+' с паролем '+V(m2.usrPass)+'.',
      'Создайте группу '+V(m2.grp)+' и добавьте в неё всех этих пользователей.','Введите машину HQ-CLI в домен.',
      'Пользователи группы '+V(m2.grp)+' могут выполнять через sudo только команды '+V(m2.sudoCmds)+'.']},
    {x:'**Сконфигурируйте файловое хранилище на HQ-SRV.**',sub:['Соберите RAID '+V(m2.raidLvl)+' из дисков '+V(m2.raidDisks)+', устройство '+V('/dev/md0')+', конфигурация в '+V('/etc/mdadm.conf')+'.',
      'Создайте файловую систему ext4 и настройте автомонтирование в '+V(m2.raidMnt)+'.',
      'Настройте NFS-сервер: каталог '+V(m2.nfsDir)+' доступен сети HQ-CLI на чтение и запись.','На HQ-CLI настройте автомонтирование этого каталога в '+V(m2.nfsMnt)+'.']},
    {x:'**Настройте службу времени chrony.** Сервер — ISP, стратум '+V(m2.ntpStratum)+'. Клиенты — HQ-RTR, BR-RTR, HQ-SRV, HQ-CLI, BR-SRV.'},
    {x:'**Сконфигурируйте Ansible на BR-SRV.**',sub:['Инвентарь '+V('/etc/ansible/hosts')+': HQ-SRV, HQ-CLI, HQ-RTR, BR-RTR.','Команда '+V('ansible all -m ping')+' отвечает pong от всех машин без предупреждений.']},
    {x:'**Разверните приложение в Docker на BR-SRV.**',sub:['Используйте образы из каталога '+V('docker')+' на диске Additional.iso.','Контейнер приложения называется '+V(m2.dockApp)+' и доступен на порту '+V(m2.dockPort)+'.',
      'Контейнер базы MariaDB: база '+V(m2.dockDb)+', пользователь '+V(m2.dockUser)+' с паролем '+V(m2.dockPass)+'.','Файл compose сохраните в домашнем каталоге root.']},
    {x:'**Разверните веб-приложение на HQ-SRV.**',sub:['Apache, PHP и MariaDB; файлы приложения возьмите из каталога '+V('web')+' на диске Additional.iso.',
      'База '+V(m2.webDb)+', пользователь '+V(m2.webUser)+' с паролем '+V(m2.webPass)+'. Загрузите в неё дамп из комплекта.']},
    {x:'**Настройте статическую трансляцию портов.**',sub:['На HQ-RTR порт '+V(m2.hqFwd)+' пробрасывается на порт 80 HQ-SRV, порт '+V(c.sshPort)+' — на порт '+V(c.sshPort)+' HQ-SRV.',
      'На BR-RTR порт '+V(m2.brFwd)+' пробрасывается на порт '+V(m2.dockPort)+' BR-SRV, порт '+V(c.sshPort)+' — на порт '+V(c.sshPort)+' BR-SRV.']},
    {x:'**Настройте обратный прокси nginx на ISP.**',sub:['Имя '+V('web.'+D)+' ведёт на веб-приложение HQ-SRV через HQ-RTR.','Имя '+V('docker.'+D)+' ведёт на приложение '+V(m2.dockApp)+' через BR-RTR.']},
    {x:'**Настройте web-аутентификацию на ISP** для '+V('web.'+D)+': логин '+V(m2.authUser)+', пароль '+V(m2.authPass)+'.'},
    {x:'**Установите Яндекс Браузер на HQ-CLI.**'}]},
    {t:'note',x:'Сведения о настройке каждого пункта занесите в отчёт.'}]);
  return head.concat([{t:'h2',x:'Задания'},{t:'ol',items:[
    {x:'**Импортируйте пользователей в домен.** Файл '+V(m3.csv)+' с диска Additional.iso загрузите в Samba на BR-SRV скриптом.'},
    {x:'**Разверните центр сертификации на HQ-SRV.**',sub:['Корневой сертификат '+V(m3.caName)+'.','Выпустите сертификаты для '+V('web.'+D)+' и '+V('docker.'+D)+' сроком на '+V(m3.certDays)+' дней.',
      'Подключите их к nginx на ISP: доступ только по HTTPS, HTTP перенаправляется.','HQ-CLI доверяет корневому сертификату, браузер открывает сайты без предупреждений.']},
    {x:'**Защитите туннель между HQ-RTR и BR-RTR с помощью IPsec** (strongSwan). Шифруется трафик GRE/IP-in-IP, ключ '+V(m3.psk)+'. OSPF продолжает работать.'},
    {x:'**Настройте межсетевой экран на HQ-RTR и BR-RTR.** Снаружи разрешены только: '+V(m3.fwAllow)+', туннель и проброшенные порты; остальной входящий трафик запрещён.'},
    {x:'**Настройте принт-сервер CUPS на HQ-SRV.**',sub:['Виртуальный PDF-принтер '+V(m3.printer)+'.','На HQ-CLI он подключён и выбран по умолчанию.']},
    {x:'**Настройте централизованное журналирование на HQ-SRV (rsyslog).**',sub:['Принимаются журналы HQ-RTR, BR-RTR и BR-SRV уровня '+V(lvlRu(m3.logLvl))+' и выше.',
      'Журналы складываются в '+V(m3.logDir+'/<имя_машины>/<имя_машины>.log')+'.','Ротация '+rotRu(m3.rotate)+' или при размере больше '+V(m3.rotSize)+', старые файлы сжимаются.']},
    {x:'**Настройте мониторинг на HQ-SRV.**',sub:['Prometheus собирает метрики HQ-SRV и BR-SRV (node_exporter), Grafana их показывает.',
      'Grafana открывается по имени '+V(m3.monName+'.'+D)+' на порту '+V('3000')+', вход '+V(m3.monUser)+' / '+V(m3.monPass)+'.']},
    {x:'**Соберите инвентаризацию через Ansible на BR-SRV.** Плейбук пишет имя и IP-адрес HQ-SRV и HQ-CLI в файлы каталога '+V(m3.pcDir)+'.'},
    {x:'**Настройте fail2ban на HQ-SRV.** После '+V(m3.f2bTries)+' неудачных попыток входа по SSH адрес блокируется на '+V(m3.f2bBan)+' секунд.'}]},
    {t:'note',x:'Сведения о настройке каждого пункта занесите в отчёт.'}]);
}
