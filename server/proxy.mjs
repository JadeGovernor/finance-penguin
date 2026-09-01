// Finance Penguin 服务端：静态托管 dist/ + DeepSeek AI 代理。
// 运行：npm run build && npm run demo   →   http://127.0.0.1:8787
// key 解析顺序：环境变量 DEEPSEEK_API_KEY > 项目 .env.local > OpenClaw 本地存储（自动）。
import http from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '127.0.0.1'
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash'

function resolveDeepSeekKey() {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim()
  const envLocal = join(ROOT, '.env.local')
  if (existsSync(envLocal)) {
    const text = readFileSync(envLocal, 'utf8')
    const m = text.match(/^\s*DEEPSEEK_API_KEY\s*=\s*(.+)\s*$/m)
    if (m && m[1]) return m[1].trim().replace(/^['"]|['"]$/g, '')
  }
  try {
    const db = join(homedir(), '.openclaw/agents/main/agent/openclaw-agent.sqlite')
    if (!existsSync(db)) return ''
    const r = spawnSync('sqlite3', [db, "select store_json from auth_profile_store where store_key='primary';"], { encoding: 'utf8' })
    if (r.status === 0 && r.stdout) {
      const json = JSON.parse(r.stdout)
      return json?.profiles?.['deepseek:default']?.key || ''
    }
  } catch { /* ignore */ }
  return ''
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
}

function json(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(payload))
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => { size += c.length; if (size > 300 * 1024) { reject(new Error('body too large')); req.destroy() } chunks.push(c) })
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}) } catch { reject(new Error('invalid json')) } })
    req.on('error', reject)
  })
}

const SYSTEM_PROMPT = `你是「Finance Penguin」A 股投研假设验证台的多方分析引擎。你会收到用户的一条投资观点或个股问题，以及可用的实时行情快照。请完成一次结构化分析，并且只输出 JSON（不要输出任何额外文字或 Markdown 代码块）。

必须遵守的产品规则：
1. 不荐股、不下买卖指令、不承诺收益；所有结论表示"值得跟踪的程度"，评分不是上涨概率。
2. 明确数据边界：行情为真实实时快照（附抓取时间）；财报/消息类信息只使用公开常识，缺少数据时如实说明，不得编造具体数字、订单或公告。
3. 验证标的：候选只能从"实时行情快照"给出的股票中挑选 2~3 只；指定个股模式必须包含用户指定的目标股票（其真实行情已在快照中），再加 1~2 只对照；若快照中没有目标股票则输出空 candidates。禁止虚构快照中不存在的股票、代码或价格；price 与 change 必须使用行情快照真实数值。
4. 多方委员会：乐观研究员、悲观研究员、风控委员、裁决官四个视角；若用户提供交易系统，额外加入"我的系统"视角（key 为 system）。每个视角包含 summary、conclusion、analysis(3 条)、basis、evidence、gap。
5. 五维评分：逻辑强度、证据完整度、兑现程度、市场拥挤度、风险可控度（0-100，help 一句话）。
6. 一周观察计划：entryPrice 触发观察价、stopPrice 失效复核价、takeRange 兑现区间字符串、initialPosition 首次仓位（默认 5%）、maxPosition（默认 10%）；focus/satisfy/reduce/cancel/pending 各 2~3 条。价格必须基于行情快照真实价格推算；marketNote 写"基于 YYYY-MM-DD HH:MM 实时行情，非投资建议"。
7. 用户交易系统按原文逐条核对；条件不足时结论写"依据不足"，禁止代用户补写规则。
8. 全部输出中文；url 可省略为空字符串。
9. 输出紧凑 JSON：不要换行缩进、不要注释、不要尾逗号，必须能被 JSON.parse 直接解析。

输出 JSON 结构：
{"interpretation":{"subject":"","direction":"","horizon":"","catalyst":"","unknown":""},"strategy":"","candidates":[{"code":"600519.SH","name":"","role":"","tags":[],"reason":"","difference":"","doubt":"","price":0,"change":0,"score":0}],"members":[{"key":"bull","label":"乐观研究员","tone":"positive","score":0,"summary":"","conclusion":"","analysis":[],"basis":[],"evidence":[{"id":"E-01","name":"","date":"","url":""}],"gap":""},{"key":"bear","label":"悲观研究员","tone":"negative","score":0,"summary":"","conclusion":"","analysis":[],"basis":[],"evidence":[],"gap":""},{"key":"risk","label":"风控委员","tone":"warning","score":0,"summary":"","conclusion":"","analysis":[],"basis":[],"evidence":[],"gap":""},{"key":"judge","label":"裁决官","tone":"accent","score":0,"summary":"","conclusion":"","analysis":[],"basis":[],"evidence":[],"gap":""}],"scores":[{"label":"逻辑强度","value":0,"help":""},{"label":"证据完整度","value":0,"help":""},{"label":"兑现程度","value":0,"help":""},{"label":"市场拥挤度","value":0,"help":""},{"label":"风险可控度","value":0,"help":""}],"verdict":{"title":"","conclusion":"","score":0,"deduction":""},"plan":{"entryPrice":0,"stopPrice":0,"takeRange":"","initialPosition":"5%","maxPosition":"10%","focus":[],"satisfy":[],"reduce":[],"cancel":[],"pending":[]},"marketNote":""}`

