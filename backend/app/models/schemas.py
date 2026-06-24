"""统一数据模型。所有模块共用，避免前后端字段对不上。"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict


class Product(BaseModel):
    """模块1输出的统一字段（对应需求里的 Product schema）。"""
    asin: str
    title: str
    brand: str
    category: str
    country: str
    price: float
    monthly_sales: float
    monthly_revenue: float
    rating: Optional[float] = None
    reviews: Optional[int] = None
    growth_rate: Optional[float] = None   # 同比/环比增长率，源数据没有则为 None
    profit_margin: Optional[float] = None # 利润率，源数据没有则为 None

    # 来源文件名，便于排查解析问题
    source_file: Optional[str] = None


class ScoredProduct(Product):
    """模块2+3输出：在统一字段基础上附加四要素子分与最终推荐。"""
    growth_score: Optional[float] = None       # 0-1，None表示该项数据缺失未参与打分
    market_size_score: Optional[float] = None  # 0-1
    competition_score: Optional[float] = None  # 0-1，基于HHI反向计算
    margin_score: Optional[float] = None       # 0-1

    hhi: Optional[float] = None                # 原始HHI值 0-1（或0-10000，见说明）
    hhi_group_size: Optional[int] = None        # 该(country,category)分组内品牌数，用于判断HHI是否可靠
    hhi_reliable: bool = True

    total_score: Optional[float] = None        # 默认权重下的加权总分
    recommendation: Optional[str] = None        # 默认权重下的推荐档位


class Weights(BaseModel):
    growth: float = 0.25
    market_size: float = 0.25
    competition: float = 0.25
    profit_margin: float = 0.25

    @field_validator("growth", "market_size", "competition", "profit_margin")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("权重不能为负数")
        return v


class Thresholds(BaseModel):
    strong_opportunity: float = 0.75
    recommended: float = 0.55
    observe: float = 0.35


class CountrySummary(BaseModel):
    country: str
    product_count: int
    avg_growth_rate: Optional[float] = None
    avg_profit_margin: Optional[float] = None
    total_monthly_revenue: float


class AnalysisSummary(BaseModel):
    total_products: int
    countries: List[CountrySummary]
    recommendation_breakdown: Dict[str, int]  # {"🔥 Strong Opportunity": 12, ...}
    parse_warnings: List[str] = Field(default_factory=list)  # 模块1解析时的字段缺失/异常提示


class AnalysisResponse(BaseModel):
    products: List[ScoredProduct]
    summary: AnalysisSummary
    weights_used: Weights
    thresholds_used: Thresholds


class RecomputeRequest(BaseModel):
    """前端调权重滑块若想用后端而非本地JS重算时使用（备用，MVP默认走前端本地计算）。"""
    products: List[ScoredProduct]
    weights: Weights
    thresholds: Thresholds = Thresholds()
