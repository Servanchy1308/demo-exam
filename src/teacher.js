// ===== teacher page =====
const KEY='degen.v3';
const STUDENT_URL='__STUDENT_URL__';

// ---------- script fragments (shared by scripts, manual solution and report) ----------
function users(user, uid, pass, alt){
  return `id ${user} >/dev/null 2>&1 || `+(uid?`useradd -m -u ${uid} ${user}`:`useradd -m -s /bin/bash ${user}`)+`
echo '${user}:${pass}' | chpasswd
`+(alt?`usermod -aG wheel ${user}
control sudo public
`:'')+`echo '${user} ALL=(ALL:ALL) NOPASSWD: ALL' > /etc/sudoers.d/${user}
chmod 440 /etc/sudoers.d/${user}`;
}
function sshBlock(c){
  return `echo ${c.banner} > /etc/openssh/banner
sed -i -E '/^#?(Port|AllowUsers|MaxAuthTries|Banner) /d' /etc/openssh/sshd_config
cat >> /etc/openssh/sshd_config <<EOF
Port ${c.sshPort}
AllowUsers ${c.su}
MaxAuthTries ${c.maxTries}
Banner /etc/openssh/banner
EOF
systemctl restart sshd`;
}
const ospfConf=(short,rid,nets,c)=>`hostname ${short}
!
interface gre1
 ip ospf network point-to-point
 ip ospf authentication message-digest
 ip ospf message-digest-key 1 md5 ${c.ospfPass}
!
router ospf
 ospf router-id ${rid}
 passive-interface default
 no passive-interface gre1
${nets.map(n=>' network '+n+' area 0').join('\n')}
 area 0 authentication message-digest
!`;
function ospfAstra(short,rid,nets,c){
  return `grep -q orel /etc/apt/sources.list || echo 'deb http://dl.astralinux.ru/astra/stable/orel/repository orel main contrib non-free' >> /etc/apt/sources.list
apt update
apt install -y frr || apt install -y quagga

OSPF='${ospfConf(short,rid,nets,c)}'

if [ -d /etc/frr ]; then
 sed -i 's/^ospfd=no/ospfd=yes/' /etc/frr/daemons
 echo "$OSPF" > /etc/frr/frr.conf
 systemctl enable frr
 systemctl restart frr
else
 echo 'hostname ${short}' > /etc/quagga/zebra.conf
 echo "$OSPF" > /etc/quagga/ospfd.conf
 sed -i 's/^zebra=no/zebra=yes/; s/^ospfd=no/ospfd=yes/' /etc/quagga/daemons 2>/dev/null
 chown quagga:quagga /etc/quagga/*.conf
 systemctl enable zebra ospfd 2>/dev/null
 systemctl restart zebra ospfd 2>/dev/null || systemctl restart quagga
fi`;
}
function ospfAlt(short,rid,nets,c){
  return `apt-get update
apt-get install -y frr
sed -i 's/^ospfd=no/ospfd=yes/' /etc/frr/daemons
cat > /etc/frr/frr.conf <<'EOF'
${ospfConf(short,rid,nets,c)}
EOF
systemctl enable frr
systemctl restart frr`;
}
const altIf=(name,opts,addr,route)=>`mkdir -p /etc/net/ifaces/${name}
rm -f /etc/net/ifaces/${name}/ipv4address /etc/net/ifaces/${name}/ipv4route
cat > /etc/net/ifaces/${name}/options <<EOF
${opts}DISABLED=no
NM_CONTROLLED=no
CONFIG_IPV4=yes
EOF`+(addr?`\necho ${addr} > /etc/net/ifaces/${name}/ipv4address`:'')+(route?`\necho default via ${route} > /etc/net/ifaces/${name}/ipv4route`:'');
const CHK=`chk(){ if eval "$2" >/dev/null 2>&1; then echo "[ OK ] $1"; else echo "[FAIL] $1"; fi; }`;

function frags(c,st,r){
  const A=addrs(c,r), {ispHq,ispBr,tun,lans}=r, s=lans.srv, cl=lans.cli, m=lans.mgmt, b=lans.br, D=c.dom, alt=st.rtrOs==='alt';
  const natPost = `post-up iptables -t nat -C POSTROUTING -o $WAN -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -o $WAN -j MASQUERADE`;
  const F={A,alt};
  F.head = short => alt ? `hostnamectl set-hostname ${short}.${D}
timedatectl set-timezone ${c.tz}
systemctl disable --now NetworkManager 2>/dev/null` : `hostnamectl set-hostname ${short}.${D}
sed -i 's/^127.0.1.1.*/127.0.1.1 ${short}.${D} ${short}/' /etc/hosts
timedatectl set-timezone ${c.tz}
systemctl disable --now NetworkManager network-manager 2>/dev/null`;
  F.fwd = alt ? `sed -i 's/^net.ipv4.ip_forward.*/net.ipv4.ip_forward = 1/' /etc/net/sysctl.conf
grep -q '^net.ipv4.ip_forward = 1' /etc/net/sysctl.conf || echo 'net.ipv4.ip_forward = 1' >> /etc/net/sysctl.conf
sysctl -w net.ipv4.ip_forward=1` : `grep -q '^net.ipv4.ip_forward=1' /etc/sysctl.conf || echo net.ipv4.ip_forward=1 >> /etc/sysctl.conf
sysctl -p`;
  F.natAlt = `command -v iptables >/dev/null || { apt-get update; apt-get install -y iptables; }
iptables -t nat -C POSTROUTING -o $WAN -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -o $WAN -j MASQUERADE
iptables-save > /etc/sysconfig/iptables
systemctl enable iptables`;
  F.ispNet = alt ? [altIf('$WAN','TYPE=eth\nBOOTPROTO=dhcp\n'), altIf('$HQ','TYPE=eth\nBOOTPROTO=static\n',A.ispHq+'/'+ispHq.p), altIf('$BR','TYPE=eth\nBOOTPROTO=static\n',A.ispBr+'/'+ispBr.p)].join('\n\n') :
`cat > /etc/network/interfaces <<EOF
auto lo
iface lo inet loopback

auto $WAN
iface $WAN inet dhcp
 ${natPost}

auto $HQ
iface $HQ inet static
 address ${A.ispHq}/${ispHq.p}

auto $BR
iface $BR inet static
 address ${A.ispBr}/${ispBr.p}
EOF`;
  F.rtrBase = side => { const hq=side==='hq', w=hq?A.hqWan:A.brWan, wp=hq?ispHq.p:ispBr.p, gw=hq?A.ispHq:A.ispBr;
    if(alt) return altIf('$WAN','TYPE=eth\nBOOTPROTO=static\n',w+'/'+wp,gw)+`\necho nameserver ${c.fwd1} > /etc/net/ifaces/$WAN/resolv.conf\n\n`+
      (hq?altIf('$LAN','TYPE=eth\nBOOTPROTO=static\n'):altIf('$LAN','TYPE=eth\nBOOTPROTO=static\n',A.brGw+'/'+b.p));
    return `cat > /etc/network/interfaces <<EOF
auto lo
iface lo inet loopback

auto $WAN
iface $WAN inet static
 address ${w}/${wp}
 gateway ${gw}
 ${natPost}

auto $LAN
`+(hq?`iface $LAN inet manual
 up ip link set $LAN up`:`iface $LAN inet static
 address ${A.brGw}/${b.p}`)+`
EOF`; };
  F.vlans = alt ? [[c.srvVid,A.hqSrvGw,s.p],[c.cliVid,A.hqCliGw,cl.p],[c.mgmtVid,A.hqMg,m.p]].map(([v,a,p])=>altIf('vlan'+v,'TYPE=vlan\nHOST=$LAN\nVID='+v+'\nBOOTPROTO=static\n',a+'/'+p)).join('\n\n') :
    'cat >> /etc/network/interfaces <<EOF\n'+[[c.srvVid,A.hqSrvGw,s.p],[c.cliVid,A.hqCliGw,cl.p],[c.mgmtVid,A.hqMg,m.p]].map(([v,a,p])=>`
auto vlan${v}
iface vlan${v} inet static
 pre-up ip link add link $LAN name vlan${v} type vlan id ${v} || true
 address ${a}/${p}`).join('\n')+'\nEOF';
  F.tunnel = side => { const hq=side==='hq', me=hq?A.tHq:A.tBr, lo=hq?A.hqWan:A.brWan, rem=hq?A.brWan:A.hqWan;
    if(alt) return altIf('gre1','TYPE=iptun\nTUNTYPE='+c.tun+'\nTUNLOCAL='+lo+'\nTUNREMOTE='+rem+"\nTUNOPTIONS='ttl 64'\nHOST=$WAN\nBOOTPROTO=static\n",me+'/'+tun.p);
    return `cat >> /etc/network/interfaces <<EOF

auto gre1
iface gre1 inet tunnel
 mode ${c.tun}
 address ${me}
 netmask ${tun.mask}
 local ${lo}
 endpoint ${rem}
 ttl 64
EOF`; };
  F.rtrFinish = alt ? F.fwd+'\nsystemctl restart network\nsleep 3\n'+F.natAlt : F.fwd+`\necho nameserver ${c.fwd1} > /etc/resolv.conf`;
  F.ospf = side => side==='hq' ? (alt?ospfAlt:ospfAstra)('hq-rtr',A.tHq,[tun.cidr,s.cidr,cl.cidr,m.cidr],c) : (alt?ospfAlt:ospfAstra)('br-rtr',A.tBr,[tun.cidr,b.cidr],c);
  F.dhcp = (alt?'apt-get install -y dnsmasq':'apt install -y dnsmasq')+`
cat > /etc/dnsmasq.conf <<EOF
port=0
interface=vlan${c.cliVid}
dhcp-range=${A.dhcpFrom},${A.dhcpTo},${cl.mask},12h
dhcp-host=hq-cli,${A.hqCli}
dhcp-option=3,${A.hqCliGw}
dhcp-option=6,${A.hqSrv}
domain=${D}
dhcp-option=15,${D}
EOF
systemctl enable dnsmasq
systemctl restart dnsmasq`;
  F.srvHead = short => `hostnamectl set-hostname ${short}.${D}
timedatectl set-timezone ${c.tz}`;
  F.srvNet = side => side==='hq' ? altIf('$IF','TYPE=eth\nBOOTPROTO=static\n')+'\n\n'+altIf('vlan'+c.srvVid,'TYPE=vlan\nHOST=$IF\nVID='+c.srvVid+'\nBOOTPROTO=static\n',A.hqSrv+'/'+s.p,A.hqSrvGw)+
      `\necho nameserver ${c.fwd1} > /etc/net/ifaces/vlan${c.srvVid}/resolv.conf\nsystemctl restart network`
    : altIf('$IF','TYPE=eth\nBOOTPROTO=static\n',A.brSrv+'/'+b.p,A.brGw)+`
echo nameserver ${A.hqSrv} > /etc/net/ifaces/$IF/resolv.conf
echo nameserver ${c.fwd1} >> /etc/net/ifaces/$IF/resolv.conf
echo search ${D} >> /etc/net/ifaces/$IF/resolv.conf
systemctl restart network`;
  F.cli = `nmcli -g UUID,TYPE con show | grep ethernet | cut -d: -f1 | xargs -r -n1 nmcli con delete
nmcli con delete vlan${c.cliVid} 2>/dev/null
nmcli con add type ethernet con-name lan ifname $IF ipv4.method disabled ipv6.method ignore
nmcli con add type vlan con-name vlan${c.cliVid} ifname vlan${c.cliVid} dev $IF id ${c.cliVid} ipv4.method auto
nmcli con mod vlan${c.cliVid} ipv4.dhcp-hostname hq-cli
nmcli con up lan
nmcli con up vlan${c.cliVid}`;
  F.dns = `apt-get update
apt-get install -y dnsmasq

cat > /etc/dnsmasq.conf <<EOF
no-resolv
server=${c.fwd1}
server=${c.fwd2}
domain=${D}
host-record=hq-rtr.${D},${A.hqSrvGw}
host-record=hq-srv.${D},${A.hqSrv}
host-record=hq-cli.${D},${A.hqCli}
address=/br-rtr.${D}/${A.brGw}
address=/br-srv.${D}/${A.brSrv}
address=/docker.${D}/${A.docker}
address=/web.${D}/${A.web}
EOF
systemctl enable dnsmasq
systemctl restart dnsmasq

echo nameserver 127.0.0.1 > /etc/net/ifaces/vlan${c.srvVid}/resolv.conf
echo search ${D} >> /etc/net/ifaces/vlan${c.srvVid}/resolv.conf
systemctl restart network`;
  return F;
}

