// ===== modules 2 and 3: solution commands =====
// Each item: {n,title,why,blocks:[[machines,code]],check:[[cmd]]}. "machines" is a list like "HQ-RTR и BR-RTR";
// a "#2" suffix puts the block into a later script for that machine.
// escape for double quotes / unquoted heredocs, and for compose files ($ → $$)
const dq = v => String(v).replace(/[$`"\\]/g,'\\$&');
const cz = v => String(v).replace(/\$/g,'$$$$');
const SUDO_PATH = cmds => cmds.split(/[,\s]+/).filter(Boolean).map(x=>'$(command -v '+x+')').join(', ');
function persistFw(alt){ return alt ? 'iptables-save > /etc/sysconfig/iptables\nsystemctl enable iptables'
  : 'DEBIAN_FRONTEND=noninteractive apt install -y iptables-persistent\nnetfilter-persistent save' }
const chronyCfg = (lines,svc) => `CONF=/etc/chrony.conf; [ -d /etc/chrony ] && CONF=/etc/chrony/chrony.conf
cat > $CONF <<EOF
${lines}
driftfile /var/lib/chrony/drift
makestep 1.0 3
rtcsync
EOF
systemctl enable chronyd 2>/dev/null || systemctl enable chrony
systemctl restart chronyd 2>/dev/null || systemctl restart chrony`;
const mountAdd = `mkdir -p /mnt/add
mountpoint -q /mnt/add || mount /dev/sr0 /mnt/add 2>/dev/null || mount /dev/cdrom /mnt/add
ls /mnt/add`;
const dockerInst = `apt-get update
apt-get install -y docker-engine
apt-get install -y docker-compose-v2 2>/dev/null || apt-get install -y docker-compose
systemctl enable --now docker
DC="docker compose"; docker compose version >/dev/null 2>&1 || DC=docker-compose`;
function nginxConf(c,A,o){
  const ssl=!!o.ssl;
  const m2=c.m2, D=c.dom, auth=`  auth_basic "Restricted";\n  auth_basic_user_file /etc/nginx/.htpasswd;\n`;
  const site=(name,to,withAuth)=>ssl?`server {
  listen 80;
  server_name ${name};
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl;
  server_name ${name};
  ssl_certificate /etc/nginx/ssl/${name.split('.')[0]}.crt;
  ssl_certificate_key /etc/nginx/ssl/${name.split('.')[0]}.key;
${withAuth?auth:''}  location / {
    proxy_pass http://${to};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`:`server {
  listen 80;
  server_name ${name};
${withAuth?auth:''}  location / {
    proxy_pass http://${to};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}`;
  return `CONF=/etc/nginx/conf.d/proxy.conf; [ -d /etc/nginx/sites-enabled.d ] && CONF=/etc/nginx/sites-enabled.d/proxy.conf
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled.d/default.conf
cat > $CONF <<'EOF'
${site('web.'+D,A.hqWan+':'+m2.hqFwd,!!o.auth)}

${site('docker.'+D,A.brWan+':'+m2.brFwd,false)}
EOF
nginx -t && systemctl enable nginx && systemctl restart nginx`;
}
function items23(mod,c,st,r){
  c=withM23(c); const m2=c.m2, m3=c.m3, A=addrs(c,r), L=r.lans, D=c.dom, alt=st.rtrOs==='alt', WG=workgroup(D), U=usersOf(m2);
  const P=alt?'apt-get update\napt-get install -y':'apt update\napt install -y';
  const it=(n,title,why,blocks,check)=>({n,title,why,blocks,check:check.map(x=>[x])});
  const wanHq='WAN='+st.ifHqWan+'\n', wanBr='WAN='+st.ifBrWan+'\n';
  if(mod===2){
    const dnat=(wan,rules)=>wan+rules.map(([p,to])=>`iptables -t nat -C PREROUTING -i $WAN -p tcp --dport ${p} -j DNAT --to-destination ${to} 2>/dev/null || iptables -t nat -A PREROUTING -i $WAN -p tcp --dport ${p} -j DNAT --to-destination ${to}`).join('\n')+'\n'+persistFw(alt);
    const raidN=m2.raidDisks.trim().split(/\s+/).length;
    return [
      it(1,'Samba DC и домен','BR-SRV становится контроллером домена со встроенным DNS. HQ-SRV отвечает за записи зоны '+D+', а остальное по домену (SRV-записи Kerberos и LDAP) пересылает на BR-SRV. После этого HQ-CLI можно ввести в домен.',[
        ['BR-SRV','IF='+st.ifSrv+`
apt-get update
apt-get install -y task-samba-dc
for s in smb nmb krb5kdc slapd bind; do systemctl disable --now $s 2>/dev/null; done
rm -f /etc/samba/smb.conf
rm -rf /var/lib/samba /var/cache/samba
mkdir -p /var/lib/samba/sysvol
samba-tool domain provision --realm=${D.toUpperCase()} --domain=${WG} --adminpass='${m2.dcPass}' --dns-backend=SAMBA_INTERNAL --server-role=dc --use-rfc2307 --option="dns forwarder = ${A.hqSrv}"
cp -f /var/lib/samba/private/krb5.conf /etc/krb5.conf
systemctl enable --now samba
sleep 5

samba-tool group add ${m2.grp}
for u in ${U.join(' ')}; do
  samba-tool user add $u '${m2.usrPass}'
  samba-tool group addmembers ${m2.grp} $u
done
samba-tool user list`],
        ['HQ-SRV',`grep -q '^server=/${D}/' /etc/dnsmasq.conf || echo 'server=/${D}/${A.brSrv}' >> /etc/dnsmasq.conf
systemctl restart dnsmasq`],
        ['HQ-CLI',`apt-get update
apt-get install -y task-auth-ad-sssd
system-auth write ad ${D} hq-cli ${WG} 'administrator' '${m2.dcPass}'
control sudo public
cat > /etc/sudoers.d/${m2.grp} <<EOF
%${m2.grp} ALL=(ALL) NOPASSWD: ${SUDO_PATH(m2.sudoCmds)}
EOF
chmod 440 /etc/sudoers.d/${m2.grp}
echo "Перезагрузите HQ-CLI и войдите как ${U[0]}"`]],
        ['samba-tool domain info 127.0.0.1','samba-tool group listmembers '+m2.grp,'id '+U[0]+'   # на HQ-CLI','sudo -l   # под '+U[0]+' на HQ-CLI']),
      it(2,'RAID и NFS','mdadm собирает массив, его описание сохраняется в /etc/mdadm.conf, а строка в /etc/fstab монтирует его после перезагрузки. NFS открывает каталог только для сети HQ-CLI '+L.cli.cidr+'.',[
        ['HQ-SRV',`apt-get update
apt-get install -y mdadm nfs-server
lsblk
mdadm --zero-superblock --force ${m2.raidDisks} 2>/dev/null
yes | mdadm --create /dev/md0 --level=${m2.raidLvl} --raid-devices=${raidN} ${m2.raidDisks}
mkfs.ext4 -F /dev/md0
mdadm --detail --scan > /etc/mdadm.conf
mkdir -p ${m2.raidMnt}
grep -q '^/dev/md0 ' /etc/fstab || echo '/dev/md0 ${m2.raidMnt} ext4 defaults 0 0' >> /etc/fstab
mount -a

mkdir -p ${m2.nfsDir}
chmod 777 ${m2.nfsDir}
grep -q '^${m2.nfsDir} ' /etc/exports || echo '${m2.nfsDir} ${L.cli.cidr}(rw,sync,no_subtree_check,no_root_squash)' >> /etc/exports
systemctl enable --now nfs
exportfs -ra`],
        ['HQ-CLI',`apt-get install -y nfs-clients
mkdir -p ${m2.nfsMnt}
grep -q ' ${m2.nfsMnt} ' /etc/fstab || echo '${A.hqSrv}:${m2.nfsDir} ${m2.nfsMnt} nfs defaults,_netdev 0 0' >> /etc/fstab
mount -a`]],
        ['cat /proc/mdstat','df -h '+m2.raidMnt,'exportfs -v','df -h '+m2.nfsMnt+'   # на HQ-CLI']),
      it(3,'Сервер времени chrony','ISP раздаёт время со стратумом '+m2.ntpStratum+'. Клиенты HQ обращаются к адресу ISP в сторону HQ, клиенты BR — в сторону BR.',[
        ['ISP',P+' chrony\n'+chronyCfg('local stratum '+m2.ntpStratum+'\nallow 0.0.0.0/0')],
        ['HQ-RTR, HQ-SRV и HQ-CLI',(alt?'':'apt install -y chrony 2>/dev/null || apt-get install -y chrony\n')+chronyCfg('server '+A.ispHq+' iburst')],
        ['BR-RTR и BR-SRV',(alt?'':'apt install -y chrony 2>/dev/null || apt-get install -y chrony\n')+chronyCfg('server '+A.ispBr+' iburst')]],
        ['chronyc clients   # на ISP','chronyc sources   # на клиентах','timedatectl']),
      it(4,'Ansible','Ansible ходит по SSH ключом root с BR-SRV. На серверах это пользователь '+c.su+' на порту '+c.sshPort+', на роутерах '+c.adm+', на HQ-CLI заводим того же '+c.su+'. interpreter_python=auto_silent убирает предупреждения.',[
        ['HQ-CLI',users(c.su,c.uid,c.suPass,true)+'\nsystemctl enable --now sshd'],
        ['HQ-RTR и BR-RTR','systemctl enable --now ssh 2>/dev/null || systemctl enable --now sshd'],
        ['BR-SRV#2',`apt-get update
apt-get install -y ansible sshpass
mkdir -p /etc/ansible
cat > /etc/ansible/ansible.cfg <<EOF
[defaults]
inventory = /etc/ansible/hosts
host_key_checking = False
interpreter_python = auto_silent
EOF
cat > /etc/ansible/hosts <<EOF
[servers]
hq-srv ansible_host=${A.hqSrv} ansible_port=${c.sshPort} ansible_user=${c.su}

[clients]
hq-cli ansible_host=${A.hqCli} ansible_user=${c.su}

[routers]
hq-rtr ansible_host=${A.hqSrvGw} ansible_user=${c.adm}
br-rtr ansible_host=${A.brGw} ansible_user=${c.adm}

[all:vars]
ansible_become=true
EOF
[ -f /root/.ssh/id_rsa ] || ssh-keygen -t rsa -N '' -f /root/.ssh/id_rsa
sshpass -p '${c.suPass}' ssh-copy-id -o StrictHostKeyChecking=no -p ${c.sshPort} ${c.su}@${A.hqSrv}
sshpass -p '${c.suPass}' ssh-copy-id -o StrictHostKeyChecking=no ${c.su}@${A.hqCli}
sshpass -p '${c.admPass}' ssh-copy-id -o StrictHostKeyChecking=no ${c.adm}@${A.hqSrvGw}
sshpass -p '${c.admPass}' ssh-copy-id -o StrictHostKeyChecking=no ${c.adm}@${A.brGw}
ansible all -m ping`]],
        ['ansible all -m ping']),
      it(5,'Docker на BR-SRV','Образы загружаются с диска Additional.iso, compose-файл поднимает базу и приложение. Порт внутри образа приложения проверьте командой docker inspect, если он не 8000.',[
        ['BR-SRV',dockerInst+'\n'+mountAdd+`
for f in /mnt/add/docker/*.tar; do docker load -i "$f"; done
docker images
IMG_DB=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -m1 -i mariadb)
IMG_APP=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -v -i mariadb | head -1)
APP_PORT=$(docker inspect -f '{{range $p, $c := .Config.ExposedPorts}}{{$p}} {{end}}' $IMG_APP | grep -o '[0-9]*' | head -1); APP_PORT=\${APP_PORT:-8000}
cat > /root/${m2.dockApp}.yml <<EOF
services:
  db:
    image: $IMG_DB
    container_name: db
    restart: always
    environment:
      MARIADB_DATABASE: ${m2.dockDb}
      MARIADB_USER: ${m2.dockUser}
      MARIADB_PASSWORD: ${dq(cz(m2.dockPass))}
      MARIADB_ROOT_PASSWORD: ${dq(cz(m2.dockPass))}
    volumes:
      - db_data:/var/lib/mysql
  ${m2.dockApp}:
    image: $IMG_APP
    container_name: ${m2.dockApp}
    restart: always
    ports:
      - "${m2.dockPort}:$APP_PORT"
    environment:
      DB_TYPE: maria
      DB_HOST: db
      DB_PORT: 3306
      DB_NAME: ${m2.dockDb}
      DB_USER: ${m2.dockUser}
      DB_PASS: ${dq(cz(m2.dockPass))}
    depends_on:
      - db
volumes:
  db_data:
EOF
$DC -f /root/${m2.dockApp}.yml up -d
docker ps`]],
        ['docker ps','curl -sI http://localhost:'+m2.dockPort]),
      it(6,'Веб-приложение на HQ-SRV','lamp-server ставит Apache, PHP и MariaDB одним пакетом. Файлы и дамп берутся с диска, в index.php вписываются данные базы.',[
        ['HQ-SRV',`apt-get update
apt-get install -y lamp-server
systemctl enable --now httpd2 mariadb
`+mountAdd+`
ls /mnt/add/web
cp -r /mnt/add/web/* /var/www/html/
rm -f /var/www/html/index.html
mariadb -e "CREATE DATABASE IF NOT EXISTS ${m2.webDb}; CREATE USER IF NOT EXISTS '${m2.webUser}'@'localhost' IDENTIFIED BY '${dq(m2.webPass)}'; GRANT ALL ON ${m2.webDb}.* TO '${m2.webUser}'@'localhost'; FLUSH PRIVILEGES;"
DUMP=$(ls /mnt/add/web/*.sql 2>/dev/null | head -1); [ -n "$DUMP" ] && mariadb ${m2.webDb} < "$DUMP"
sed -i -E 's/^(\\$(servername|host|dbhost)[[:space:]]*=).*/\\1 "localhost";/; s/^(\\$(username|user|dbuser)[[:space:]]*=).*/\\1 "${m2.webUser}";/; s/^(\\$(password|pass|dbpass)[[:space:]]*=).*/\\1 "${m2.webPass}";/; s/^(\\$(dbname|database|db)[[:space:]]*=).*/\\1 "${m2.webDb}";/' /var/www/html/index.php
grep -n -E '^\\$' /var/www/html/index.php
systemctl restart httpd2`]],
        ['curl -s http://localhost | head','mariadb -e "SHOW DATABASES"']),
      it(7,'Проброс портов','DNAT на внешнем интерфейсе роутера отправляет входящие подключения на сервер офиса.',[
        ['HQ-RTR',dnat(wanHq,[[m2.hqFwd,A.hqSrv+':80'],[c.sshPort,A.hqSrv+':'+c.sshPort]])],
        ['BR-RTR',dnat(wanBr,[[m2.brFwd,A.brSrv+':'+m2.dockPort],[c.sshPort,A.brSrv+':'+c.sshPort]])]],
        ['iptables -t nat -S PREROUTING','curl -sI http://'+A.hqWan+':'+m2.hqFwd+'   # с ISP','curl -sI http://'+A.brWan+':'+m2.brFwd+'   # с ISP']),
      it(8,'Обратный прокси nginx','ISP принимает запросы по имени и передаёт их на проброшенные порты HQ-RTR и BR-RTR.',[
        ['ISP',P+' nginx\n'+nginxConf(c,A,{ssl:false,auth:false})]],
        ['nginx -t','curl -sI -H "Host: web.'+D+'" http://localhost','curl -sI -H "Host: docker.'+D+'" http://localhost']),
      it(9,'Web-аутентификация','Файл паролей создаётся через openssl, отдельный пакет htpasswd не нужен. Конфигурация nginx перезаписывается уже с auth_basic для web.'+D+'.',[
        ['ISP',`printf '%s:%s\\n' '${m2.authUser}' "$(openssl passwd -apr1 '${m2.authPass}')" > /etc/nginx/.htpasswd
chmod 644 /etc/nginx/.htpasswd
`+nginxConf(c,A,{ssl:false,auth:true})]],
        ['curl -sI -H "Host: web.'+D+'" http://localhost   # 401','curl -sI -u '+m2.authUser+':'+m2.authPass+' -H "Host: web.'+D+'" http://localhost   # 200']),
      it(10,'Яндекс Браузер','Пакет есть в репозитории Альт.',[['HQ-CLI','apt-get update\napt-get install -y yandex-browser-stable']],['rpm -q yandex-browser-stable'])
    ];
  }
  const lv=(LOGLV.find(x=>x[0]===m3.logLvl)||['warning',4])[1];
  const proto=c.tun==='gre'?'47':'4', fwPorts=m3.fwAllow.split(/[,\s]+/).filter(Boolean);
  const fwRules=[]; if(fwPorts.includes('http')||fwPorts.includes('https')){ const p=[fwPorts.includes('http')?'80':'',fwPorts.includes('https')?'443':''].filter(Boolean).join(','); fwRules.push('iptables -A FW_IN -p tcp -m multiport --dports '+p+' -j ACCEPT') }
  if(fwPorts.includes('dns')) fwRules.push('iptables -A FW_IN -p udp --dport 53 -j ACCEPT','iptables -A FW_IN -p tcp --dport 53 -j ACCEPT');
  if(fwPorts.includes('ntp')) fwRules.push('iptables -A FW_IN -p udp --dport 123 -j ACCEPT');
  if(fwPorts.includes('icmp')) fwRules.push('iptables -A FW_IN -p icmp -j ACCEPT');
  if(fwPorts.includes('ssh')) fwRules.push('iptables -A FW_IN -p tcp --dport 22 -j ACCEPT');
  const fw=wan=>wan+`iptables -N FW_IN 2>/dev/null
iptables -F FW_IN
iptables -A FW_IN -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A FW_IN -m conntrack --ctstate DNAT -j ACCEPT
iptables -A FW_IN -p ${proto} -j ACCEPT
iptables -A FW_IN -p esp -j ACCEPT
iptables -A FW_IN -p udp -m multiport --dports 500,4500 -j ACCEPT
${fwRules.join('\n')}
iptables -A FW_IN -j DROP
iptables -C INPUT -i $WAN -j FW_IN 2>/dev/null || iptables -I INPUT -i $WAN -j FW_IN
iptables -C FORWARD -i $WAN -j FW_IN 2>/dev/null || iptables -I FORWARD -i $WAN -j FW_IN
`+persistFw(alt);
  const ipsec=(me,peer)=>P+` strongswan
cat > /etc/ipsec.conf <<EOF
config setup

conn tunnel
  auto=start
  type=transport
  authby=secret
  keyexchange=ikev2
  left=${me}
  right=${peer}
  leftprotoport=${proto}
  rightprotoport=${proto}
  ike=aes256-sha256-modp2048
  esp=aes256-sha256
EOF
echo '${me} ${peer} : PSK "${m3.psk}"' > /etc/ipsec.secrets
chmod 600 /etc/ipsec.secrets
systemctl enable ipsec 2>/dev/null || systemctl enable strongswan-starter 2>/dev/null
ipsec restart
sleep 3
ipsec status`;
  const rsCli=(inst)=>inst+`
echo '*.${m3.logLvl} @@${A.hqSrv}:514' > /etc/rsyslog.d/90-remote.conf
systemctl enable rsyslog
systemctl restart rsyslog
logger -p user.${m3.logLvl} "test from $(hostname)"`;
  return [
    it(1,'Импорт пользователей из CSV','Скрипт читает файл построчно и создаёт пользователей в Samba. Сначала посмотрите первую строку файла и при необходимости поправьте порядок столбцов в строке read.',[
      ['BR-SRV',mountAdd+`
F=$(ls /mnt/add/*.csv /mnt/add/*/*.csv 2>/dev/null | head -1); [ -n "$F" ] && cp -f "$F" ${m3.csv}
head -2 ${m3.csv}
samba-tool domain passwordsettings set --complexity=off --min-pwd-length=1
cat > /root/import_users.sh <<'EOF'
#!/bin/bash
# columns: First Name;Last Name;Role;Phone;OU;Street;ZIP;City;Country;Password
tail -n +2 "$1" | tr -d '\\r' | while IFS=';' read -r fn ln role phone ou street zip city country pass; do
  [ -z "$fn" ] && continue
  login=$(echo "$fn.$ln" | tr '[:upper:]' '[:lower:]' | tr -d ' ')
  if [ -n "$ou" ]; then
    samba-tool ou add "OU=$ou" >/dev/null 2>&1 || samba-tool ou create "OU=$ou" >/dev/null 2>&1
    samba-tool user add "$login" "\${pass:-P@ssw0rd}" --given-name="$fn" --surname="$ln" --job-title="$role" --telephone-number="$phone" --userou="OU=$ou"
  else
    samba-tool user add "$login" "\${pass:-P@ssw0rd}" --given-name="$fn" --surname="$ln"
  fi
done
EOF
chmod +x /root/import_users.sh
/root/import_users.sh ${m3.csv}
samba-tool user list | wc -l`]],
      ['samba-tool user list','samba-tool ou list']),
    it(2,'Центр сертификации и HTTPS','ЦС — это ключ и самоподписанный сертификат на HQ-SRV. Им подписываются сертификаты сайтов, nginx на ISP забирает их по SSH через проброшенный порт HQ-RTR, HQ-CLI добавляет корневой сертификат в доверенные.',[
      ['HQ-SRV',`mkdir -p /root/ca && cd /root/ca
[ -f ca.key ] || openssl genrsa -out ca.key 4096
openssl req -x509 -new -key ca.key -days 3650 -subj "/CN=${m3.caName}" -out ca.crt
for n in web docker; do
  openssl genrsa -out $n.key 2048
  openssl req -new -key $n.key -subj "/CN=$n.${D}" -out $n.csr
  printf "subjectAltName=DNS:$n.${D}\\nbasicConstraints=CA:FALSE\\nkeyUsage=digitalSignature,keyEncipherment\\nextendedKeyUsage=serverAuth\\n" > $n.ext
  openssl x509 -req -in $n.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days ${m3.certDays} -extfile $n.ext -out $n.crt
done
mkdir -p /home/${c.su}/certs
cp ca.crt web.crt web.key docker.crt docker.key /home/${c.su}/certs/
chown -R ${c.su} /home/${c.su}/certs
openssl x509 -in web.crt -noout -subject -enddate`],
      ['ISP',`mkdir -p /etc/nginx/ssl
scp -P ${c.sshPort} -o StrictHostKeyChecking=no ${c.su}@${A.hqWan}:certs/{web,docker}.{crt,key} /etc/nginx/ssl/
chmod 600 /etc/nginx/ssl/*.key
`+nginxConf(c,A,{ssl:true,auth:true})],
      ['HQ-CLI',`scp -P ${c.sshPort} -o StrictHostKeyChecking=no ${c.su}@${A.hqSrv}:certs/ca.crt /etc/pki/ca-trust/source/anchors/${D}-ca.crt
update-ca-trust
# если браузер всё равно ругается: Настройки → Сертификаты → Импорт /etc/pki/ca-trust/source/anchors/${D}-ca.crt`]],
      ['curl -sI https://web.'+D+'   # на HQ-CLI, без -k','openssl s_client -connect web.'+D+':443 -servername web.'+D+' </dev/null | grep -i verify']),
    it(3,'IPsec поверх туннеля','Режим transport шифрует только пакеты туннеля (протокол '+proto+') между внешними адресами роутеров. Туннель и OSPF остаются как в Модуле 1.',[
      ['HQ-RTR',ipsec(A.hqWan,A.brWan)],['BR-RTR',ipsec(A.brWan,A.hqWan)]],
      ['ipsec status','ip xfrm state','ping -c3 '+A.tBr+'   # с HQ-RTR']),
    it(4,'Межсетевой экран','Своя цепочка FW_IN проверяет всё, что приходит снаружи на внешний интерфейс: разрешены ответы, проброшенные порты, туннель с IPsec и выбранные службы, остальное отбрасывается. Внутренние сети и туннель не ограничены.',[
      ['HQ-RTR',fw(wanHq)],['BR-RTR',fw(wanBr)]],
      ['iptables -S FW_IN','ping -c2 '+c.fwd1,'vtysh -c "show ip ospf neighbor"']),
    it(5,'Принт-сервер CUPS','cups-pdf создаёт виртуальный принтер, который сохраняет задания в PDF. HQ-CLI подключается к нему по IPP.',[
      ['HQ-SRV',`apt-get update
apt-get install -y cups cups-pdf
systemctl enable --now cups
cupsctl --remote-admin --remote-any --share-printers
PPD=$(lpinfo -m | grep -i -m1 pdf | cut -d' ' -f1)
lpadmin -p ${m3.printer} -E -v cups-pdf:/ -m "$PPD" -o printer-is-shared=true
lpoptions -d ${m3.printer}
systemctl restart cups`],
      ['HQ-CLI',`apt-get install -y cups
systemctl enable --now cups
lpadmin -p ${m3.printer} -E -v ipp://${A.hqSrv}:631/printers/${m3.printer} -m everywhere
lpoptions -d ${m3.printer}`]],
      ['lpstat -p -d','echo test | lp   # на HQ-CLI']),
    it(6,'Журналирование rsyslog','HQ-SRV слушает порт 514 и раскладывает сообщения с других машин по каталогам с их именами. Клиенты отправляют всё уровня '+m3.logLvl+' и выше. logrotate сжимает старые журналы.',[
      ['HQ-SRV',`apt-get update
apt-get install -y rsyslog-classic
cat > /etc/rsyslog.d/10-remote.conf <<'EOF'
module(load="imtcp")
input(type="imtcp" port="514")
module(load="imudp")
input(type="imudp" port="514")
template(name="RemoteLogs" type="string" string="${m3.logDir}/%HOSTNAME%/%HOSTNAME%.log")
if $fromhost-ip != "127.0.0.1" and $syslogseverity <= ${lv} then {
  action(type="omfile" dynaFile="RemoteLogs")
  stop
}
EOF
systemctl enable rsyslog
systemctl restart rsyslog
cat > /etc/logrotate.d/remote-logs <<'EOF'
${m3.logDir}/*/*.log {
  ${m3.rotate}
  maxsize ${m3.rotSize}
  rotate 4
  compress
  missingok
  notifempty
  copytruncate
}
EOF
logrotate -d /etc/logrotate.d/remote-logs 2>&1 | tail -3`],
      ['HQ-RTR и BR-RTR',rsCli(alt?'apt-get install -y rsyslog-classic 2>/dev/null':'apt install -y rsyslog')],
      ['BR-SRV',rsCli('apt-get install -y rsyslog-classic')]],
      ['ls '+m3.logDir+'/*/   # на HQ-SRV','tail '+m3.logDir+'/br-srv/br-srv.log']),
    it(7,'Мониторинг Prometheus и Grafana','Всё запускается в Docker на HQ-SRV, источник данных Prometheus подключается к Grafana автоматически. На BR-SRV работает node_exporter. Имя '+m3.monName+'.'+D+' добавляется в DNS на HQ-SRV.',[
      ['HQ-SRV',dockerInst+`
mkdir -p /root/monitoring/provisioning/datasources
cat > /root/monitoring/prometheus.yml <<'EOF'
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: node
    static_configs:
      - targets: ['${A.hqSrv}:9100', '${A.brSrv}:9100']
EOF
cat > /root/monitoring/provisioning/datasources/prometheus.yml <<'EOF'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
EOF
cat > /root/monitoring/compose.yml <<'EOF'
services:
  prometheus:
    image: prom/prometheus
    restart: always
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  grafana:
    image: grafana/grafana
    restart: always
    environment:
      GF_SECURITY_ADMIN_USER: ${m3.monUser}
      GF_SECURITY_ADMIN_PASSWORD: ${cz(m3.monPass)}
    volumes:
      - ./provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
  node-exporter:
    image: prom/node-exporter
    restart: always
    network_mode: host
    pid: host
EOF
cd /root/monitoring && $DC -f compose.yml up -d
grep -q '/${m3.monName}.${D}/' /etc/dnsmasq.conf || echo 'address=/${m3.monName}.${D}/${A.hqSrv}' >> /etc/dnsmasq.conf
systemctl restart dnsmasq`],
      ['BR-SRV','docker rm -f node-exporter 2>/dev/null\ndocker run -d --name node-exporter --restart always --net host --pid host prom/node-exporter']],
      ['curl -s http://localhost:9090/api/v1/targets | grep -o \'"health":"[a-z]*"\'','http://'+m3.monName+'.'+D+':3000   # в браузере HQ-CLI']),
    it(8,'Инвентаризация Ansible','Плейбук собирает факты с HQ-SRV и HQ-CLI и записывает имя и адрес каждой машины в отдельный файл на BR-SRV.',[
      ['BR-SRV',`mkdir -p ${m3.pcDir}
cat > /etc/ansible/get_hostname_address.yml <<'EOF'
- hosts: hq-srv,hq-cli
  gather_facts: yes
  tasks:
    - name: save hostname and address
      copy:
        dest: "${m3.pcDir}/{{ ansible_hostname }}.yml"
        content: |
          hostname: {{ ansible_fqdn }}
          address: {{ ansible_default_ipv4.address }}
      delegate_to: localhost
      become: false
EOF
ansible-playbook /etc/ansible/get_hostname_address.yml
cat ${m3.pcDir}/*.yml`]],
      ['ls '+m3.pcDir,'cat '+m3.pcDir+'/*.yml']),
    it(9,'fail2ban','Джейл sshd читает журнал systemd и блокирует адрес после '+m3.f2bTries+' ошибок на '+m3.f2bBan+' секунд.',[
      ['HQ-SRV',`apt-get update
apt-get install -y fail2ban python3-module-systemd 2>/dev/null || apt-get install -y fail2ban
cat > /etc/fail2ban/jail.d/sshd.local <<EOF
[sshd]
enabled = true
port = ${c.sshPort}
filter = sshd
backend = systemd
maxretry = ${m3.f2bTries}
findtime = 600
bantime = ${m3.f2bBan}
EOF
systemctl enable fail2ban
systemctl restart fail2ban
sleep 2
fail2ban-client status sshd`]],
      ['fail2ban-client status sshd'])
  ];
}
// group item blocks into one script per machine, in run order
const ORDER23={2:[['HQ-RTR','Пробросы портов, chrony'],['BR-RTR','Пробросы портов, chrony'],['ISP','chrony и nginx'],['BR-SRV','Samba DC, chrony, Docker'],['HQ-SRV','RAID, NFS, веб, DNS'],['HQ-CLI','Домен, NFS, браузер'],['BR-SRV#2','Ansible, когда HQ-CLI в сети']],
  3:[['BR-SRV','Импорт, журналы, мониторинг, Ansible'],['HQ-SRV','ЦС, CUPS, rsyslog, мониторинг, fail2ban'],['ISP','HTTPS на nginx'],['HQ-RTR','IPsec, экран, журналы'],['BR-RTR','IPsec, экран, журналы'],['HQ-CLI','Доверие к ЦС, принтер']]};
const VMKEY={'ISP':'vmIsp','HQ-RTR':'vmHqRtr','BR-RTR':'vmBrRtr','HQ-SRV':'vmHqSrv','BR-SRV':'vmBrSrv','HQ-CLI':'vmHqCli'};
function scripts23(mod,c,st,r){
  const items=items23(mod,c,st,r), by={};
  items.forEach(it=>it.blocks.forEach(([who,code])=>{ const step=/#2$/.test(who)?'#2':''; who.replace(/#2$/,'').replace(/^Оба роутера/,'HQ-RTR и BR-RTR').split(/\s*(?:,| и )\s*/).forEach(m=>{
    m=m.replace(/\s*\(.*\)$/,'').trim(); if(!VMKEY[m]) return; (by[m+step]=by[m+step]||[]).push('# ----- '+it.n+'. '+it.title+' -----\n'+code) }) }));
  const out=ORDER23[mod].filter(([k])=>by[k]).map(([k,when],i)=>{ const m=k.replace('#2',''), sh=m.toLowerCase()+'-m'+mod+(k.endsWith('#2')?'-2':'')+'.sh';
    return {id:k,vm:st[VMKEY[m]],machine:m,sh,title:MODS[mod].name+' на '+m+(k.endsWith('#2')?' (шаг 2)':''),when,
      text:'#!/bin/bash\n# '+m+' · '+MODS[mod].name+'\n\n'+by[k].join('\n\n')+'\n\necho DONE\n'} });
  return wrap(out,st);
}
