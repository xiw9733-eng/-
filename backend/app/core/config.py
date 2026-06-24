"""全局配置：环境变量 + 四要素打分的默认权重/阈值。"""
import os
from typing import List


class Settings:
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    dashscope_api_key: str = os.environ.get("DASHSCOPE_API_KEY", "")
    cors_origins: str = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    max_upload_mb: int = int(os.environ.get("MAX_UPLOAD_MB", "20"))

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

# ---- 模块3：推荐引擎默认参数（均可在请求里被前端覆盖）----

# 四要素默认权重，需求总和=1.0
DEFAULT_WEIGHTS = {
    "growth": 0.25,        # 增速
    "market_size": 0.25,   # 市场容量
    "competition": 0.25,   # 竞争度（基于HHI反向计算，越分散分数越高）
    "profit_margin": 0.25, # 利润率
}

# 总分（0-1）切档阈值，从高到低
DEFAULT_THRESHOLDS = {
    "strong_opportunity": 0.75,  # >= 0.75 -> 🔥 Strong Opportunity
    "recommended": 0.55,         # >= 0.55 -> ✅ Recommended
    "observe": 0.35,             # >= 0.35 -> ⚠ Observe
    # < 0.35 -> ❌ Avoid
}

# 同一(country, category)分组内样本数低于此值时，HHI不具统计意义，
# 会在结果里标记 hhi_reliable=False，前端可提示"样本过少，竞争度仅供参考"
MIN_GROUP_SIZE_FOR_HHI = 3
