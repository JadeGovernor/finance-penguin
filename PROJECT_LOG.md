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