// ---------- solution scripts ----------
function wrap(out,st){
  const autoReboot = st.autoReboot==='yes';
  out.forEach(x=>{
    const body=x.text.replace(/\necho DONE - now type: reboot\n$/, '\necho DONE\n');
    const rb = autoReboot && /now type: reboot/.test(x.text);
    x.text='set +H\ncat > /root/'+x.sh+" << 'EOF_FINAL'\n"+body+'EOF_FINAL\nbash /root/'+x.sh+(rb?' && reboot':'')+'\n';
  });
  return out;
}
function gen(c,st,r){
  const F=frags(c,st,r), A=F.A, osTag=F.alt?'ALT Server':'Astra Linux CE', out=[];
  const rtr=(id,side,name,short,vm,when)=>({id,vm,machine:name,sh:short+'.sh',title:'Базовая настройка '+name,when,text:
`#!/bin/bash
# ${name} (${osTag}). Check names: ip -br a
WAN=${side==='hq'?st.ifHqWan:st.ifBrWan}
LAN=${side==='hq'?st.ifHqLan:st.ifBrLan}

${F.head(short)}

${F.rtrBase(side)}
${side==='hq'?'\n'+F.vlans+'\n':''}
${F.tunnel(side)}

${F.rtrFinish}

${users(c.adm,'',c.admPass,F.alt)}

echo DONE - now type: reboot
`});
  out.push({id:'isp',vm:st.vmIsp,machine:'ISP',sh:'isp.sh',title:'Базовая настройка ISP',when:'Первым, затем reboot',text:
`#!/bin/bash
# ISP (${osTag}). Check names: ip -br a
WAN=${st.ifIspWan}
HQ=${st.ifIspHq}
BR=${st.ifIspBr}

${F.head('isp')}

${F.ispNet}

${F.alt?F.fwd+'\nsystemctl restart network\nsleep 5\n'+F.natAlt:F.fwd}

echo DONE - now type: reboot
`});
  out.push(rtr('hqrtr','hq','HQ-RTR','hq-rtr',st.vmHqRtr,'После ISP, затем reboot'));
  out.push(rtr('brrtr','br','BR-RTR','br-rtr',st.vmBrRtr,'После HQ-RTR, затем reboot'));
  const srv=(id,side,name,short,vm)=>({id,vm,machine:name,sh:short+'.sh',title:'Базовая настройка '+name,when:'После роутеров, затем reboot',text:
`#!/bin/bash
# ${name} (ALT Server). Check name: ip -br a
IF=${st.ifSrv}

${F.srvHead(short)}

${F.srvNet(side)}

${users(c.su,c.uid,c.suPass,true)}

${sshBlock(c)}

echo DONE - now type: reboot
`});
  out.push(srv('hqsrv','hq','HQ-SRV','hq-srv',st.vmHqSrv));
  out.push(srv('brsrv','br','BR-SRV','br-srv',st.vmBrSrv));
  const waitOspf=`for i in $(seq 1 12); do vtysh -c "show ip ospf neighbor" 2>/dev/null | grep -q Full && break; sleep 5; done`;
  out.push({id:'hqrtr2',vm:st.vmHqRtr,machine:'HQ-RTR',sh:'hq-rtr-2.sh',title:'OSPF и DHCP на HQ-RTR',when:'Когда ping '+c.fwd1+' проходит',text:
`#!/bin/bash
# HQ-RTR step 2: OSPF + DHCP. Needs internet (ping ${c.fwd1})

${F.ospf('hq')}

${F.dhcp}

echo Waiting for OSPF neighbor...
${waitOspf}
${CHK}
chk "internet ${c.fwd1}" "ping -c1 -W3 ${c.fwd1}"
chk "tunnel peer ${A.tBr}" "ping -c1 -W2 ${A.tBr}"
chk "ospf neighbor Full" "vtysh -c 'show ip ospf neighbor' | grep -q Full"
chk "route to ${r.lans.br.cidr}" "ip route | grep -q '^${r.lans.br.cidr} '"
chk "dhcp listening" "ss -lun | grep -q ':67 '"
echo DONE
`});
  out.push({id:'brrtr2',vm:st.vmBrRtr,machine:'BR-RTR',sh:'br-rtr-2.sh',title:'OSPF на BR-RTR',when:'Когда ping '+c.fwd1+' проходит',text:
`#!/bin/bash
# BR-RTR step 2: OSPF. Needs internet (ping ${c.fwd1})

${F.ospf('br')}

echo Waiting for OSPF neighbor...
${waitOspf}
${CHK}
chk "internet ${c.fwd1}" "ping -c1 -W3 ${c.fwd1}"
chk "tunnel peer ${A.tHq}" "ping -c1 -W2 ${A.tHq}"
chk "ospf neighbor Full" "vtysh -c 'show ip ospf neighbor' | grep -q Full"
chk "route to ${r.lans.srv.cidr}" "ip route | grep -q '^${r.lans.srv.cidr} '"
echo DONE
`});
  out.push({id:'hqcli',vm:st.vmHqCli,machine:'HQ-CLI',sh:'hq-cli.sh',title:'Настройка HQ-CLI',when:'После DHCP на HQ-RTR. В терминале su -',text:
`#!/bin/bash
# HQ-CLI (ALT Workstation, NetworkManager). Run as root
IF=${st.ifCli}

${F.srvHead('hq-cli')}

${F.cli}

sleep 5
ip -br a
${CHK}
chk "dhcp address ${A.hqCli}" "ip -4 -o addr | grep -q 'inet ${A.hqCli}/'"
chk "gateway ${A.hqCliGw}" "ping -c1 -W2 ${A.hqCliGw}"
chk "dns server ${A.hqSrv} in resolv.conf" "grep -q '^nameserver ${A.hqSrv}' /etc/resolv.conf"
echo DONE
`});
  out.push({id:'hqsrv2',vm:st.vmHqSrv,machine:'HQ-SRV',sh:'hq-srv-2.sh',title:'DNS на HQ-SRV',when:'Последним',text:
`#!/bin/bash
# HQ-SRV step 2: DNS (dnsmasq). Needs internet (ping ${c.fwd1})

${F.dns}

sleep 3
${CHK}
chk "hq-cli.${c.dom} -> ${A.hqCli}" "nslookup hq-cli.${c.dom} 127.0.0.1 | grep -q 'Address: ${A.hqCli}'"
chk "PTR ${A.hqSrv}" "nslookup ${A.hqSrv} 127.0.0.1 | grep -qi 'hq-srv.${c.dom}'"
chk "docker.${c.dom} -> ${A.docker}" "nslookup docker.${c.dom} 127.0.0.1 | grep -q 'Address: ${A.docker}'"
chk "external ya.ru" "nslookup ya.ru 127.0.0.1 | grep -A2 '^Name:' | grep -q Address"
echo DONE
`});
  return {out:wrap(out,st),A,F};
}
function orderText(list){
  return 'Порядок запуска\n\n'+list.map((x,i)=>String(i+1).padStart(2,'0')+'  '+x.machine.padEnd(7)+'  '+x.title+'  ('+x.when+')').join('\n')+
`

Как отправить файл в ВМ
1. Сохраните скрипт в C:\\1.txt
2. Откройте C:\\Program Files\\Oracle\\VirtualBox, в адресной строке наберите cmd
3. В ВМ залогиньтесь под root, раскладка английская, курсор в приглашении #
4. В cmd:   VBoxManage controlvm ИМЯ_ВМ keyboardputfile C:\\1.txt
5. Ничего нажимать не нужно: файл /root/<имя>.sh создастся и сразу запустится.
   Перезапустить его вручную можно командой  bash /root/<имя>.sh
   Скрипты можно запускать повторно, они ничего не сломают.
`;
}

