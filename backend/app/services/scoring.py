"""模块2：四要素评分引擎。

四个子分都归一化到 0-1（数据集内百分位排名），分数越高代表越有利。
- growth_score：增速百分位
- market_size_score：月销售额百分位
- competition_score：1 - HHI百分位（HHI越低/越分散，分越高）
- margin_score：利润率百分位

HHI 按 (country, category) 分组计算品牌收入份额平方和，
组内品牌数低于 MIN_GROUP_SIZE_FOR_HHI 时标记 hhi_reliable=False。
"""
from typing import List
import math
import pandas as pd


def _clean(v):
    """把 pandas/numpy 的 NaN、NA 统一转成 None，避免JSON序列化和pydantic校验出问题。"""
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v


def compute_scores(products: List[dict], min_group_size: int = 3) -> List[dict]:
    if not products:
        return []

    df = pd.DataFrame(products)
    df["hhi"] = None
    df["hhi_group_size"] = 0
    df["hhi_reliable"] = True

    for (_country, _category), group in df.groupby(["country", "category"]):
        brand_rev = group.groupby("brand")["monthly_revenue"].sum()
        total_rev = brand_rev.sum()
        hhi_val = float((brand_rev / total_rev).pow(2).sum()) if total_rev > 0 else None
        n_brands = int(brand_rev.shape[0])
        idx = group.index
        df.loc[idx, "hhi"] = hhi_val
        df.loc[idx, "hhi_group_size"] = n_brands
        df.loc[idx, "hhi_reliable"] = n_brands >= min_group_size

    df["growth_score"] = df["growth_rate"].rank(pct=True, na_option="keep")
    df["market_size_score"] = df["monthly_revenue"].rank(pct=True, na_option="keep")
    df["margin_score"] = df["profit_margin"].rank(pct=True, na_option="keep")

    hhi_numeric = pd.to_numeric(df["hhi"], errors="coerce")
    df["competition_score"] = 1 - hhi_numeric.rank(pct=True, na_option="keep")

    records = df.to_dict(orient="records")
    for r in records:
        for k, v in list(r.items()):
            r[k] = _clean(v)
        if r.get("hhi_group_size") is None:
            r["hhi_group_size"] = 0
        if r.get("hhi_reliable") is None:
            r["hhi_reliable"] = False
    return records
