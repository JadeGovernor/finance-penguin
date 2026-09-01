# Finance Penguin 项目日志

### 2026-08-30 16:00
- 归档旧 Codex 任务（`01a03e59…`）：历史消息损坏（API invalid_request_error）systemError 无法恢复；工作转移到新对话。
- 暂停「密码门上线监控」heartbeat（fp-gate ×11、Pages built，目标达成）；初始化项目状态文件。

### 2026-08-30 16:40
- 接入真实行情：东财 push2（CORS 放行）+ 腾讯兜底，页面进入与「最新行情 · 重置」自动抓取；候选卡片显示实时价格/涨跌幅。
- 接入真实 AI：`deepseek-v4-flash` 经本地代理 `server/proxy.mjs`（端口 8787，静态托管 dist + `/api/analyze`），key 自动从 OpenClaw auth 存储读取，不落前端/仓库。
- 付费分层（演示）：免费版基础分析不限、组合体检+复盘共 10 次、单日超 100 次降智；专业版 29 元/月不限次；顶栏会员入口 + 定价弹窗。
- 踩坑：v4-flash 推理 token 占用正文预算（正文被截断）→ max_tokens 提到 10000/3000；模型输出带尾逗号 JSON → 代理容错解析。
- 验证：`npm run lint`/`build`/`tsc --noEmit` 通过；`/api/analyze` 返回完整结构化结果（9761 tokens/次）；线上 gh-pages 已切新 bundle。
- 部署：main `fa84f4e`，gh-pages `2df57ee`（含 `.nojekyll`）。
- 遗留：线上静态页 AI 需本地代理，未部署 serverless 代理；DeepSeek 余额 ¥20.95，v4-flash 推理模式单次约 1 万 token，注意用量。

### 2026-08-30 17:20
- 复盘管理改造（用户反馈：复盘删不掉、堆积）：
  - 新增删除（此前复盘列表没有删除入口）；新增收藏置顶（置顶区置于最上）。
  - 历史复盘按月收纳、组内按日细分，月份标题可点击收起/展开（缩进层级）。
  - 新增重命名（modal 输入，覆盖默认标题）；顺带修复默认标题笔误「中级宣传」→ 取留档文件名/类型名。
- 验证：lint / tsc --noEmit / build 通过；本地 8787 与线上 gh-pages 均切到新 bundle `index-iF_vBlDe.js`。
- 部署：main `7c29144`，gh-pages `2c2fe78`。

### 2026-08-30 17:17
- 修复「点击复盘教练黑屏」：根因是生成复盘后新增记录立即渲染历史列表时 `Star`（收藏图标）未从 lucide-react 导入 → `ReferenceError: Star is not defined`，React 整体卸载白屏（Vite dev + 临时 DebugBoundary 抓到真实堆栈）。
- 新增全局 `ErrorBoundary`（`src/components/ErrorBoundary.tsx`，`main.tsx` 包裹），渲染异常不再白屏，改为「页面出了一点问题 + 重新加载」。
- 顺带落地：`src/lib/storage.ts` localStorage 安全包装器（plan.ts / HomePage.tsx 改走 storageGet/Set/Remove）；`server/proxy.mjs` serveStatic 剥离 `/finance-penguin` 前缀、`/` 302 到 `/finance-penguin/`。
- 验证：lint / tsc --noEmit / build 通过；本地 8787 全流程回归（生成复盘、收藏置顶、重命名、删除）正常；线上 gh-pages 已切新 bundle `index-B-S2WJRN.js`。
- 部署：main `7d3e9e7`，gh-pages `e50ec7a`。
- 提醒：浏览器旧链接是残缺的 `https://jadegovernor.github.io/finance-penguin/（密码`，请用干净链接 `https://jadegovernor.github.io/finance-penguin/`。

### 2026-08-30 18:10
- 个股分析真实能力修复（用户反馈：输入个股名被拦「请补充观点、方向和时间」；分析 demo 外股票报错）：
  - 根因①：个股输入校验 `<8 字符` 拦截只输股票名的用户；根因②：行情快照只含 demo 股票，prompt 禁止选快照外标的 → 模型返回空 candidates → 前端 `candidates[0]` 为 undefined 崩溃。
  - 新增 `/api/resolve`：解析顺序 = 6 位代码/带后缀 → 东财 searchapi type=14（中文名/拼音/代码）→ DeepSeek 轻量纠正错别字（「绿地谐波」→「绿的谐波 688017.SH」）→ 全部失败明确提示。
  - 个股交互：校验放宽为 ≥2 字符直接分析；输入框提示「输入股票名称或 6 位代码」；新增可折叠选填区「补充你的判断/方向/时间（可选）」；「Mock 行情」标注改为「东财 + 腾讯实时行情」。
  - 分析流程：先 resolve 目标股 → 抓真实行情进快照（严格模式：抓不到则中止并提示）→ `targetStock` 注入 prompt（规则：必须含目标股、价格用快照真实值、禁止虚构）→ 候选不含目标股时友好报错不崩溃。
  - 后端健壮性：extractJson 失败自动重试一次（DeepSeek 偶发输出格式异常）。
