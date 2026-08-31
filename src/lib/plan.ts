// 会员方案与付费分层：免费版 / 专业版（29 元/月）。
import { storageGet, storageSet } from './storage'

const STORAGE_KEY = 'fp-user'

export type PlanState = {
  name: string
  tier: 'free' | 'pro'
  createdAt: string
  premiumUsed: number      // 免费版：组合体检 + 复盘 共用次数
  analysisDate: string     // YYYY-MM-DD
  analysisCount: number    // 当日分析请求数
}

export const FREE_PREMIUM_QUOTA = 10
export const FREE_DEGRADE_AFTER = 100

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultPlan(): PlanState {
  return { name: '本地用户', tier: 'free', createdAt: new Date().toISOString(), premiumUsed: 0, analysisDate: today(), analysisCount: 0 }
}

function save(plan: PlanState) {
  storageSet(STORAGE_KEY, JSON.stringify(plan))
}

export function getPlan(): PlanState {
  try {
    const raw = storageGet(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PlanState>
      return { ...defaultPlan(), ...parsed }
    }
  } catch { /* ignore */ }
  const plan = defaultPlan()
  save(plan)
  return plan
}

/** 免费版组合体检与复盘共用 10 次；专业版不限。返回是否放行及剩余次数。 */
export function tryUsePremium(plan: PlanState): { ok: boolean; plan: PlanState; remaining: number } {
  if (plan.tier === 'pro') return { ok: true, plan, remaining: -1 }
  const remaining = FREE_PREMIUM_QUOTA - plan.premiumUsed
  if (remaining <= 0) return { ok: false, plan, remaining: 0 }
  const next = { ...plan, premiumUsed: plan.premiumUsed + 1 }
  save(next)
  return { ok: true, plan: next, remaining: remaining - 1 }
}

/** 记录一次分析请求，并判断本次是否以轻量模式运行。 */
export function trackAnalysis(plan: PlanState): { plan: PlanState; count: number; degraded: boolean } {
  const date = today()
  const base = plan.analysisDate === date ? plan : { ...plan, analysisDate: date, analysisCount: 0 }
  const count = base.analysisCount + 1
  const next = { ...base, analysisCount: count }
  save(next)
  return { plan: next, count, degraded: next.tier === 'free' && count > FREE_DEGRADE_AFTER }
}

export function upgradePlan(): PlanState {
  const plan = { ...getPlan(), tier: 'pro' as const }
  save(plan)
  return plan
}

export function premiumRemaining(plan: PlanState): number {
  return plan.tier === 'pro' ? -1 : Math.max(0, FREE_PREMIUM_QUOTA - plan.premiumUsed)
}
