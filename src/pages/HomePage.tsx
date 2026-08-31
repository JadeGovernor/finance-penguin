import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Archive, BadgeCheck, BrainCircuit, CalendarClock,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot, ClipboardCheck, Clock3, Database, FileSearch, FileText,
  FolderOpen, Gavel, Info, Layers3, Menu, Pencil, PieChart, Plus, RefreshCw, Scale, Search, ShieldCheck,
  ShieldQuestion, Star, Target, Trash2, TrendingDown, TrendingUp, X,
} from 'lucide-react'

import { fetchQuotes, type Quote } from '@/lib/quotes'
import { runAnalysis, type AnalysisResult, type AnalysisMember } from '@/lib/ai'
import { resolveStock } from '@/lib/resolve'
import { getPlan, trackAnalysis, tryUsePremium, upgradePlan, premiumRemaining, FREE_PREMIUM_QUOTA, FREE_DEGRADE_AFTER, type PlanState } from '@/lib/plan'
import { storageGet, storageSet, storageRemove } from '@/lib/storage'

type EntryMode = 'thesis' | 'stock'
type Stage = 'input' | 'candidates' | 'committee' | 'verdict'
type View = 'assistant' | 'portfolio' | 'review' | 'archives'
type ArchiveRecord = {
  id: string; taskTitle?: string; code: string; name: string; query: string; subject: string; verdict: string;
  score: number; price: number; createdAt: string; updatedAt: string; expiresAt: string;
  entryPrice?: number; stopPrice?: number; takeRange: string; initialPosition?: string; maxPosition?: string;
  tradingSystemText?: string; tradingSystemUpdatedAt?: string; systemVerdict?: string;
  stopRange?: string; members?: AnalysisMember[]; marketNote?: string; status: '有效' | '即将过期' | '已过期';
}
type TradingSystem = { text: string; updatedAt: string }
type PortfolioItem = {
  code: string; name: string; weight: number; source: '档案' | '手动'; addedAt: string;
}
type ReviewMode = 'stock' | 'portfolio'
type ReviewRecord = {
  id: string; mode: ReviewMode; title: string; result: string; pnl: string; source?: string; createdAt: string;
  operation?: string; reason?: string; question?: string; archiveId?: string; pinned?: boolean; customTitle?: string;
}
type Candidate = {
  code: string; name: string; role: string; tags: string[]; reason: string;
  difference: string; doubt: string; price: number; change: number; score: number;
}

type Scenario = {
  input: string
  interpretation: { subject: string; direction: string; horizon: string; catalyst: string; unknown: string }
  strategy: string
  candidates: Candidate[]
}

const themeScenario: Scenario = {
  input: '我认为未来一年 AI 基础设施资本开支仍会增长，想寻找真正受益、但市场定价存在差异的 A 股公司。',
  interpretation: { subject: 'AI 基础设施资本开支', direction: '未来一年继续增长', horizon: '中期逻辑，拆解为一周观察', catalyst: '云厂商资本开支、订单与业绩披露', unknown: '基本面受益是否已被价格充分反映' },
  strategy: '本次用三个不同传导环节验证观点：服务器观察需求兑现，光模块观察高敏感环节，液冷观察功率密度提升的配套增量。它们不是固定类型，而是本次假设下的信息互补角色。',
  candidates: [
    { code: '000977.SZ', name: '浪潮信息', role: '验证服务器需求兑现', tags: ['传导直接', '已有经营证据'], reason: '服务器位于算力资本开支的设备层，可直接检验需求是否转化为采购与收入。', difference: '相比另外两家，更接近算力设备总需求，但利润仍受产品结构影响。', doubt: '收入增长能否同步转化为利润改善。', price: 52.36, change: 1.82, score: 84 },
    { code: '300308.SZ', name: '中际旭创', role: '验证高速互联景气度', tags: ['主题敏感', '市场反映较高'], reason: 'AI 集群扩张会提高高速互联需求，光模块是需求弹性较高的关键环节。', difference: '相对服务器与液冷，海外算力需求暴露更高，价格敏感度也更强。', doubt: '阶段涨幅较大，景气预期可能已被部分计价。', price: 168.20, change: -0.74, score: 81 },
    { code: '002837.SZ', name: '英维克', role: '验证液冷配套增量', tags: ['间接受益', '兑现待跟踪'], reason: '机柜功率密度提升会增加温控与液冷需求，可验证资本开支是否向配套环节扩散。', difference: '受益路径更靠后，但可提供不同于算力设备和互联环节的交叉验证。', doubt: '液冷业务收入占比与订单兑现速度仍需补证。', price: 38.91, change: 2.15, score: 73 },
  ],
}

const stockScenario: Scenario = {
  input: '我认为贵州茅台当前估值已经较充分消化悲观预期，未来一周可能出现修复。',
  interpretation: { subject: '贵州茅台估值修复', direction: '未来一周偏强', horizon: '7 个自然日', catalyst: '消费数据、批价与市场风险偏好', unknown: '修复来自公司特异性还是板块共振' },
  strategy: '你指定了贵州茅台。本次固定保留目标股票，再加入一个经营韧性同行和一个弹性更高的板块对照，用来判断修复是否具有公司特异性，而不是重新给出一组三只股票。',
  candidates: [
    { code: '600519.SH', name: '贵州茅台', role: '目标标的：验证估值修复', tags: ['用户指定', '高流动性'], reason: '直接验证用户观点，重点观察估值、批价和板块相对强弱。', difference: '唯一的目标股票，其他候选只承担对照作用。', doubt: '一周修复缺少明确公司级催化剂。', price: 1428.00, change: 0.68, score: 76 },
    { code: '000858.SZ', name: '五粮液', role: '支持性同行：验证板块共振', tags: ['同行对照', '经营验证'], reason: '同属高端白酒，可判断上涨是行业风险偏好修复还是茅台独立变化。', difference: '如果两者同步走强，更可能是板块因素，而非茅台特有逻辑。', doubt: '行业共同压力可能削弱其支持性。', price: 126.40, change: 1.12, score: 71 },
    { code: '000568.SZ', name: '泸州老窖', role: '反向对照：验证修复弹性', tags: ['弹性对照', '波动较高'], reason: '提供不同估值与波动特征，帮助比较修复行情中的相对弹性。', difference: '弹性通常更高；若其强而茅台弱，目标股修复逻辑需重新审视。', doubt: '更高波动可能放大短期噪声。', price: 118.76, change: -0.35, score: 67 },
  ],
}

const baseCommittee = [
  {
    key: 'bull', label: '乐观研究员', icon: TrendingUp, tone: 'positive', score: 82,
    summary: '高速互联是 AI 集群扩容中需求传导较直接的环节，公司主营与云计算数据中心高度相关，中期景气逻辑有业务基础。',
    conclusion: '偏乐观：需求逻辑成立，但需要订单与盈利数据继续确认。',
    analysis: [
      '需求端：AI 训练与推理集群扩大后，服务器节点之间的数据交换量同步提升，高速光模块是网络侧扩容的重要组成部分，资本开支向互联环节传导的链条相对较短。',
      '公司端：公开报告显示公司主营高端光通信收发模块，产品服务于云计算数据中心等场景，因此并非只有概念关联；产品速率升级还可能带来收入结构改善。',
      '催化端：后续云厂商资本开支、800G/1.6T 产品进展及季度收入变化，均可能成为验证景气度是否延续的关键节点。',
    ],
    basis: ['主营业务与云计算数据中心直接相关', 'AI 集群扩容提高高速互联需求', '产品代际升级可能改善收入结构'],
    evidence: [{ id: 'E-01', name: '中际旭创 2025 年半年度报告', date: '2025-08-27', url: 'https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?stockid=300308&id=11379776' }, { id: 'E-02', name: '盘后行情 Mock 快照', date: '2026-08-21', url: 'https://data.eastmoney.com/stockdata/300308.html' }],
    gap: '仍缺少最新订单结构、不同速率产品收入占比与未来两个季度的客户需求指引。',
  },
  {
    key: 'bear', label: '悲观研究员', icon: TrendingDown, tone: 'negative', score: 58,
    summary: '产业景气并不等于股票仍有足够空间。阶段价格表现较强、客户集中与技术迭代，可能让当前估值对利好更敏感。',
    conclusion: '偏谨慎：基本面可能继续改善，但赔率未必与确定性同步。',
    analysis: [
      '定价端：演示快照显示该股近 60 日已有明显上涨，说明市场可能提前交易 AI 资本开支与高速产品放量；此时新增利好需要超出已有预期才能继续驱动价格。',
      '经营端：高速光模块行业具有产品快速迭代、客户认证周期和客户集中度较高等特征，任何订单节奏变化都可能放大单季收入和利润波动。',
      '估值端：如果后续资本开支只是符合预期而非上修，较高关注度可能导致估值先于基本面回落，因此不能把行业景气直接等同于短期买入理由。',
    ],
    basis: ['阶段涨幅反映部分乐观预期', '客户与产品迭代带来业绩波动', '缺少一致预期上修幅度数据'],
    evidence: [{ id: 'E-02', name: '盘后行情 Mock 快照', date: '2026-08-21', url: 'https://data.eastmoney.com/stockdata/300308.html' }, { id: 'E-01', name: '中际旭创 2025 年半年度报告', date: '2025-08-27', url: 'https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?stockid=300308&id=11379776' }],
    gap: '缺少分析师一致盈利预期的最近三个月变化，也无法确认当前估值已计入多高的增长假设。',
  },
  {
    key: 'risk', label: '风控委员', icon: ShieldCheck, tone: 'warning', score: 64,
    summary: '一周观察窗口内，价格波动、海外资本开支消息和公司公告都可能造成跳空，风险控制应优先于方向判断。',
    conclusion: '中等风险：可以观察，但必须设置失效条件并限制单次风险暴露。',
    analysis: [
      '波动风险：光模块板块通常对产业消息反应较快，一周窗口里方向判断容易被市场风险偏好和主题交易放大，盘中触及价格不应直接视为趋势确认。',
      '事件风险：海外云厂商资本开支、客户订单、产品认证或供应链变化，可能在非交易时段发生并造成跳空，普通止损区间无法覆盖全部事件风险。',
      '执行风险：当前使用的是 Mock 盘后快照，若次日开盘价格已经显著偏离参考价，原有风险收益比失效，必须重新计算而不是机械处理。',
    ],
    basis: ['20 日波动处于中高区间', '海外需求消息可能引发跳空', '盘后参考价存在时效边界'],
    evidence: [{ id: 'E-03', name: '20 日波动与成交 Mock 指标', date: '2026-08-21', url: 'https://quote.eastmoney.com/sz300308.html' }, { id: 'R-02', name: '内部事件风险检查规则', date: '2026-08-25', url: 'https://www.sac.net.cn/sjb/flfg_949/zlgz/201012/t20101220_14236.html' }],
    gap: '缺少盘中流动性、最新公告事件和真实持仓风险信息，因此不能生成个性化仓位建议。',
  },
  {
    key: 'judge', label: '裁决官', icon: Gavel, tone: 'accent', score: 72,
    summary: '业务逻辑与中期需求方向获得支持，但市场定价和订单证据仍有缺口。综合判断为暂不行动，等待价格和新增证据形成一致信号。',
    conclusion: '综合判断：暂不行动，等待价格与新增证据共同确认。',
    analysis: [
      '综合三方意见，行业需求向高速互联传导的逻辑最为明确，公开主营资料也支持公司与主题的直接关联，因此逻辑强度得分较高。',
      '主要矛盾在于“好公司”与“好价格”并不等价。阶段涨幅和较高市场关注度降低了短期赔率，而最新订单、盈利预测变化仍未纳入证据池。',
      '因此综合评分为 72 分：它代表值得跟踪的程度，不等于买入信号。行动前必须同时看到价格确认、行业对照同步和新证据出现；核心客户需求下修将直接推翻本次判断。',
    ],
    basis: ['逻辑强度 84', '证据完整度 68', '市场拥挤度仅 43', '风险可控度 62'],
    evidence: [{ id: 'S-01', name: '四方证据综合评分', date: '2026-08-25', url: 'https://vip.stock.finance.sina.com.cn/corp/view/vCB_AllBulletinDetail.php?stockid=300308&id=11379776' }, { id: 'S-02', name: '评分规则 v0.2', date: '2026-08-25', url: 'https://data.eastmoney.com/stockdata/300308.html' }],
    gap: '综合结论仍依赖 Mock 盘后快照，接入真实盘后数据和最新财报后必须重新评分。',
  },
]