// ---------- autocheck scripts ----------
function autoChecks(c,st,r){
  const A=addrs(c,r), L=r.lans, D=c.dom, P=c.sshPort, tw=c.tun==='gre'?'gre':'ipip';
  const host=h=>[1,'hostname '+h+'.'+D,`[ "$(hostname)" = "${h}.${D}" ] || [ "$(hostname -f 2>/dev/null)" = "${h}.${D}" ]`];
  const ip=(n,a,p,d)=>[n,d||('address '+a+'/'+p),`ip -4 -o addr | grep -q "inet ${a}/${p} "`];
  const ping=(n,a,d)=>[n,d||('ping '+a),`ping -c2 -W2 ${a}`];
  const tz=[11,'timezone '+c.tz,`timedatectl | grep -q "${c.tz}"`];
  const nat=[8,'NAT masquerade',`iptables -t nat -S POSTROUTING 2>/dev/null | grep -q MASQUERADE || nft list ruleset 2>/dev/null | grep -q masquerade`];
  const fwd=[8,'ip forwarding on',`[ "$(sysctl -n net.ipv4.ip_forward)" = 1 ]`];
  const sudo=u=>[3,'sudo without password for '+u,`sudo -l -U ${u} 2>/dev/null | grep -q NOPASSWD`];
  const tunMode=(rem)=>[6,'tunnel mode '+tw+' remote '+rem,`ip -d link | grep "remote ${rem}" | grep -qw ${tw}`];
  const ospfFull=[7,'ospf neighbor Full',`vtysh -c "show ip ospf neighbor" 2>/dev/null | grep -q Full`];
  const ospfAuth=[7,'ospf authentication configured',`vtysh -c "show running-config" 2>/dev/null | grep -qiE "message-digest-key|authentication-key"`];
  const route=(net)=>[7,'route to '+net+' learned by ospf',`ip route | grep "^${net} " | grep -qE "proto (ospf|zebra)"`];
  const srvCommon=[
    [3,'user '+c.su+' uid '+c.uid,`[ "$(id -u ${c.su} 2>/dev/null)" = "${c.uid}" ]`], sudo(c.su),
    [5,'sshd listens on '+P,`ss -ltn | grep -q ":${P} "`],
    [5,'sshd AllowUsers '+c.su,`sshd -T 2>/dev/null | grep -qix "allowusers ${c.su}"`],
    [5,'sshd MaxAuthTries '+c.maxTries,`sshd -T 2>/dev/null | grep -qix "maxauthtries ${c.maxTries}"`],
    [5,'banner text',`B=$(sshd -T 2>/dev/null | awk '$1=="banner"{print $2}'); [ -n "$B" ] && grep -qF "${c.banner}" "$B"`]];
  return [
    {id:'isp',machine:'ISP',vm:st.vmIsp,list:[host('isp'),ip(2,A.ispHq,r.ispHq.p),ip(2,A.ispBr,r.ispBr.p),[2,'default route via DHCP','ip route | grep -q "^default"'],fwd,nat,
      ping(2,c.fwd1,'internet '+c.fwd1),ping(2,A.hqWan,'reach HQ-RTR '+A.hqWan),ping(2,A.brWan,'reach BR-RTR '+A.brWan),tz]},
    {id:'hqrtr',machine:'HQ-RTR',vm:st.vmHqRtr,list:[host('hq-rtr'),ip(1,A.hqWan,r.ispHq.p),ping(2,A.ispHq,'reach ISP '+A.ispHq),
      [4,'vlan '+c.srvVid,`ip -d link | grep -q "802.1Q id ${c.srvVid} "`],[4,'vlan '+c.cliVid,`ip -d link | grep -q "802.1Q id ${c.cliVid} "`],[4,'vlan '+c.mgmtVid,`ip -d link | grep -q "802.1Q id ${c.mgmtVid} "`],
      ip(1,A.hqSrvGw,L.srv.p),ip(1,A.hqCliGw,L.cli.p),ip(1,A.hqMg,L.mgmt.p),
      [3,'user '+c.adm,`id ${c.adm}`],sudo(c.adm),tunMode(A.brWan),ip(6,A.tHq,r.tun.p,'tunnel address '+A.tHq+'/'+r.tun.p),ping(6,A.tBr,'tunnel peer '+A.tBr),
      ospfFull,route(L.br.cidr),ospfAuth,fwd,nat,ping(8,c.fwd1,'internet '+c.fwd1),[9,'dhcp server listening',`ss -lun | grep -q ":67 "`],tz]},
    {id:'brrtr',machine:'BR-RTR',vm:st.vmBrRtr,list:[host('br-rtr'),ip(1,A.brWan,r.ispBr.p),ip(1,A.brGw,L.br.p),ping(2,A.ispBr,'reach ISP '+A.ispBr),
      [3,'user '+c.adm,`id ${c.adm}`],sudo(c.adm),tunMode(A.hqWan),ip(6,A.tBr,r.tun.p,'tunnel address '+A.tBr+'/'+r.tun.p),ping(6,A.tHq,'tunnel peer '+A.tHq),
      ospfFull,route(L.srv.cidr),route(L.cli.cidr),ospfAuth,fwd,nat,ping(8,c.fwd1,'internet '+c.fwd1),tz]},
    {id:'hqsrv',machine:'HQ-SRV',vm:st.vmHqSrv,list:[host('hq-srv'),ip(1,A.hqSrv,L.srv.p),[4,'tagged vlan '+c.srvVid,`ip -d link | grep -q "802.1Q id ${c.srvVid} "`],
      [1,'default via '+A.hqSrvGw,`ip route | grep -q "^default via ${A.hqSrvGw}"`],...srvCommon,
      ping(7,A.brSrv,'reach BR-SRV '+A.brSrv),ping(8,c.fwd1,'internet '+c.fwd1),
      [10,'dns hq-rtr.'+D+' A',`nslookup hq-rtr.${D} 127.0.0.1 | grep -q "Address: ${A.hqSrvGw}"`],
      [10,'dns br-srv.'+D+' A',`nslookup br-srv.${D} 127.0.0.1 | grep -q "Address: ${A.brSrv}"`],
      [10,'dns PTR '+A.hqCli,`nslookup ${A.hqCli} 127.0.0.1 | grep -qi "hq-cli.${D}"`],
      [10,'dns docker.'+D,`nslookup docker.${D} 127.0.0.1 | grep -q "Address: ${A.docker}"`],
      [10,'dns web.'+D,`nslookup web.${D} 127.0.0.1 | grep -q "Address: ${A.web}"`],
      [10,'dns forwarding ya.ru',`nslookup ya.ru 127.0.0.1 | grep -A2 "^Name:" | grep -q Address`],tz]},
    {id:'brsrv',machine:'BR-SRV',vm:st.vmBrSrv,list:[host('br-srv'),ip(1,A.brSrv,L.br.p),[1,'default via '+A.brGw,`ip route | grep -q "^default via ${A.brGw}"`],...srvCommon,
      ping(7,A.hqSrv,'reach HQ-SRV '+A.hqSrv),ping(8,c.fwd1,'internet '+c.fwd1),tz]},
    {id:'hqcli',machine:'HQ-CLI',vm:st.vmHqCli,list:[host('hq-cli'),[9,'dhcp address '+A.hqCli+'/'+L.cli.p,`ip -4 -o addr | grep -q "inet ${A.hqCli}/${L.cli.p} "`],
      [9,'default via '+A.hqCliGw,`ip route | grep -q "^default via ${A.hqCliGw}"`],[9,'nameserver '+A.hqSrv,`grep -q "^nameserver ${A.hqSrv}" /etc/resolv.conf`],
      [9,'search '+D,`grep -qE "^(search|domain) .*${D}" /etc/resolv.conf`],[4,'tagged vlan '+c.cliVid,`ip -d link | grep -q "802.1Q id ${c.cliVid} "`],
      [10,'resolve hq-srv.'+D,`nslookup hq-srv.${D} | grep -q "Address: ${A.hqSrv}"`],[10,'resolve br-rtr.'+D,`nslookup br-rtr.${D} | grep -q "Address: ${A.brGw}"`],
      [5,'ssh port '+P+' open on HQ-SRV',`timeout 3 bash -c "</dev/tcp/${A.hqSrv}/${P}"`],[5,'ssh port '+P+' open on BR-SRV',`timeout 3 bash -c "</dev/tcp/${A.brSrv}/${P}"`],
      ping(7,A.brSrv,'reach BR-SRV '+A.brSrv),ping(8,c.fwd1,'internet '+c.fwd1),tz]}
  ];
}
function checkScripts(c,st,r){
  const code=codeOf(c);
  return wrap(autoChecks(c,st,r).map(m=>({id:m.id,vm:m.vm,machine:m.machine,sh:'check-'+m.id+'.sh',title:'Проверка '+m.machine,when:'После выполнения задания',count:m.list.length,text:
`#!/bin/bash
# Autocheck ${m.machine}, variant ${code}. Run as root
P=0; T=0; F=""
ok(){ T=$((T+1)); if "$3" >/dev/null 2>&1; then P=$((P+1)); echo "[ OK ] p$1 $2"; else echo "[FAIL] p$1 $2"; F="$F p$1"; fi; }
`+m.list.map((x,i)=>'c'+i+'(){ '+x[2]+'; }').join('\n')+'\n\n'+m.list.map((x,i)=>'ok '+x[0]+' "'+x[1]+'" c'+i).join('\n')+`

echo "----------------------------------------"
echo "RESULT ${m.machine}: $P / $T"
[ -n "$F" ] && echo "FAILED ITEMS:$(echo $F | tr ' ' '\\n' | sort -uV | tr '\\n' ' ')"
`})),{autoReboot:'no'});
}

// ---------- report ----------
function reportText(c,st,r,A){
  const L=r.lans, tl=c.tun==='gre'?'GRE':'IP in IP';
  return `Таблица 2. IP-адресация
Устройство | Интерфейс | IP-адрес | Шлюз по умолчанию
`+addrRows(c,st,r,A).map(x=>x.join(' | ')).join('\n')+`

Коммутация (п. 4)
Роль коммутатора HQ-SW выполняет внутренняя сеть VirtualBox. На HQ-RTR интерфейс ${st.ifHqLan} работает как транк 802.1Q, на нём подынтерфейсы vlan${c.srvVid} (HQ-SRV, ${A.hqSrvGw}/${L.srv.p}), vlan${c.cliVid} (HQ-CLI, ${A.hqCliGw}/${L.cli.p}) и vlan${c.mgmtVid} (сеть управления, ${A.hqMg}/${L.mgmt.p}). HQ-SRV и HQ-CLI тегируют свой трафик сами: vlan${c.srvVid} и vlan${c.cliVid}.

Туннель (п. 6)
Технология ${tl}, интерфейс gre1. HQ-RTR: ${A.tHq}/${r.tun.p}, local ${A.hqWan}, remote ${A.brWan}. BR-RTR: ${A.tBr}/${r.tun.p}, local ${A.brWan}, remote ${A.hqWan}. TTL 64.

Динамическая маршрутизация (п. 7)
Протокол OSPF (link-state), область 0, пакет FRR. Все интерфейсы пассивные (passive-interface default), активен только gre1, поэтому соседство устанавливается только между HQ-RTR и BR-RTR. Router-id: HQ-RTR ${A.tHq}, BR-RTR ${A.tBr}. Защита: аутентификация message-digest (MD5), ключ 1. Сети HQ-RTR: ${r.tun.cidr}, ${L.srv.cidr}, ${L.cli.cidr}, ${L.mgmt.cidr}. Сети BR-RTR: ${r.tun.cidr}, ${L.br.cidr}.

NAT (п. 2 и п. 8)
На ISP, HQ-RTR и BR-RTR правило iptables MASQUERADE на внешнем интерфейсе, включена пересылка net.ipv4.ip_forward = 1.

DHCP (п. 9)
Сервер dnsmasq на HQ-RTR, интерфейс vlan${c.cliVid}. Подсеть ${L.cli.cidr}, диапазон ${A.dhcpFrom}–${A.dhcpTo}, для HQ-CLI закреплён адрес ${A.hqCli}. Адрес маршрутизатора ${A.hqCliGw} исключён из выдачи. Шлюз ${A.hqCliGw}, DNS ${A.hqSrv}, DNS-суффикс ${c.dom}.

DNS (п. 10)
Сервер dnsmasq на HQ-SRV, пересылка на ${c.fwd1} и ${c.fwd2}.
hq-rtr.${c.dom}  A, PTR  ${A.hqSrvGw}
br-rtr.${c.dom}  A       ${A.brGw}
hq-srv.${c.dom}  A, PTR  ${A.hqSrv}
hq-cli.${c.dom}  A, PTR  ${A.hqCli}
br-srv.${c.dom}  A       ${A.brSrv}
docker.${c.dom}  A       ${A.docker}
web.${c.dom}     A       ${A.web}

Часовой пояс (п. 11): ${c.tz} на всех устройствах.
`;
}

// ---------- teacher key ----------
const WEIGHTS_DEF=[1,1,1,1,1,1,1.5,0.5,1,1.5,0.5];
function why(c,k,p){ const N=+c[k+'N'], size=2**(32-p);
  return c[k+'Rule']==='le' ? (size===N?'ровно '+N:size+' ≤ '+N+' < '+size*2)+' → /'+p : (size===N?'ровно '+N:size/2+' < '+N+' ≤ '+size)+' → /'+p }
