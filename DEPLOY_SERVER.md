# 服务器部署指南（方案二：国内轻量云服务器）

把「AI 代理 + 页面」一起部署到公网，评委可直接在线体验完整功能（行情实时 + DeepSeek 真实分析）。

## 一、买服务器

- 推荐：**腾讯云轻量应用服务器** 或 **阿里云轻量应用服务器**
- 配置：2 核 2G、带宽 3M 起即可；系统选 **Ubuntu 22.04**
- 地域：选离评委/你近的国内节点（如上海、广州）
- 价格：新用户活动约 ¥50~100/年；学生认证更便宜
- 不需要域名：先用 `http://服务器IP:8787` 访问即可（IP 直访无需备案）

## 二、开放防火墙端口

- 腾讯云控制台 → 防火墙 / 阿里云 → 安全组：放行 **8787**（TCP），来源 `0.0.0.0/0`
- 后续用 80 端口时再放行 80

## 三、登录服务器

```bash
ssh root@服务器IP
```

（阿里云默认用户可能是 `ubuntu`；控制台也有网页版终端）

## 四、一键部署（systemd 方案，推荐）

把下面整段粘贴到服务器终端执行（注意最后一步填你的 DeepSeek key）：

```bash
# 1. 安装 Node 20（Ubuntu 22.04）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git
node -v   # 应显示 v20.x

# 2. 拉取项目
git clone https://github.com/JadeGovernor/finance-penguin.git /opt/finance-penguin
cd /opt/finance-penguin

# 3. 安装依赖并构建
npm install
npm run build

# 4. 配置 DeepSeek key（文件权限 600，不会提交到 git）
cat > .env.local << 'KEY'
DEEPSEEK_API_KEY=sk-你的key
KEY
chmod 600 .env.local

# 5. 注册 systemd 服务并启动
cp deploy/finance-penguin.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now finance-penguin

# 6. 验证
curl http://127.0.0.1:8787/api/health
```

`/api/health` 返回 `{"ok":true,"keyConfigured":true,...}` 即成功。

## 五、浏览器访问

- 打开 `http://服务器IP:8787/finance-penguin/`
- 访问密码：`CHEZHI`
- 测「绿地谐波」→ 应能自动识别、抓真实行情并完成 AI 分析

## 六、Docker 方案（备选）

服务器装了 Docker 后：

```bash
cd /opt/finance-penguin
cat > .env.local << 'KEY'
DEEPSEEK_API_KEY=sk-你的key
KEY
chmod 600 .env.local
docker compose -f deploy/docker-compose.yml up -d --build
curl http://127.0.0.1:8787/api/health
```

国内拉 Docker 镜像慢的话，先配置镜像加速器（腾讯云/阿里云控制台有免费加速地址）。

## 七、日常维护

```bash
# 查看日志
journalctl -u finance-penguin -f

# 重启
systemctl restart finance-penguin

# 更新到最新代码
cd /opt/finance-penguin && git pull && npm install && npm run build && systemctl restart finance-penguin
```

## 八、可选：绑定域名 + HTTPS

国内服务器绑定域名**必须 ICP 备案**（约 1~2 周）。备案完成后：

```bash
# 1. 装 nginx 并启用反代
apt-get install -y nginx
cp deploy/nginx.conf /etc/nginx/sites-available/finance-penguin
ln -s /etc/nginx/sites-available/finance-penguin /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 2. 安全组/防火墙再放行 80
# 3. 域名解析 A 记录指向服务器 IP
# 4. 用 certbot 申请免费 HTTPS 证书
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d 你的域名
```

## 安全提醒

- DeepSeek key 只写在服务器 `.env.local`（chmod 600），不要贴到聊天/仓库/网页
- 服务器只开放必要端口（8787、80、22）
- 别用弱密码，建议改用 SSH 密钥登录
