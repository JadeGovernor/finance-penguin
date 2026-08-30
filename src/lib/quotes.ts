// 免费实时行情：东财 push2 接口直连（浏览器 CORS 放行），失败回退腾讯行情。
export type Quote = {
  code: string        // 600519.SH
  name: string
  price: number       // 最新价（元）
  changePct: number   // 涨跌幅 %
  updatedAt: number   // 抓取时间戳
}

export function normalizeCode(code: string): string {
  const m = code.toUpperCase().match(/^(\d{6})\.(SH|SZ|BJ)$/)
  if (m) return `${m[2].toLowerCase()}${m[1]}`
  const m2 = code.toUpperCase().match(/^(\d{6})$/)
  if (m2) return `${code.startsWith('6') ? 'sh' : 'sz'}${m2[1]}`
  return code.toLowerCase()
}

export function toEastmoneySecid(code: string): string {
  const m = code.toUpperCase().match(/^(\d{6})\.(SH|SZ|BJ)$/)
  if (!m) return ''
  return `${m[2] === 'SH' ? 1 : 0}.${m[1]}`
}

export async function fetchQuotes(codes: string[]): Promise<Record<string, Quote>> {
  const list = codes.filter(Boolean)
  const secids = list.map(toEastmoneySecid).filter(Boolean)
  const now = Date.now()
  if (secids.length) {
    try {
      const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${secids.join(',')}&fields=f2,f3,f4,f12,f13,f14&fltt=2`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        const diff: Array<{ f2?: number; f3?: number; f12?: string; f13?: number; f14?: string }> = json?.data?.diff ?? []
        const result: Record<string, Quote> = {}
        for (const item of diff) {
          if (!item.f12) continue
          const market = item.f13 === 1 ? 'SH' : item.f13 === 0 ? 'SZ' : 'BJ'
          const code = `${item.f12}.${market}`
          if (!list.includes(code)) continue
          result[code] = { code, name: item.f14 || code, price: Number(item.f2) || 0, changePct: Number(item.f3) || 0, updatedAt: now }
        }
        if (Object.keys(result).length) return result
      }
    } catch { /* 回退腾讯 */ }
  }
  return fetchQuotesTencent(list.map(normalizeCode))
}

async function fetchQuotesTencent(normalized: string[]): Promise<Record<string, Quote>> {
  const result: Record<string, Quote> = {}
  if (!normalized.length) return result
  const res = await fetch(`https://qt.gtimg.cn/q=${normalized.join(',')}`)
  const text = await res.text()
  const now = Date.now()
  for (const line of text.split(';')) {
    const m = line.match(/v_(\w+?)="([^"]*)"/)
    if (!m) continue
    const parts = m[2].split('~')
    const price = Number(parts[3])
    const prev = Number(parts[4])
    if (!price) continue
    const market = m[1].startsWith('sh') ? 'SH' : 'SZ'
    const code = `${m[1].slice(2)}.${market}`
    result[code] = { code, name: code, price, changePct: prev ? ((price - prev) / prev) * 100 : 0, updatedAt: now }
  }
  return result
}