function traps(c,r){
  const t=[];
  LANS.forEach(([k,n])=>{ const N=+c[k+'N']; if(N&(N-1)) t.push(n+': «'+ruleTxt(c[k+'Rule'])+' '+N+'» не степень двойки, правильно /'+r.lans[k].p+' (размер '+r.lans[k].size+')') });
  if(c.addrMode==='vlsm'){ const o=LANS.map(([k,n])=>n+' '+r.lans[k].cidr).join(', '); t.push('VLSM: сети начинаются не с нуля. Верная нарезка: '+o) }
  if(c.tun==='ipip') t.push('Туннель IP-in-IP, а не GRE: нужен mode ipip на обоих концах');
  if(r.tun.p!==30) t.push('Сеть туннеля /'+r.tun.p+', маска '+r.tun.mask);
  if((r.tun.net&255)!==0) t.push('Сеть туннеля начинается с '+n2ip(r.tun.net)+', HQ-RTR получает '+r.tun.h(1));
  [['ISP — HQ-RTR',r.ispHq],['ISP — BR-RTR',r.ispBr]].forEach(([n,x])=>{ if(x.p!==28) t.push(n+': маска /'+x.p+' ('+x.mask+'), а не привычная /28'); if((x.net&255)!==0) t.push(n+': сеть начинается с '+n2ip(x.net)+', первый адрес '+x.h(1)) });
  if(c.adm!=='net_admin'||c.su!=='sshuser') t.push('Нестандартные логины: '+c.adm+' и '+c.su);
  if(c.dom!=='au-team.irpo') t.push('Домен '+c.dom+', а не au-team.irpo');
  if(c.dockerTo==='br') t.push('docker указывает на сторону BR-RTR, web — на сторону HQ-RTR');
  if(+c.maxTries!==2) t.push('MaxAuthTries '+c.maxTries+', а не 2');
  return t;
}
const ITEM_NAMES=['Базовая настройка','ISP','Учётные записи','Коммутация VLAN','SSH','Туннель','OSPF','NAT на роутерах','DHCP','DNS','Часовой пояс'];
function checks(c,r,A){
  const D=c.dom, L=r.lans;
  return [
    [['hostname','на каждой машине → <b>'+esc('hq-rtr.'+D)+'</b> и т.д.'],['ip -br a','адреса совпадают с таблицей 2']],
    [['ip -br a','на ISP: <b>'+A.ispHq+'/'+r.ispHq.p+'</b> и <b>'+A.ispBr+'/'+r.ispBr.p+'</b>'],['iptables -t nat -S POSTROUTING','на ISP: <b>-j MASQUERADE</b>'],['ping -c2 '+c.fwd1,'с HQ-RTR и BR-RTR: ответы идут']],
    [['id '+c.su,'на HQ-SRV/BR-SRV: <b>uid='+esc(c.uid)+'</b>'],['su - '+c.su+' -c "sudo -n id"','<b>uid=0(root)</b> без запроса пароля'],['su - '+c.adm+' -c "sudo -n id"','на HQ-RTR/BR-RTR: <b>uid=0(root)</b>']],
    [['ip -d link | grep 802.1Q','на HQ-RTR: <b>id '+c.srvVid+'</b>, <b>id '+c.cliVid+'</b>, <b>id '+c.mgmtVid+'</b>'],['ip -d link | grep 802.1Q','на HQ-SRV: <b>id '+c.srvVid+'</b>; на HQ-CLI: <b>id '+c.cliVid+'</b>']],
    [['ssh -p '+c.sshPort+' '+c.su+'@'+A.hqSrv,'с HQ-CLI: баннер <b>'+esc(c.banner)+'</b>, вход успешен'],['ssh -p '+c.sshPort+' root@'+A.brSrv,'отказ в доступе'],['sshd -T | grep -E "^(port|allowusers|maxauthtries|banner)"','<b>port '+c.sshPort+'</b>, <b>maxauthtries '+c.maxTries+'</b>']],
    [['ip -d link show gre1','на HQ-RTR: <b>'+(c.tun==='gre'?'gre':'ipip')+'</b> remote '+A.brWan+' local '+A.hqWan],['ping -c2 '+A.tBr,'с HQ-RTR: ответы идут']],
    [['vtysh -c "show ip ospf neighbor"','сосед <b>'+A.tBr+'</b> (или '+A.tHq+'), состояние <b>Full</b>'],['vtysh -c "show ip route ospf"','на HQ-RTR есть <b>'+L.br.cidr+'</b> через gre1'],['vtysh -c "show running-config"','<b>message-digest-key 1 md5</b>']],
    [['ping -c2 '+c.fwd1,'с HQ-SRV и BR-SRV: ответы идут'],['iptables -t nat -S POSTROUTING','на HQ-RTR/BR-RTR: <b>-j MASQUERADE</b>']],
    [['ip -br a','на HQ-CLI: <b>'+A.hqCli+'/'+L.cli.p+'</b>'],['ip r','<b>default via '+A.hqCliGw+'</b>'],['cat /etc/resolv.conf','<b>nameserver '+A.hqSrv+'</b>, <b>search '+esc(D)+'</b>']],
    [['nslookup hq-rtr.'+D,'<b>'+A.hqSrvGw+'</b>'],['nslookup '+A.hqCli,'<b>hq-cli.'+esc(D)+'</b>'],['nslookup docker.'+D,'<b>'+A.docker+'</b>; web → <b>'+A.web+'</b>'],['nslookup ya.ru','внешнее имя разрешается']],
    [['timedatectl | grep zone','на всех машинах: <b>'+esc(c.tz)+'</b>']]
  ];
}
function addrRows(c,st,r,A){
  const L=r.lans;
  return [
    ['ISP',st.ifIspWan,'DHCP',''],['',st.ifIspHq,A.ispHq+'/'+r.ispHq.p,''],['',st.ifIspBr,A.ispBr+'/'+r.ispBr.p,''],
    ['HQ-RTR',st.ifHqWan,A.hqWan+'/'+r.ispHq.p,A.ispHq],['','vlan'+c.srvVid,A.hqSrvGw+'/'+L.srv.p,''],['','vlan'+c.cliVid,A.hqCliGw+'/'+L.cli.p,''],['','vlan'+c.mgmtVid,A.hqMg+'/'+L.mgmt.p,''],['','gre1',A.tHq+'/'+r.tun.p,''],
    ['BR-RTR',st.ifBrWan,A.brWan+'/'+r.ispBr.p,A.ispBr],['',st.ifBrLan,A.brGw+'/'+L.br.p,''],['','gre1',A.tBr+'/'+r.tun.p,''],
    ['HQ-SRV','vlan'+c.srvVid,A.hqSrv+'/'+L.srv.p,A.hqSrvGw],['HQ-CLI','vlan'+c.cliVid,A.hqCli+'/'+L.cli.p+' (DHCP)',A.hqCliGw],['BR-SRV',st.ifSrv,A.brSrv+'/'+L.br.p,A.brGw]];
}
function keyPlain(c,r,A){
  const L=r.lans;
  return 'Ключ к варианту '+codeOf(c)+' ('+LEVELS[c.lv].name+')\n'+
    LANS.map(([k,n])=>n+': '+L[k].cidr+', маска '+L[k].mask+(k==='br'?'':', VLAN '+c[k+'Vid'])).join('\n')+
    '\nISP—HQ: '+r.ispHq.cidr+' (ISP '+A.ispHq+', HQ-RTR '+A.hqWan+')\nISP—BR: '+r.ispBr.cidr+' (ISP '+A.ispBr+', BR-RTR '+A.brWan+')'+
    '\nТуннель '+(c.tun==='gre'?'GRE':'IP-in-IP')+': '+r.tun.cidr+' (HQ '+A.tHq+', BR '+A.tBr+')'+
    '\nHQ-SRV '+A.hqSrv+', HQ-CLI '+A.hqCli+', BR-SRV '+A.brSrv+'\nDHCP: '+A.dhcpFrom+'–'+A.dhcpTo+'\nSSH: порт '+c.sshPort+', '+c.su+', попыток '+c.maxTries+
    '\ndocker → '+A.docker+', web → '+A.web+'\nЧасовой пояс: '+c.tz+'\n';
}

// ---------- manual solution ----------
function manualItems(c,st,r){
  const F=frags(c,st,r), A=F.A, ck=checks(c,r,A), rt=F.alt?'ALT':'Astra';
  const wan=(w,l)=>'WAN='+w+'\nLAN='+l+'\n';
  const it=(n,title,why,blocks)=>({n,title,why,blocks,check:ck[n-1]});
  return [
    it(1,'Имена и адреса','Задайте полное имя и адреса каждой машине. Вписывайте имена интерфейсов со своего стенда, их видно в ip -br a. На роутерах '+rt+' адреса VLAN и туннеля добавим в пунктах 4 и 6.',[
      ['HQ-RTR',wan(st.ifHqWan,st.ifHqLan)+F.head('hq-rtr')+'\n\n'+F.rtrBase('hq')],['BR-RTR',wan(st.ifBrWan,st.ifBrLan)+F.head('br-rtr')+'\n\n'+F.rtrBase('br')],
      ['HQ-SRV','IF='+st.ifSrv+'\n'+F.srvHead('hq-srv')+'\n\n'+F.srvNet('hq')],['BR-SRV','IF='+st.ifSrv+'\n'+F.srvHead('br-srv')+'\n\n'+F.srvNet('br')]]),
    it(2,'ISP','Внешний интерфейс берёт адрес по DHCP, два внутренних получают первые адреса сетей. Пересылка и маскарад дают офисам выход в интернет.',[
      ['ISP','WAN='+st.ifIspWan+'\nHQ='+st.ifIspHq+'\nBR='+st.ifIspBr+'\n'+F.head('isp')+'\n\n'+F.ispNet+'\n\n'+(F.alt?F.fwd+'\nsystemctl restart network\n'+F.natAlt:F.fwd)]]),
    it(3,'Учётные записи','sudo без пароля даёт файл в /etc/sudoers.d. На серверах ALT пользователя ещё добавляют в группу wheel и открывают sudo командой control.',[
      ['HQ-RTR и BR-RTR',users(c.adm,'',c.admPass,F.alt)],['HQ-SRV и BR-SRV',users(c.su,c.uid,c.suPass,true)]]),
    it(4,'Коммутация VLAN','HQ-RTR работает как «роутер на палочке»: один физический порт в сторону офиса и три подынтерфейса 802.1Q. HQ-SRV тегирует трафик сам (vlan'+c.srvVid+' настроен в пункте 1), HQ-CLI тоже (пункт 9).',[
      ['HQ-RTR',wan(st.ifHqWan,st.ifHqLan)+F.vlans]]),
    it(5,'SSH','Порт, разрешённый пользователь, число попыток и баннер задаются в /etc/openssh/sshd_config. После правки перезапустите sshd.',[['HQ-SRV и BR-SRV',sshBlock(c)]]),
    it(6,'Туннель '+(c.tun==='gre'?'GRE':'IP-in-IP'),'Туннель строится между внешними адресами роутеров. Внутри него своя маленькая сеть '+r.tun.cidr+'.',[
      ['HQ-RTR',wan(st.ifHqWan,st.ifHqLan)+F.tunnel('hq')],['BR-RTR',wan(st.ifBrWan,st.ifBrLan)+F.tunnel('br')],
      ['Оба роутера, затем перезагрузка',F.rtrFinish+'\nreboot']]),
    it(7,'OSPF','Все интерфейсы пассивные, кроме gre1, поэтому соседство появляется только через туннель. Пароль защищает обмен маршрутами (MD5). Нужен интернет для установки FRR.',[
      ['HQ-RTR',F.ospf('hq')],['BR-RTR',F.ospf('br')]]),
    it(8,'NAT на роутерах',F.alt?'На ALT маскарад задаётся правилом iptables и сохраняется в /etc/sysconfig/iptables. Это уже сделано в конце пункта 6.':'На Astra маскарад включается строкой post-up в описании WAN в /etc/network/interfaces (пункт 1). Проверьте, что правило появилось:',[
      ['HQ-RTR и BR-RTR','iptables -t nat -S POSTROUTING\nsysctl net.ipv4.ip_forward']]),
    it(9,'DHCP','dnsmasq на HQ-RTR раздаёт адреса только в VLAN '+c.cliVid+'. Адрес роутера в диапазон не входит, HQ-CLI закреплён по имени.',[
      ['HQ-RTR',F.dhcp],['HQ-CLI (под root)','IF='+st.ifCli+'\n'+F.srvHead('hq-cli')+'\n\n'+F.cli]]),
    it(10,'DNS','dnsmasq на HQ-SRV отвечает за зону '+c.dom+'. Запись host-record создаёт A и PTR сразу, address — только A.',[['HQ-SRV',F.dns]]),
    it(11,'Часовой пояс','Пояс уже задан в пункте 1. Команда для проверки и ручной установки:',[['Все машины','timedatectl set-timezone '+c.tz+'\ntimedatectl']])
  ];
}

