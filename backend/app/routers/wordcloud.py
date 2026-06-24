from typing import List, Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.vision import analyze_product_images

router = APIRouter(prefix="/api", tags=["wordcloud"])


class WordcloudRequest(BaseModel):
    asins: List[str] = Field(..., max_length=100, description="ASIN列表，最多100个")
    top_n: int = Field(default=60, ge=10, le=200, description="返回词频最高的前N个词")


class WordcloudResponse(BaseModel):
    word_freq: Dict[str, int]    # {词: 频次}，已按频次降序
    total_analyzed: int           # 成功识图数
    total_requested: int
    failed_count: int


@router.post("/wordcloud", response_model=WordcloudResponse)
async def wordcloud(body: WordcloudRequest):
    if not body.asins:
        raise HTTPException(status_code=400, detail="asins不能为空")

    # 去重，最多取100个
    unique_asins = list(dict.fromkeys(body.asins))[:100]

    result = await analyze_product_images(unique_asins)

    # 只返回top_n
    top_words = dict(list(result["word_freq"].items())[:body.top_n])

    return WordcloudResponse(
        word_freq=top_words,
        total_analyzed=result["total_analyzed"],
        total_requested=result["total_requested"],
        failed_count=len(result["failed_asins"]),
    )
