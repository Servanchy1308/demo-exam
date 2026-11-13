// ===== «Быстрое решение»: вид блока «Решение» модуля 1 =====
// Короткая форма → таблица адресов и готовые команды. Стенд: ISP и роутеры на Astra, серверы и HQ-CLI на Альт.
const QUICK=(function(){
const QKEY='degen.quick.v1';
const QF=[
  ['Сети из задания',[['NET_ISP_HQ','ISP ↔ HQ-RTR','172.16.1.0/28'],['NET_ISP_BR','ISP ↔ BR-RTR','172.16.2.0/28'],['NET_SRV','Сеть HQ-SRV','192.168.90.0/27'],
    ['NET_CLI','Сеть HQ-CLI','192.168.10.0/28'],['NET_MGMT','Сеть управления','192.168.40.0/29'],['NET_BR','Сеть BR-SRV','192.168.30.0/28'],['NET_TUN','Сеть туннеля','10.10.10.0/30']]],
  ['VLAN',[['VLAN_SRV','VLAN HQ-SRV','100'],['VLAN_CLI','VLAN HQ-CLI','200'],['VLAN_MGMT','VLAN управления','999']]],
  ['Пользователи и SSH',[['ADM','Логин роутеров','net_admin'],['ADM_PASS','Пароль роутеров','P@ssw0rd'],['SU','Логин серверов','sshuser'],['SU_UID','UID','2027'],
    ['SU_PASS','Пароль серверов','P@ssw0rd'],['SSH_PORT','Порт SSH','2027'],['SSH_TRIES','Попыток входа','2'],['BANNER','Баннер','Authorized access only']]],
  ['Остальное',[['OSPF_PASS','Пароль OSPF','P@ssw0rd'],['DOMAIN','Домен','au-team.irpo'],['TZ','Часовой пояс','Europe/Moscow'],['DNS1','DNS пересылки 1','77.88.8.7'],['DNS2','DNS пересылки 2','77.88.8.3']]],
  ['Интерфейсы стенда (ip -br a)',[['ISP_WAN','ISP: наружу','eth0'],['ISP_HQ','ISP: к HQ-RTR','eth1'],['ISP_BR','ISP: к BR-RTR','eth2'],
    ['RTR_WAN','Роутеры: к ISP','eth0'],['RTR_LAN','Роутеры: в офис','eth1'],['SRV_IF','Серверы','enp0s3'],['CLI_IF','HQ-CLI','enp0s3']]]
];
const QDEF={}; QF.forEach(([,fs])=>fs.forEach(([k,,d])=>QDEF[k]=d));
let Q=Object.assign({},QDEF,store.get(QKEY,{}));
const qsave=()=>store.set(QKEY,Q);
const sq = s => "'"+String(s).replace(/'/g,"'\\''")+"'";   // одинарные кавычки для bash

// ---------- вариант → поля ----------
function fromVariant(c){
  const r=compute(c); if(!r.ok) return 'Вариант не посчитался';
  const n=s=>{ const x=parseCidr(s); return x?x.cidr:s };
  Object.assign(Q,{NET_ISP_HQ:n(c.netIspHq),NET_ISP_BR:n(c.netIspBr),NET_SRV:r.lans.srv.cidr,NET_CLI:r.lans.cli.cidr,NET_MGMT:r.lans.mgmt.cidr,NET_BR:r.lans.br.cidr,
    NET_TUN:n(c.netTun),VLAN_SRV:c.srvVid,VLAN_CLI:c.cliVid,VLAN_MGMT:c.mgmtVid,ADM:c.adm,ADM_PASS:c.admPass,SU:c.su,SU_UID:c.uid,SU_PASS:c.suPass,
    SSH_PORT:c.sshPort,SSH_TRIES:c.maxTries,BANNER:c.banner,OSPF_PASS:c.ospfPass,DOMAIN:c.dom,TZ:c.tz,DNS1:c.fwd1,DNS2:c.fwd2});
  qsave(); return ''
}
function fromCode(code){ const p=parseCode(code); if(!p) return 'Код выглядит так: R-12, D-1, X-7'; return fromVariant(makeVariant(p.lv,p.num,p.mask)) }

// ---------- расчёт ----------
function qcalc(){
  const E=[], N={};
  ['NET_ISP_HQ','NET_ISP_BR','NET_SRV','NET_CLI','NET_MGMT','NET_BR','NET_TUN'].forEach(k=>{
    const x=parseCidr(Q[k]); if(!x){ E.push(k+': нужен формат 192.168.1.0/28'); return }
    if(!x.aligned) E.push(k+': '+Q[k]+' — не адрес сети, должно быть '+x.cidr); N[k]=x });
  if(E.length) return {E};
  const all=Object.entries(N);
  for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){ const [a,x]=all[i],[b,y]=all[j]; if(x.net<=y.bc&&y.net<=x.bc) E.push('Сети пересекаются: '+a+' и '+b) }
  ['VLAN_SRV','VLAN_CLI','VLAN_MGMT'].forEach(k=>{ if(!(/^\d+$/.test(Q[k])&&+Q[k]>=1&&+Q[k]<=4094)) E.push(k+': номер от 1 до 4094') });
  Object.keys(QDEF).forEach(k=>{ if(!String(Q[k]||'').trim()) E.push(k+': не заполнено'); else if(/[^\x20-\x7E]/.test(Q[k])) E.push(k+': только латиница') });
  if(N.NET_CLI&&N.NET_CLI.size<8) E.push('Сеть HQ-CLI слишком маленькая для DHCP');
  if(E.length) return {E};
  const ih=N.NET_ISP_HQ, ib=N.NET_ISP_BR, s=N.NET_SRV, cl=N.NET_CLI, m=N.NET_MGMT, b=N.NET_BR, t=N.NET_TUN, hp=(x,i)=>x.h(i)+'/'+x.p;
  return {E, N, A:{ispHq:hp(ih,1),ispBr:hp(ib,1),hqWan:hp(ih,2),hqWanIp:ih.h(2),hqGw:ih.h(1),brWan:hp(ib,2),brWanIp:ib.h(2),brGw:ib.h(1),
    hqSrvGw:hp(s,1),hqCliGw:hp(cl,1),hqMgmt:hp(m,1),brLan:hp(b,1),hqSrv:hp(s,2),brSrv:hp(b,2),
    tunHq:t.h(1),tunBr:t.h(2),tunMask:t.mask,cliIp:cl.h(2),dhcpFrom:cl.h(3),dhcpTo:n2ip(cl.bc-1),cliMask:cl.mask,
    netsHq:[t,s,cl,m].map(x=>x.cidr),netsBr:[t,b].map(x=>x.cidr)}}
}

// ---------- команды по машинам ----------
function qcmds(A){
  const V=Q, D=V.DOMAIN, ip=x=>x.split('/')[0];
  const name=(h,astra)=>'hostnamectl set-hostname '+h+'.'+D+(astra?"\nsed -i 's/^127.0.1.1.*/127.0.1.1 "+h+'.'+D+' '+h+"/' /etc/hosts":'')+'\ntimedatectl set-timezone '+V.TZ;
  const fwd='echo net.ipv4.ip_forward=1 >> /etc/sysctl.conf\nsysctl -p';
  const adm='useradd -m -s /bin/bash '+V.ADM+'\necho '+sq(V.ADM+':'+V.ADM_PASS)+' | chpasswd\necho '+sq(V.ADM+' ALL=(ALL:ALL) NOPASSWD: ALL')+' > /etc/sudoers.d/'+V.ADM+'\nchmod 440 /etc/sudoers.d/'+V.ADM;
  const tun=(adr,loc,rem)=>'\nauto gre1\niface gre1 inet tunnel\n mode gre\n address '+adr+'\n netmask '+A.tunMask+'\n local '+loc+'\n endpoint '+rem+'\n ttl 64';
  const wan=(adr,gw)=>'auto lo\niface lo inet loopback\n\nauto '+V.RTR_WAN+'\niface '+V.RTR_WAN+' inet static\n address '+adr+'\n gateway '+gw+'\n post-up iptables -t nat -A POSTROUTING -o '+V.RTR_WAN+' -j MASQUERADE\n';
  const vlan=(id,adr)=>'\nauto vlan'+id+'\niface vlan'+id+' inet static\n pre-up ip link add link '+V.RTR_LAN+' name vlan'+id+' type vlan id '+id+' || true\n address '+adr+'\n';
  const ssh='useradd -m -u '+V.SU_UID+' '+V.SU+'\necho '+sq(V.SU+':'+V.SU_PASS)+' | chpasswd\nusermod -aG wheel '+V.SU+'\ncontrol sudo public\necho '+sq(V.SU+' ALL=(ALL:ALL) NOPASSWD: ALL')+' > /etc/sudoers.d/'+V.SU+
    '\nchmod 440 /etc/sudoers.d/'+V.SU+'\n\necho '+sq(V.BANNER)+" > /etc/openssh/banner\nsed -i -E '/^#?(Port|AllowUsers|MaxAuthTries|Banner) /d' /etc/openssh/sshd_config\ncat >> /etc/openssh/sshd_config <<EOF\nPort "+V.SSH_PORT+
    '\nAllowUsers '+V.SU+'\nMaxAuthTries '+V.SSH_TRIES+'\nBanner /etc/openssh/banner\nEOF\nsystemctl restart sshd';
  const etc=(dir,opts)=>'mkdir -p /etc/net/ifaces/'+dir+'\ncat > /etc/net/ifaces/'+dir+'/options <<EOF\n'+opts+'BOOTPROTO=static\nDISABLED=no\nNM_CONTROLLED=no\nCONFIG_IPV4=yes\nEOF';
  const ospf=(h,rid,nets)=>'apt update\napt install -y frr\n\nsed -i \'s/^ospfd=no/ospfd=yes/\' /etc/frr/daemons\ncat > /etc/frr/frr.conf <<EOF\nhostname '+h+'\n!\ninterface gre1\n ip ospf network point-to-point\n ip ospf authentication message-digest\n ip ospf message-digest-key 1 md5 '+V.OSPF_PASS+
    '\n!\nrouter ospf\n ospf router-id '+rid+'\n passive-interface default\n no passive-interface gre1\n'+nets.map(n=>' network '+n+' area 0').join('\n')+'\n area 0 authentication message-digest\n!\nEOF\nsystemctl enable frr\nsystemctl restart frr';
  const PATHFIX='export PATH=$PATH:/sbin:/usr/sbin';
  return [
    ['ISP','Astra · sudo -i · 1-й проход',name('isp',1)+'\nsystemctl disable --now NetworkManager\n\ncat > /etc/network/interfaces <<EOF\nauto lo\niface lo inet loopback\n\nauto '+V.ISP_WAN+'\niface '+V.ISP_WAN+' inet dhcp\n post-up iptables -t nat -A POSTROUTING -o '+V.ISP_WAN+' -j MASQUERADE\n\nauto '+V.ISP_HQ+'\niface '+V.ISP_HQ+' inet static\n address '+A.ispHq+'\n\nauto '+V.ISP_BR+'\niface '+V.ISP_BR+' inet static\n address '+A.ispBr+'\nEOF\n\n'+fwd+'\nsystemctl restart networking',
      'ping -c2 '+V.DNS1],
    ['HQ-RTR','Astra · sudo -i · 1-й проход',name('hq-rtr',1)+'\nsystemctl disable --now NetworkManager\n\ncat > /etc/network/interfaces <<EOF\n'+wan(A.hqWan,A.hqGw)+'\nauto '+V.RTR_LAN+'\niface '+V.RTR_LAN+' inet manual\n up ip link set '+V.RTR_LAN+' up\n'+
      vlan(V.VLAN_SRV,A.hqSrvGw)+vlan(V.VLAN_CLI,A.hqCliGw)+vlan(V.VLAN_MGMT,A.hqMgmt)+tun(A.tunHq,A.hqWanIp,A.brWanIp)+'\nEOF\n\n'+fwd+'\necho nameserver '+V.DNS1+' > /etc/resolv.conf\n\n'+adm+'\n\nsystemctl restart networking',
      'ping -c2 '+A.tunBr+'   # после BR-RTR'],
    ['BR-RTR','Astra · sudo -i · 1-й проход',name('br-rtr',1)+'\nsystemctl disable --now NetworkManager\n\ncat > /etc/network/interfaces <<EOF\n'+wan(A.brWan,A.brGw)+'\nauto '+V.RTR_LAN+'\niface '+V.RTR_LAN+' inet static\n address '+A.brLan+'\n'+
      tun(A.tunBr,A.brWanIp,A.hqWanIp)+'\nEOF\n\n'+fwd+'\necho nameserver '+V.DNS1+' > /etc/resolv.conf\n\n'+adm+'\n\nsystemctl restart networking',
      'ping -c2 '+A.tunHq],
    ['HQ-SRV','Альт · su - · 1-й проход',PATHFIX+'\n'+name('hq-srv')+'\n\n'+etc(V.SRV_IF,'TYPE=eth\n')+'\n\n'+etc('vlan'+V.VLAN_SRV,'TYPE=vlan\nHOST='+V.SRV_IF+'\nVID='+V.VLAN_SRV+'\n')+
      '\necho '+A.hqSrv+' > /etc/net/ifaces/vlan'+V.VLAN_SRV+'/ipv4address\necho default via '+ip(A.hqSrvGw)+' > /etc/net/ifaces/vlan'+V.VLAN_SRV+'/ipv4route\necho nameserver '+V.DNS1+' > /etc/net/ifaces/vlan'+V.VLAN_SRV+'/resolv.conf\nsystemctl restart network\n\n'+ssh,
      'ping -c2 '+V.DNS1],
    ['BR-SRV','Альт · su - · 1-й проход',PATHFIX+'\n'+name('br-srv')+'\n\n'+etc(V.SRV_IF,'TYPE=eth\n')+'\necho '+A.brSrv+' > /etc/net/ifaces/'+V.SRV_IF+'/ipv4address\necho default via '+ip(A.brLan)+' > /etc/net/ifaces/'+V.SRV_IF+
      '/ipv4route\necho nameserver '+V.DNS1+' > /etc/net/ifaces/'+V.SRV_IF+'/resolv.conf\nsystemctl restart network\n\n'+ssh,
      'ping -c2 '+V.DNS1],
    ['HQ-RTR','2-й проход: OSPF и DHCP',ospf('hq-rtr',A.tunHq,A.netsHq)+'\n\napt install -y dnsmasq\ncat > /etc/dnsmasq.conf <<EOF\nport=0\ninterface=vlan'+V.VLAN_CLI+'\ndhcp-range='+A.dhcpFrom+','+A.dhcpTo+','+A.cliMask+',12h\ndhcp-host=hq-cli,'+A.cliIp+
      '\ndhcp-option=3,'+ip(A.hqCliGw)+'\ndhcp-option=6,'+ip(A.hqSrv)+'\ndomain='+D+'\ndhcp-option=15,'+D+'\nEOF\nsystemctl enable dnsmasq\nsystemctl restart dnsmasq',
      'vtysh -c "show ip ospf neighbor"'],
    ['BR-RTR','2-й проход: OSPF',ospf('br-rtr',A.tunBr,A.netsBr),'vtysh -c "show ip ospf neighbor"'],
    ['HQ-SRV','2-й проход: DNS',PATHFIX+'\napt-get update\napt-get install -y dnsmasq\ncat > /etc/dnsmasq.conf <<EOF\nno-resolv\nserver='+V.DNS1+'\nserver='+V.DNS2+'\ndomain='+D+
      '\naddress=/hq-rtr.'+D+'/'+ip(A.hqSrvGw)+'\nhost-record=hq-srv.'+D+','+ip(A.hqSrv)+'\naddress=/hq-cli.'+D+'/'+A.cliIp+'\naddress=/br-rtr.'+D+'/'+ip(A.brLan)+'\nhost-record=br-srv.'+D+','+ip(A.brSrv)+
      '\naddress=/docker.'+D+'/'+ip(A.ispHq)+'\naddress=/web.'+D+'/'+ip(A.ispBr)+'\nEOF\nsystemctl enable dnsmasq\nsystemctl restart dnsmasq\n\necho nameserver 127.0.0.1 > /etc/net/ifaces/vlan'+V.VLAN_SRV+'/resolv.conf\necho search '+D+' >> /etc/net/ifaces/vlan'+V.VLAN_SRV+'/resolv.conf\nsystemctl restart network',
      'nslookup br-srv.'+D+' 127.0.0.1'],
    ['HQ-CLI','Альт РС · su - · последним',PATHFIX+'\n'+name('hq-cli')+"\n\nnmcli -g UUID,TYPE con show | grep ethernet | cut -d: -f1 | xargs -r -n1 nmcli con delete\nnmcli con add type ethernet con-name lan ifname "+V.CLI_IF+' ipv4.method disabled ipv6.method ignore\nnmcli con add type vlan con-name vlan'+V.VLAN_CLI+' ifname vlan'+V.VLAN_CLI+' dev '+V.CLI_IF+' id '+V.VLAN_CLI+
      ' ipv4.method auto\nnmcli con mod vlan'+V.VLAN_CLI+' ipv4.dhcp-hostname hq-cli\nnmcli con up lan\nnmcli con up vlan'+V.VLAN_CLI,
      'ip -br a   # vlan'+V.VLAN_CLI+' = '+A.cliIp]
  ];
}

// ---------- отрисовка в контейнер ----------
let box=null;
function mount(el, curVariant){
  box=el;
  if(!store.get(QKEY,null) && curVariant) fromVariant(curVariant);   // первый раз: значения текущего варианта страницы
  el.innerHTML='<div class="qk"><div class="ef qk-entry"><label for="qkCode"><b>Код варианта</b></label><input id="qkCode" class="bigin" placeholder="R-12" spellcheck="false" autocomplete="off">'+
    '<button type="button" class="btn primary" id="qkGo">Заполнить</button>'+(curVariant?'<button type="button" class="btn" id="qkCur">Из текущего варианта</button>':'')+
    '<span class="hint">или впишите значения из текста варианта вручную</span></div>'+
    '<div class="qgrid">'+QF.map(([g,fs])=>'<fieldset><legend>'+esc(g)+'</legend>'+
    fs.map(([k,l])=>'<label><span>'+esc(l)+'</span><input data-k="'+k+'" value="'+esc(Q[k])+'" spellcheck="false" autocomplete="off"></label>').join('')+'</fieldset>').join('')+'</div>'+
    '<div id="qkOut"></div></div>';
  const go=()=>{ const v=el.querySelector('#qkCode').value.trim(), e=fromCode(v); if(e){ toast(e); return } mount(el,curVariant); toast('Подставлен вариант '+v.toUpperCase()) };
  el.querySelector('#qkGo').addEventListener('click',go); el.querySelector('#qkCode').addEventListener('keydown',e=>{ if(e.key==='Enter') go() });
  const cur=el.querySelector('#qkCur'); if(cur) cur.addEventListener('click',()=>{ const e=fromVariant(curVariant); if(e){ toast(e); return } mount(el,curVariant); toast('Подставлены значения текущего варианта') });
  el.querySelectorAll('input[data-k]').forEach(i=>i.addEventListener('input',()=>{ Q[i.dataset.k]=i.value.trim(); qsave(); out() }));
  out();
}
function out(){
  const R=qcalc(), el=box.querySelector('#qkOut');
  if(R.E.length){ el.innerHTML='<div class="msg err"><b>Проверьте значения</b><ul>'+R.E.map(e=>'<li>'+esc(e)+'</li>').join('')+'</ul></div>'; return }
  const A=R.A, V=Q, ip=x=>x.split('/')[0];
  const rows=[['ISP',V.ISP_HQ+' '+A.ispHq+', '+V.ISP_BR+' '+A.ispBr,'DHCP'],
    ['HQ-RTR',A.hqWan+'; vlan'+V.VLAN_SRV+' '+A.hqSrvGw+'; vlan'+V.VLAN_CLI+' '+A.hqCliGw+'; vlan'+V.VLAN_MGMT+' '+A.hqMgmt+'; gre1 '+A.tunHq+'/'+R.N.NET_TUN.p,A.hqGw],
    ['BR-RTR',A.brWan+'; '+A.brLan+'; gre1 '+A.tunBr+'/'+R.N.NET_TUN.p,A.brGw],['HQ-SRV',A.hqSrv+' (vlan'+V.VLAN_SRV+')',ip(A.hqSrvGw)],
    ['HQ-CLI',A.cliIp+'/'+R.N.NET_CLI.p+' (DHCP, vlan'+V.VLAN_CLI+')',ip(A.hqCliGw)],['BR-SRV',A.brSrv,ip(A.brLan)]];
  const cmds=qcmds(A);
  el.innerHTML='<h3 class="wk-h3">Таблица адресов <small>для отчёта, п. 1</small></h3><div class="tblx"><table class="wikitable"><thead><tr><th>Устройство</th><th>IP-адрес</th><th>Шлюз</th></tr></thead><tbody>'+
    rows.map(r=>'<tr><td>'+r.map(esc).join('</td><td>')+'</td></tr>').join('')+'</tbody></table></div>'+
    '<p class="sub">DHCP для HQ-CLI: '+esc(A.dhcpFrom+' – '+A.dhcpTo)+'. OSPF на HQ-RTR объявляет: '+esc(A.netsHq.join(', '))+'.</p>'+
    '<h3 class="wk-h3">Команды по машинам <small>по порядку; 2-й проход после ping '+esc(V.DNS1)+' с роутеров</small></h3><div class="qcmds">'+
    cmds.map(([m,sub,code,chk],i)=>'<div class="blk"><div class="mh"><span>'+(i+1)+'. '+esc(m)+' <small>· '+esc(sub)+'</small></span><button type="button" class="lnk" data-q="'+i+'">Копировать</button></div><pre tabindex="0">'+esc(code)+'</pre>'+
      '<div class="sub">Проверка: <code>'+esc(chk)+'</code></div></div>').join('')+'</div>';
  el.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>copyText(cmds[+b.dataset.q][2],b)));
}
return {mount, qcalc, qcmds, fromCode, get:()=>Q, set:v=>{ Q=v }, QDEF};
})();