// ---------- journal (shared db when available) ----------
const J={rows:[],mode:'loading',col:null,subs:[],
  emit(){ J.rows.sort((a,b)=>(a.order||0)-(b.order||0)); J.subs.forEach(f=>{ try{ f() }catch(e){} }) },
  saveLocal(){ store.set(KEY+'.journal',J.rows) },
  async add(o){ if(J.mode==='db'){ await J.col.add(o) } else { o.id='l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); J.rows.push(o); J.saveLocal(); J.emit() } },
  async update(id,p){ if(J.mode==='db'){ await J.col.doc(id).update(p) } else { const r=J.rows.find(x=>x.id===id); if(r){ Object.assign(r,p); J.saveLocal(); J.emit() } } },
  async remove(id){ if(J.mode==='db'){ await J.col.doc(id).delete() } else { J.rows=J.rows.filter(x=>x.id!==id); J.saveLocal(); J.emit() } }
};
(async()=>{ let db=null; try{ if(window.claude&&window.claude.use) db=await window.claude.use('db') }catch(e){}
  if(db){ J.mode='db'; J.col=db.collection('journal');
    J.col.onSnapshot(s=>{ J.rows=s.docs.map(d=>Object.assign({id:d.id},d.data())); J.emit() }, e=>{ J.err=e&&e.message; J.emit() }) }
  else { J.mode='local'; J.rows=store.get(KEY+'.journal',[]); J.emit() } })();

// ---------- state ----------
const STAND_DEF={ifIspWan:'eth0',ifIspHq:'eth1',ifIspBr:'eth2',ifHqWan:'eth0',ifHqLan:'eth1',ifBrWan:'eth0',ifBrLan:'eth1',ifSrv:'enp0s3',ifCli:'enp0s3',
  vmIsp:'ISP',vmHqRtr:'HQ-RTR',vmBrRtr:'BR-RTR',vmHqSrv:'HQ-SRV',vmBrSrv:'BR-SRV',vmHqCli:'HQ-CLI',autoReboot:'no',rtrOs:'astra',weights:WEIGHTS_DEF.slice()};
let S = Object.assign({lv:'X',num:1,mask:ALLTRAPS,custom:null,tab:'task',sel:'isp',step:0,mode:'auto',student:null}, store.get(KEY,{}));
let ST = Object.assign({},STAND_DEF,store.get(KEY+'.stand',{}));
if(!Array.isArray(ST.weights)||ST.weights.length!==11) ST.weights=WEIGHTS_DEF.slice();
const hc=parseCode(location.hash);
if(hc){ S.lv=hc.lv; S.num=hc.num; S.mask=hc.mask; S.custom=null; S.student=null }
S.customOn=!!S.custom;
let C = S.custom || makeVariant(S.lv,S.num,S.mask), R=null, G=null, A=null, CK=null;
function save(){ S.custom = S.customOn ? C : null; store.set(KEY,S) }
const totalW = () => ST.weights.reduce((a,b)=>a+(+b||0),0);
const fmt = x => (Math.round(x*100)/100).toString().replace('.',',');

function renderHead(){
  const lv=C.lv;
  $('#codeBox').className='code lv-'+lv;
  $('#codeBox').innerHTML='<small>Вариант</small><div class="big"><span class="let">'+lv+'</span>'+esc(codeOf(C).slice(1))+'</div><div class="lvname"><span class="dot"></span>'+LEVELS[lv].name+
    (S.customOn?'<button type="button" class="edited" id="unedit" title="Вернуть параметры варианта">изменён вручную ×</button>':'')+'</div>';
  const u=$('#unedit'); if(u) u.addEventListener('click',()=>{ load(S.lv,S.num,S.mask); toast('Параметры варианта '+codeOf(C)+' восстановлены') });
  $('#levels').innerHTML=Object.entries(LEVELS).map(([k,v])=>'<button type="button" class="lvb lv-'+k+'" data-lv="'+k+'" aria-pressed="'+(S.lv===k)+'"><b><span class="dot"></span>'+v.name+'</b><span>'+v.desc+'</span></button>').join('');
  $('#levels').querySelectorAll('.lvb').forEach(b=>b.addEventListener('click',()=>load(b.dataset.lv,S.num,S.mask)));
  if(document.activeElement!==$('#numIn')) $('#numIn').value=S.num;
  const tr=$('#trapRow'); tr.hidden = S.lv!=='H';
  if(S.lv==='H'){ tr.innerHTML='<span>Подвохи</span>'+TRAPS.map((t,i)=>'<button type="button" class="tchip" data-b="'+i+'" aria-pressed="'+!!(S.mask&(1<<i))+'">'+t[1]+'</button>').join('')+
      '<button type="button" class="tchip all" data-b="all">'+(S.mask===ALLTRAPS?'Снять все':'Включить все')+'</button>';
    tr.querySelectorAll('.tchip').forEach(b=>b.addEventListener('click',()=>{ const m = b.dataset.b==='all' ? (S.mask===ALLTRAPS?0:ALLTRAPS) : S.mask^(1<<+b.dataset.b); load('H',S.num,m) })) }
}
function load(lv,num,mask){
  num=Math.max(1,Math.min(9999,parseInt(num,10)||1)); S.lv=lv; S.num=num; S.mask=lv==='H'?(mask==null?ALLTRAPS:mask):ALLTRAPS; S.customOn=false;
  C=makeVariant(lv,num,S.mask); if(S.student){ const st=J.rows.find(x=>x.id===S.student); if(!st||st.code!==codeOf(C)) S.student=null }
  try{ history.replaceState(null,'','#'+codeOf(C)) }catch(e){}
  render();
}
$('#prevBtn').addEventListener('click',()=>load(S.lv,S.num-1,S.mask));
$('#nextBtn').addEventListener('click',()=>load(S.lv,S.num+1,S.mask));
$('#numIn').addEventListener('change',e=>load(S.lv,e.target.value,S.mask));
$('#rndBtn').addEventListener('click',()=>{ let n; do{ n=1+Math.floor(Math.random()*999) }while(n===S.num); load(S.lv,n,S.mask); toast('Вариант '+codeOf(C)) });

const TABS=[['task','Задание','студенту'],['key','Ключ','преподавателю'],['solve','Решение',''],['journal','Журнал',''],['batch','Пакет на группу',''],['params','Параметры',''],['settings','Настройки','']];
function renderTabs(){
  $('#tabs').innerHTML=TABS.map(([k,n,t])=>'<button type="button" class="tab" role="tab" data-t="'+k+'" aria-selected="'+(S.tab===k)+'">'+n+(t?'<span class="tg">'+t+'</span>':'')+'</button>').join('');
  $('#tabs').querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{ S.tab=b.dataset.t; save(); renderTabs(); renderMain() }));
}
function msgsHtml(){ if(!R) return ''; let h='';
  R.E.forEach(t=>h+='<div class="msg err">'+esc(t)+'</div>'); R.W.forEach(t=>h+='<div class="msg warn">'+esc(t)+'</div>');
  return h?'<div class="msgs">'+h+'</div>':'' }
const brokenHtml = () => msgsHtml()+'<p class="lead">В параметрах варианта есть ошибки. Исправьте их на вкладке «Параметры» или выберите другой номер.</p>';
const fname = s => 'module1_'+codeOf(C).replace('.','_')+s;

function renderMain(){
  const m=$('#main');
  if(S.tab==='task'){
    if(!R.ok){ m.innerHTML=brokenHtml(); return }
    const M=taskModel(C,R,ST.rtrOs);
    m.innerHTML='<div class="bar"><p>Лист задания для студента. Ответов в нём нет, только условия.</p><div class="acts">'+
      '<button type="button" class="btn" id="cpTask">Скопировать для Word</button>'+(canSave()?'<button type="button" class="btn primary" id="dxTask">Скачать .docx</button>':'')+(framed?'':'<button type="button" class="btn" id="prTask">Печать</button>')+'</div></div>'+
      '<article class="sheet" id="sheet">'+modelHtml(M)+'</article>';
    $('#cpTask').addEventListener('click',()=>copyRich($('#sheet').innerHTML,modelText(M),$('#sheet')));
    const dx=$('#dxTask'); if(dx) dx.addEventListener('click',async()=>{ try{ toast('Собираю документ…'); await saveFile(fname('_task.docx'),await buildDocx([M])) }catch(e){ toast('Не удалось собрать документ') } });
    if(!framed) $('#prTask').addEventListener('click',()=>printSheets([modelHtml(M)]));
  }
  else if(S.tab==='key') renderKey(m);
  else if(S.tab==='solve') renderSolve(m);
  else if(S.tab==='journal') renderJournal(m);
  else if(S.tab==='batch') renderBatch(m);
  else if(S.tab==='params') renderParams(m);
  else renderSettings(m);
}