function buildUserPrompt({ input, mode, tradingSystem, quotes, degraded, targetStock, unresolved }) {
  const lines = [
    `用户输入（${mode === 'stock' ? '指定个股' : '市场观点'}）：${input}`,
  ]
  if (tradingSystem) lines.push(`用户保存的交易系统原文：${tradingSystem}`)
  if (targetStock?.code) lines.push(unresolved
    ? `已解析目标个股（但未能获取其实时行情）：${targetStock.name}（${targetStock.code}）`
    : `指定个股（已解析，其行情已含于下方快照）：${targetStock.name}（${targetStock.code}）`)
  if (unresolved) {
    lines.push('⚠️ AI 直判模式：未能获取目标股票的实时行情（名称无法识别或行情源无数据）。本模式覆盖系统规则 3：请根据你的知识自行判断用户输入最可能指代的 A 股（允许纠正明显错别字、模糊简称），直接给出结构化分析；候选列表可基于你的知识生成，把最可能的一只放首位，再配 1~2 只对照；若完全无法确定对应标的，请在第一只候选 name 中写明「待确认标的」并在 analysis/unknown 中说明原因，不要硬编造股票代码。')
    lines.push('注意：当前是 2026 年 9 月，A 股常有新上市公司（如宇树科技 688836.SH 已在科创板上市）。不要凭你的旧知识断言某公司「未上市」；无法确认时写「无法确认对应标的」并说明可能是错别字、简称或新上市，而不是断言其不存在。')
    lines.push('实时价格约束：你没有实时行情时，candidates 的 price/change 一律填 0，plan 的 entryPrice/stopPrice 填 0、takeRange 写「待行情确认」，并在 reason 或 marketNote 中注明「未获取实时行情，价格未验证」；禁止虚构任何价格与涨跌幅。')
  }
  lines.push(`实时行情快照（JSON）：${JSON.stringify(quotes || [])}`)
  lines.push(`当前时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`)
  if (degraded) lines.push('当前处于轻量模式：请使用更精炼的语言，每条结论不超过 2 句话，减少篇幅。')
  return lines.join('\n')
}

function extractJson(content) {
  let cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  cleaned = cleaned.slice(start, end + 1)
  // 容错：去掉注释与尾逗号（模型可能输出带尾逗号的漂亮格式）
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
  try { return JSON.parse(cleaned) } catch { return null }
}