const fallbackScores = [
  { label: '逻辑强度', value: 84, help: '传导链完整，业务相关度较高' },
  { label: '证据完整度', value: 68, help: '缺少最新订单与一致预期' },
  { label: '兑现程度', value: 74, help: '业务成立，利润兑现仍需验证' },
  { label: '市场拥挤度', value: 43, help: '分数越高代表越不拥挤' },
  { label: '风险可控度', value: 62, help: '一周波动与事件风险中等' },
]

const stockProfiles: Record<string, { code: string; name: string; theme: string; role: string; opportunity: string; risk: string; baseScore: number; volatility: '低' | '中' | '高'; defensive: boolean }> = {
  '300308.SZ': { code: '300308.SZ', name: '中际旭创', theme: 'AI 算力链', role: '高速互联弹性资产', opportunity: '高速光模块需求延续，受益于 AI 集群扩容。', risk: '估值和订单预期敏感，海外需求变化会放大波动。', baseScore: 81, volatility: '高', defensive: false },
  '000977.SZ': { code: '000977.SZ', name: '浪潮信息', theme: 'AI 算力链', role: '服务器需求验证资产', opportunity: '服务器采购能直接验证算力资本开支兑现。', risk: '利润率与产品结构仍需持续确认。', baseScore: 78, volatility: '高', defensive: false },
  '002837.SZ': { code: '002837.SZ', name: '英维克', theme: 'AI 配套设施', role: '液冷配套观察资产', opportunity: '机柜功率密度提升带来温控和液冷增量。', risk: '业务占比和订单兑现节奏仍不透明。', baseScore: 72, volatility: '中', defensive: false },
  '600519.SH': { code: '600519.SH', name: '贵州茅台', theme: '消费白酒', role: '防御型核心资产', opportunity: '品牌壁垒和现金流稳定，有助于降低组合波动。', risk: '短期修复依赖消费数据和市场风险偏好。', baseScore: 76, volatility: '低', defensive: true },
  '000858.SZ': { code: '000858.SZ', name: '五粮液', theme: '消费白酒', role: '白酒板块对照资产', opportunity: '可验证白酒板块共振与估值修复。', risk: '行业共同压力可能削弱修复持续性。', baseScore: 71, volatility: '中', defensive: true },
  '000568.SZ': { code: '000568.SZ', name: '泸州老窖', theme: '消费白酒', role: '弹性消费资产', opportunity: '估值弹性较高，适合观察板块修复强度。', risk: '波动高于高端白酒核心资产。', baseScore: 67, volatility: '中', defensive: false },
  '300750.SZ': { code: '300750.SZ', name: '宁德时代', theme: '新能源', role: '新能源周期核心资产', opportunity: '电池龙头具备产业链话语权。', risk: '受价格竞争、政策周期和海外需求影响。', baseScore: 74, volatility: '高', defensive: false },
  '600036.SH': { code: '600036.SH', name: '招商银行', theme: '银行金融', role: '组合稳定器', opportunity: '盈利稳定和分红属性有助于平衡成长股波动。', risk: '受宏观信用周期和地产链风险影响。', baseScore: 79, volatility: '低', defensive: true },
}

const stockAliases: Record<string, string> = Object.values(stockProfiles).reduce((acc, item) => {
  acc[item.name] = item.code
  acc[item.code] = item.code
  acc[item.code.replace(/\.(SZ|SH)$/, '')] = item.code
  return acc
}, {} as Record<string, string>)

function normalizePortfolioInput(input: string): PortfolioItem[] {
  const now = new Date().toISOString()
  return input.split(/[\n,，;；]+/).map((raw) => raw.trim()).filter(Boolean).map<PortfolioItem | null>((raw) => {
    const matchedKey = Object.keys(stockAliases).find((key) => raw.includes(key))
    if (!matchedKey) return null
    const profile = stockProfiles[stockAliases[matchedKey]]
    const weightMatch = raw.match(/(\d+(?:\.\d+)?)\s*%/)
    return { code: profile.code, name: profile.name, weight: weightMatch ? Number(weightMatch[1]) : 5, source: '手动' as const, addedAt: now }
  }).filter((item): item is PortfolioItem => Boolean(item))
}

function getScoreTone(score: number) {
  return score >= 75 ? 'high' : score >= 60 ? 'medium' : 'low'
}

function memberIcon(key: string) {
  return key === 'bull' ? TrendingUp : key === 'bear' ? TrendingDown : key === 'risk' ? ShieldCheck : key === 'judge' ? Gavel : FileText
}

function displayTitle(record: ReviewRecord) {
  return record.customTitle || record.title || (record.mode === 'stock' ? '个股复盘' : '组合复盘')
}

