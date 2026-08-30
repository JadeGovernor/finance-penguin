# 项目：Finance Penguin（AI 投资决策 Agent V0.2）

## 最后更新
2026-08-30

## 目标（一句话）
把个人投资者的模糊判断变成可验证假设，用多方委员会检验风险、留档复盘沉淀决策纪律的 AI 投研训练原型（国创赛参赛项目）。

## 当前进度
- [x] V0.2 源码初始化（2026-08-25 验证：git commit `6a2d010`）
- [x] 访问密码门 + PRD（2026-08-26 验证：git commit `502c4ea`）
- [x] GitHub Pages 上线（2026-08-30 验证：`gh api .../pages/builds/latest` → `built`；curl 线上 HTTP 200，标题「AI 投资决策 Agent｜假设验证台」，密码门 `fp-gate` × 11，密码 CHEZHI）
- [x] 功能闭环：分析助手五步流程 / 我的交易系统 / 留档 / 组合体检 / 复盘教练（Mock 数据，localStorage 持久化）
- [x] 密码门上线监控达成（2026-08-30 验证：fp-gate > 0；heartbeat 已暂停）
- [ ] 录 1 分钟国创赛 demo 视频
- [ ] 一期迭代细节完善（视评委反馈）

## 下一步
1. 按脚本录制 1 分钟演示视频（推荐路径：输入观点 → 验证标的 → 多方委员会 → 综合判断 → 观察计划 → 留档）
2. 准备问答口径：产品定位 / 数据边界（Mock）/ 商业模式（订阅制）
3. 二期规划：接入真实盘后数据（AKShare / Tushare）

## 关键决策 / 踩坑
- 旧 Codex 任务（`01a03e59…`）因历史消息损坏（API `invalid_request_error`）进入 `systemError`，无法恢复，已归档；工作转移到新对话，本文件即为交接依据。
- 页面有密码门（密码 CHEZHI），非公开可见；监控已完成使命。
- 全部数据为 Mock 盘后快照，不得描述为实时行情（项目 AGENTS.md 硬约束）。
- 依赖安装必须用内部源 `https://npm.corp.kuaishou.com/`。

## 涉及文件与命令
- `src/pages/HomePage.tsx`（唯一主页面，含分析/组合/复盘/留档四模块）
- 启动/检查：`cd "finance penguin" && export PATH="$PWD/.tools/node/bin:$PATH" && npm run dev`（`lint` / `build`）
- 线上地址：https://jadegovernor.github.io/finance-penguin/

## 验收标准 / 验证方式
- `npm run build` 与 `npm run lint` 必须成功
- 页面无白屏、无 JS 报错，覆盖启用/未启用交易系统两条分析路径
- 刷新后交易规则、留档、组合、复盘仍存在（localStorage 持久化）