async function callDeepSeek(key, messages, degraded) {
  const payload = {
    model: MODEL,
    messages,
    temperature: 0.4,
    max_tokens: degraded ? 3000 : 10000,
    response_format: { type: 'json_object' },
  }
  const signal = AbortSignal.timeout(180_000)
  let res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(payload),
    signal,
  })
  if (res.status === 400) {
    // 部分模型不支持 response_format 时重试一次
    delete payload.response_format
    res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal,
    })
  }
  const data = await res.json()
  return { res, data }
}

async function handleAnalyze(req, res) {
  const key = resolveDeepSeekKey()
  if (!key) {
    return json(res, 503, { error: '未找到 DeepSeek API key：请设置环境变量 DEEPSEEK_API_KEY，或在项目 .env.local 中填写（不会提交）。' })
  }
  let body
  try { body = await readJson(req) } catch { return json(res, 400, { error: '请求体不是合法 JSON' }) }
  const { input, mode, tradingSystem, quotes, degraded, targetStock, unresolved } = body || {}
  if (!input || typeof input !== 'string' || input.trim().length < 2) return json(res, 400, { error: '缺少输入内容' })

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt({ input, mode, tradingSystem, quotes, degraded, targetStock, unresolved }) },
  ]
  try {
    const { res: upstream, data } = await callDeepSeek(key, messages, Boolean(degraded))
    if (!upstream.ok) {
      console.error(`[analyze] DeepSeek ${upstream.status}:`, data?.error?.message || '')
      return json(res, 502, { error: `DeepSeek 接口错误（${upstream.status}）：${data?.error?.message || '未知错误，请重试'}` })
    }
    const content = data?.choices?.[0]?.message?.content || ''
    let parsed = extractJson(content)
    if (!parsed) {
      // DeepSeek 偶发输出格式异常：同参数自动重试一次
      const retry = await callDeepSeek(key, messages, Boolean(degraded))
      if (retry.res.ok) {
        const retryContent = retry.data?.choices?.[0]?.message?.content || ''
        parsed = extractJson(retryContent)
        if (parsed) {
          console.log(`[analyze] ok (retry) · model=${retry.data?.model || MODEL} · degraded=${Boolean(degraded)} · tokens=${retry.data?.usage?.total_tokens ?? '?'}`)
          return json(res, 200, { result: parsed, model: retry.data?.model || MODEL })
        }
      }
      return json(res, 502, { error: 'AI 返回内容无法解析为 JSON，请重试。', raw: content.slice(0, 2000) })
    }
    console.log(`[analyze] ok · model=${data?.model || MODEL} · degraded=${Boolean(degraded)} · tokens=${data?.usage?.total_tokens ?? '?'}`)
    return json(res, 200, { result: parsed, model: data?.model || MODEL })
  } catch (err) {
    console.error('[analyze] upstream error:', err.message)
    return json(res, 502, { error: `AI 服务调用失败：${err.message}` })
  }
}

function normalizeSix(code) {
  if (/^[68]/.test(code)) return `${code}.SH`
  if (/^[49]/.test(code)) return `${code}.BJ`
  return `${code}.SZ`
}

function parseDirectCode(text) {
  const clean = text.trim().toUpperCase()
  const m = clean.match(/^(\d{6})(?:\.(SH|SZ|BJ))?$/)
  if (!m) return null
  return { code: m[2] ? `${m[1]}.${m[2]}` : normalizeSix(m[1]), name: text.trim() }
}

