"""
模块6：AI机会总结 + 产品推荐理由。
一次API调用同时生成：
- summary: 整体市场总结（150字以内）
- reasons: Top20产品各自的推荐/不推荐理由（每条30字以内）
"""
import os
import json
import asyncio
import httpx
from typing import List, Dict

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
PRIMARY_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def _shorten(text: str, limit: int = 300) -> str:
    text = " ".join(text.split())
    return text[:limit] + ("..." if len(text) > limit else "")


def _build_prompt(products: List[dict], summary_stats: dict) -> str:
    # 只取关键字段，省token
    slim = [
        {
            "asin": p["asin"],
            "country": p["country"],
            "category": p.get("category", ""),
            "growth": f"{(p.get('growth_rate') or 0)*100:.0f}%",
            "revenue": f"{(p.get('monthly_revenue') or 0)/1000:.0f}K",
            "hhi": round(p.get("hhi") or 0, 2),
            "margin": f"{(p.get('profit_margin') or 0)*100:.0f}%",
            "score": round(p.get("total_score") or 0, 3),
            "rec": p.get("recommendation", ""),
        }
        for p in products[:20]
    ]

    stats_lines = []
    for c in summary_stats.get("countries", []):
        stats_lines.append(
            f"{c['country']}: 月销售额{c['total_monthly_revenue']/1000:.0f}K"
            + (f" 平均增速{c['avg_growth_rate']*100:.0f}%" if c.get("avg_growth_rate") else "")
        )

    rec_breakdown = summary_stats.get("recommendation_breakdown", {})

    return f"""你是跨境电商选品分析师。根据以下数据生成分析，语言简洁，直接给结论。

【市场概况】
{chr(10).join(stats_lines)}
推荐分布：{json.dumps(rec_breakdown, ensure_ascii=False)}

【Top20产品数据】
{json.dumps(slim, ensure_ascii=False)}

请严格按以下JSON格式返回，不要任何其他内容：
{{
  "summary": "整体市场总结，150字以内，说明哪个国家/品类机会最大、主要风险，给出1-2个明确建议",
  "reasons": {{
    "ASIN1": "30字以内推荐/回避理由",
    "ASIN2": "30字以内推荐/回避理由"
  }}
}}"""


async def _call_gemini(client: httpx.AsyncClient, model: str, prompt: str) -> dict:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": 1000,
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    resp = await client.post(url, json=payload)
    try:
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise ValueError(
            f"Gemini模型{model}请求失败({resp.status_code})：{_shorten(resp.text)}"
        ) from exc

    try:
        return resp.json()
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini模型{model}返回内容不是JSON：{_shorten(resp.text)}") from exc


async def _call_gemini_with_retry(prompt: str) -> dict:
    models = [PRIMARY_MODEL]
    if FALLBACK_MODEL and FALLBACK_MODEL not in models:
        models.append(FALLBACK_MODEL)

    last_error: Exception | None = None
    async with httpx.AsyncClient(timeout=60) as client:
        for model in models:
            for attempt in range(3):
                try:
                    return await _call_gemini(client, model, prompt)
                except ValueError as exc:
                    last_error = exc
                    message = str(exc)
                    retryable = any(f"({code})" in message for code in RETRYABLE_STATUS_CODES)
                    if not retryable or attempt == 2:
                        break
                    await asyncio.sleep(1.5 * (attempt + 1))

    raise ValueError(f"AI分析暂时不可用，已重试多个模型：{last_error}") from last_error


async def generate_insight(products: List[dict], summary_stats: dict) -> Dict:
    if not GEMINI_API_KEY:
        raise ValueError("请设置环境变量 GEMINI_API_KEY")

    prompt = _build_prompt(products, summary_stats)
    data = await _call_gemini_with_retry(prompt)

    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError(f"Gemini没有返回候选结果：{_shorten(json.dumps(data, ensure_ascii=False))}")

    candidate = candidates[0]
    parts = candidate.get("content", {}).get("parts") or []
    raw = "".join(part.get("text", "") for part in parts).strip()
    if not raw:
        finish_reason = candidate.get("finishReason", "UNKNOWN")
        raise ValueError(f"Gemini返回为空，结束原因：{finish_reason}")

    # Gemini偶尔仍会包一层```json代码块，这里做一次兼容提取。
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start < 0 or end <= start:
        raise ValueError(f"Gemini未返回有效JSON：{_shorten(raw)}")

    try:
        parsed = json.loads(raw[start:end])
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini返回JSON解析失败：{_shorten(raw)}") from exc

    if not isinstance(parsed, dict):
        raise ValueError("Gemini返回格式错误：顶层不是JSON对象")

    reasons = parsed.get("reasons", {})
    if not isinstance(reasons, dict):
        reasons = {}

    return {
        "summary": str(parsed.get("summary", "")),
        "reasons": {str(k): str(v) for k, v in reasons.items()},
    }