// ---------- key tab ----------
function renderKey(m){
  if(!R.ok){ m.innerHTML=brokenHtml(); return }
  const L=R.lans, code=codeOf(C)+(S.customOn?'*':''), tr=traps(C,R), ck=CK;
  const stu = S.student ? J.rows.find(x=>x.id===S.student) : null;
  const done = stu ? (stu.done||[]) : store.get(KEY+'.chk.'+code,[]);
  const card=(t,net,d,w)=>'<div class="kc"><div class="t"><span>'+t+'</span></div><div class="net">'+net+'</div><div class="d">'+d+'</div>'+(w?'<div class="why">'+w+'</div>':'')+'</div>';
  const cards=LANS.map(([k,n])=>card(n+(k==='br'?'':' · VLAN '+esc(C[k+'Vid'])),L[k].cidr,'маска '+L[k].mask+'<br>шлюз '+L[k].h(1)+(k==='mgmt'?'':' · '+(k==='cli'?'клиент':'сервер')+' '+L[k].h(2)),why(C,k,L[k].p))).join('')+
    card('ISP ↔ HQ-RTR',R.ispHq.cidr,'ISP '+A.ispHq+' · HQ-RTR '+A.hqWan)+card('ISP ↔ BR-RTR',R.ispBr.cidr,'ISP '+A.ispBr+' · BR-RTR '+A.brWan)+
    card('Туннель '+(C.tun==='gre'?'GRE':'IP-in-IP'),R.tun.cidr,'HQ-RTR '+A.tHq+' · BR-RTR '+A.tBr+'<br>маска '+R.tun.mask)+
    card('DHCP на HQ-RTR',A.dhcpFrom+' – '+A.dhcpTo,'резерв HQ-CLI '+A.hqCli+'<br>шлюз '+A.hqCliGw+' · DNS '+A.hqSrv)+
    card('SSH на серверах','порт '+esc(C.sshPort),esc(C.su)+' · uid '+esc(C.uid)+' · попыток '+esc(C.maxTries)+'<br>«'+esc(C.banner)+'»');
  const D=C.dom, rep=reportText(C,ST,R,A);
  const dns=[['hq-rtr.'+D,'A, PTR',A.hqSrvGw],['br-rtr.'+D,'A',A.brGw],['hq-srv.'+D,'A, PTR',A.hqSrv],['hq-cli.'+D,'A, PTR',A.hqCli],['br-srv.'+D,'A',A.brSrv],['docker.'+D,'A',A.docker],['web.'+D,'A',A.web]];
  m.innerHTML=(stu?'<div class="who"><span>Проверяете: <b>'+esc(stu.name)+'</b> · вариант '+esc(stu.code)+'. Отметки сохраняются в журнал.</span><button type="button" class="btn" id="noStu">Проверять без студента</button></div>':'')+
    '<div class="bar"><p>Правильные значения и команды проверки для варианта '+esc(code)+'. Если студент выбрал другие адреса внутри верной подсети, пункт можно засчитать.</p><div class="acts"><button type="button" class="btn" id="cpKey">Скопировать ключ</button>'+(canSave()?'<button type="button" class="btn" id="dlKey">Скачать .txt</button>':'')+'</div></div>'+
    (tr.length?'<section class="sect"><h3>На что обратить внимание</h3><ul class="traps">'+tr.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></section>':'')+
    '<div class="kgrid">'+cards+'</div>'+
    '<section class="sect"><h3>Проверка по пунктам</h3><p class="sub">Баллы за пункты меняются на вкладке «Настройки». Быстрее всего проверять скриптами: «Решение» → «Скрипты проверки».</p><div class="score"><div class="meter"><i id="meter"></i></div><b id="scoreTxt"></b><button type="button" class="btn" id="ckReset">Снять отметки</button></div><div class="checks">'+
    ck.map((rows,i)=>'<div class="ck"><input type="checkbox" id="ck'+i+'" data-i="'+i+'"'+(done.includes(i)?' checked':'')+'><label class="h" for="ck'+i+'"><span>'+(i+1)+'</span>'+ITEM_NAMES[i]+'<em>'+fmt(+ST.weights[i]||0)+' б.</em></label><div class="rows">'+
      rows.map(([cmd,exp])=>'<div class="cr"><code>'+esc(cmd)+'</code><span class="exp">'+exp+'</span></div>').join('')+'</div></div>').join('')+'</div></section>'+
    '<section class="sect"><h3>Таблица 2. IP-адресация</h3><p class="sub">Имена интерфейсов взяты с вкладки «Настройки»</p>'+dtable(['Устройство','Интерфейс','IP-адрес','Шлюз'],addrRows(C,ST,R,A))+'</section>'+
    '<section class="sect"><h3>Таблица 3. Записи DNS</h3>'+dtable(['Имя','Тип','Адрес'],dns)+'<p class="sub">Пересылка на '+esc(C.fwd1)+' и '+esc(C.fwd2)+' · часовой пояс '+esc(C.tz)+'</p></section>'+
    '<section class="sect"><h3>Текст для отчёта</h3><p class="sub">Образец того, что студент пишет в отчёт по пунктам 1, 4, 6–10</p>'+termHtml('report.txt',rep,true,'rep')+'</section>';
  const upd=(write)=>{ const on=[...m.querySelectorAll('.ck input')].filter(x=>x.checked).map(x=>+x.dataset.i);
    const sc=on.reduce((a,i)=>a+(+ST.weights[i]||0),0);
    $('#meter').style.width=(totalW()?sc/totalW()*100:0)+'%'; $('#scoreTxt').textContent='Пунктов '+on.length+' из 11 · '+fmt(sc)+' из '+fmt(totalW())+' б.';
    if(!write) return;
    if(stu) J.update(stu.id,{done:on,score:sc,updated:new Date().toISOString()}).catch(()=>toast('Не удалось сохранить в журнал'));
    else store.set(KEY+'.chk.'+code,on) };
  m.querySelectorAll('.ck input').forEach(x=>x.addEventListener('change',()=>upd(true))); upd(false);
  $('#ckReset').addEventListener('click',()=>{ m.querySelectorAll('.ck input').forEach(x=>x.checked=false); upd(true) });
  $('#cpKey').addEventListener('click',()=>copyText(keyPlain(C,R,A)));
  const dk=$('#dlKey'); if(dk) dk.addEventListener('click',()=>saveFile(fname('_key.txt'),keyPlain(C,R,A)+'\n\n'+rep));
  const ns=$('#noStu'); if(ns) ns.addEventListener('click',()=>{ S.student=null; save(); renderKey(m) });
  wireTerm('rep',rep,'report.txt');
}
const dtable=(head,rows)=>'<div class="tbl"><table class="dt"><thead><tr>'+head.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';

// ---------- solve tab ----------
const ICONS={
  router:'<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>',
  server:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="2" width="10" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="9" width="10" height="5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="5.5" cy="4.5" r=".9" fill="currentColor"/><circle cx="5.5" cy="11.5" r=".9" fill="currentColor"/></svg>',
  client:'<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="8" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 14h6M8 11v3" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>'
};
const MACH=[
  {key:'isp',name:'ISP',role:'router',steps:['isp']},
  {key:'hqrtr',name:'HQ-RTR',role:'router',steps:['hqrtr','hqrtr2']},
  {key:'brrtr',name:'BR-RTR',role:'router',steps:['brrtr','brrtr2']},
  {key:'hqsrv',name:'HQ-SRV',os:'Альт Сервер',role:'server',steps:['hqsrv','hqsrv2']},
  {key:'brsrv',name:'BR-SRV',os:'Альт Сервер',role:'server',steps:['brsrv']},
  {key:'hqcli',name:'HQ-CLI',os:'Альт Рабочая станция',role:'client',steps:['hqcli']}
];
const STEPNAME={isp:'База',hqrtr:'База',hqrtr2:'OSPF и DHCP',brrtr:'База',brrtr2:'OSPF',hqsrv:'База',hqsrv2:'DNS',brsrv:'База',hqcli:'Сеть и имя'};
function hl(t){ return esc(t).split('\n').map(l=>/^\s*#/.test(l)?'<span class="cm">'+l+'</span>':/(EOF_FINAL|&lt;&lt;\s*'?EOF'?|^EOF$)/.test(l)?'<span class="hd">'+l+'</span>':/^\[ OK \]|^chk |^ok /.test(l)?'<span class="hd">'+l+'</span>':l).join('\n') }
function termHtml(fn,text,wrapL,id){ id=id||'t';
  return '<div class="term"><div class="tbar"><span class="fn">'+esc(fn)+'</span><div class="acts"><button type="button" class="tb primary" id="'+id+'Copy">Копировать</button>'+
    (canSave()?'<button type="button" class="tb" id="'+id+'Dl">Скачать .txt</button>':'')+'</div></div><pre id="'+id+'Code"'+(wrapL?' class="wrap"':'')+'>'+hl(text)+'</pre></div>' }
function wireTerm(id,text,file){ const c=$('#'+id+'Copy'); if(c) c.addEventListener('click',()=>copyText(text,$('#'+id+'Code'))); const d=$('#'+id+'Dl'); if(d) d.addEventListener('click',()=>saveFile(file,text)) }
function mainIp(key){ const L=R.lans;
  return {isp:A.ispHq+' · '+A.ispBr, hqrtr:A.hqWan+' · '+A.hqSrvGw, brrtr:A.brWan+' · '+A.brGw, hqsrv:A.hqSrv+'/'+L.srv.p, brsrv:A.brSrv+'/'+L.br.p, hqcli:A.hqCli+' (DHCP)'}[key] }
function renderSolve(m){
  if(!G){ m.innerHTML=brokenHtml(); return }
  const modes=[['auto','Скрипты решения'],['check','Скрипты проверки'],['manual','Решение вручную']];
  m.innerHTML=(R.W.length?msgsHtml():'')+'<div class="bar"><div class="seg" role="group" aria-label="Что показать">'+modes.map(([k,n])=>'<button type="button" data-m="'+k+'" aria-pressed="'+(S.mode===k)+'">'+n+'</button>').join('')+'</div><div class="acts" id="solveActs"></div></div><div id="solveBody" class="panel"></div>';
  m.querySelectorAll('[data-m]').forEach(b=>b.addEventListener('click',()=>{ S.mode=b.dataset.m; save(); renderSolve(m) }));
  if(S.mode==='manual') return renderManual($('#solveBody'));
  const isChk=S.mode==='check', list=isChk?checkScripts(C,ST,R):G.out;
  const acts=$('#solveActs');
  acts.innerHTML=(isChk?'':'<button type="button" class="btn" id="orderBtn">Порядок запуска</button>')+(canSave()?'<button type="button" class="btn" id="zipBtn">Скачать всё (.zip)</button>':'');
  const ob=$('#orderBtn'); if(ob) ob.addEventListener('click',()=>{ S.sel='order'; save(); renderSolve(m) });
  const zb=$('#zipBtn'); if(zb) zb.addEventListener('click',()=>downloadZip(isChk));
  const body=$('#solveBody');
  body.innerHTML='<p class="lead" style="font-size:.88rem">'+(isChk?'Запустите на каждой машине после выполнения задания. Скрипт ничего не меняет, только проверяет и печатает [ OK ] или [FAIL] с номером пункта. Сверьте результат и отметьте пункты на вкладке «Ключ».':'Скрипты собраны под вариант '+esc(codeOf(C))+' и стенд с вкладки «Настройки». Запускайте по номерам шагов. Повторный запуск безопасен.')+'</p><div class="strip" id="strip"></div><section class="viewer" id="viewer"></section>';
  const orderOf = id => list.findIndex(x=>x.id===id)+1;
  const st=$('#strip');
  MACH.forEach(mm=>{ const b=document.createElement('button'); b.type='button'; b.className='mc '+mm.role; b.setAttribute('aria-pressed',S.sel===mm.key?'true':'false');
    const os = mm.os || OSNAME[ST.rtrOs];
    const chips = isChk ? '<span class="chip">'+list.find(x=>x.id===mm.key).count+' проверок</span>' : mm.steps.map(s=>'<span class="chip">шаг '+orderOf(s)+'</span>').join('');
    b.innerHTML='<div class="top"><span class="ic">'+ICONS[mm.role]+'</span><div><div class="nm">'+mm.name+'</div><div class="os">'+os+'</div></div></div><div class="ip">'+esc(mainIp(mm.key))+'</div><div class="steps">'+chips+'</div>';
    b.addEventListener('click',()=>{ S.sel=mm.key; S.step=0; save(); renderSolve(m) }); st.appendChild(b) });
  const v=$('#viewer'), mm=MACH.find(x=>x.key===S.sel);
  if(!mm){ if(isChk){ S.sel='isp'; return renderSolve(m) } const t=orderText(G.out); v.innerHTML='<div class="vh"><div><h2>Порядок запуска</h2><p>Запускайте строго по номерам шагов</p></div></div>'+termHtml('order.txt',t,true); wireTerm('t',t,'order.txt'); return }
  let x, seg='', sub;
  if(isChk){ x=list.find(o=>o.id===mm.key); sub=x.count+' проверок · скрипт только читает настройки' }
  else { const sid=mm.steps[Math.min(S.step,mm.steps.length-1)]; x=list.find(o=>o.id===sid); sub='Шаг '+orderOf(sid)+' из '+list.length+' · '+x.when;
    if(mm.steps.length>1) seg='<div class="seg" role="group" aria-label="Шаги">'+mm.steps.map((s,i)=>'<button type="button" data-i="'+i+'" aria-pressed="'+(s===sid)+'"><span class="n">'+orderOf(s)+'</span>'+STEPNAME[s]+'</button>').join('')+'</div>' }
  v.innerHTML='<div class="vh"><div><h2>'+esc(x.title)+'</h2><p>'+esc(sub)+'</p></div>'+seg+'</div>'+
    '<div class="howto"><div class="hs"><b>1 · В виртуалке</b>Войдите под root, раскладка английская</div>'+
    '<div class="hs"><b>2 · На Windows</b>Сохраните текст в C:\\1.txt и выполните в cmd из папки VirtualBox<code>VBoxManage controlvm "'+esc(x.vm)+'" keyboardputfile C:\\1.txt</code></div>'+
    '<div class="hs"><b>3 · Готово</b>Скрипт сам запишется в /root/'+esc(x.sh)+' и выполнится</div></div>'+
    termHtml('/root/'+x.sh+' · '+x.text.split('\n').length+' строк', x.text, false);
  v.querySelectorAll('.seg button').forEach(b=>b.addEventListener('click',()=>{ S.step=+b.dataset.i; save(); renderSolve(m) }));
  wireTerm('t',x.text,(isChk?'':String(orderOf(x.id)).padStart(2,'0')+'_')+x.sh.replace('.sh','')+'.txt');
}
function renderManual(body){
  const items=manualItems(C,ST,R);
  $('#solveActs').innerHTML=canSave()?'<button type="button" class="btn" id="dlMan">Скачать решение .txt</button>':'';
  const plain=items.map(it=>'=== '+it.n+'. '+it.title+' ===\n'+it.why+'\n\n'+it.blocks.map(([mm,code])=>'# '+mm+'\n'+code).join('\n\n')).join('\n\n\n');
  const d=$('#dlMan'); if(d) d.addEventListener('click',()=>saveFile(fname('_solution.txt'),plain));
  body.innerHTML='<p class="lead" style="font-size:.88rem">Команды набираются в терминале под root. Это те же действия, что делают скрипты, только по пунктам задания и с пояснениями.</p><div class="manual">'+items.map((it,i)=>'<section class="mi"><h3><span>'+it.n+'</span>'+esc(it.title)+'</h3><p>'+esc(it.why)+'</p>'+
    it.blocks.map(([mm,code],j)=>'<div class="blk"><div class="mh"><span>'+esc(mm)+'</span><button type="button" data-c="'+i+'_'+j+'">Копировать</button></div><pre id="mc'+i+'_'+j+'">'+hl(code)+'</pre></div>').join('')+
    '<div class="chk">Проверка: '+it.check.map(([cmd])=>'<code>'+esc(cmd)+'</code>').join(' ')+'</div></section>').join('')+'</div>';
  body.querySelectorAll('[data-c]').forEach(b=>b.addEventListener('click',()=>{ const [i,j]=b.dataset.c.split('_').map(Number); copyText(items[i].blocks[j][1],$('#mc'+b.dataset.c)) }));
}
function downloadZip(isChk){
  if(!window.JSZip){ toast('Архиватор не загрузился'); return }
  const z=new JSZip();
  if(isChk) checkScripts(C,ST,R).forEach(x=>z.file(x.sh.replace('.sh','')+'.txt',x.text));
  else { G.out.forEach((x,i)=>z.file(String(i+1).padStart(2,'0')+'_'+x.sh.replace('.sh','')+'.txt',x.text)); z.file('00_order.txt',orderText(G.out)); z.file('key.txt',keyPlain(C,R,A)); z.file('report.txt',reportText(C,ST,R,A)) }
  z.generateAsync({type:'blob'}).then(bl=>saveFile(fname(isChk?'_check.zip':'_scripts.zip'),bl));
}

// ---------- journal tab ----------
let jConfirm=false;
function renderJournal(m){
  const rows=J.rows, tw=totalW();
  const prevNames=$('#jNames')?$('#jNames').value:'';
  const modeTxt = J.mode==='db' ? 'Журнал общий: его видно с любого устройства, где открыта эта страница.' : J.mode==='local' ? 'Журнал хранится только в этом браузере. В claude.ai он станет общим.' : 'Подключаю журнал…';
  m.innerHTML='<div class="bar"><p>'+modeTxt+(J.err?' Ошибка: '+esc(J.err):'')+'</p><div class="acts">'+(canSave()&&rows.length?'<button type="button" class="btn" id="jCsv">Скачать .csv</button>':'')+(rows.length?(jConfirm?'<span class="confirm">Удалить весь журнал? <button type="button" class="btn" id="jYes">Да, удалить</button><button type="button" class="btn" id="jNo">Нет</button></span>':'<button type="button" class="btn" id="jClear">Очистить журнал</button>'):'')+'</div></div>'+
    (STUDENT_URL.startsWith('http')?'<div class="linkbox">Страница для студентов (без ключа и скриптов): <code>'+esc(STUDENT_URL)+'</code><button type="button" class="btn" id="jLink">Скопировать ссылку</button></div>':'')+
    '<div class="jgrid"><section class="sect"><h3>Добавить студентов</h3><p class="sub">По одному на строку. Каждый получит свой вариант, номера идут подряд.</p>'+
    '<div class="f"><label for="jNames">Список группы</label><textarea id="jNames" placeholder="Иванов Иван&#10;Петрова Анна"></textarea></div>'+
    '<div class="row"><div class="f"><label for="jLv">Сложность</label><select id="jLv">'+Object.entries(LEVELS).map(([k,v])=>'<option value="'+k+'"'+(S.lv===k?' selected':'')+'>'+v.name+'</option>').join('')+'</select></div>'+
    '<div class="f"><label for="jStart">Начиная с номера</label><input id="jStart" class="mono" inputmode="numeric" value="'+(rows.length?Math.max(...rows.map(r=>(parseCode(r.code)||{num:0}).num))+1:1)+'"></div></div>'+
    '<p class="hint">Для уровня «С подвохами» берутся подвохи, выбранные сейчас вверху.</p><button type="button" class="btn primary" id="jAdd">Раздать варианты</button></section>'+
    '<section class="sect"><h3>Группа · '+rows.length+'</h3>'+(rows.length?'<div class="tbl"><table class="dt"><thead><tr><th>№</th><th>Студент</th><th>Вариант</th><th>Баллы</th><th>Проверен</th><th></th></tr></thead><tbody>'+
      rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(r.name)+'</td><td>'+esc(r.code)+'</td><td>'+(r.done&&r.done.length?'<span class="pill ok">'+fmt(r.score||0)+' / '+fmt(tw)+'</span>':'<span class="pill">—</span>')+'</td><td>'+(r.updated?esc(new Date(r.updated).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})):'')+'</td>'+
        '<td><div class="act"><button type="button" class="open" data-k="'+esc(r.id)+'">Проверить</button><button type="button" class="open" data-t="'+esc(r.id)+'">Задание</button><button type="button" class="open del" data-d="'+esc(r.id)+'" aria-label="Удалить '+esc(r.name)+'">×</button></div></td></tr>').join('')+'</tbody></table></div>'
      :'<p class="sub" style="margin:0">Пока пусто. Вставьте список группы слева и нажмите «Раздать варианты».</p>')+'</section></div>';
  if(prevNames) $('#jNames').value=prevNames;
  const go=(id,tab)=>{ const r=J.rows.find(x=>x.id===id); const p=r&&parseCode(r.code); if(!p) return; S.tab=tab; load(p.lv,p.num,p.mask); if(tab==='key'){ S.student=id; save(); renderMain() } renderTabs(); window.scrollTo({top:0}) };
  m.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.k,'key')));
  m.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.t,'task')));
  m.querySelectorAll('[data-d]').forEach(b=>b.addEventListener('click',()=>J.remove(b.dataset.d).catch(()=>toast('Не удалось удалить'))));
  $('#jAdd').addEventListener('click',async()=>{
    const names=$('#jNames').value.split('\n').map(s=>s.trim()).filter(Boolean); if(!names.length){ toast('Вставьте хотя бы одно имя'); return }
    const lv=$('#jLv').value, start=Math.max(1,parseInt($('#jStart').value,10)||1), base=J.rows.length;
    try{ for(let i=0;i<names.length;i++){ const c=makeVariant(lv,start+i,lv==='H'?S.mask:ALLTRAPS); await J.add({name:names[i].slice(0,120),code:codeOf(c),done:[],score:0,order:base+i+1,created:new Date().toISOString()}) }
      toast('Добавлено: '+names.length); $('#jNames').value='' }catch(e){ toast('Не удалось записать в журнал') }
  });
  const cl=$('#jClear'); if(cl) cl.addEventListener('click',()=>{ jConfirm=true; renderJournal(m) });
  const no=$('#jNo'); if(no) no.addEventListener('click',()=>{ jConfirm=false; renderJournal(m) });
  const yes=$('#jYes'); if(yes) yes.addEventListener('click',async()=>{ jConfirm=false; for(const r of J.rows.slice()) await J.remove(r.id).catch(()=>{}); toast('Журнал очищен') });
  const lk=$('#jLink'); if(lk) lk.addEventListener('click',()=>copyText(STUDENT_URL));
  const csv=$('#jCsv'); if(csv) csv.addEventListener('click',()=>{ const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
    const lines=[['№','Студент','Вариант'].concat(ITEM_NAMES.map((n,i)=>(i+1)+'. '+n)).concat(['Баллы','Из','Проверен']).map(q).join(';')].concat(J.rows.map((r,i)=>[i+1,r.name,r.code].concat(ITEM_NAMES.map((n,k)=>(r.done||[]).includes(k)?fmt(+ST.weights[k]||0):'0')).concat([fmt(r.score||0),fmt(tw),r.updated||'']).map(q).join(';')));
    saveFile('journal.csv','\ufeff'+lines.join('\r\n')) });
}