async function resolveFromEastmoney(text) {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(text.trim())}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=8`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' } })
  if (!res.ok) return null
  const json = await res.json()
  const list = json?.QuotationCodeTable?.Data ?? []
  for (const item of list) {
    const m = String(item.QuoteID || '').match(/^(\d)\.(\d{6})$/)
    if (!m) continue
    const market = m[1] === '1' ? 'SH' : m[1] === '0' ? 'SZ' : 'BJ'
    return { code: `${m[2]}.${market}`, name: item.Name || text.trim(), market }
  }
  return null
}

function stockNameMatch(a, b) {
  const norm = (s) => String(s || '').replace(/\s+/g, '').replace(/-[A-Za-z0-9]+$/g, '').toLowerCase()
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}

async function verifyQuoteName(code, expectedName) {
  try {
    const m = String(code || '').toUpperCase().match(/^(\d{6})\.(SH|SZ|BJ)$/)
    if (!m) return null
    const secid = `${m[2] === 'SH' ? 1 : 0}.${m[1]}`
    const res = await fetch(`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secid}&fields=f12,f14&fltt=2`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const item = data?.data?.diff?.[0]
    if (!item?.f14) return null
    return stockNameMatch(item.f14, expectedName)
  } catch {
    return null
  }
}

async function resolveWithDeepSeek(key, text) {
  const messages = [
    { role: 'system', content: '你是 A 股股票识别器。把用户输入解析为一只 A 股股票，可纠正明显错别字、谐音与模糊简称（例如「绿地谐波」→「绿的谐波」，「语数科技」→「宇树科技」）。注意：当前是 2026 年 9 月，A 股常有新上市公司（如宇树科技已在科创板上市，代码 688836.SH），不要凭旧知识断定某公司未上市。只输出紧凑 JSON：{"name":"","code":""}。name 填你判断的最可能股票名称（可留空）；code 填 6 位代码+市场后缀（如 688836.SH），只有当你相当确定时才填，不确定就留空字符串，不要编造。' },
    { role: 'user', content: `用户输入：${text}` },
  ]
  for (let attempt = 0; attempt < 2; attempt++) {
    const payload = { model: MODEL, messages, temperature: 0, max_tokens: 300, response_format: { type: 'json_object' } }
    const signal = AbortSignal.timeout(30_000)
    let res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal,
    })
    if (res.status === 400) {
      delete payload.response_format
      res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal,
      })
    }
    if (!res.ok) continue
    const data = await res.json()
    const parsed = extractJson(data?.choices?.[0]?.message?.content || '')
    if (parsed) {
      const code = String(parsed.code || '').trim().toUpperCase()
      return {
        code: /^\d{6}\.(SH|SZ|BJ)$/.test(code) ? code : '',
        name: String(parsed.name || '').trim() || text.trim(),
      }
    }
  }
  return null
}

async function handleResolve(req, res) {
  let body
  try { body = await readJson(req) } catch { return json(res, 400, { error: '请求体不是合法 JSON' }) }
  const { input } = body || {}
  if (!input || typeof input !== 'string' || !input.trim()) return json(res, 400, { error: '缺少输入内容' })

  const direct = parseDirectCode(input)
  if (direct) return json(res, 200, { ...direct, source: 'direct' })

  // AI 判断优先：纠正错别字/谐音/简称（如「语数科技」→「宇树科技」）
  const key = resolveDeepSeekKey()
  let ds = null
  if (key) {
    try { ds = await resolveWithDeepSeek(key, input) } catch { ds = null }
  }

  // 1) 用 AI 纠正后的名称去东财搜索：东财搜索是权威的名称→代码映射，避免 AI 编造代码
  let best = null
  if (ds?.name && ds.name !== input.trim()) {
    try {
      const em = await resolveFromEastmoney(ds.name)
      if (em) best = { ...em, source: 'deepseek' }
    } catch { /* ignore */ }
  }
  // 2) 直接用原始输入搜索（标准名称/拼音/代码）
  if (!best) {
    try {
      const em = await resolveFromEastmoney(input)
      if (em) best = { ...em, source: 'eastmoney' }
    } catch { /* ignore */ }
  }
  // 3) AI 给出代码时，用实时行情接口校验代码与名称是否一致（防止 AI 编造/错配代码）
  if (!best && ds?.code) {
    const match = await verifyQuoteName(ds.code, ds.name || input)
    if (match !== false) best = { code: ds.code, name: ds.name || input.trim(), source: 'deepseek' }
  }

  if (best) return json(res, 200, best)

  return json(res, 404, { error: `未能识别「${input.trim()}」对应的股票。请直接输入 6 位代码（如 688017）重试，或换个更常见的名称。` })
}

const PORTFOLIO_SYSTEM_PROMPT = `你是「Finance Penguin」的 A 股组合体检引擎。你会收到用户当前组合名单（股票代码、名称、模拟仓位权重）、实时行情快照（真实价格与涨跌幅）以及可选的用户交易系统原文。请完成一次组合健康度分析，只输出紧凑 JSON（不要输出任何额外文字或 Markdown 代码块）。

