"""
模块5：产品图片识图 → 关键词提取。
复用识图分析.py的核心逻辑，适配FastAPI异步环境。
使用 Qwen Vision 模型（DashScope兼容OpenAI接口）。
"""
import os
import io
import base64
import asyncio
from typing import List, Tuple
from collections import Counter
import re

import httpx
from openai import AsyncOpenAI
from PIL import Image

# ── 配置 ──────────────────────────────────────────
DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY", "sk-ws-H.REMXIRP.iFwr.MEUCIEOMYoNXBEL676J_ykP8n1z7auOiNSmHWql4uz1HLukmAiEAxs3mNqql5mE689jzMLyvnp96hHhxWLoVUEDJo33buy0")
MODEL_NAME = os.environ.get("VISION_MODEL", "qwen3-vl-235b-a22b-thinking")
MAX_IMAGE_SIDE = 256      # 压缩后最大边长，省token
MAX_TOKENS_PER_IMG = 80   # 每张图最大输出token
MAX_WORKERS = 5           # 并发数

PROMPT = (
    "这是一张产品图片。请直接输出8-12个中文关键词标签，"
    "涵盖产品类型、颜色、材质、外形特征、功能部件等，"
    "用逗号分隔，不要任何解释或多余文字，不要句子。"
)

# 停用词：过于泛化，对选品没参考价值
STOPWORDS = {
    "产品", "图片", "商品", "物品", "包装", "背景", "白色背景",
    "正面", "侧面", "展示", "图", "款", "个", "件", "支", "只",
}


def _get_client() -> AsyncOpenAI:
    if not DASHSCOPE_API_KEY:
        raise ValueError("请设置环境变量 DASHSCOPE_API_KEY")
    return AsyncOpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


def _amazon_image_url(asin: str) -> str:
    return f"https://m.media-amazon.com/images/P/{asin}.01._SCLZZZZZZZ_.jpg"


async def _fetch_and_compress(asin: str, client: httpx.AsyncClient) -> str | None:
    """下载Amazon产品图，压缩，转base64 data url。失败返回None。"""
    url = _amazon_image_url(asin)
    try:
        resp = await client.get(url, timeout=15)
        resp.raise_for_status()
    except Exception:
        return None

    try:
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        w, h = img.size
        scale = MAX_IMAGE_SIDE / max(w, h)
        if scale < 1:
            img = img.resize((int(w * scale), int(h * scale)))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return None


async def _get_keywords_single(
    asin: str,
    data_url: str,
    llm: AsyncOpenAI,
) -> Tuple[str, List[str]]:
    """调用Qwen Vision，返回 (asin, keywords列表)。"""
    try:
        resp = await llm.chat.completions.create(
            model=MODEL_NAME,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": PROMPT},
                ],
            }],
            max_tokens=MAX_TOKENS_PER_IMG,
        )
        raw = resp.choices[0].message.content.strip()
        # 分割关键词，清理
        kws = [
            k.strip().strip("。，,.、")
            for k in re.split(r"[，,、\n]", raw)
            if k.strip() and k.strip() not in STOPWORDS and len(k.strip()) >= 2
        ]
        return asin, kws
    except Exception as e:
        return asin, []


async def analyze_product_images(asins: List[str]) -> dict:
    """
    主入口：接收ASIN列表，并发识图，返回词频统计结果。
    返回格式：
    {
        "word_freq": {"关键词": 出现次数, ...},   # 按频次降序
        "total_analyzed": 85,                    # 成功识别的图片数
        "total_requested": 100,
        "failed_asins": ["B0XXXXX", ...]         # 图片下载失败的
    }
    """
    if not asins:
        return {"word_freq": {}, "total_analyzed": 0, "total_requested": 0, "failed_asins": []}

    llm = _get_client()
    semaphore = asyncio.Semaphore(MAX_WORKERS)
    failed: List[str] = []
    all_keywords: List[str] = []

    async def process_one(asin: str):
        async with semaphore:
            async with httpx.AsyncClient() as http:
                data_url = await _fetch_and_compress(asin, http)
            if data_url is None:
                failed.append(asin)
                return
            _, kws = await _get_keywords_single(asin, data_url, llm)
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
