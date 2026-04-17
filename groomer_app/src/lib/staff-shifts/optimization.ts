export type ShiftGenerateStrategy = 'rule_based' | 'optimized'

export type OptimizationWeights = {
  fairness_weight: number
  preferred_shift_weight: number
  reservation_coverage_weight: number
  workload_health_weight: number
}

export const DEFAULT_OPTIMIZATION_WEIGHTS: OptimizationWeights = {
  fairness_weight: 0.35,
  preferred_shift_weight: 0.25,
  reservation_coverage_weight: 0.3,
  workload_health_weight: 0.1,
}

export function parseStrategy(value: string | null | undefined): ShiftGenerateStrategy {
  return value === 'optimized' ? 'optimized' : 'rule_based'
}

export function normalizeWeight(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(1, parsed))
}

export function normalizeWeights(input: Partial<OptimizationWeights> | null | undefined): OptimizationWeights {
  return {
    fairness_weight: normalizeWeight(input?.fairness_weight, DEFAULT_OPTIMIZATION_WEIGHTS.fairness_weight),
    preferred_shift_weight: normalizeWeight(input?.preferred_shift_weight, DEFAULT_OPTIMIZATION_WEIGHTS.preferred_shift_weight),
    reservation_coverage_weight: normalizeWeight(
      input?.reservation_coverage_weight,
      DEFAULT_OPTIMIZATION_WEIGHTS.reservation_coverage_weight
    ),
    workload_health_weight: normalizeWeight(input?.workload_health_weight, DEFAULT_OPTIMIZATION_WEIGHTS.workload_health_weight),
  }
}

export function sumWeights(weights: OptimizationWeights) {
  return (
    weights.fairness_weight +
    weights.preferred_shift_weight +
    weights.reservation_coverage_weight +
    weights.workload_health_weight
  )
}

export function hasValidWeightSum(weights: OptimizationWeights, tolerance = 0.0001) {
  return Math.abs(sumWeights(weights) - 1) <= tolerance
}

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export type ScoreBreakdown = {
  fairness: number
  preferred_shift: number
  reservation_coverage: number
  workload_health: number
}

export function computeOptimizationScores(params: {
  created: number
  updated: number
  deleted: number
  skippedManual: number
  policyViolations: number
  alerts: number
  weights: OptimizationWeights
}) {
  const touched = params.created + params.updated
  const fairnessBase = touched <= 0 ? 45 : 60 + Math.min(30, touched * 2) - Math.min(35, params.policyViolations * 8)
  const preferredBase = touched <= 0 ? 40 : 58 + Math.min(28, params.updated * 3) - Math.min(25, params.skippedManual * 3)
  const reservationBase = touched <= 0 ? 45 : 62 + Math.min(25, params.created * 2) - Math.min(30, params.alerts * 4)
  const workloadBase = touched <= 0 ? 42 : 55 + Math.min(24, touched * 1.5) - Math.min(30, params.deleted * 3)

  const breakdown: ScoreBreakdown = {
    fairness: round2(clampScore(fairnessBase)),
    preferred_shift: round2(clampScore(preferredBase)),
    reservation_coverage: round2(clampScore(reservationBase)),
    workload_health: round2(clampScore(workloadBase)),
  }

  const total =
    breakdown.fairness * params.weights.fairness_weight +
    breakdown.preferred_shift * params.weights.preferred_shift_weight +
    breakdown.reservation_coverage * params.weights.reservation_coverage_weight +
    breakdown.workload_health * params.weights.workload_health_weight

  return {
    total_score: round2(clampScore(total)),
    score_breakdown: breakdown,
  }
}