产品规则：
1. 不荐股、不承诺收益、不下买卖指令；所有评分代表「组合结构健康度与值得跟踪的程度」，不是收益预测。
2. 数据边界：行情为真实实时快照（附抓取时间）；财报/消息类信息只使用公开常识，缺少数据时如实说明，不得编造具体数字、公告或订单；价格与涨跌幅必须使用快照真实数值。
3. 主题归组：把名单按真实业务/产业链归入主题（如 AI 算力链、消费白酒、新能源、银行金融），theme 数量不超过 4 个；无法归类的写「其他」。
4. items 基础判断：对每只股票给出 role（组合中的角色）、opportunity（机会）、risk（主要风险），必须结合快照真实行情（涨跌、估值常识）给出，禁止空泛套话。
5. management 组合管理：给出 3~5 条具体建议（主题集中度、仓位上限、高波动标的控制、防御资产、与用户交易系统的冲突检查）。用户提供了交易系统时必须逐条核对并指出冲突；未提供则如实说明。
6. combinations 优化组合建议：只能由当前名单中的股票组成子组合（可调整权重侧重），给出 0~3 个比当前评分更优的组合；找不到更优则为空数组。
7. 权重口径：主题权重、aiWeight（AI 算力链合计权重）、defensiveWeight（防御资产合计权重，如白酒/银行/现金类）按名单模拟仓位权重加总，输出 0-100 数字（可含小数）；maxTheme 为权重最高的主题。
8. score：0-100 整数，综合考虑主题集中度、风险重叠、高波动暴露、防御比例与仓位结构，代表健康度而非收益。
9. 全部输出中文；marketNote 写「基于 YYYY-MM-DD HH:MM 实时行情与 AI 分析，非投资建议」；note 写一段对当前组合结构的总结。

输出 JSON 结构：
{"score":0,"maxTheme":{"theme":"","weight":0,"names":[]},"themes":[{"theme":"","weight":0,"names":[]}],"aiWeight":0,"defensiveWeight":0,"items":[{"code":"","name":"","role":"","opportunity":"","risk":""}],"management":[""],"combinations":[{"names":[],"reason":"","score":0}],"note":"","marketNote":""}`

const REVIEW_SYSTEM_PROMPT = `你是「Finance Penguin」的 A 股交易复盘教练。你会收到：复盘对象（个股或组合）、原观察计划（触发价/失效价/仓位等，若有）、用户记录的实际操作、当时判断、盈亏结果与问题，以及实时行情快照（真实价格）。请完成一次结构化复盘，只输出紧凑 JSON（不要输出任何额外文字或 Markdown 代码块）。

产品规则：
1. 复盘目的是检查「操作是否与计划一致」，不是判断对错；不荐股、不承诺收益、不追责。
2. 数据边界：行情为真实实时快照（附抓取时间）；若快照含复盘标的，用当前真实价格对比原计划触发价/失效价并指出偏离（如「当前 ¥xx 高于原失效价 ¥xx」）；快照缺失时如实说明，不得编造价格。
3. 区分两类因素：不可控（行情、系统性波动、突发公告）与可优化（入场位置、仓位纪律、复核纪律、情绪化处理）；issues 只给可优化项。
4. comparisons 为「计划 vs 实际」对比表，每行 [步骤, 原计划, 实际, 判定]，判定为「可优化」或「不可控」。
5. 若提供交易系统，逐条核对是否违反；未提供则如实说明。
6. 全部输出中文；marketNote 写「基于 YYYY-MM-DD HH:MM 实时行情与 AI 分析，非投资建议」。