function getArchiveFileName(archive: ArchiveRecord) {
  const basis = archive.taskTitle || archive.subject || archive.name
  return basis === archive.name ? archive.name : `${basis} / ${archive.name}`
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

function ActionBlock({ title, icon: Icon, items, tone = '' }: { title: string; icon: typeof CircleDot; items: string[]; tone?: string }) {
  return <section className={`action-section ${tone}`}><h3><Icon size={16}/>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>
}

export default function HomePage() {
  const [mode, setMode] = useState<EntryMode>('thesis')
  const [query, setQuery] = useState(themeScenario.input)
  const [extraNote, setExtraNote] = useState('')
  const [stage, setStage] = useState<Stage>('input')
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('分析中')
  const [loadingElapsed, setLoadingElapsed] = useState(0)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [committeeTick, setCommitteeTick] = useState(-1)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [riskModal, setRiskModal] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [view, setView] = useState<View>('assistant')
  const [toast, setToast] = useState('')
  const [justArchived, setJustArchived] = useState(false)
  const [activeArchive, setActiveArchive] = useState<ArchiveRecord | null>(null)
  const [tradingSystem, setTradingSystem] = useState<TradingSystem | null>(() => {
    try { return JSON.parse(storageGet('thesis-ai-trading-system') || 'null') as TradingSystem | null } catch { return null }
  })
  const [systemModalOpen, setSystemModalOpen] = useState(false)
  const [systemDraft, setSystemDraft] = useState('')
  const [systemError, setSystemError] = useState('')
  const [archives, setArchives] = useState<ArchiveRecord[]>(() => {
    try { return JSON.parse(storageGet('thesis-ai-archives') || '[]') as ArchiveRecord[] } catch { return [] }
  })
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>(() => {
    try { return JSON.parse(storageGet('thesis-ai-portfolio') || '[]') as PortfolioItem[] } catch { return [] }
  })
  const [portfolioDraft, setPortfolioDraft] = useState('中际旭创 5%\n浪潮信息 4%\n贵州茅台 8%\n宁德时代 6%\n招商银行 10%')
  const [portfolioError, setPortfolioError] = useState('')
  const [portfolioReportReady, setPortfolioReportReady] = useState(false)
  const [reviewMode, setReviewMode] = useState<ReviewMode>('stock')
  const [reviewArchive, setReviewArchive] = useState<ArchiveRecord | null>(null)
  const [reviewOperation, setReviewOperation] = useState('我在 168 元买入中际旭创，仓位 10%。后来跌到 156 元没有止损，反弹到 162 元卖出。')
  const [reviewReason, setReviewReason] = useState('当时觉得 AI 算力还是强主线，盘中反弹说明资金可能回来，所以没有按原计划复核。')
  const [reviewResult, setReviewResult] = useState<'盈利' | '亏损' | '持平'>('亏损')
  const [reviewPnl, setReviewPnl] = useState('-3.6%')
  const [reviewQuestion, setReviewQuestion] = useState('这次亏损是行情问题，还是我没有遵守原计划？')
  const [reviewError, setReviewError] = useState('')
  const [reviewReportReady, setReviewReportReady] = useState(false)
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>(() => {
    try { return JSON.parse(storageGet('thesis-ai-reviews') || '[]') as ReviewRecord[] } catch { return [] }
  })
  const [marketUpdatedAt, setMarketUpdatedAt] = useState(() => new Date().toISOString())
  const [marketRefreshing, setMarketRefreshing] = useState(false)
  const [live, setLive] = useState<AnalysisResult | null>(null)
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [quotesAt, setQuotesAt] = useState<number | null>(null)
  const [plan, setPlan] = useState<PlanState>(() => getPlan())
  const [pricingOpen, setPricingOpen] = useState(false)
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({})
  const [renameTarget, setRenameTarget] = useState<ReviewRecord | null>(null)
  const [renameDraft, setRenameDraft] = useState('')

  const scenario = live
    ? { input: query, interpretation: live.interpretation, strategy: live.strategy, candidates: live.candidates }
    : (mode === 'thesis' ? themeScenario : stockScenario)
  const scores = live?.scores ?? fallbackScores
  const activeMembers = useMemo(() => live?.members ?? [], [live])
  const committeeStep = Math.floor(committeeTick / 2)
  const committeePhase = committeeTick < 0 ? 'waiting' : committeeTick % 2 === 0 ? 'thinking' : 'generating'
  const isStockMode = mode === 'stock'
  const stageIndex = isStockMode && (stage === 'committee' || stage === 'verdict') ? { committee: 1, verdict: 2 }[stage] : { input: 0, candidates: 1, committee: 2, verdict: 3 }[stage]
  const candidateSectionTitle = `匹配 ${scenario.candidates.length} 个观察标的`
  const candidateSectionDescription = '匹配度代表验证价值，不代表上涨概率。'
  const candidatePoolLabel = quotesAt ? '实时行情' : '行情获取中…'
  const committeeDescription = isStockMode
    ? `围绕 ${selected?.name || '目标股票'} 验证用户判断，对照同行只作参考。`
    : `多视角生成判断${tradingSystem ? '，并核对您的交易系统' : ''}。`
  const verdictDescription = isStockMode
    ? `只对目标股票给出结论；评分代表跟踪价值，不等于买入信号。${tradingSystem ? '用户系统结论会单独保留。' : ''}`
    : `汇总多方观点后的跟踪结论；评分不等于买入信号。${tradingSystem ? '用户系统结论会单独保留。' : ''}`
  const marketTimeLabel = new Date(marketUpdatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const planWindow = (() => {
    const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return `${f(new Date())} — ${f(new Date(Date.now() + 7 * 86400000))}`
  })()

  useEffect(() => {
    if (stage !== 'committee' || committeeTick >= activeMembers.length * 2 - 1) return
    const delay = committeeTick % 2 === 0 ? 1400 : 1800
    const timer = window.setTimeout(() => setCommitteeTick((tick) => tick + 1), delay)
    return () => window.clearTimeout(timer)
  }, [activeMembers.length, stage, committeeTick])

  useEffect(() => {
    if (stage === 'committee' && committeeTick === activeMembers.length * 2 - 1) {
      const timer = window.setTimeout(() => setStage('verdict'), 700)
      return () => window.clearTimeout(timer)
    }
  }, [activeMembers.length, stage, committeeTick])

  useEffect(() => {
    storageSet('thesis-ai-archives', JSON.stringify(archives))
  }, [archives])

  useEffect(() => {
    storageSet('thesis-ai-portfolio', JSON.stringify(portfolioItems))
  }, [portfolioItems])

  useEffect(() => {
    storageSet('thesis-ai-reviews', JSON.stringify(reviewRecords))
  }, [reviewRecords])

  useEffect(() => {
    if (tradingSystem) storageSet('thesis-ai-trading-system', JSON.stringify(tradingSystem))
    else storageRemove('thesis-ai-trading-system')
  }, [tradingSystem])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const portfolioAnalysis = useMemo(() => {
    const items = portfolioItems.map((item) => ({ ...item, profile: stockProfiles[item.code] })).filter((item) => item.profile)
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
    const themes = items.reduce((acc, item) => {
      const theme = item.profile.theme
      acc[theme] = acc[theme] || { weight: 0, names: [] as string[] }
      acc[theme].weight += item.weight
      acc[theme].names.push(item.name)
      return acc
    }, {} as Record<string, { weight: number; names: string[] }>)
    const maxTheme = Object.entries(themes).sort((a, b) => b[1].weight - a[1].weight)[0]
    const highVolCount = items.filter((item) => item.profile.volatility === '高').length
    const defensiveWeight = items.filter((item) => item.profile.defensive).reduce((sum, item) => sum + item.weight, 0)
    const aiWeight = themes['AI 算力链']?.weight || 0
    const concentrationPenalty = maxTheme ? Math.max(0, maxTheme[1].weight - 8) * 2 : 0
    const overlapPenalty = items.filter((item) => item.profile.theme === 'AI 算力链').length > 1 ? 8 : 0
    const volatilityPenalty = highVolCount * 3
    const defensiveBonus = defensiveWeight >= 12 ? 8 : defensiveWeight >= 6 ? 4 : 0
    const score = Math.max(48, Math.min(92, Math.round(82 - concentrationPenalty - overlapPenalty - volatilityPenalty + defensiveBonus)))
    const combinations = [
      { names: ['贵州茅台', '招商银行'], score: 86, reason: '防御资产占比提升，主题波动明显下降。' },
      { names: ['中际旭创', '招商银行'], score: 79, reason: '保留 AI 弹性，同时加入低波动金融资产作为稳定器。' },
      { names: ['浪潮信息', '贵州茅台', '招商银行'], score: 82, reason: '降低同主题重复暴露，并保留一个算力验证资产。' },
      { names: ['中际旭创', '浪潮信息'], score: 60, reason: '主题集中度过高，主要风险来源重叠。' },
      { names: ['中际旭创', '宁德时代'], score: 58, reason: '高波动成长资产占比偏高，缺少稳定器。' },
    ].filter((combo) => combo.score > score && combo.score >= 75 && combo.names.every((name) => items.some((item) => item.name === name)))
    return { items, themes, maxTheme, highVolCount, defensiveWeight, aiWeight, totalWeight, score, combinations }
  }, [portfolioItems])

  const reviewAnalysis = useMemo(() => {
    const targetName = reviewMode === 'stock' ? (reviewArchive?.name || '当前个股') : '当前组合'
    const sourceTitle = reviewMode === 'stock' ? (reviewArchive ? getArchiveFileName(reviewArchive) : '未选择档案') : `${portfolioItems.length} 只组合名单`
    const operationText = reviewOperation.trim()
    const reasonText = reviewReason.trim()
    const questionText = reviewQuestion.trim()
    const pnlText = reviewPnl.trim() || '未填写'
    const shortOperation = operationText.length > 72 ? `${operationText.slice(0, 72)}…` : operationText
    const shortReason = reasonText.length > 68 ? `${reasonText.slice(0, 68)}…` : reasonText
    const isLoss = reviewResult === '亏损'
    const conclusion = reviewMode === 'stock'
      ? `本次${targetName}复盘的关键不是判断对错，而是操作是否跟计划一致。你记录的结果是 ${reviewResult} ${pnlText}；从描述看，主要问题集中在入场位置、仓位和跌破复核点后的处理。`
      : `本次组合复盘重点在风险是否集中。结果是 ${reviewResult} ${pnlText}；需要把主题暴露、仓位上限和防御资产比例拆开看。`
    const positives = [
      `你写清了实际操作：${shortOperation || '暂无完整操作描述'}。这让复盘可以落到动作，而不是停留在情绪。`,
      `你补充了当时判断：${shortReason || '暂无判断原因'}。这能定位决策依据是否可靠。`,
      questionText ? `你提出了明确问题：${questionText}。后续回答可以直接围绕这个问题展开。` : '你已记录盈亏结果，后续可以继续补充最想追问的问题。',
    ]
    const issues = reviewMode === 'stock'
      ? [
        `入场纪律：如果原计划等待确认，但实际在更高位置买入，说明执行动作早于证据。`,
        `仓位纪律：一次性接近或超过计划上限，会放大一次判断失误的影响。`,
        `复核纪律：跌破关键价后没有立即复核，而是等反弹再处理，容易把风险控制变成情绪等待。`,
      ]
      : [
        `组合集中：如果多只股票依赖同一主线，回撤时会一起下跌，分散效果会变弱。`,
        `仓位边界：缺少单一主题上限时，行情好时容易越买越集中。`,
        `防御不足：缺少低波动资产时，组合净值会更受情绪和主题波动影响。`,
      ]
    const unavoidable = reviewMode === 'stock'
      ? [
        `${targetName}所在板块的整体风险偏好变化，不是单个用户可以提前完全控制的。`,
        `盘中波动、隔夜消息和板块联动可能让价格直接偏离原计划。`,
        isLoss ? '亏损不必全部归因于个人能力；但可控动作需要单独记录并修正。' : '盈利也不代表流程一定正确，仍要检查是否违反计划。',
      ]
      : [
        '市场系统性回撤无法完全提前规避。',
        '同主题资产在压力期相关性会上升，组合会短暂失去分散效果。',
        '突发公告和板块流动性变化通常不是复盘者能事前完全控制的。',
      ]
    const nextActions = reviewMode === 'stock'
      ? [
        `下次下单前写一句硬规则：什么价格可以入场，什么价格必须复核。`,
        `首次仓位先限制在计划上限内，不用一次动作证明判断。`,
        `跌破复核价时先暂停加仓和补仓，重新回答“原假设是否还成立”。`,
      ]
      : [
        '先设单一主题上限，再决定每只股票仓位。',
        '把同一逻辑驱动的股票归为一组，不要当成天然分散。',
        '每次大幅波动后，先检查组合结构，再评价单只股票。',
      ]
    const comparisons = reviewMode === 'stock'
      ? [
        ['入场', `原计划等待 ¥${reviewArchive?.entryPrice || 162} 附近确认`, '实际描述中存在提前或较高位置买入', '可优化'],
        ['仓位', `首次 ${reviewArchive?.initialPosition || '5%'}，确认后最高 ${reviewArchive?.maxPosition || '10%'}`, '仓位接近最高上限', '可优化'],
        ['复核', `跌破 ¥${reviewArchive?.stopPrice || 157} 后重新判断`, '跌破后继续等待反弹', '可优化'],
        ['行情', '接受板块波动和突发消息影响', '结果受外部行情影响', '不可控'],
      ]
      : [
        ['主题', '单一主题不应成为主要风险来源', '多只股票依赖同一主线', '可优化'],
        ['分散', '不同资产应依赖不同盈利前提', '相关性在回撤中上升', '可优化'],
        ['防御', '低波动资产降低回撤', '稳定器占比不足', '可优化'],
        ['行情', '接受系统性波动', '组合受市场影响', '不可控'],
      ]
    return { targetName, sourceTitle, conclusion, positives, issues, unavoidable, nextActions, comparisons }
  }, [portfolioItems.length, reviewArchive, reviewMode, reviewOperation, reviewPnl, reviewQuestion, reviewReason, reviewResult])

  const activeCommittee = useMemo(() => {
    const completedCount = stage === 'verdict' ? activeMembers.length : Math.max(0, Math.floor(committeeTick / 2))
    return activeMembers.slice(0, completedCount)
  }, [activeMembers, committeeTick, stage])

  const switchMode = (nextMode: EntryMode) => {
    setMode(nextMode)
    setQuery(nextMode === 'thesis' ? themeScenario.input : stockScenario.input)
    setExtraNote('')
    setStage('input'); setSelected(null); setCommitteeTick(-1); setError(''); setCardOpen(false); setJustArchived(false); setLive(null)
  }

  const loadQuotes = async (codes?: string[]) => {
    const list = codes?.length ? codes : Object.keys(stockProfiles)
    setMarketRefreshing(true)
    try {
      const result = await fetchQuotes(list)
      if (Object.keys(result).length) {
        setQuotes((prev) => ({ ...prev, ...result }))
        setQuotesAt(Date.now())
        setMarketUpdatedAt(new Date().toISOString())
      }
    } catch { /* 保留旧数据 */ } finally {
      setMarketRefreshing(false)
    }
  }

  useEffect(() => { void loadQuotes() }, [])

  useEffect(() => {
    if (!loading) { setLoadingElapsed(0); return }
    const start = Date.now()
    const timer = window.setInterval(() => setLoadingElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [loading])

  const refreshMarket = () => {
    reset()
    loadQuotes()
    window.setTimeout(() => setToast('已抓取最新行情并重置'), 300)
  }

  const discover = async () => {
    const text = query.trim()
    if (isStockMode) {
      if (text.length < 2) { setError('请输入股票名称或 6 位代码。'); return }
    } else if (text.length < 8) {
      setError('请补充观点、方向和时间。')
      return
    }
    setError(''); setLoading(true)
    try {
      const tracked = trackAnalysis(plan)
      setPlan(tracked.plan)
      if (tracked.count === FREE_DEGRADE_AFTER + 1) setToast('今日免费请求已超过 100 次，已启用降智模式')

      let targetStock: { code: string; name: string; price?: number; changePct?: number } | undefined
      let analyzeInput = text
      let snapshotQuotes: Quote[] = Object.values(quotes)
      if (isStockMode) {
        setLoadingLabel('正在识别股票…')
        const resolved = await resolveStock(text)
        if (!resolved?.code) { setError(`未能识别「${text}」对应的股票。请直接输入 6 位代码（如 688017）重试，或换个更常见的名称。`); return }
        targetStock = resolved
        setLoadingLabel('正在获取实时行情…')
        let quoteResult: Record<string, Quote> = {}
        try { quoteResult = await fetchQuotes([resolved.code]) } catch { /* 按未获取处理 */ }
        const quote = quoteResult[resolved.code]
        if (!quote) { setError(`未获取到 ${resolved.name} 的实时行情，请确认代码后重试。`); return }
        setQuotes((prev) => ({ ...prev, ...quoteResult }))
        setQuotesAt(Date.now())
        snapshotQuotes = [...Object.values(quotes), quote]
        const note = extraNote.trim()
        analyzeInput = note ? `个股：${resolved.name}（${resolved.code}）。补充判断：${note}` : `个股：${resolved.name}（${resolved.code}）`
      }

      setLoadingLabel('AI 分析中…')
      const result = await runAnalysis({ input: analyzeInput, mode, tradingSystem: tradingSystem?.text, quotes: snapshotQuotes, degraded: tracked.degraded, targetStock })
      setLive(result)
      if (result.candidates.length) loadQuotes(result.candidates.map((c) => c.code))
      if (isStockMode) {
        const target = result.candidates.find((c) => c.code === targetStock?.code)
        if (!result.candidates.length || !target) {
          setError('本次未生成有效候选标的，请重试。')
          return
        }
        startCommittee(target)
        return
      }
      setStage('candidates')
      window.setTimeout(() => document.querySelector('#candidates')?.scrollIntoView({ behavior: 'smooth' }), 30)
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败，请重试。')
    } finally {
      setLoading(false)
    }
  }

  const startCommittee = (candidate: Candidate) => {
    setSelected(candidate); setCommitteeTick(0); setExpandedMember(null); setStage('committee'); setJustArchived(false)
    window.setTimeout(() => document.querySelector('#committee')?.scrollIntoView({ behavior: 'smooth' }), 40)
  }

  const openRisk = () => { setAcknowledged(false); setRiskModal(true) }
  const createCard = () => { if (!acknowledged) return; setRiskModal(false); setJustArchived(false); setCardOpen(true) }
  const reset = () => { setView('assistant'); setStage('input'); setSelected(null); setCommitteeTick(-1); setCardOpen(false); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const saveArchive = () => {
    if (!selected) return
    const now = new Date().toISOString()
    const id = `${mode}-${scenario.interpretation.subject}-${selected.code}`
    const existing = archives.find((item) => item.id === id)
    const sys = live?.members.find((m) => m.key === 'system')
    const record: ArchiveRecord = {
      id, taskTitle: scenario.interpretation.subject, code: selected.code, name: selected.name, query, subject: scenario.interpretation.subject,
      verdict: live?.verdict.title ?? '暂不行动', score: live?.verdict.score ?? 72, price: selected.price,
      createdAt: existing?.createdAt || now, updatedAt: now,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      entryPrice: live?.plan.entryPrice ?? 162, stopPrice: live?.plan.stopPrice ?? 157,
      takeRange: live?.plan.takeRange ?? '¥175 — ¥178', initialPosition: live?.plan.initialPosition ?? '5%', maxPosition: live?.plan.maxPosition ?? '10%',
      tradingSystemText: tradingSystem?.text, tradingSystemUpdatedAt: tradingSystem?.updatedAt,
      systemVerdict: sys?.conclusion ?? (tradingSystem ? '依据不足，保持观察，不触发首次 5% 观察仓位。' : undefined),
      members: live?.members, marketNote: live?.marketNote,
      status: '有效',
    }
    setArchives((items) => [record, ...items.filter((item) => item.id !== id)])
    setJustArchived(true)
    setToast('已成功留档，可继续加入组合体检或一周后复盘')
  }
  const openSystemEditor = () => { setSystemDraft(tradingSystem?.text || ''); setSystemError(''); setSystemModalOpen(true) }
  const saveTradingSystem = () => {
    const text = systemDraft.trim()
    if (text.length < 20) { setSystemError('请至少输入 20 个字，说明入场、仓位或风险规则。'); return }
    setTradingSystem({ text, updatedAt: new Date().toISOString() })
    setSystemModalOpen(false); setSystemError(''); setToast('交易系统已保存并启用')
  }
  const clearTradingSystem = () => {
    setTradingSystem(null); setSystemDraft(''); setSystemModalOpen(false); setSystemError(''); setToast('交易系统已清除')
  }
  const closeCard = () => {
    if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.action-drawer')) document.activeElement.blur()
    setCardOpen(false)
  }
  const showReview = () => { closeCard(); setView('review'); setActiveArchive(null); setNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const showPortfolio = () => { closeCard(); setView('portfolio'); setActiveArchive(null); setNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const showArchives = () => { closeCard(); setView('archives'); setNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const showAssistant = () => { setView('assistant'); setActiveArchive(null); setNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const addPortfolioItem = (item: PortfolioItem) => {
    setPortfolioItems((items) => [item, ...items.filter((existing) => existing.code !== item.code)])
    setPortfolioReportReady(false)
    setToast(`已将 ${item.name} 添加入组合名单`)
  }
  const addArchiveToPortfolio = (archive: ArchiveRecord) => addPortfolioItem({ code: archive.code, name: archive.name, weight: 5, source: '档案', addedAt: new Date().toISOString() })
  const addManualPortfolioItems = () => {
    const parsed = normalizePortfolioInput(portfolioDraft)
    if (parsed.length === 0) { setPortfolioError('未识别到可添加的 A 股标的，请输入示例中的股票名称、代码或仓位。'); return }
    setPortfolioError('')
    setPortfolioItems((items) => [...parsed, ...items.filter((existing) => !parsed.some((item) => item.code === existing.code))])
    setPortfolioReportReady(false)
    setToast(`已添加 ${parsed.length} 只股票到组合名单`)
  }
  const removePortfolioItem = (code: string) => { setPortfolioItems((items) => items.filter((item) => item.code !== code)); setPortfolioReportReady(false) }
  const runPortfolioAnalysis = () => {
    if (portfolioItems.length < 2) { setPortfolioError('至少添加 2 只股票后才能生成组合综合分析。'); return }
    const gate = tryUsePremium(plan)
    setPlan(gate.plan)
    if (!gate.ok) { setPortfolioError(`免费版组合体检与复盘共用 ${FREE_PREMIUM_QUOTA} 次，已用完；升级专业版（29 元/月）不限次数。`); setPricingOpen(true); return }
    setPortfolioError(''); setPortfolioReportReady(true)
    window.setTimeout(() => document.querySelector('#portfolio-report')?.scrollIntoView({ behavior: 'smooth' }), 30)
  }
  const deepAnalyzePortfolioItem = (item: PortfolioItem) => {
    setMode('stock'); setQuery(`我当前组合中关注 ${item.name}，请分析它在 ${stockProfiles[item.code]?.theme || '当前组合'} 中的风险与机会。`)
    setStage('input'); setSelected(null); setCommitteeTick(-1); setView('assistant'); setNavOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const startReviewFromArchive = (archive: ArchiveRecord) => {
    setReviewMode('stock'); setReviewArchive(archive); setReviewOperation(`我围绕 ${archive.name} 做了一次观察后的操作：价格、仓位和处理过程如下……`); setReviewReason(`当时参考了「${getArchiveFileName(archive)}」这次分析，但实际处理中有一些犹豫。`); setReviewResult('亏损'); setReviewPnl('-3.6%'); setReviewQuestion('这次结果主要是行情问题，还是我可以主动规避？'); setReviewError(''); setReviewReportReady(false); setActiveArchive(null); showReview()
  }
  const runReview = () => {
    if (reviewOperation.trim().length < 20 || reviewReason.trim().length < 10 || !reviewPnl.trim()) { setReviewError('请补充实际操作、当时判断和最终盈亏，AI 才能区分无法规避与可以优化。'); return }
    const gate = tryUsePremium(plan)
    setPlan(gate.plan)
    if (!gate.ok) { setReviewError(`免费版组合体检与复盘共用 ${FREE_PREMIUM_QUOTA} 次，已用完；升级专业版（29 元/月）不限次数。`); setPricingOpen(true); return }
    setReviewError(''); setReviewReportReady(true)
    const record: ReviewRecord = { id: `${Date.now()}`, mode: reviewMode, title: reviewArchive ? getArchiveFileName(reviewArchive) : (reviewMode === 'stock' ? '个股复盘' : '组合复盘'), result: reviewResult, pnl: reviewPnl, source: reviewAnalysis.sourceTitle, createdAt: new Date().toISOString(), operation: reviewOperation, reason: reviewReason, question: reviewQuestion, archiveId: reviewArchive?.id }
    setReviewRecords((items) => [record, ...items].slice(0, 12))
    window.setTimeout(() => document.querySelector('#review-report')?.scrollIntoView({ behavior: 'smooth' }), 30)
  }
  const openReviewRecord = (record: ReviewRecord) => {
    setReviewMode(record.mode)
    setReviewArchive(record.archiveId ? archives.find((item) => item.id === record.archiveId) || null : null)
    setReviewOperation(record.operation || (record.mode === 'stock' ? '这是一条旧复盘记录，原始操作未保存。' : '这是一条旧组合复盘记录，原始组合操作未保存。'))
    setReviewReason(record.reason || '这是一条旧复盘记录，原始判断原因未保存。')
    setReviewResult(record.result === '盈利' || record.result === '持平' ? record.result : '亏损')
    setReviewPnl(record.pnl)
    setReviewQuestion(record.question || '查看历史复盘报告')
    setReviewReportReady(true)
    window.setTimeout(() => document.querySelector('#review-report')?.scrollIntoView({ behavior: 'smooth' }), 30)
  }
  const deleteArchive = (id: string) => { setArchives((items) => items.filter((item) => item.id !== id)); setActiveArchive(null); setToast('留档已删除') }
  const handleUpgrade = () => { const next = upgradePlan(); setPlan(next); setPricingOpen(false); setToast('演示环境已开通专业版（未真实扣费）') }
  const deleteReview = (id: string) => {
    setReviewRecords((items) => items.filter((item) => item.id !== id))
    if (renameTarget?.id === id) setRenameTarget(null)
    setToast('复盘记录已删除')
  }
  const togglePinReview = (id: string) => {
    setReviewRecords((items) => items.map((item) => item.id === id ? { ...item, pinned: !item.pinned } : item))
    setToast('已更新收藏')
  }
  const openRename = (record: ReviewRecord) => { setRenameTarget(record); setRenameDraft(displayTitle(record)) }
  const saveRename = () => {
    const title = renameDraft.trim()
    if (!title || !renameTarget) return
    setReviewRecords((items) => items.map((item) => item.id === renameTarget.id ? { ...item, customTitle: title } : item))
    setRenameTarget(null)
    setToast('复盘名称已更新')
  }
  const toggleMonth = (month: string) => setCollapsedMonths((prev) => ({ ...prev, [month]: !prev[month] }))
  const monthLabel = (month: string) => { const [y, m] = month.split('-'); return `${y} 年 ${Number(m)} 月` }
  const dateLabel = (date: string) => { const [, m, d] = date.split('-'); return `${Number(m)} 月 ${Number(d)} 日` }
  const reviewGroups = useMemo(() => {
    const pinned: ReviewRecord[] = []
    const byMonth = new Map<string, ReviewRecord[]>()
    for (const record of [...reviewRecords].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))) {
      if (record.pinned) { pinned.push(record); continue }
      const month = (record.createdAt || '').slice(0, 7) || '未知月份'
      byMonth.set(month, [...(byMonth.get(month) || []), record])
    }
    const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, records]) => {
      const byDate = new Map<string, ReviewRecord[]>()
      for (const record of records) {
        const date = (record.createdAt || '').slice(0, 10) || month
        byDate.set(date, [...(byDate.get(date) || []), record])
      }
      return { month, records, dates: [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])) }
    })
    return { pinned, months }
  }, [reviewRecords])
  const reviewRecordCard = (record: ReviewRecord) => (
    <div className="review-record" key={record.id}>
      <button className="review-record-main" onClick={() => openReviewRecord(record)}>
        <div><strong>{displayTitle(record)}</strong><span>{record.mode === 'stock' ? '个股复盘' : '组合复盘'}{record.source ? ` · ${record.source}` : ''}</span></div>
        <b className={record.result === '亏损' ? 'loss' : 'gain'}>{record.result} {record.pnl}</b>
        <small>{new Date(record.createdAt).toLocaleString('zh-CN')} · 点击查看报告</small>
      </button>
      <div className="review-record-actions">
        <button className={`icon-btn ${record.pinned ? 'pinned' : ''}`} onClick={() => togglePinReview(record.id)} aria-label={record.pinned ? '取消收藏' : '收藏置顶'} title={record.pinned ? '取消收藏' : '收藏置顶'}><Star size={13} fill={record.pinned ? 'currentColor' : 'none'}/></button>
        <button className="icon-btn" onClick={() => openRename(record)} aria-label="重命名" title="重命名"><Pencil size={13}/></button>
        <button className="icon-btn danger-icon" onClick={() => deleteReview(record.id)} aria-label="删除" title="删除"><Trash2 size={13}/></button>
      </div>
    </div>
  )

  return <div className="app">
    <header className="topbar">
      <div className="brand"><button className="icon-btn menu-btn" aria-label="打开流程导航" onClick={() => setNavOpen(!navOpen)}><Menu size={18}/></button><div className="logo penguin-logo" aria-hidden="true"><svg viewBox="0 0 40 40" role="img"><ellipse cx="20" cy="20" rx="12" ry="15" fill="#111827"/><ellipse cx="20" cy="23" rx="8" ry="10" fill="#f8fafc"/><circle cx="16" cy="15" r="2.1" fill="#f8fafc"/><circle cx="24" cy="15" r="2.1" fill="#f8fafc"/><path d="M12 14h7v4h-7zM21 14h7v4h-7z" fill="#020617"/><path d="M19 16h2" stroke="#020617" strokeWidth="1.5"/><path d="M18 20h4l-2 2.5z" fill="#f59e0b"/><path d="M13 31c2 2 12 2 14 0" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/></svg></div><div><strong>finance penguin</strong><span>A 股假设验证台</span></div></div>
      <div className="top-actions"><button className="plan-chip" onClick={() => setPricingOpen(true)} aria-label="查看会员方案"><BadgeCheck size={13}/><span>{plan.tier === 'pro' ? '专业版 · 已开通' : `免费版 · 高级功能剩余 ${premiumRemaining(plan)} 次`}</span><strong>{plan.tier === 'pro' ? '29 元/月' : '升级专业版'}</strong></button><button className="market-refresh" onClick={refreshMarket} disabled={marketRefreshing} aria-label="刷新最新行情并重置"><Database size={13}/><span>最新行情 · 重置</span><strong>{marketTimeLabel}</strong>{marketRefreshing && <RefreshCw className="spin" size={13}/>}</button></div>
    </header>

    <aside className={`rail ${navOpen ? 'open' : ''}`}>
      <div className="rail-label">WORKSPACE</div>
      <button className={`module-nav ${view === 'assistant' ? 'active' : ''}`} onClick={showAssistant}><BrainCircuit size={17}/><div><strong>分析助手</strong><span>验证新的投资假设</span></div></button>
      <button className={`module-nav ${view === 'portfolio' ? 'active' : ''}`} onClick={showPortfolio}><PieChart size={17}/><div><strong>组合体检</strong><span>{portfolioItems.length} 只组合名单</span></div></button>
      <button className={`module-nav ${view === 'review' ? 'active' : ''}`} onClick={showReview}><ClipboardCheck size={17}/><div><strong>复盘教练</strong><span>{reviewRecords.length} 条复盘记录</span></div></button>
      <button className={`module-nav ${view === 'archives' ? 'active' : ''}`} onClick={showArchives}><Archive size={17}/><div><strong>留档</strong><span>{archives.length} 份完整分析</span></div></button>
      {view === 'assistant' && <><div className="rail-label flow-label">分析进度</div>{(isStockMode ? ['输入观点', '多方分析', '综合判断', '观察计划'] : ['输入观点', '验证标的', '多方分析', '综合判断', '观察计划']).map((label, index) => <div className={`rail-item ${index === stageIndex ? 'active' : ''} ${index < stageIndex ? 'done' : ''}`} key={label}><span>{index < stageIndex ? <Check size={13}/> : index + 1}</span>{label}</div>)}</>}
      <div className="rail-warning"><AlertTriangle size={16}/><p>行情为真实免费接口实时快照，AI 分析由 DeepSeek 生成；仅供学习验证，不构成投资建议。</p></div>
    </aside>

    <main className="workspace">
      {view === 'assistant' ? <>
        <section className="hero compact-hero"><div><h1>验证你的投资判断</h1></div><div className="coverage"><div><strong>5,000+</strong><span>A 股</span></div></div></section>

      <section id="trading-system" className={`trading-system-card ${tradingSystem ? 'enabled' : ''}`}>
        <div className="trading-system-icon"><FileText size={20}/></div>
        <div className="trading-system-copy"><div className="trading-system-title"><span>我的交易系统</span>{tradingSystem && <Pill tone="success"><CheckCircle2 size={11}/>已启用</Pill>}</div>{tradingSystem ? <><p>{tradingSystem.text}</p><small>更新于 {new Date(tradingSystem.updatedAt).toLocaleString('zh-CN')}</small></> : <p>可选填写交易规则。</p>}</div>
        <div className="trading-system-actions"><button className="btn secondary" onClick={openSystemEditor}>{tradingSystem ? '查看与修改' : '添加交易系统'}</button>{tradingSystem && <button className="btn text-danger" onClick={clearTradingSystem}>清除</button>}</div>
      </section>

      <section className="panel input-panel">
        <div className="section-head"><div><span className="section-no">01 / 输入观点</span><h2>您想了解什么？</h2></div><Pill tone="success">沪深京 A 股</Pill></div>
        <div className="mode-tabs" role="tablist"><button className={mode === 'thesis' ? 'active' : ''} onClick={() => switchMode('thesis')}><BrainCircuit size={16}/>市场观点</button><button className={mode === 'stock' ? 'active' : ''} onClick={() => switchMode('stock')}><Search size={16}/>指定个股</button></div>
        <label htmlFor="query">{mode === 'thesis' ? '输入行业、主题、政策或事件判断' : '输入股票名称或 6 位代码（如：绿的谐波 / 688017）'}</label>
        <textarea id="query" value={query} onChange={(event) => setQuery(event.target.value)} aria-invalid={Boolean(error)} />
        {isStockMode && <details className="stock-extra"><summary>补充你的判断 / 方向 / 时间（可选）</summary><textarea id="stock-extra-note" value={extraNote} onChange={(event) => setExtraNote(event.target.value)} placeholder="例如：关注机器人减速器赛道，未来一周观察回踩支撑后的承接力度" rows={2}/></details>}
        {error && <div className="error"><AlertTriangle size={16}/><span>{error}</span></div>}
        <div className="input-examples"><span>切换示例</span><button onClick={() => switchMode('thesis')}>AI 基础设施资本开支</button><button onClick={() => switchMode('stock')}>贵州茅台一周修复</button></div>
        <div className="input-footer"><span><Info size={14}/>东财 + 腾讯实时行情 · AI 完整分析约需 30-90 秒</span><button className="btn primary discover-btn" disabled={loading} onClick={discover}>{loading ? <><RefreshCw className="spin" size={16}/>{loadingLabel}{loadingElapsed >= 5 ? <em className="elapsed"> {loadingElapsed}s</em> : null}</> : <><Search size={16}/>{isStockMode ? '开始分析' : '发现标的'}</>}</button></div>
      </section>

      {stage !== 'input' && <section className="interpretation"><div className="interpret-title"><BadgeCheck size={17}/>您的观点概览</div><div className="interpret-grid">{Object.entries(scenario.interpretation).map(([key, value]) => <div key={key}><span>{{ subject: '关注方向', direction: '您的判断', horizon: '关注周期', catalyst: '潜在催化', unknown: '待确认信息' }[key]}</span><strong>{value}</strong></div>)}</div></section>}

      {stage !== 'input' && !isStockMode && <section id="candidates" className="block">
        <div className="section-head"><div><span className="section-no">02 / 验证标的</span><h2>{candidateSectionTitle}</h2><p>{candidateSectionDescription}</p></div><Pill>{candidatePoolLabel}</Pill></div>
        <div className="strategy-note"><Target size={18}/><div><strong>筛选思路</strong><p>{scenario.strategy}</p></div></div>
        <div className="candidate-grid">{scenario.candidates.map((candidate, index) => {
          const scoreTone = candidate.score >= 75 ? 'high' : candidate.score >= 60 ? 'medium' : 'low'
          const isTargetStock = isStockMode && index === 0
          const isComparison = isStockMode && index > 0
          const rankLabel = isStockMode ? (isTargetStock ? '目标股票' : `对照参照 ${index}`) : `验证 ${index + 1}`
          const scoreLabel = isComparison ? '参照度' : '匹配度'
          const roleLabel = isStockMode ? (isTargetStock ? '本轮验证对象' : '对照用途') : '验证作用'
          const quote = quotes[candidate.code]
          const price = quote?.price ?? candidate.price
          const change = quote?.changePct ?? candidate.change
          return <article className={`candidate ${selected?.code === candidate.code ? 'selected' : ''}`} key={candidate.code}>
          <div className="candidate-top"><span className="rank">{rankLabel}</span><div className={`match-score ${scoreTone}`}><strong>{candidate.score}</strong><span>{scoreLabel}</span></div></div>
          <div className="company"><div><h3>{candidate.name}</h3><span>{candidate.code}</span></div><div><strong>¥{price.toFixed(2)}</strong><span className={change >= 0 ? 'up' : 'down'}>{change >= 0 ? '+' : ''}{change}%</span></div></div>
          <div className="role"><Target size={15}/><div><span>{roleLabel}</span><strong>{candidate.role}</strong></div></div>
          <div className="tags">{candidate.tags.map((tag) => <Pill key={tag} tone="accent">{tag}</Pill>)}</div>
          <dl><div><dt>{isComparison ? '参照依据' : '匹配依据'}</dt><dd>{candidate.reason}</dd></div><div><dt>{isComparison ? '如何辅助判断' : '为什么值得关注'}</dt><dd>{candidate.difference}</dd></div><div className="doubt"><dt>主要风险</dt><dd>{candidate.doubt}</dd></div></dl>
          <div className="candidate-foot"><span><Clock3 size={12}/>{quotesAt ? `实时行情 · ${new Date(quotesAt).toLocaleTimeString('zh-CN')} 抓取` : '行情获取中…'}</span>{isComparison ? <span className="btn ghost small" aria-disabled="true">仅作对照，不进入分析</span> : <button className="btn secondary choose-btn" onClick={() => startCommittee(candidate)}>{isTargetStock ? `开始验证${candidate.name}` : '选择并开始分析'}<ChevronRight size={15}/></button>}</div>
        </article>})}</div>
      </section>}

      {(stage === 'committee' || stage === 'verdict') && selected && <section id="committee" className="block">
        <div className="section-head"><div><span className="section-no">03 / 多方分析</span><h2>{selected.name} · 多方分析</h2><p>{committeeDescription}</p></div><Pill tone="mock">{activeMembers.length} 个视角</Pill></div>
        <div className="committee-track">{activeMembers.map((member, index) => { const current = stage === 'committee' && index === committeeStep; const complete = stage === 'verdict' || index < committeeStep; const status = complete ? '已完成' : current ? committeePhase === 'thinking' ? '思考中' : '正在生成' : '等待中'; return <div className={`track-item ${complete ? 'complete' : ''} ${current ? 'active' : ''}`} key={member.key}><span>{complete ? <Check size={14}/> : current ? <RefreshCw className="spin" size={14}/> : index + 1}</span><div><strong>{member.label}</strong><small>{status}</small></div></div>})}</div>
        {stage === 'committee' && committeeStep >= 0 && activeMembers[committeeStep] && <div className={`speaker-status ${activeMembers[committeeStep].tone}`}><span className="speaker-pulse"><RefreshCw className="spin" size={17}/></span><div><strong>{activeMembers[committeeStep].label}{committeePhase === 'thinking' ? '正在思考…' : '正在整理分析…'}</strong><p>{activeMembers[committeeStep].key === 'system' ? '正在逐条读取您保存的规则，仅按原文核对条件与冲突。' : committeePhase === 'thinking' ? '正在阅读业务、行情与风险依据，形成独立判断。' : '已形成核心观点，正在生成详细分析与证据索引。'}</p></div></div>}
        <div className="committee-list">{activeCommittee.map((member) => { const Icon = memberIcon(member.key); const open = expandedMember === member.key; return <article className={`member ${member.tone}`} key={member.key}><button className="member-head" onClick={() => setExpandedMember(open ? null : member.key)}><span className="member-icon"><Icon size={18}/></span><div><span>{member.label} · 已完成</span><strong>{member.summary}</strong><small>{open ? '收起完整分析' : '展开完整分析与依据'}</small></div><b>{member.score}</b><ChevronDown className={open ? 'rotate' : ''} size={17}/></button>{open && <div className="member-detail"><div className="member-conclusion"><span>核心结论</span><strong>{member.conclusion}</strong></div><div className="analysis-copy">{member.analysis.map((paragraph, index) => <p key={paragraph}><b>{index + 1}</b>{paragraph}</p>)}</div><div className="basis-grid"><div><h4>分析依据</h4><ul>{member.basis.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="evidence-gap"><h4>待补充信息</h4><p>{member.gap}</p></div></div><div className="evidence-list"><h4>证据与来源</h4>{member.evidence.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer"><span>{item.id}</span><div><strong>{item.name}</strong><small>数据日期：{item.date}</small></div><ChevronRight size={14}/></a>)}</div></div>}</article>})}</div>
        {stage === 'committee' && <div className="committee-footnote">当前视角完成后，将自动进入下一位。综合判断只会在{tradingSystem ? '乐观、悲观、风控和“我的系统”' : '乐观、悲观和风控'}全部完成后生成，约数秒完成。</div>}
      </section>}

      {stage === 'verdict' && selected && <section className="block verdict-section">
        <div className="section-head"><div><span className="section-no">04 / 综合判断</span><h2>{isStockMode ? `${selected.name} · 综合判断` : '综合判断'}</h2><p>{verdictDescription}</p></div><div className="score-total"><span>跟踪评分</span><strong>{live?.verdict.score ?? 72}</strong><em>/ 100</em></div></div>
        <div className="verdict-grid"><div className="score-panel">{scores.map((item) => <div className="score-row" key={item.label}><div><strong>{item.label}</strong><span>{item.help}</span></div><div className="score-meter"><i style={{ width: `${item.value}%` }}/></div><b>{item.value}</b></div>)}</div><aside className="verdict-card"><span className="verdict-label">系统综合判断</span><h3>{live?.verdict.title ?? '暂不行动，继续观察'}</h3><p>{live?.verdict.conclusion ?? '业务关联与中期需求逻辑较强；市场反映程度和订单证据缺口构成主要扣分。建议用一周窗口观察价格确认与新增证据，不将评分理解为上涨概率。'}</p><div className="deduction"><AlertTriangle size={15}/><span>{live?.verdict.deduction || '主要扣分：市场拥挤、最新订单缺失、短期事件风险'}</span></div>{live?.marketNote && <div className="ai-disclaimer"><Database size={14}/><p>{live.marketNote}</p></div>}<button className="btn primary full" onClick={openRisk}><CalendarClock size={16}/>生成一周观察计划</button></aside></div>
      </section>}
      </> : view === 'portfolio' ? <section className="portfolio-page">
        <div className="portfolio-hero"><div><h1>组合体检</h1></div><div className={`portfolio-total ${getScoreTone(portfolioAnalysis.score)}`}><span>组合评分</span><strong>{portfolioItems.length >= 2 ? portfolioAnalysis.score : '--'}</strong></div></div>
        <div className="portfolio-layout">
          <section className="panel portfolio-input-panel"><div className="section-head"><div><span className="section-no">01 / 添加组合</span><h2>录入股票</h2></div><Pill tone="mock">演示组合</Pill></div><textarea className="portfolio-textarea" value={portfolioDraft} onChange={(event) => { setPortfolioDraft(event.target.value); setPortfolioError('') }} aria-invalid={Boolean(portfolioError)}/>{portfolioError && <div className="error"><AlertTriangle size={16}/><span>{portfolioError}</span></div>}<div className="portfolio-input-actions"><button className="btn secondary" onClick={() => setPortfolioDraft('中际旭创 5%\n浪潮信息 4%\n贵州茅台 8%\n宁德时代 6%\n招商银行 10%')}>填入示例</button><button className="btn primary" onClick={addManualPortfolioItems}><Plus size={15}/>添加到组合</button></div></section>
          <section className="panel portfolio-list-panel"><div className="section-head"><div><span className="section-no">02 / 组合名单</span><h2>当前组合</h2></div><button className="btn primary" onClick={runPortfolioAnalysis}><PieChart size={15}/>综合分析</button></div>{portfolioItems.length === 0 ? <div className="portfolio-empty"><Layers3 size={28}/><h3>还没有组合名单</h3><p>先完成一次分析并留档，再点击“加入组合”；也可以从左侧示例直接添加。</p></div> : <div className="portfolio-holdings">{portfolioItems.map((item) => { const profile = stockProfiles[item.code]; return <article className="holding-card" key={item.code}><div><strong>{item.name}</strong><span>{item.code} · {profile?.theme || '未分类'} · 来源：{item.source}</span></div><div className="holding-weight"><b>{item.weight}%</b><small>模拟仓位</small></div><button className="icon-btn danger-icon" aria-label={`移除 ${item.name}`} onClick={() => removePortfolioItem(item.code)}><Trash2 size={15}/></button></article>})}</div>}</section>
        </div>
        {portfolioReportReady && <section id="portfolio-report" className="portfolio-report block"><div className="section-head"><div><span className="section-no">03 / 综合分析报告</span><h2>组合评分与优化建议</h2><p>围绕当前名单给出基础判断、组合管理、交易系统冲突和绿色高分组合建议。</p></div><div className={`score-total portfolio-score ${getScoreTone(portfolioAnalysis.score)}`}><span>组合总分</span><strong>{portfolioAnalysis.score}</strong><em>/ 100</em></div></div>
          <div className="portfolio-summary-grid"><div><span>组合数量</span><strong>{portfolioItems.length} 只</strong><small>当前名单</small></div><div><span>模拟仓位合计</span><strong>{portfolioAnalysis.totalWeight}%</strong><small>不代表账户真实仓位</small></div><div><span>最大主题暴露</span><strong>{portfolioAnalysis.maxTheme ? `${portfolioAnalysis.maxTheme[0]} ${portfolioAnalysis.maxTheme[1].weight}%` : '--'}</strong><small>{portfolioAnalysis.maxTheme ? portfolioAnalysis.maxTheme[1].names.join('、') : '暂无'}</small></div><div><span>防御资产占比</span><strong>{portfolioAnalysis.defensiveWeight}%</strong><small>白酒与银行金融</small></div></div>
          <div className="portfolio-report-grid"><section className="report-card"><h3><FileSearch size={16}/>基础判断</h3>{portfolioAnalysis.items.map((item) => <div className="judgement-row" key={item.code}><div><strong>{item.name}</strong><span>{item.profile.role}</span></div><p>{item.profile.opportunity}</p><small>主要风险：{item.profile.risk}</small><button className="btn ghost" onClick={() => deepAnalyzePortfolioItem(item)}>深入分析</button></div>)}</section><section className="report-card"><h3><Layers3 size={16}/>主题暴露与风险重叠</h3>{Object.entries(portfolioAnalysis.themes).map(([theme, info]) => <div className="theme-row" key={theme}><div><strong>{theme}</strong><span>{info.names.join('、')}</span></div><b>{info.weight}%</b></div>)}<p className="report-note">AI 算力链合计 {portfolioAnalysis.aiWeight}%。中际旭创与浪潮信息虽然环节不同，但主要风险都来自云厂商资本开支、订单兑现和估值拥挤。</p></section></div>
          <div className="portfolio-report-grid"><section className="report-card"><h3><Scale size={16}/>组合管理</h3><ul className="report-list"><li>仓位管理：单只股票默认按输入比例评估，未输入时按 5% 处理。</li><li>资金管理：当前模拟仓位合计 {portfolioAnalysis.totalWeight}%，保留现金或低波动资产可降低回撤压力。</li><li>风险重叠：高波动标的 {portfolioAnalysis.highVolCount} 只，需避免同一主题连续加仓。</li><li>交易系统冲突：{tradingSystem ? '已检测用户交易系统，若单一主题上限为 10%，AI 算力链已接近或触及关注阈值。' : '尚未启用交易系统，无法检查个性化仓位规则。'}</li></ul></section><section className="report-card"><h3><Target size={16}/>优化组合建议</h3><div className={`combo-current ${getScoreTone(portfolioAnalysis.score)}`}><span>当前完整组合</span><strong>{portfolioItems.map((item) => item.name).join(' + ')}</strong><b>{portfolioAnalysis.score} 分</b></div>{portfolioAnalysis.score >= 75 ? <p className="report-note">当前组合已进入绿色区间，优先维持结构并定期复核高波动标的。</p> : portfolioAnalysis.combinations.length === 0 ? <p className="report-note">暂未找到高于当前组合且达到绿色区间的子组合，建议先补充防御资产或降低主题重复暴露。</p> : <div className="combo-list">{portfolioAnalysis.combinations.map((combo) => <div className="combo-card" key={combo.names.join('-')}><div><strong>{combo.names.join(' + ')}</strong><span>{combo.reason}</span></div><b>{combo.score}</b></div>)}</div>}</section></div>
          <div className="ai-disclaimer"><ShieldCheck size={17}/><p>组合体检基于用户主动录入和 Mock 标的画像生成，只用于结构诊断与复核优先级排序，不构成投资建议，也不代表收益预测或上涨概率。</p></div></section>}
      </section> : view === 'review' ? <section className="review-page">
        <div className="portfolio-hero review-hero"><div><h1>复盘教练</h1></div><div className="portfolio-total high"><span>历史复盘</span><strong>{reviewRecords.length}</strong></div></div>
        <div className="review-layout"><section className="panel review-input-panel"><div className="section-head"><div><span className="section-no">01 / 选择复盘类型</span><h2>个股复盘或组合复盘</h2><p>第一版不接真实成交。建议从留档进入复盘，对照当初的观察计划区分不可控行情和可优化动作。</p></div><Pill tone="mock">演示复盘</Pill></div><div className="mode-tabs review-tabs"><button className={reviewMode === 'stock' ? 'active' : ''} onClick={() => { setReviewMode('stock'); setReviewReportReady(false) }}><FileSearch size={16}/>个股复盘</button><button className={reviewMode === 'portfolio' ? 'active' : ''} onClick={() => { setReviewMode('portfolio'); setReviewReportReady(false) }}><PieChart size={16}/>组合复盘</button></div>{reviewMode === 'stock' && <div className="review-source"><span>复盘对象</span><strong>{reviewArchive ? getArchiveFileName(reviewArchive) : '未从留档选择，使用通用个股复盘'}</strong><small>建议从留档卡片点击“开始复盘”，可自动带入原观察计划。</small></div>}{reviewMode === 'portfolio' && <div className="review-source"><span>复盘对象</span><strong>{portfolioItems.length} 只组合名单</strong><small>{portfolioItems.length ? portfolioItems.map((item) => item.name).join('、') : '可先在组合体检中添加股票'}</small></div>}<label htmlFor="review-operation">实际操作过程</label><textarea id="review-operation" value={reviewOperation} onChange={(event) => { setReviewOperation(event.target.value); setReviewError('') }} aria-invalid={Boolean(reviewError)}/><label htmlFor="review-reason">当时判断或心理原因</label><textarea id="review-reason" className="review-small-textarea" value={reviewReason} onChange={(event) => { setReviewReason(event.target.value); setReviewError('') }} aria-invalid={Boolean(reviewError)}/><div className="review-result-row"><div><label>最终结果</label><select value={reviewResult} onChange={(event) => setReviewResult(event.target.value as '盈利' | '亏损' | '持平')}><option>盈利</option><option>亏损</option><option>持平</option></select></div><div><label htmlFor="review-pnl">盈亏幅度</label><input id="review-pnl" value={reviewPnl} onChange={(event) => setReviewPnl(event.target.value)} placeholder="例如 -3.6%"/></div></div><label htmlFor="review-question">想复盘的问题，可选</label><input id="review-question" value={reviewQuestion} onChange={(event) => setReviewQuestion(event.target.value)} placeholder="例如：这是行情问题还是纪律问题？"/>{reviewError && <div className="error"><AlertTriangle size={16}/><span>{reviewError}</span></div>}<button className="btn primary full" onClick={runReview}><ClipboardCheck size={16}/>生成复盘报告</button></section><aside className="panel review-history"><div className="section-head"><div><span className="section-no">历史复盘</span><h2>最近记录</h2><p>按月收纳、可收起；支持收藏置顶、重命名与删除。</p></div></div>{reviewRecords.length === 0 ? <div className="portfolio-empty"><ClipboardCheck size={28}/><h3>暂无复盘记录</h3><p>生成一次复盘后会保存在当前浏览器。</p></div> : <div className="review-records">{reviewGroups.pinned.length > 0 && <section className="review-group pinned"><div className="review-group-head"><Star size={13}/><strong>收藏置顶</strong><span>{reviewGroups.pinned.length} 条</span></div><div className="review-group-body">{reviewGroups.pinned.map(reviewRecordCard)}</div></section>}{reviewGroups.months.map(({ month, records, dates }) => { const collapsed = collapsedMonths[month]; return <section className="review-group" key={month}><button className="review-group-head" onClick={() => toggleMonth(month)} aria-expanded={!collapsed}><ChevronRight size={14} className={collapsed ? '' : 'rotate'}/><strong>{monthLabel(month)}</strong><span>{records.length} 条</span></button>{!collapsed && <div className="review-group-body">{dates.map(([date, items]) => <div className="review-date-block" key={date}><div className="review-date-label">{dateLabel(date)}</div>{items.map(reviewRecordCard)}</div>)}</div>}</section>})}</div>}</aside></div>
        {reviewReportReady && <section id="review-report" className="review-report block"><div className="section-head"><div><span className="section-no">02 / 复盘报告</span><h2>{reviewAnalysis.targetName} · 结论</h2></div><Pill tone={reviewResult === '亏损' ? 'warning' : 'success'}>{reviewResult} {reviewPnl}</Pill></div><div className="review-conclusion"><h3>核心结论</h3><p>{reviewAnalysis.conclusion}</p></div><div className="review-grid review-insight-grid"><section className="report-card review-insight good"><h3><CheckCircle2 size={22}/>做得好的地方</h3><ul>{reviewAnalysis.positives.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="report-card review-insight bad"><h3><AlertTriangle size={22}/>做得不好的地方</h3><ul>{reviewAnalysis.issues.map((item) => <li key={item}>{item}</li>)}</ul></section></div><div className="review-grid review-insight-grid"><section className="report-card review-insight unavoidable"><h3><ShieldQuestion size={22}/>无法提前控制</h3><ul>{reviewAnalysis.unavoidable.map((item) => <li key={item}>{item}</li>)}</ul></section><section className="report-card review-insight action"><h3><Target size={22}/>下次怎么做</h3><ul>{reviewAnalysis.nextActions.map((item) => <li key={item}>{item}</li>)}</ul></section></div><section className="report-card review-compare"><h3><FileText size={18}/>计划 vs 实际</h3><div className="compare-table">{reviewAnalysis.comparisons.map(([step, plan, actual, judgement]) => <div className="compare-row" key={step}><strong>{step}</strong><span>{plan}</span><span>{actual}</span><b className={judgement === '不可控' ? 'neutral' : 'warn'}>{judgement}</b></div>)}</div></section></section>}
      </section> : <section className="archive-page">
        <div className="archive-hero"><div><h1>留档</h1></div><div className="archive-count"><strong>{archives.length}</strong><span>份留档</span></div></div>
        <div className="archive-toolbar"><div><h2>全部留档</h2><p>按最近更新时间排序</p></div><button className="btn primary" onClick={showAssistant}><BrainCircuit size={15}/>开始新的分析</button></div>
        {archives.length === 0 ? <div className="archive-empty"><span><FolderOpen size={27}/></span><h3>还没有留档</h3><p>完成一次分析并生成观察计划后，点击“留档”即可保存本次观点、验证标的、综合判断和观察计划。</p><button className="btn primary" onClick={showAssistant}>开始第一次分析<ChevronRight size={15}/></button></div> : <div className="archive-grid">{archives.map((item) => <article className="archive-card" key={item.id}>
          <div className="archive-card-top"><Pill tone="success">{item.status}</Pill><span>更新于 {new Date(item.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
          <div className="archive-company"><div><h3>{getArchiveFileName(item)}</h3><span>{item.code}</span></div><div className="archive-score"><strong>{item.score}</strong><span>综合评分</span></div></div>
          <p className="archive-query">{item.query}</p>
          <div className="archive-verdict"><span>综合判断</span><strong>{item.verdict}</strong></div>
          <div className="archive-docs"><div><FileSearch size={16}/><span><strong>研究分析</strong><small>假设、验证标的与多方审查</small></span></div><div><FileText size={16}/><span><strong>观察计划</strong><small>触发价、失效价与待补证据</small></span></div>{item.tradingSystemText && <div className="archive-system-doc"><ShieldCheck size={16}/><span><strong>我的系统</strong><small>保存当次规则与推导结论</small></span></div>}</div>
          <div className="archive-meta"><span><CalendarClock size={13}/>有效至 2026-09-01</span><span>观察参考价 ¥{item.price.toFixed(2)}</span></div>
          <div className="archive-actions"><button className="btn secondary" onClick={() => setActiveArchive(item)}>查看完整档案</button><button className="btn ghost" onClick={() => addArchiveToPortfolio(item)}><Plus size={14}/>加入组合</button><button className="btn ghost" onClick={() => startReviewFromArchive(item)}><ClipboardCheck size={14}/>开始复盘</button><button className="icon-btn danger-icon" aria-label={`删除 ${getArchiveFileName(item)} 留档`} onClick={() => deleteArchive(item.id)}><Trash2 size={16}/></button></div>
        </article>)}</div>}
      </section>}
    </main>

    {systemModalOpen && <div className="modal-layer"><div className="modal system-modal"><button className="icon-btn close" onClick={() => setSystemModalOpen(false)} aria-label="关闭交易系统编辑"><X size={18}/></button><div className="modal-icon system"><FileText size={25}/></div><h2>{tradingSystem ? '查看与修改交易系统' : '添加我的交易系统'}</h2><p>请使用自然语言写清入场、仓位、加减仓和退出规则。分析时只按您提供的原文推导；缺少的规则会标记为“依据不足”。</p><label htmlFor="system-rules">交易规则</label><textarea id="system-rules" className="system-textarea" value={systemDraft} onChange={(event) => { setSystemDraft(event.target.value); setSystemError('') }} aria-invalid={Boolean(systemError)} placeholder="例如：仅在收盘价站上 20 日均线且行业指数同步走强时建仓；首次仓位 5%，确认后最高 10%；跌破关键支撑则退出……"/>{systemError && <div className="error"><AlertTriangle size={16}/><span>{systemError}</span></div>}<div className="system-helper"><span>{systemDraft.trim().length} 字</span><span>规则将仅保存在当前浏览器</span></div><div className="modal-actions">{tradingSystem ? <button className="btn text-danger" onClick={clearTradingSystem}>清除规则</button> : <button className="btn ghost" onClick={() => setSystemModalOpen(false)}>取消</button>}<button className="btn primary" onClick={saveTradingSystem}>保存并启用</button></div></div></div>}

    {riskModal && <div className="modal-layer"><div className="modal"><button className="icon-btn close" onClick={() => setRiskModal(false)} aria-label="关闭"><X size={18}/></button><div className="modal-icon"><ShieldQuestion size={25}/></div><h2>生成前确认风险边界</h2><p>观察计划会根据演示数据和透明规则整理触发价、失效价与待补证据。它不是确定预测，也不能替代独立判断。</p><label className="check"><input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)}/><span>我理解本内容基于 Mock 盘后快照生成，可能遗漏、延迟或错误；我将独立判断并自行承担投资损益。</span></label><div className="legal-note">当前功能仅限内部体验验证，不构成持牌证券投资建议；请先确认风险边界再生成。</div><div className="modal-actions"><button className="btn ghost" onClick={() => setRiskModal(false)}>返回综合判断</button><button className="btn primary" disabled={!acknowledged} onClick={createCard}>确认并生成观察计划</button></div></div></div>}

    {cardOpen && <div className={`drawer-overlay ${cardOpen ? 'show' : ''}`} onClick={closeCard}/>}
    {cardOpen && <aside className="action-drawer open" aria-hidden={false}>
      <div className="drawer-head"><div><span className="section-no">05 / 一周观察计划</span><h2>{selected?.name}</h2></div><button className="icon-btn" onClick={closeCard} aria-label="关闭观察计划"><X size={18}/></button></div>
      <div className="drawer-body"><div className="expiry"><CalendarClock size={19}/><div><span>观察窗口</span><strong>{planWindow}</strong><small>{quotesAt ? `基于 ${new Date(quotesAt).toLocaleString('zh-CN')} 实时行情 · 到期需重新分析` : '到期需重新分析'}</small></div></div>
        <div className="price-anchor action-overview"><div><span>综合判断</span><strong className="watch">{live?.verdict.title ?? '暂不行动'}</strong><small>等待价格与证据确认</small></div><div><span>若条件触发</span><strong>首次上限 {live?.plan.initialPosition ?? '5%'}</strong><small>确认后最高 {live?.plan.maxPosition ?? '10%'}</small></div></div>
        <section className="trade-levels"><h3><Scale size={16}/>观察触发与失效规则</h3><div className="trade-level-grid"><div><span>观察触发价</span><strong>¥{live?.plan.entryPrice ?? '—'}</strong><small>高于参考价不追价</small></div><div className="stop"><span>失效复核价</span><strong>¥{live?.plan.stopPrice ?? '—'}</strong><small>收盘确认后重新判断</small></div><div className="take"><span>兑现观察区间</span><strong>{live?.plan.takeRange || '—'}</strong><small>只作跟踪，不自动成交</small></div></div></section>
        <ActionBlock title="本周观察重点" icon={CircleDot} items={live?.plan.focus ?? []}/>
        <ActionBlock title="满足条件后再考虑" icon={TrendingUp} items={live?.plan.satisfy ?? []}/>
        <ActionBlock title="降低关注条件" icon={TrendingDown} tone="warning" items={live?.plan.reduce ?? []}/>
        <ActionBlock title="取消观察条件" icon={AlertTriangle} tone="danger" items={live?.plan.cancel ?? []}/>
        {tradingSystem && <section className="system-snapshot"><div><ShieldCheck size={17}/><h3>本次使用的交易系统</h3></div><p>{tradingSystem.text}</p><strong>{live?.members.find((m) => m.key === 'system')?.conclusion || '系统结论：依据不足，保持观察，不触发首次 5% 观察仓位。'}</strong></section>}
        <ActionBlock title="本周待补证据" icon={FileSearch} tone="warning" items={live?.plan.pending ?? []}/>
        <div className="ai-disclaimer"><ShieldCheck size={17}/><p>{live?.marketNote || '本观察计划基于实时行情与 AI 分析生成，只用于记录触发条件、失效条件和待补证据，不构成持牌证券投资建议。'}</p></div>
      </div><div className="drawer-actions archive-drawer-actions"><button className={`btn archive-primary ${justArchived ? 'archived' : ''}`} onClick={saveArchive}>{justArchived ? <CheckCircle2 size={17}/> : <Archive size={17}/>} {justArchived ? '已留档' : archives.some((item) => item.id === `${mode}-${scenario.interpretation.subject}-${selected?.code}`) ? '更新留档' : '保存为留档'}</button><button className="btn ghost" onClick={() => window.print()}>打印</button><button className="btn ghost" onClick={closeCard}>关闭观察计划</button></div>
    </aside>}
    {activeArchive && <div className="modal-layer"><div className="archive-detail-modal"><div className="archive-detail-head"><div><span className="section-no">完整留档</span><h2>{getArchiveFileName(activeArchive)}</h2><p>{activeArchive.code}</p><p>{activeArchive.query}</p></div><button className="icon-btn" onClick={() => setActiveArchive(null)} aria-label="关闭留档详情"><X size={18}/></button></div><div className="archive-detail-body"><section><div className="doc-title"><FileSearch size={18}/><div><span>文档 01</span><h3>研究分析</h3></div></div><div className="detail-summary"><div><span>分析任务</span><strong>{activeArchive.taskTitle || activeArchive.subject}</strong></div><div><span>综合判断</span><strong>{activeArchive.verdict}</strong></div><div><span>跟踪评分</span><strong>{activeArchive.score} / 100</strong></div></div><div className="detail-opinions">{(activeArchive.members?.length ? activeArchive.members : baseCommittee).map((member) => <div key={member.key}><span>{member.label}</span><p>{member.summary}</p></div>)}</div></section>{activeArchive.tradingSystemText && <section><div className="doc-title"><ShieldCheck size={18}/><div><span>规则快照</span><h3>我的交易系统</h3></div></div><p className="archived-system-text">{activeArchive.tradingSystemText}</p><div className="detail-summary"><div><span>规则更新时间</span><strong>{activeArchive.tradingSystemUpdatedAt ? new Date(activeArchive.tradingSystemUpdatedAt).toLocaleString('zh-CN') : '未记录'}</strong></div><div><span>系统原始结论</span><strong>{activeArchive.systemVerdict || '依据不足'}</strong></div></div></section>}<section><div className="doc-title"><FileText size={18}/><div><span>文档 02</span><h3>观察计划</h3></div></div><div className="detail-summary"><div><span>若条件触发</span><strong>首次 {activeArchive.initialPosition || '5%'} · 最高 {activeArchive.maxPosition || '10%'}</strong></div><div><span>触发 / 失效</span><strong>¥{activeArchive.entryPrice || 162} / ¥{activeArchive.stopPrice || 157}</strong></div><div><span>兑现观察区间</span><strong>{activeArchive.takeRange || '¥175 — ¥178'}</strong></div></div><p className="detail-note">{activeArchive.marketNote || '基于 2026-08-21 Mock 盘后快照，有效至 2026-09-01。到期后必须使用最新数据重新分析；价格触及不代表自动交易。'}</p></section></div><div className="archive-detail-actions"><button className="btn ghost" onClick={() => deleteArchive(activeArchive.id)}><Trash2 size={14}/>删除留档</button><button className="btn secondary" onClick={() => addArchiveToPortfolio(activeArchive)}><Plus size={14}/>加入组合</button><button className="btn secondary" onClick={() => startReviewFromArchive(activeArchive)}><ClipboardCheck size={14}/>开始复盘</button><button className="btn primary" onClick={() => { setActiveArchive(null); showAssistant(); setToast('已返回分析助手，可基于最新数据重新复核') }}><RefreshCw size={14}/>继续复核</button></div></div></div>}

    {pricingOpen && <div className="modal-layer"><div className="modal pricing-modal"><button className="icon-btn close" onClick={() => setPricingOpen(false)} aria-label="关闭"><X size={18}/></button><div className="modal-icon"><BadgeCheck size={25}/></div><h2>Finance Penguin 会员方案</h2><p>当前为本地演示账户（{plan.name}）。免费版即可体验完整分析；升级专业版解锁不限次数的高级功能（演示环境不真实扣费）。</p><div className="pricing-grid"><div className={`pricing-card ${plan.tier === 'free' ? 'current' : ''}`}><h3>免费版</h3><div className="price">¥0<small>/月</small></div><ul><li>基础行情分析：不限次数</li><li>组合体检 + 复盘：共 {FREE_PREMIUM_QUOTA} 次</li><li>单日超 {FREE_DEGRADE_AFTER} 次请求自动降智</li></ul>{plan.tier === 'free' ? <button className="btn secondary" disabled>当前方案</button> : <button className="btn secondary" onClick={() => { setPricingOpen(false); setToast('已切回免费版') }}>切回免费版</button>}</div><div className={`pricing-card pro ${plan.tier === 'pro' ? 'current' : ''}`}><h3>专业版</h3><div className="price">¥29<small>/月</small></div><ul><li>基础行情分析：不限次数</li><li>组合体检 + 复盘：不限次数</li><li>不降智，优先使用深度分析模型</li></ul>{plan.tier === 'pro' ? <button className="btn primary" disabled>已开通</button> : <button className="btn primary" onClick={handleUpgrade}>立即开通（演示）</button>}</div></div><div className="legal-note">演示环境不会真实扣费；正式版本将接入微信/支付宝订阅，并同步真实账号体系。</div></div></div>}
    {renameTarget && <div className="modal-layer"><div className="modal"><button className="icon-btn close" onClick={() => setRenameTarget(null)} aria-label="关闭"><X size={18}/></button><div className="modal-icon"><Pencil size={25}/></div><h2>重命名复盘</h2><p>修改后的名称会显示在历史复盘列表中。</p><label htmlFor="rename-title">复盘名称</label><input id="rename-title" className="rename-input" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} maxLength={40} placeholder="输入新的复盘名称"/><div className="modal-actions"><button className="btn ghost" onClick={() => setRenameTarget(null)}>取消</button><button className="btn primary" disabled={!renameDraft.trim()} onClick={saveRename}>保存</button></div></div></div>}
    {toast && <div className="toast" role="status" aria-live="assertive"><CheckCircle2 size={20}/><div><strong>{toast}</strong><span>本次观点、验证标的、综合判断和观察计划已保存</span><button onClick={showArchives}>前往留档查看</button></div><button className="toast-close" onClick={() => setToast('')} aria-label="关闭提示"><X size={15}/></button></div>}
  </div>
}
