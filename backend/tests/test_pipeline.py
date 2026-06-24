import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.excel_parser import parse_excel_file
from app.services.scoring import compute_scores
from app.services.recommendation import apply_recommendations
from app.models.schemas import Weights, Thresholds, ScoredProduct

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

all_products, all_warnings = [], []
for fname, country in [("germany_sample.xlsx", "Germany"), ("us_sample.xlsx", "US")]:
    with open(os.path.join(FIXTURES, fname), "rb") as f:
        content = f.read()
    products, warnings = parse_excel_file(content, fname, country)
    print(f"--- {fname} ---")
    print(f"解析出 {len(products)} 条记录, warnings={warnings}")
    all_products.extend(products)
    all_warnings.extend(warnings)

assert len(all_products) == 7 + 6, f"期望13条记录，实际{len(all_products)}"

# 抽查一条中文表头+百分号字符串的解析结果
us_sample = next(p for p in all_products if p["asin"] == "B0US001")
print("\n样本字段检查 (B0US001):", json.dumps(us_sample, ensure_ascii=False, indent=2))
assert us_sample["title"] == "无线耳机 降噪"
assert us_sample["brand"] == "BrandX"
assert abs(us_sample["growth_rate"] - 0.25) < 1e-6, "百分号字符串25%应转换为0.25"
assert abs(us_sample["profit_margin"] - 0.30) < 1e-6

scored = compute_scores(all_products, min_group_size=3)

kitchen_scale = [p for p in scored if p["category"] == "Kitchen Scale"]
yoga_mat = [p for p in scored if p["category"] == "Yoga Mat"]
print(f"\nKitchen Scale组 hhi={kitchen_scale[0]['hhi']:.4f} group_size={kitchen_scale[0]['hhi_group_size']} reliable={kitchen_scale[0]['hhi_reliable']}")
print(f"Yoga Mat组 hhi={yoga_mat[0]['hhi']:.4f} group_size={yoga_mat[0]['hhi_group_size']} reliable={yoga_mat[0]['hhi_reliable']}")
assert kitchen_scale[0]["hhi_reliable"] is True, "Kitchen Scale有4个品牌，应可靠"
assert yoga_mat[0]["hhi_reliable"] is False, "Yoga Mat只有2个品牌，应不可靠"

scored = apply_recommendations(scored, Weights(), Thresholds())

# 校验四要素子分都落在[0,1]
for p in scored:
    for f in ["growth_score", "market_size_score", "competition_score", "margin_score", "total_score"]:
        v = p.get(f)
        assert v is None or 0 <= v <= 1, f"{f}={v} 超出[0,1]范围: {p['asin']}"

# 用pydantic模型做最终的schema校验（确保和API响应一致）
validated = [ScoredProduct(**p) for p in scored]
print(f"\n全部{len(validated)}条记录通过ScoredProduct schema校验")

ranked = sorted(validated, key=lambda p: (p.total_score or -1), reverse=True)
print("\n--- 排名前5 ---")
for p in ranked[:5]:
    print(f"{p.asin:10s} {p.country:8s} {p.category:15s} total={p.total_score:.3f}  {p.recommendation}")

print("\n--- 权重调整测试（增速权重拉满）---")
growth_heavy = apply_recommendations(
    [p.model_dump() for p in validated],
    Weights(growth=1.0, market_size=0, competition=0, profit_margin=0),
    Thresholds(),
)
top_growth = sorted(growth_heavy, key=lambda p: (p["total_score"] or -1), reverse=True)[0]
print(f"增速权重拉满后排名第一: {top_growth['asin']} growth_rate={top_growth['growth_rate']}")

print("\n✅ 全部测试通过")