输出 JSON 结构：
{"targetName":"","conclusion":"","positives":[""],"issues":[""],"unavoidable":[""],"nextActions":[""],"comparisons":[["步骤","原计划","实际","判定"]],"marketNote":""}`

function buildPortfolioPrompt({ items, quotes, tradingSystem }) {
  return [
    `用户组合名单（JSON）：${JSON.stringify(items || [])}`,
    `实时行情快照（JSON）：${JSON.stringify(quotes || [])}`,
    `用户交易系统：${tradingSystem || '未提供'}`,
    `当前时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
  ].join('\n')
}

function buildReviewPrompt({ mode, targetName, archive, items, quotes, tradingSystem, operation, reason, result, pnl, question, guide }) {
  const plan = archive
    ? { entryPrice: archive.entryPrice, stopPrice: archive.stopPrice, takeRange: archive.takeRange, initialPosition: archive.initialPosition, maxPosition: archive.maxPosition }
    : null
  const lines = [
    `复盘对象：${mode === 'stock' ? `个股「${targetName}」` : `组合（${items?.length || 0} 只）`}`,
    `原观察计划（JSON）：${plan ? JSON.stringify(plan) : '未提供'}`,
    `用户实际操作：${operation || '未填写'}`,
    `当时判断：${reason || '未填写'}`,
    `盈亏结果：${result || ''}${pnl ? `（${pnl}）` : ''}`,
    `用户问题：${question || '未填写'}`,
    `实时行情快照（JSON）：${JSON.stringify(quotes || [])}`,
    `用户交易系统：${tradingSystem || '未提供'}`,
    `当前时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`,
  ]
  if (guide) {
    lines.splice(1, 0, `用户引导确认（用户点选的分类与自定义说明，复盘需围绕这些确认展开）：${guide}`)
  }
  return lines.join('\n')
}

async function callChatJson(key, messages, degraded) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { res, data } = await callDeepSeek(key, messages, degraded)
    if (!res.ok) return { ok: false, status: res.status, error: data?.error?.message || '未知错误' }
    const content = data?.choices?.[0]?.message?.content || ''
    const parsed = extractJson(content)
    if (parsed) return { ok: true, parsed, model: data?.model }
    if (attempt === 0) continue
    return { ok: false, status: 502, error: 'AI 返回内容无法解析为 JSON，请重试。' }
  }
  return { ok: false, status: 502, error: 'AI 返回内容无法解析为 JSON，请重试。' }
}

async function handlePortfolio(req, res) {
  const key = resolveDeepSeekKey()
  if (!key) return json(res, 503, { error: '未找到 DeepSeek API key，请先配置。' })
  let body
  try { body = await readJson(req) } catch { return json(res, 400, { error: '请求体不是合法 JSON' }) }
  const { items, quotes, tradingSystem, degraded } = body || {}
  if (!Array.isArray(items) || items.length < 2) return json(res, 400, { error: '至少需要 2 只股票才能做组合体检。' })
  const messages = [
    { role: 'system', content: PORTFOLIO_SYSTEM_PROMPT },
    { role: 'user', content: buildPortfolioPrompt({ items, quotes, tradingSystem }) },
  ]
  try {
    const result = await callChatJson(key, messages, Boolean(degraded))
    if (!result.ok) return json(res, result.status || 502, { error: result.error })
    console.log(`[portfolio] ok · model=${result.model} · tokens=?`)
    return json(res, 200, { result: result.parsed, model: result.model })
  } catch (err) {
    console.error('[portfolio] error:', err.message)
    return json(res, 502, { error: `AI 组合体检失败：${err.message}` })
  }
}

