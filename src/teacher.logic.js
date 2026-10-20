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