- 验证：lint / tsc / build 通过；浏览器端到端「绿地谐波」全流程成功（纠正 688017.SH → 委员会分析 → 综合判断 62 分，标注 17:41 实时行情）；市场观点模式回归候选卡片显示真实价（中际旭创 ¥858.35 等）；`/api/resolve` 六种输入（代码/后缀/中文名/拼音/错别字/无效）均符合预期。
- 部署：main `0c2b433`，gh-pages `ec86df2`（线上 bundle `index-CIcdfZH2.js`）。
- 遗留：线上 gh-pages 无本地代理，AI 分析/股票解析需本机 127.0.0.1:8787（行情仍实时）。

### 2026-08-30 18:15
- 用户反馈线上输入「绿地谐波」报「股票识别失败」。根因：线上 gh-pages 静态托管无 AI 代理，POST `/api/resolve` 返回 405 → 前端抛「股票识别失败」。本地 8787 三次调用均成功（deepseek 纠正 688017.SH）。
- 解析逻辑改为 AI 判断优先：纯代码格式（6 位/带后缀）机器直析；其余一律 DeepSeek 识别（可纠正错别字，失败自动重试一次）；AI 不可用/失败时东财 suggest 兜底；全部失败返回可操作提示（建议直接输 6 位代码）。
- 前端失败文案优化：不再出现含糊的「股票识别失败」；线上无代理时提示用本地 8787。
- 验证：lint/tsc/build 通过；浏览器端到端「绿地谐波」成功（AI 识别 → 真实行情 → 委员会 → 综合判断 57 分）；curl 四类输入符合预期。
- 部署：main `9e170ba`，gh-pages `81c5a7f`（线上 bundle `index-Cjg2FXFB.js`）。
- 遗留：线上 AI 可用性取决于 serverless 代理是否部署（本机无 wrangler/vercel，需用户账号授权）。

### 2026-08-31 22:50
- 方案二落地：腾讯云轻量服务器（北京，2C2G Ubuntu 22.04.5）部署线上完整版：
  - 免密登录：控制台密钥对（codex.pem）绑定实例，root 密码登录被拒（SSH 配置不允许）→ 改用密钥免密。
  - Node 20.18.0 装 /usr/local（npmmirror 二进制）；npm 源切 npmmirror。
  - 踩坑：package-lock.json 依赖 URL 指向快手内网源（npm.corp.kuaishou.com）→ 服务器 ENOTFOUND；且 @codeflicker/appwrite 为快手私有包公开源 404 → 从项目移除该未使用的二期预留依赖（删除 src/lib/appwrite.ts + package.json 依赖），lock 批量 sed 替换源域名后安装成功（572 包）。
  - systemd 服务 finance-penguin（/opt/finance-penguin，User=ubuntu，EnvironmentFile=.env.local，DEEPSEEK_API_KEY 来自本机 OpenClaw 存储，未落仓库）。
  - 验证：/api/health ok + keyConfigured；页面 200；/api/resolve「绿地谐波」→ 688017.SH；/api/analyze 完整分析成功（绿的谐波 ¥300.49 +2.91% 盘中实时，综合判断 65 分）。
- 公网地址：http://49.232.16.132:8787/finance-penguin/（需控制台防火墙放行 8787）。
- 待办：控制台放行 8787 后公网验证；本地 git push（网络此前不通，需补推 831c4b0/13dba6a/移除 appwrite 变更）。

### 2026-08-31 22:55
- Token 成本测算（替代此前笼统的 ¥6.72/用户/月）：`docs/token-cost-model.md`，按 DeepSeek 官方最新计价（deepseek-v4-flash，2026-08-31 抓取）与实测 token 数分档测算。
  - 计价：输入命中缓存 $0.007/1M（off-peak）/ $0.014（peak）；未命中 $0.22/$0.44；输出 $0.66/$1.32；peak = 北京工作日 9-12、14-18，其余半价；汇率 7.2。
  - 单次：完整分析 ≈8,000 tokens（3,500 入 + 4,500 出）≈¥0.024（off-peak）；降智 ≈6,000 ≈¥0.015；resolve ≈400 ≈¥0.001。
  - 免费版：典型 36 次/月 ≈288k ≈¥0.9-1.7；重度 110 次/月 ≈760k ≈¥2.1-4.1；极端滥用 3,000 次/月 ≈¥72（风控边界，附说明）。
  - 进阶版（假设 ¥9.9/月、50 次高级/月、不降智，待确认）：典型 ≈480k ≈¥1.5-2.9；重度 ≈1.2M ≈¥3.6-7.3。
  - 专业版（¥29/月）：典型 90 次 ≈720k ≈¥2.2-4.4；重度 280 次 ≈2.24M ≈¥6.8-13.5（毛利率 >50%）。
  - 口径：组合体检/复盘当前为前端模板不耗 token，按最终版接入真实 AI 估算；PRD 4.7 目前仅免费/专业两档，进阶版定价与配额需产品确认。