async function handleReview(req, res) {
  const key = resolveDeepSeekKey()
  if (!key) return json(res, 503, { error: '未找到 DeepSeek API key，请先配置。' })
  let body
  try { body = await readJson(req) } catch { return json(res, 400, { error: '请求体不是合法 JSON' }) }
  const { mode, targetName, archive, items, quotes, tradingSystem, degraded, operation, reason, result, pnl, question, guide } = body || {}
  const messages = [
    { role: 'system', content: REVIEW_SYSTEM_PROMPT },
    { role: 'user', content: buildReviewPrompt({ mode, targetName, archive, items, quotes, tradingSystem, operation, reason, result, pnl, question, guide }) },
  ]
  try {
    const out = await callChatJson(key, messages, Boolean(degraded))
    if (!out.ok) return json(res, out.status || 502, { error: out.error })
    console.log(`[review] ok · model=${out.model}`)
    return json(res, 200, { result: out.parsed, model: out.model })
  } catch (err) {
    console.error('[review] error:', err.message)
    return json(res, 502, { error: `AI 复盘失败：${err.message}` })
  }
}

async function resolveBatchWithDeepSeek(key, inputs) {
  const messages = [
    { role: 'system', content: '你是 A 股股票识别器。用户可能输入股票名称、简称、错别字、谐音或多打少打字。请逐个判断每个输入最可能指代的 A 股股票（可纠正错别字/谐音/模糊简称，如「语数科技」→「宇树科技」，「微机谐波」→「绿的谐波」）。注意：当前是 2026 年 9 月，A 股常有新上市公司（如宇树科技 688836.SH 已在科创板上市），不要凭旧知识断定某公司未上市。只输出紧凑 JSON：{"results":[{"input":"原输入","name":"判断的股票名称","code":"6位代码+市场后缀或空字符串"}]}；name 给出最可能猜测，code 只有相当确定时才填，不确定留空，不要编造代码。' },
    { role: 'user', content: `待识别输入（每行一个）：\n${inputs.join('\n')}` },
  ]
  for (let attempt = 0; attempt < 2; attempt++) {
    const payload = { model: MODEL, messages, temperature: 0.2, max_tokens: 1200, response_format: { type: 'json_object' } }
    const signal = AbortSignal.timeout(45_000)
    let res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal,
    })
    if (res.status === 400) {
      delete payload.response_format
      res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
        signal,
      })
    }
    if (!res.ok) continue
    const data = await res.json()
    const parsed = extractJson(data?.choices?.[0]?.message?.content || '')
    const results = parsed?.results
    if (Array.isArray(results)) return results
  }
  return null
}

async function handleResolveBatch(req, res) {
  let body
  try { body = await readJson(req) } catch { return json(res, 400, { error: '请求体不是合法 JSON' }) }
  const { inputs } = body || {}
  const cleaned = Array.isArray(inputs) ? inputs.map((i) => String(i || '').trim()).filter(Boolean) : []
  if (!cleaned.length) return json(res, 400, { error: '缺少输入内容' })

  const results = []
  const needAi = []
  for (const input of cleaned) {
    const direct = parseDirectCode(input)
    if (direct) {
      results.push({ input, ok: true, code: direct.code, name: direct.name, source: 'direct' })
    } else {
      needAi.push(input)
    }
  }

  if (needAi.length) {
    const key = resolveDeepSeekKey()
    const aiResults = key ? await resolveBatchWithDeepSeek(key, needAi) : null
    for (const input of needAi) {
      const ai = Array.isArray(aiResults) ? aiResults.find((r) => String(r?.input || '').trim() === input) : null
      const aiName = String(ai?.name || '').trim()
      let best = null
      // 用 AI 判断出的名称去东财搜索拿权威代码（名称→代码映射）
      if (aiName && aiName !== input) {
        try {
          const em = await resolveFromEastmoney(aiName)
          if (em) best = { ...em, source: 'deepseek' }
        } catch { /* ignore */ }
      }
      if (!best) {
        try {
          const em = await resolveFromEastmoney(input)
          if (em) best = { ...em, source: 'eastmoney' }
        } catch { /* ignore */ }
      }
      if (!best && ai?.code) {
        const code = String(ai.code).trim().toUpperCase()
        if (/^\d{6}\.(SH|SZ|BJ)$/.test(code)) {
          const match = await verifyQuoteName(code, aiName || input)
          if (match !== false) best = { code, name: aiName || input, source: 'deepseek' }
        }
      }
      results.push(best
        ? { input, ok: true, code: best.code, name: best.name, source: best.source }
        : { input, ok: false })
    }
  }

  return json(res, 200, { results })
}

