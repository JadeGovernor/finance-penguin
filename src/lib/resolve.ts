export type ResolvedStock = {
  code: string
  name: string
  market?: string
  source: 'direct' | 'eastmoney' | 'deepseek'
}

export async function resolveStock(text: string): Promise<ResolvedStock | null> {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
  let res: Response
  try {
    res = await fetch(`${base}/api/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch {
    throw new Error('股票识别超时或服务未连接，请重试或直接输入 6 位代码。')
  }
  if (res.status === 404) return null
  const data: { error?: string } = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'AI 服务暂不可用，请稍后重试。')
  return data as ResolvedStock
}
