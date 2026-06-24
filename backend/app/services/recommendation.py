"""模块3：推荐引擎。

把模块2算出的四个子分按权重加权求和成总分，再按阈值切档。
权重不要求预先归一化（内部会按比例处理）；
某产品若缺失某个子分（比如没填growth_rate），会自动按剩余可用维度重新分配权重，
不会因为一项缺失就把总分拖到很低。
"""
from typing import List
from app.models.schemas import Weights, Thresholds

LABELS = {
    "strong_opportunity": "🔥 Strong Opportunity",
    "recommended": "✅ Recommended",
    "observe": "⚠ Observe",
    "avoid": "❌ Avoid",
}

# 权重字段名 -> 模块2算出的子分字段名
SUB_SCORE_FIELDS = {
    "growth": "growth_score",
    "market_size": "market_size_score",
    "competition": "competition_score",
    "profit_margin": "margin_score",
}


def _classify(score: float, thresholds: Thresholds) -> str:
    if score >= thresholds.strong_opportunity:
        return LABELS["strong_opportunity"]
    if score >= thresholds.recommended:
        return LABELS["recommended"]
    if score >= thresholds.observe:
        return LABELS["observe"]
    return LABELS["avoid"]


def apply_recommendations(
    products: List[dict], weights: Weights, thresholds: Thresholds
) -> List[dict]:
    weight_map = weights.model_dump()

    for p in products:
        weighted_sum = 0.0
        weight_used = 0.0
        for key, field in SUB_SCORE_FIELDS.items():
            score = p.get(field)
            w = weight_map[key]
            if score is not None and w > 0:
                weighted_sum += score * w
                weight_used += w

        if weight_used == 0:
            p["total_score"] = None
            p["recommendation"] = None
            continue

        total = weighted_sum / weight_used
        p["total_score"] = round(total, 4)
        p["recommendation"] = _classify(total, thresholds)

    return products