// ---------- batch tab ----------
let B=Object.assign({lv:'X',count:15,start:1},store.get(KEY+'.batch',{}));
function batchList(){ const out=[]; for(let i=0;i<B.count;i++){ const c=makeVariant(B.lv,B.start+i,B.lv==='H'?S.mask:ALLTRAPS), r=compute(c); out.push({c,r,A:r.ok?addrs(c,r):null}) } return out }
function renderBatch(m){
  const list=batchList(), ok=list.filter(x=>x.r.ok);
  m.innerHTML='<div class="bar"><p>Разные варианты на всю группу. Номера идут подряд, любой вариант можно открыть снова по коду. Чтобы закрепить варианты за студентами, используйте «Журнал».</p></div>'+
    '<section class="sect"><div class="bctl">'+
    '<div class="f"><label for="b_lv">Сложность</label><select id="b_lv">'+Object.entries(LEVELS).map(([k,v])=>'<option value="'+k+'"'+(B.lv===k?' selected':'')+'>'+v.name+'</option>').join('')+'</select></div>'+
    '<div class="f"><label for="b_count">Сколько вариантов</label><input id="b_count" class="mono w-n" inputmode="numeric" value="'+B.count+'"></div>'+
    '<div class="f"><label for="b_start">Начиная с номера</label><input id="b_start" class="mono w-n" inputmode="numeric" value="'+B.start+'"></div>'+
    '<div class="sw">'+(canSave()?'<button type="button" class="btn primary" id="b_dxTasks">Все задания .docx</button><button type="button" class="btn" id="b_dlKeys">Все ключи .txt</button>':'')+'<button type="button" class="btn" id="b_cpTasks">Скопировать задания</button><button type="button" class="btn" id="b_cpKeys">Скопировать ключи</button>'+
    (framed?'':'<button type="button" class="btn" id="b_prTasks">Печать заданий</button>')+'</div></div>'+
    '<div class="tbl"><table class="dt"><thead><tr><th>Вариант</th><th>HQ-SRV</th><th>HQ-CLI</th><th>Управление</th><th>BR-SRV</th><th>Туннель</th><th>SSH</th><th></th></tr></thead><tbody>'+
    list.map(({c,r})=>{ const code=codeOf(c); if(!r.ok) return '<tr><td>'+esc(code)+'</td><td colspan="7">не удалось собрать</td></tr>';
      return '<tr><td><span class="lvtag lv-'+c.lv+'"><span class="dot"></span>'+esc(code)+'</span></td><td>'+r.lans.srv.cidr+'</td><td>'+r.lans.cli.cidr+'</td><td>'+r.lans.mgmt.cidr+'</td><td>'+r.lans.br.cidr+'</td><td>'+(c.tun==='gre'?'GRE ':'IPIP ')+r.tun.cidr+'</td><td>'+esc(c.sshPort)+'</td><td><button type="button" class="open" data-code="'+esc(code)+'">Открыть</button></td></tr>' }).join('')+'</tbody></table></div></section>';
  const upd=()=>{ B={lv:$('#b_lv').value,count:Math.max(1,Math.min(40,parseInt($('#b_count').value,10)||1)),start:Math.max(1,Math.min(9960,parseInt($('#b_start').value,10)||1))}; store.set(KEY+'.batch',B); renderBatch(m) };
  ['#b_lv','#b_count','#b_start'].forEach(s=>$(s).addEventListener('change',upd));
  m.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>{ const p=parseCode(b.dataset.code); S.tab='task'; load(p.lv,p.num,p.mask); renderTabs(); window.scrollTo({top:0}) }));
  const models=()=>ok.map(x=>taskModel(x.c,x.r,ST.rtrOs));
  const keys=()=>ok.map(x=>keyPlain(x.c,x.r,x.A)+'\n'+reportText(x.c,ST,x.r,x.A)).join('\n════════════════════\n\n');
  $('#b_cpTasks').addEventListener('click',()=>{ const ms=models(); copyRich(ms.map(modelHtml).join('<br style="page-break-before:always">'),ms.map(modelText).join('\n\n════════\n\n')) });
  $('#b_cpKeys').addEventListener('click',()=>copyText(ok.map(x=>keyPlain(x.c,x.r,x.A)).join('\n────────\n\n')));
  const dx=$('#b_dxTasks'); if(dx) dx.addEventListener('click',async()=>{ try{ toast('Собираю '+ok.length+' заданий…'); await saveFile('module1_'+B.lv+'_'+B.start+'-'+(B.start+B.count-1)+'_tasks.docx',await buildDocx(models())) }catch(e){ toast('Не удалось собрать документ') } });
  const dk=$('#b_dlKeys'); if(dk) dk.addEventListener('click',()=>saveFile('module1_'+B.lv+'_'+B.start+'-'+(B.start+B.count-1)+'_keys.txt',keys()));
  if(!framed) $('#b_prTasks').addEventListener('click',()=>printSheets(models().map(modelHtml)));
}

