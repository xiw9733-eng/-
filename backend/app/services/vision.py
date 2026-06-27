"""
模块5：产品图片识图 → 关键词提取。
使用 Google Gemini Vision 模型（gemini-1.5-flash）。
"""
import os
import io
import base64
import asyncio
from typing import List, Tuple
from collections import Counter
import re

import httpx
from PIL import Image

# ── 配置 ──────────────────────────────────────────
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL_NAME = "gemini-3.5-flash"
MAX_IMAGE_SIDE = 512
MAX_WORKERS = 5

PROMPT = (
    "这是一张产品图片。请直接输出8-12个中文关键词标签，"
    "涵盖产品类型、颜色、材质、外形特征、功能部件等，"
    "用逗号分隔，不要任何解释或多余文字，不要句子。"
)

STOPWORDS = {
    "产品", "图片", "商品", "物品", "包装", "背景", "白色背景",
    "正面", "侧面", "展示", "图", "款", "个", "件", "支", "只",
}


def _amazon_image_url(asin: str) -> str:
    return f"https://m.media-amazon.com/images/P/{asin}.01._SCLZZZZZZZ_.jpg"


async def _fetch_and_compress(asin: str, client: httpx.AsyncClient):
    url = _amazon_image_url(asin)
    try:
        resp = await client.get(url, timeout=15)
        resp.raise_for_status()
    except Exception:
        return None, None

    try:
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        w, h = img.size
        scale = MAX_IMAGE_SIDE / max(w, h)
        if scale < 1:
            img = img.resize((int(w * scale), int(h * scale)))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return b64, "image/jpeg"
    except Exception:
        return None, None


async def _get_keywords_single(asin: str, b64: str, mime: str) -> Tuple[str, List[str]]:
    if not GEMINI_API_KEY:
        raise ValueError("请设置环境变量 GEMINI_API_KEY")

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_NAME}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{
            "parts": [
                {"inline_data": {"mime_type": mime, "data": b64}},
                {"text": PROMPT},
            ]
        }]
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            import logging
            logging.warning(f"[vision] {asin} raw={repr(raw[:200])}")
            kws = [
                k.strip().strip("。，,.、")
                for k in re.split(r"[，,、\n]", raw)
                if k.strip() and k.strip() not in STOPWORDS and len(k.strip()) >= 2
            ]
            logging.warning(f"[vision] {asin} kws={kws}")
            return asin, kws
    except Exception as e:
        import logging
        logging.warning(f"[vision] {asin} error={e}")
        return asin, []


async def analyze_product_images(asins: List[str]) -> dict:
    if not asins:
        return {"word_freq": {}, "total_analyzed": 0, "total_requested": 0, "failed_asins": []}

    semaphore = asyncio.Semaphore(MAX_WORKERS)
    failed: List[str] = []
    all_keywords: List[str] = []

    async def process_one(asin: str):
        async with semaphore:
            async with httpx.AsyncClient() as http:
                b64, mime = await _fetch_and_compress(asin, http)
            if b64 is None:
                failed.append(asin)
                return
            _, kws = await _get_keywords_single(asin, b64, mime)
            all_keywords.extend(kws)

    await asyncio.gather(*[process_one(a) for a in asins])

    counter = Counter(all_keywords)
    word_freq = dict(sorted(counter.items(), key=lambda x: x[1], reverse=True))

    return {
        "word_freq": word_freq,
        "total_analyzed": len(asins) - len(failed),
        "total_requested": len(asins),
        "failed_asins": failed,
    }
