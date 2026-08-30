# 项目：Finance Penguin（AI 投资决策 Agent V0.2 → 真实数据接入版）

## 最后更新
2026-08-30

## 目标（一句话）
把个人投资者的模糊判断变成可验证假设，用多方委员会检验风险、留档复盘沉淀决策纪律的 AI 投研训练工具（国创赛参赛项目）。

## 当前进度
- [x] V0.2 源码初始化 + 密码门 + PRD（git `6a2d010` / `502c4ea`）
- [x] GitHub Pages 部署（验证：`gh api .../pages/builds` → `built`；线上新 bundle `index-CtK6EVUU.js`，密码 CHEZHI）
- [x] 实时行情接入：东财 push2 直连（CORS 放行）+ 腾讯兜底；页面进入与「最新行情 · 重置」均重新抓取（2026-08-30 验证：curl 东财 ulist 返回 8 只真实价格）
- [x] DeepSeek 真实分析：`deepseek-v4-flash` 经本地代理（`server/proxy.mjs`）调用，key 自动读取 OpenClaw auth 存储，不落前端/仓库（2026-08-30 验证：`/api/analyze` 返回完整结构化结果，含我的系统/五维评分/观察计划）
- [x] 付费分层（演示）：免费版基础分析不限 + 组合体检/复盘共 10 次 + 单日超 100 次降智；专业版 29 元/月不限次（不真实扣费）
- [x] 部署：main `fa84f4e` + gh-pages `2df57ee`
- [x] 复盘管理：分类收纳（按月/日、可收起）、收藏置顶、重命名、删除 + 黑屏修复（2026-08-30 验证：lint/tsc/build 通过；本地 8787 与线上 gh-pages 均回归正常；main `7c29144`/`7d3e9e7`，gh-pages `2c2fe78`/`e50ec7a`，线上 bundle `index-B-S2WJRN.js`）
- [x] 个股分析真实能力：`/api/resolve` 股票解析（东财 suggest → DeepSeek 纠正错别字）、目标股实时行情快照、严格模式、个股名直接分析（2026-08-30 验证：浏览器端到端「绿地谐波」全流程成功；main `0c2b433`，gh-pages `ec86df2`）
- [ ] 录 1 分钟国创赛 demo 视频（用本地 http://127.0.0.1:8787 录制真实行情+真实 AI）
- [ ] 线上 AI 代理（如需评委直接在线体验）：部署 serverless（Cloudflare/Vercel）并设置 `DEEPSEEK_API_KEY`

## 下一步
1. 按脚本录制 1 分钟演示视频（输入观点 → 验证标的 → 多方委员会 → 综合判断 → 观察计划 → 留档，含免费版配额/升级弹窗演示）
2. 视评委反馈完善一期细节；准备问答口径（数据边界、定价、合规）
3. 二期：真实账号体系（Kuaishou/Appwrite）、微信/支付宝订阅、云端存档

## 关键决策 / 踩坑
- 旧 Codex 任务 `01a03e59…` 因历史消息损坏 systemError，已归档；本文件为交接依据。
- `deepseek-v4-flash` 是推理模型：`reasoning_content` 与正文共用 max_tokens，预算需给足（normal 10000 / 降智 3000），否则正文被截断。
- 模型会输出带尾逗号的漂亮 JSON：代理端做了容错解析（去围栏/注释/尾逗号）。
- 静态托管无法持有 API key：线上页行情实时、AI 需本地代理；key 只经 `server/proxy.mjs`（env > .env.local > OpenClaw 存储）。
- 免费行情：东财 push2 返回 `fltt=2` 时价格为小数；腾讯 `qt.gtimg.cn` 为 GBK 文本，回退时只取数字字段。
- 复盘黑屏：新功能引用了未导入的图标（`Star`）→ 渲染时 ReferenceError 整页卸载；教训：改动后跑一遍「新增记录立即渲染」路径 + 全局 ErrorBoundary 兜底（`src/components/ErrorBoundary.tsx`）。
- 个股分析失败根因：行情快照只含 demo 股票而 prompt 禁止选快照外标的 → 空 candidates → 前端用 undefined 崩溃；解法是「先解析目标股 → 抓行情进快照 → 再分析」+ 前端判空兜底。DeepSeek 偶发输出非 JSON，代理端已加自动重试一次。

## 涉及文件与命令
- `src/pages/HomePage.tsx`（主页面）；`src/lib/quotes.ts` / `ai.ts` / `plan.ts` / `storage.ts` / `resolve.ts`；`src/components/ErrorBoundary.tsx`；`server/proxy.mjs`（`/api/analyze` + `/api/resolve`）
- 演示：`npm run demo:build` → http://127.0.0.1:8787
- 开发：`export PATH="$PWD/.tools/node/bin:$PATH" && npm run dev`（`/api` 代理到 8787）
- 线上：https://jadegovernor.github.io/finance-penguin/

## 验收标准 / 验证方式
- `npm run lint` / `npm run build` / `npx tsc --noEmit` 全通过
- 页面进入与重置均触发真实行情抓取；分析为 DeepSeek 真实生成
- 免费版 10 次配额耗尽弹出定价窗口；开通专业版后不限次
- 刷新后交易规则、留档、组合、复盘仍存在（localStorage）
