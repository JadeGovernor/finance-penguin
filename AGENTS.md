# AGENTS.md

> [!IMPORTANT]
> **用户认证、数据库操作、部署等详细说明，请读取并使用 `cf-web-artifacts` 或者 `website-builder` skill，本文件不重复记录。**

> 本文件遵循 [agents.md](https://agents.md/) 规范，为 AI Agent 提供项目上下文。

## 项目概览

本项目基于 `cf-web-artifacts` 或者 `website-builder` skill 构建的快手内部全栈 React 模板。

- **前端**：Vite 8 + React 18 + TypeScript 5
- **UI**：shadcn/ui + TailwindCSS v4
- **路由**：React Router v7
- **状态管理**：Zustand v5
- **数据请求**：Fetch API
- **后端 / 部署**：参见 `cf-web-artifacts` 或者 `website-builder` skill

## 目录结构

```
src/
├── pages/            # 页面组件（每个路由对应一个文件）
├── components/
│   └── ui/           # shadcn/ui 组件（用 npx shadcn@latest add 添加，不要手动修改）
├── lib/
│   ├── appwrite.ts   # Appwrite client、account、databases、storage、loginWithKuaishou 导出（endpoint 已固定，禁止修改）
│   └── utils.ts      # cn() 工具函数（tailwind-merge + clsx）
├── App.tsx           # 路由配置（React Router <Routes>）
├── main.tsx          # 应用入口（BrowserRouter 包裹）
└── index.css         # 全局样式（TailwindCSS 入口）
```

## 路由开发规范

路由统一在 `src/App.tsx` 的 `<Routes>` 中配置，页面组件放在 `src/pages/` 目录。

### 新增页面步骤

1. 在 `src/pages/` 下创建页面组件文件（如 `ProfilePage.tsx`）
2. 在 `src/App.tsx` 中添加对应的 `<Route>`

### App.tsx 示例

```tsx
import { Routes, Route } from 'react-router'
import HomePage from '@/pages/HomePage'
import AboutPage from '@/pages/AboutPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/profile/:id" element={<ProfilePage />} />
    </Routes>
  )
}
```

### 页面内跳转

```tsx
import { Link, useNavigate, useParams } from 'react-router'

// 声明式跳转
<Link to="/about">关于</Link>

// 编程式跳转
const navigate = useNavigate()
navigate('/about')
navigate(-1) // 返回上一页

// 动态路由参数
const { id } = useParams<{ id: string }>()
```

## 构建与启动命令

项目使用仓库内的 Node 22 与 npm：

```bash
export PATH="$PWD/.tools/node/bin:$PATH"

# 安装依赖（必须使用快手内部 npm 源）
npm install --registry https://npm.corp.kuaishou.com/

# 启动开发服务器
npm run dev

# 代码检查与构建
npm run lint
npm run build
```

## 当前原型架构约束

- 核心页面位于 `src/pages/HomePage.tsx`，当前数据为可复现 Mock，不得描述为实时行情。
- 委员会必须通过动态 `activeMembers` 驱动计时器、进度和结果展示，不要重新写死角色数量。
- 未启用交易系统时顺序为：乐观研究员 → 悲观研究员 → 风控委员 → 裁决官。
- 启用交易系统时顺序为：乐观研究员 → 悲观研究员 → 风控委员 → 我的系统 → 裁决官。
- “我的系统”只能根据用户原文推导；规则不足时必须输出“依据不足”，禁止代用户补写。
- 本地存储键：`thesis-ai-trading-system` 保存当前规则，`thesis-ai-archives` 保存分析档案。
- 新归档以分析任务标题为主标题，股票名称和代码仅作为关联标的；读取旧档案必须保留字段回退。
- 组合体检是与分析助手平行的一级功能，组合名单可从档案添加或手动录入，存储键为 `thesis-ai-portfolio`。
- 组合体检第一版只做 Mock 结构诊断，不接券商账户，不计算真实盈亏，不输出买卖指令。
- 组合评分低于 75 分时，只展示分数高于当前组合且达到绿色区间的优化组合，并解释风险重叠减少或仓位冲突降低的原因。
- 复盘教练是最后一个平行一级功能，存储键为 `thesis-ai-reviews`，支持从留档进入个股复盘，也支持组合复盘。
- 复盘教练不接真实成交，不评价用户能力；表达必须区分“无法提前规避”和“可以优化”，避免使用“错误点”“失败原因”等指责性文案。
- 复盘报告需要包含复盘结论、做得好的地方、无法提前规避、可以优化、正确操作 vs 实际操作和下次优化建议。
- 行动卡只展示仓位比例，不计算具体股数。当前 Mock 口径为首次 5%、最高 10%、限价 ¥162、止损 ¥157、止盈 ¥175～178。
- 安装依赖必须使用 `https://npm.corp.kuaishou.com/`。

## 已安装的 shadcn/ui 组件

`button` `card`

添加更多组件：
```bash
npx shadcn@latest add <component-name>
```

## 安全约束（禁止违反）

| 规则 | ✅ 允许 | ❌ 禁止 |
|------|---------|---------|
| 登录方式 | `loginWithKuaishou()` / `OAuthProvider.Kuaishou` | 邮箱/手机号/Google/GitHub |
| Appwrite SDK | `@codeflicker/appwrite` | 官方 `appwrite` npm 包 |
| 数据库 CLI | `appwrite-cf` | 官方 `appwrite` CLI |
| UI 组件库 | shadcn/ui + TailwindCSS（推荐） | — |
| npm 源 | `https://npm.corp.kuaishou.com/` | npmjs.org 直连（网络受限）|
| Endpoint | 禁止手动修改 | 硬编码其他 URL 字符串 |
| project_id 格式 | 纯字母数字下划线 | 含连字符 `-` |
| `appwrite-cf.config.json` | 只读，由 `appwrite-cf` 工具自动管理 | 手动修改文件内容 |
| `.static-site-deploy.json` | 只读，由部署工具自动管理 | 手动修改文件内容 |

> 用户认证、数据库操作、部署等详细说明，请读取并使用 `cf-web-artifacts` 或者 `website-builder` skill。

## 测试指令

- **开发中**：`npm run dev` 启动后，验证无白屏、无 JS 报错，并分别覆盖启用/未启用交易系统的分析路径
- **构建验证**：`npm run build`（必须看到明确成功日志）
- **代码检查**：`npm run lint`（必须看到明确成功日志）
- **持久化验证**：刷新后交易规则仍存在，留档详情可回放当次规则快照和“我的系统”原始结论
