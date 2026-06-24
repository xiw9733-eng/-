import json
from collections import Counter
from typing import List, Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import pandas as pd

from app.core.config import DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS, MIN_GROUP_SIZE_FOR_HHI
from app.models.schemas import (
    AnalysisResponse,
    AnalysisSummary,
    CountrySummary,
    ScoredProduct,
    Weights,
    Thresholds,
)
from app.services.excel_parser import parse_excel_file
from app.services.scoring import compute_scores
from app.services.recommendation import apply_recommendations

router = APIRouter(prefix="/api", tags=["analyze"])


def _build_summary(products: List[dict], warnings: List[str]) -> AnalysisSummary:
    df = pd.DataFrame(products)
    country_summaries = []
    for country, group in df.groupby("country"):
        country_summaries.append(
            CountrySummary(
                country=country,
                product_count=int(len(group)),
                avg_growth_rate=(
                    float(group["growth_rate"].dropna().mean())
                    if group["growth_rate"].notna().any()
                    else None
                ),
                avg_profit_margin=(
                    float(group["profit_margin"].dropna().mean())
                    if group["profit_margin"].notna().any()
                    else None
                ),
                total_monthly_revenue=float(group["monthly_revenue"].sum()),
            )
        )

    rec_counts = Counter(p.get("recommendation") for p in products if p.get("recommendation"))

    return AnalysisSummary(
        total_products=len(products),
        countries=country_summaries,
        recommendation_breakdown=dict(rec_counts),
        parse_warnings=warnings,
    )


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    files: List[UploadFile] = File(..., description="一个或多个Excel文件，与countries按顺序一一对应"),
    countries: str = Form(..., description="逗号分隔的国家名，顺序与files一致，如：德国,法国,意大利,英国,美国"),
    weights: Optional[str] = Form(None, description="JSON字符串，覆盖默认权重，如：{\"growth\":0.4,\"market_size\":0.2,\"competition\":0.2,\"profit_margin\":0.2}"),
    thresholds: Optional[str] = Form(None, description="JSON字符串，覆盖默认分档阈值"),
):
    country_list = [c.strip() for c in countries.split(",") if c.strip()]
    if len(country_list) != len(files):
        raise HTTPException(
            status_code=400,
            detail=f"countries数量({len(country_list)})与上传文件数量({len(files)})不一致",
        )

    weights_obj = Weights(**json.loads(weights)) if weights else Weights(**DEFAULT_WEIGHTS)
    thresholds_obj = Thresholds(**json.loads(thresholds)) if thresholds else Thresholds(**DEFAULT_THRESHOLDS)

    all_products: List[dict] = []
    all_warnings: List[str] = []

    for file, country in zip(files, country_list):
        content = await file.read()
        products, warnings = parse_excel_file(content, file.filename, country)
        all_products.extend(products)
        all_warnings.extend(warnings)

    if not all_products:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "未解析出任何有效数据，请检查Excel表头是否包含必需字段",
                "required_fields": ["asin", "title", "brand", "category", "price", "monthly_sales", "monthly_revenue"],
                "warnings": all_warnings,
            },
        )

    scored = compute_scores(all_products, min_group_size=MIN_GROUP_SIZE_FOR_HHI)
    scored = apply_recommendations(scored, weights_obj, thresholds_obj)

    summary = _build_summary(scored, all_warnings)
    scored_products = [ScoredProduct(**p) for p in scored]

    return AnalysisResponse(
        products=scored_products,
        summary=summary,
        weights_used=weights_obj,
        thresholds_used=thresholds_obj,
    )
