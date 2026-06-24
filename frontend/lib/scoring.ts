import { ScoredProduct, Weights, Thresholds, RECOMMENDATION_LABELS } from "./types";

const SUB_SCORE_FIELDS: Record<keyof Weights, keyof ScoredProduct> = {
  growth: "growth_score",
  market_size: "market_size_score",
  competition: "competition_score",
  profit_margin: "margin_score",
};

function classify(score: number, thresholds: Thresholds): string {
  if (score >= thresholds.strong_opportunity) return RECOMMENDATION_LABELS.strong;
  if (score >= thresholds.recommended) return RECOMMENDATION_LABELS.recommended;
  if (score >= thresholds.observe) return RECOMMENDATION_LABELS.observe;
  return RECOMMENDATION_LABELS.avoid;
}

/**
 * 与后端 app/services/recommendation.py 的 apply_recommendations 逻辑保持一致：
 * 按权重加权四个子分，缺失的子分按比例从剩余权重里重新分配，不再额外打API。
 */
export function recomputeRecommendations(
  products: ScoredProduct[],
  weights: Weights,
  thresholds: Thresholds
): ScoredProduct[] {
  return products.map((p) => {
    let weightedSum = 0;
    let weightUsed = 0;
    (Object.keys(SUB_SCORE_FIELDS) as (keyof Weights)[]).forEach((key) => {
      const field = SUB_SCORE_FIELDS[key];
      const score = p[field] as number | null;
      const w = weights[key];
      if (score !== null && w > 0) {
        weightedSum += score * w;
        weightUsed += w;
      }
    });

    if (weightUsed === 0) {
      return { ...p, total_score: null, recommendation: null };
    }

    const total = weightedSum / weightUsed;
    return {
      ...p,
      total_score: Math.round(total * 10000) / 10000,
      recommendation: classify(total, thresholds),
    };
  });
}
