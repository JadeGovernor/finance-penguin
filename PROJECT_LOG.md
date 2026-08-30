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