const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt'])
const staticCache = new Map()

function serveStatic(req, res) {
  // 站点 base 为 /finance-penguin/：按该前缀提供静态资源
  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  let clean = urlPath
  if (clean === '/finance-penguin' || clean === '/finance-penguin/') clean = '/'
  else if (clean.startsWith('/finance-penguin/')) clean = clean.slice('/finance-penguin'.length)
  let filePath = normalize(join(DIST, clean === '/' ? 'index.html' : clean))
  if (!filePath.startsWith(DIST)) filePath = join(DIST, 'index.html')
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(DIST, 'index.html')
  const ext = extname(filePath).toLowerCase()
  // 内存缓存 + gzip：哈希资源可长期缓存，重复访问几乎零网络传输
  const mtime = statSync(filePath).mtimeMs
  let entry = staticCache.get(filePath)
  if (!entry || entry.mtime !== mtime) {
    const body = readFileSync(filePath)
    const gz = COMPRESSIBLE.has(ext) ? gzipSync(body, { level: 6 }) : null
    entry = { mtime, body, gz }
    if (staticCache.size > 100) staticCache.clear()
    staticCache.set(filePath, entry)
  }
  const acceptGzip = String(req.headers['accept-encoding'] || '').includes('gzip')
  const useGz = Boolean(entry.gz) && acceptGzip && entry.gz.length < entry.body.length
  const cacheControl = clean.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cacheControl,
    'Content-Length': useGz ? entry.gz.length : entry.body.length,
  }
  if (useGz) headers['Content-Encoding'] = 'gzip'
  res.writeHead(200, headers)
  res.end(useGz ? entry.gz : entry.body)
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, model: MODEL, keyConfigured: Boolean(resolveDeepSeekKey()), dist: existsSync(join(DIST, 'index.html')) })
  }
  if (url.pathname === '/api/analyze' && req.method === 'POST') return handleAnalyze(req, res)
  if (url.pathname === '/api/resolve' && req.method === 'POST') return handleResolve(req, res)
  if (url.pathname === '/api/resolve-batch' && req.method === 'POST') return handleResolveBatch(req, res)
  if (url.pathname === '/api/portfolio' && req.method === 'POST') return handlePortfolio(req, res)
  if (url.pathname === '/api/review' && req.method === 'POST') return handleReview(req, res)
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' })
  if (url.pathname === '/' || url.pathname === '') {
    res.writeHead(302, { Location: '/finance-penguin/' })
    return res.end()
  }
  return serveStatic(req, res)
})

server.listen(PORT, HOST, () => {
  const keyOk = Boolean(resolveDeepSeekKey())
  console.log('')
  console.log(`  Finance Penguin 服务已启动（监听 ${HOST}:${PORT}）`)
  console.log(`  → http://${HOST}:${PORT}`)
  console.log(`  AI 模型：${MODEL} · DeepSeek key：${keyOk ? '已配置（未显示）' : '未配置'}`)
  console.log(`  dist 静态资源：${existsSync(join(DIST, 'index.html')) ? '就绪' : '缺失（请先运行 npm run build）'}`)
  console.log('')
})
