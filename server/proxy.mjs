// Finance Penguin 服务端：静态托管 dist/ + DeepSeek AI 代理。
// 运行：npm run build && npm run demo   →   http://127.0.0.1:8787
// key 解析顺序：环境变量 DEEPSEEK_API_KEY > 项目 .env.local > OpenClaw 本地存储（自动）。
import http from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'

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

function buildUserPrompt({ input, mode, tradingSystem, quotes, degraded, targetStock }) {
  const lines = [
    `用户输入（${mode === 'stock' ? '指定个股' : '市场观点'}）：${input}`,
  ]
  if (tradingSystem) lines.push(`用户保存的交易系统原文：${tradingSystem}`)
  if (targetStock?.code) lines.push(`指定个股（已解析，其行情已含于下方快照）：${targetStock.name}（${targetStock.code}）`)
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
  const { input, mode, tradingSystem, quotes, degraded, targetStock } = body || {}
  if (!input || typeof input !== 'string' || input.trim().length < 4) return json(res, 400, { error: '缺少输入内容' })

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt({ input, mode, tradingSystem, quotes, degraded, targetStock }) },
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

async function resolveWithDeepSeek(key, text) {
  const messages = [
    { role: 'system', content: '你是 A 股股票识别器。把用户输入解析为一只 A 股股票，可纠正明显错别字（例如「绿地谐波」→「绿的谐波」）。只输出紧凑 JSON：{"code":"688017.SH","name":"绿的谐波"}；无法确定时输出 {"code":"","name":""}。' },
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
    if (parsed && /^\d{6}\.(SH|SZ|BJ)$/.test(String(parsed.code || ''))) {
      return { code: String(parsed.code), name: String(parsed.name || text.trim()), market: String(parsed.code).slice(-2) }
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

  // AI 判断优先：能纠正错别字、识别模糊名称（如「绿地谐波」→「绿的谐波 688017.SH」）
  const key = resolveDeepSeekKey()
  if (key) {
    try {
      const ds = await resolveWithDeepSeek(key, input)
      if (ds) return json(res, 200, { ...ds, source: 'deepseek' })
    } catch { /* 继续机器兜底 */ }
  }

  // 机器识别兜底：AI 不可用或失败时，用东财 suggest 处理标准名称/拼音/代码
  try {
    const em = await resolveFromEastmoney(input)
    if (em) return json(res, 200, { ...em, source: 'eastmoney' })
  } catch { /* 落入未识别 */ }

  return json(res, 404, { error: `未能识别「${input.trim()}」对应的股票。请直接输入 6 位代码（如 688017）重试，或换个更常见的名称。` })
}

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
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
  res.end(readFileSync(filePath))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (url.pathname === '/api/health') {
    return json(res, 200, { ok: true, model: MODEL, keyConfigured: Boolean(resolveDeepSeekKey()), dist: existsSync(join(DIST, 'index.html')) })
  }
  if (url.pathname === '/api/analyze' && req.method === 'POST') return handleAnalyze(req, res)
  if (url.pathname === '/api/resolve' && req.method === 'POST') return handleResolve(req, res)
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