// ---------- params tab ----------
const PF=[
  ['Провайдер и туннель','Пункты 2, 6 и 7',[['netIspHq','ISP ↔ HQ-RTR',1],['netIspBr','ISP ↔ BR-RTR',1],['netTun','Сеть туннеля',1],['tun','Технология туннеля',0,[['gre','GRE'],['ipip','IP-in-IP']]],['ospfPass','Пароль OSPF',1]]],
  ['Пользователи и SSH','Пункты 3 и 5',[['adm','Логин на роутерах',1],['admPass','Пароль на роутерах',1],['su','Логин на серверах',1],['suPass','Пароль на серверах',1],['uid','UID на серверах',1],['sshPort','Порт SSH',1],['maxTries','Попыток входа',1],['banner','Текст баннера',1,null,1]]],
  ['Домен, время и DNS','Пункты 9, 10 и 11',[['dom','Домен',1],['tz','Часовой пояс',0,Object.keys(TZ).map(k=>[k,k])],['fwd1','Внешний DNS 1',1],['fwd2','Внешний DNS 2',1],['dockerTo','Куда указывает docker',0,[['hq','ISP в сторону HQ-RTR, web — в сторону BR'],['br','ISP в сторону BR-RTR, web — в сторону HQ']],1]]]
];
function field(k,l,mono,opts,full){
  const v=C[k]??'';
  return '<div class="f'+(full?' full':'')+'"><label for="p_'+k+'">'+l+'</label>'+(opts?'<select id="p_'+k+'" data-k="'+k+'">'+opts.map(([a,b])=>'<option value="'+esc(a)+'"'+(a===v?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select>'
    :'<input id="p_'+k+'" data-k="'+k+'"'+(mono?' class="mono"':'')+' value="'+esc(v)+'">')+'</div>';
}
function renderParams(m){
  const lanBox=([k,n])=>'<div class="lan"><div class="lt"><b>'+(k==='mgmt'?'Сеть управления':'Сеть '+n)+'</b><span class="calc" id="calc_'+k+'"></span></div><div class="sentence">'+
    (C.addrMode==='given'?'Адрес <input class="mono w-ip" id="p_'+k+'Base" data-k="'+k+'Base" aria-label="Адрес сети '+n+'" value="'+esc(C[k+'Base'])+'">,':'')+' вмещать '+
    '<select id="p_'+k+'Rule" data-k="'+k+'Rule" aria-label="Правило '+n+'"><option value="le"'+(C[k+'Rule']==='le'?' selected':'')+'>не более</option><option value="ge"'+(C[k+'Rule']==='ge'?' selected':'')+'>не менее</option></select> '+
    '<input class="mono w-n" id="p_'+k+'N" data-k="'+k+'N" aria-label="Число адресов '+n+'" inputmode="numeric" value="'+esc(C[k+'N'])+'"> адресов'+
    (k==='br'?'':', VLAN <input class="mono w-v" id="p_'+k+'Vid" data-k="'+k+'Vid" aria-label="VLAN '+n+'" inputmode="numeric" value="'+esc(C[k+'Vid'])+'">')+'</div></div>';
  m.innerHTML='<div class="bar"><p>Правьте любые значения. Задание, ключ и скрипты пересчитываются сразу. Изменённый вариант нельзя открыть по коду, поэтому для группы лучше брать варианты без правок.</p><div class="acts"><button type="button" class="btn" id="resetP">Вернуть значения варианта</button></div></div><div id="pmsgs"></div>'+
    '<div class="form" id="pform"><div class="fg"><h3>Локальные сети</h3><p class="sub">Пункты 1 и 4</p>'+
    field('addrMode','Как заданы адреса',0,[['given','Адрес каждой сети указан в задании'],['vlsm','Нарезать из общего блока (VLSM)']],1)+
    (C.addrMode==='vlsm'?field('block','Общий блок',1):'')+LANS.map(lanBox).join('')+'</div>'+
    PF.map(([t,sub,fs])=>'<div class="fg"><h3>'+t+'</h3><p class="sub">'+sub+'</p><div class="row">'+fs.map(f=>field(...f)).join('')+'</div></div>').join('')+'</div>';
  const upd=()=>{ $('#pmsgs').innerHTML=msgsHtml(); LANS.forEach(([k])=>{ const e=$('#calc_'+k), n=R.lans[k]; e.textContent=n?n.cidr+' · маска '+n.mask+' · '+n.size+' адр.':'—' }) };
  m.querySelectorAll('[data-k]').forEach(el=>{
    el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
      const k=el.dataset.k; C=Object.assign({},C,{[k]:el.value.trim()});
      if(k==='addrMode'&&C.addrMode==='vlsm'&&!parseCidr(C.block)){ const p=String(C.srvBase).split('.'); C.block=p.slice(0,3).join('.')+'.0/24' }
      if(k==='addrMode'&&C.addrMode==='given'&&R.ok) fillBases(C,R);
      S.customOn=true; S.student=null; recompute(); save(); renderHead();
      if(k==='addrMode') renderParams(m); else upd();
    });
  });
  $('#resetP').addEventListener('click',()=>{ load(S.lv,S.num,S.mask); toast('Значения варианта '+codeOf(C)+' восстановлены') });
  upd();
}

// ---------- settings tab ----------
function renderSettings(m){
  const f=(k,l)=>'<div class="f"><label for="s_'+k+'">'+l+'</label><input class="mono" id="s_'+k+'" data-s="'+k+'" value="'+esc(ST[k])+'"></div>';
  m.innerHTML='<div class="bar"><p>Эти настройки относятся к вашему стенду и к оценке, а не к варианту. Они сохраняются в браузере и действуют для всех вариантов.</p><div class="acts"><button type="button" class="btn" id="resetS">Вернуть по умолчанию</button></div></div>'+
    '<div class="form"><div class="fg"><h3>Операционные системы</h3><p class="sub">Серверы и клиент — всегда Альт</p><div class="f"><label for="s_rtrOs">ISP, HQ-RTR и BR-RTR</label><select id="s_rtrOs" data-s="rtrOs"><option value="astra"'+(ST.rtrOs==='astra'?' selected':'')+'>Astra Linux CE</option><option value="alt"'+(ST.rtrOs==='alt'?' selected':'')+'>Альт Сервер</option></select><span class="hint">Меняет скрипты, решение вручную и таблицу 1 в задании.</span></div>'+
    '<div class="f"><label for="s_autoReboot">После шага «База»</label><select id="s_autoReboot" data-s="autoReboot"><option value="no"'+(ST.autoReboot==='no'?' selected':'')+'>Не перезагружать, reboot наберу сам</option><option value="yes"'+(ST.autoReboot==='yes'?' selected':'')+'>Сразу перезагрузить машину</option></select></div></div>'+
    '<div class="fg"><h3>Имена интерфейсов</h3><p class="sub">Посмотрите на машинах командой ip -br a</p><div class="row">'+
    f('ifIspWan','ISP → интернет')+f('ifIspHq','ISP → HQ')+f('ifIspBr','ISP → BR')+f('ifHqWan','HQ-RTR → ISP')+f('ifHqLan','HQ-RTR → офис')+f('ifBrWan','BR-RTR → ISP')+f('ifBrLan','BR-RTR → офис')+f('ifSrv','HQ-SRV и BR-SRV')+f('ifCli','HQ-CLI')+'</div></div>'+
    '<div class="fg"><h3>Имена ВМ в VirtualBox</h3><p class="sub">Для команды VBoxManage, так же как в левом списке VirtualBox</p><div class="row">'+
    f('vmIsp','ВМ ISP')+f('vmHqRtr','ВМ HQ-RTR')+f('vmBrRtr','ВМ BR-RTR')+f('vmHqSrv','ВМ HQ-SRV')+f('vmBrSrv','ВМ BR-SRV')+f('vmHqCli','ВМ HQ-CLI')+'</div></div>'+
    '<div class="fg"><h3>Баллы за пункты</h3><p class="sub">Сейчас всего <b id="wTot">'+fmt(totalW())+'</b> б. Поставьте свои значения по критериям оценки.</p><div class="row">'+
    ITEM_NAMES.map((n,i)=>'<div class="f"><label for="w'+i+'">'+(i+1)+'. '+n+'</label><input class="mono" id="w'+i+'" data-w="'+i+'" inputmode="decimal" value="'+fmt(ST.weights[i])+'"></div>').join('')+'</div></div></div>';
  m.querySelectorAll('[data-s]').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{ ST[el.dataset.s]=el.value.trim(); store.set(KEY+'.stand',ST); recompute(); renderHead() }));
  m.querySelectorAll('[data-w]').forEach(el=>el.addEventListener('input',()=>{ const v=parseFloat(el.value.replace(',','.')); ST.weights[+el.dataset.w]=isFinite(v)&&v>=0?v:0; store.set(KEY+'.stand',ST); $('#wTot').textContent=fmt(totalW()) }));
  $('#resetS').addEventListener('click',()=>{ ST=Object.assign({},STAND_DEF,{weights:WEIGHTS_DEF.slice()}); store.set(KEY+'.stand',ST); recompute(); renderSettings(m); toast('Настройки по умолчанию') });
}

function recompute(){ R=compute(C); A=R.ok?addrs(C,R):null; G=R.ok?gen(C,ST,R):null; CK=R.ok?checks(C,R,A):null }
function render(){ recompute(); save(); renderHead(); renderTabs(); renderMain() }
J.subs.push(()=>{ if(S.tab==='journal'||(S.tab==='key'&&S.student)) renderMain() });
onSaveReady(()=>{ if(DL) renderMain() });
render();
