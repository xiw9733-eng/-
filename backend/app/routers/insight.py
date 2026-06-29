from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_insight import generate_insight

router = APIRouter(prefix="/api", tags=["insight"])


class InsightRequest(BaseModel):
    products: List[dict]
    summary_stats: dict


class InsightResponse(BaseModel):
    summary: str
    reasons: Dict[str, str]


@router.post("/insight", response_model=InsightResponse)
async def insight(body: InsightRequest):
    if not body.products:
        raise HTTPException(status_code=400, detail="products不能为空")
    try:
        result = await generate_insight(body.products, body.summary_stats)
        return InsightResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI分析失败：{e}")
