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
    })
  } catch {
    throw new Error('AI 服务未连接。请在本机运行 `npm run demo:build` 后，通过 http://127.0.0.1:8787 访问本页。')
  }
  if (res.status === 404) return null
  const data: { error?: string } = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'AI 服务未连接：请在本地运行 `npm run demo:build` 后通过 http://127.0.0.1:8787 使用完整 AI 功能。')
  return data as ResolvedStock
}