### 2026-08-31 23:30
- 性能与可达性修复（用户反馈：网页打不开、分析卡）：
  - 根因①：服务器 Node 硬编码监听 `127.0.0.1` → 公网永远连不上（即使安全组放行）；改为 `HOST` 环境变量（默认 127.0.0.1），服务器 `.env.local` 设 `HOST=0.0.0.0`，`ss` 确认监听 0.0.0.0:8787。剩余卡点：腾讯云控制台安全组放行 TCP 8787（OS 层 ufw 已确认不拦）。
  - 根因②：单次完整分析实测 54s+（DeepSeek v4-flash 推理非流式、max_tokens 10000，最重 90s+），前端只有转圈 → 体感卡死。前端按钮加「已用时 Xs」倒计时（≥5s 显示）+ 提示「AI 完整分析约需 30-90 秒」；代理与前端加超时兜底（analyze 180s/200s、resolve 30s/60s），不再无限挂起。
  - 验证：lint/tsc/build 通过（新 bundle `index-Bl0VRGiP.js`）；本地 8787 resolve「绿地谐波」正常；服务器已部署新 proxy+dist 并重启。
- 交付 `docs/Finance-Penguin-Token成本测算.xlsx`：5 个 Sheet（① 计价与单次成本 / ② 免费版 / ③ 进阶版 / ④ 专业版 / ⑤ 结论），全公式驱动，可直接转发；免费典型 ¥0.9、重度 ¥2.1-4.2、极端滥用 ¥72（风控边界）；进阶（假设 ¥9.9）典型 ¥1.5、重度 ¥3.6-7.3；专业典型 ¥2.2、重度 ¥6.8-13.5。
- 待办：GitHub 网络仍不通（push 失败：443 连接超时），本地已提交 `704a3bc`（成本测算文档）+ `9c2b685`（性能与可达性），恢复后补推；腾讯云控制台放行 8787 后公网验证。

### 2026-08-31 23:40
- 按反馈简化 Token 成本表：只保留 免费版/付费版 两档，单张表回答两个问题（① 每个功能单次跑的成本 ② 单月 token 花费与价格 × 轻度/中度/重度）。
  - 重写 `docs/Finance-Penguin-Token成本测算.xlsx`（单 Sheet：计价依据 → 单次成本 5 行 → 两版 × 三档人群 6 行，全公式驱动）。
  - 免费版：轻度 12 次/月 ≈96k ≈¥0.3；中度 35 次 ≈280k ≈¥0.8；重度 110 次（含 60 降智）≈760k ≈¥2.1。
  - 付费版（¥29/月）：轻度 25 次 ≈200k ≈¥0.6；中度 75 次 ≈600k ≈¥1.8；重度 250 次 ≈2M ≈¥6.0（peak ≈¥12）。
  - 同步简化 `docs/token-cost-model.md`（移除进阶版）；表格数值已用 artifact-tool 读回校验（修正一次月度公式列引用：完整/降智 用 D/E 列）。

### 2026-09-01 00:10
- 生产化文案清理（用户反馈：已进入生产环境，删除所有 Mock/演示/降智表述）：
  - 删除全部用户可见「Mock/演示/演示用户/演示组合/演示复盘/不真实扣费/单日超 100 次降智」文案：风险确认弹窗、会员定价弹窗、复盘/组合页、留档详情、示例场景证据、开通 toast、AI 未连接提示（不再引导 demo:build）。
  - 会员弹窗：免费版删掉「单日超 100 次自动降智」，专业版删掉「不降智」，按钮改为「立即开通」；降智逻辑保留在内部（控制成本），对外不再提及。
  - README/PRD 同步：数据边界改为真实行情 + 真实 AI 口径，线上地址补充服务器完整版。
- 全流程走查：lint/tsc/build 通过（新 bundle `index-CRvZFPuA.js`）；本地 resolve「绿地谐波」→688017.SH；完整 analyze 48.8s 成功（真实行情标注）；dist bundle 内 0 处残留文案；服务器已部署并重启（health ok）。

### 2026-09-01 09:30
- 风险确认弹窗按反馈强化：明确「观察计划由 AI 基于实时行情与公开信息自动生成，仅供研究参考，不构成投资建议，不作收益保证」；勾选文案改为「分析内容由 AI 生成…投资决策由我独立做出，风险与损益由我自己承担」；去掉「仅限内部体验验证」。
- 访问提速：`serveStatic` 增加 gzip 压缩 + 内存缓存 + 哈希资源不可变缓存头（`max-age=31536000, immutable`）。JS 263KB→gzip 87KB（-67%），重复访问静态资源几乎零网络传输；index.html 仍 no-cache 保证新版本即时生效。验证：本地与服务器均返回 `Content-Encoding: gzip` + immutable。
- 公网访问诊断（用户反馈「网址访问不上」）：服务 active、监听 0.0.0.0:8787、公网 IP 49.232.16.132 正确、OS 防火墙（ufw/iptables）均放行；但服务器自测公网 IP hairpin 超时 → 判定为腾讯云控制台实例防火墙未放行 TCP 8787，需用户在控制台添加规则（TCP 8787，来源 0.0.0.0/0）。
- 部署：服务器已更新 bundle `index-BYRwqnuI.js` + 新代理，重启后 health ok。
