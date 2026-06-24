"""生成两份字段命名风格完全不同的样本Excel，用于测试模块1的别名匹配是否健壮。"""
import pandas as pd
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "fixtures")
os.makedirs(OUT_DIR, exist_ok=True)

# 德国：英文表头（类似H10导出风格）
de_rows = [
    # category=Kitchen Scale, 4个品牌 -> HHI样本充足
    ["B0DE001", "Digital Kitchen Scale 5kg", "BrandA", "Kitchen Scale", 19.99, 3200, 63968, 4.5, 1200, 0.18, 0.32],
    ["B0DE002", "Stainless Kitchen Scale", "BrandB", "Kitchen Scale", 24.99, 2100, 52479, 4.3, 800, 0.05, 0.28],
    ["B0DE003", "Smart Kitchen Scale App", "BrandC", "Kitchen Scale", 29.99, 1500, 44985, 4.6, 600, 0.22, 0.35],
    ["B0DE004", "Mini Kitchen Scale", "BrandD", "Kitchen Scale", 14.99, 4000, 59960, 4.1, 2000, -0.03, 0.25],
    ["B0DE005", "Pro Kitchen Scale Glass", "BrandA", "Kitchen Scale", 22.99, 1800, 41382, 4.4, 500, 0.10, 0.30],
    # category=Yoga Mat, 2个品牌 -> 样本不足，hhi_reliable应为False
    ["B0DE006", "Premium Yoga Mat 6mm", "BrandE", "Yoga Mat", 34.99, 900, 31491, 4.7, 1500, 0.30, 0.40],
    ["B0DE007", "Eco Yoga Mat Cork", "BrandF", "Yoga Mat", 39.99, 600, 23994, 4.5, 700, 0.12, 0.38],
]
de_columns = [
    "ASIN", "Title", "Brand", "Category", "Price", "Monthly Sales", "Monthly Revenue",
    "Rating", "Reviews", "Growth Rate", "Profit Margin",
]

# 美国：中文表头（模拟卖家精灵导出风格），故意打乱列顺序+用百分号字符串
us_rows = [
    ["B0US001", "BrandX", "Wireless Earbuds", "无线耳机 降噪", 49.99, 5000, 249950, 4.4, 3000, "25%", "30%"],
    ["B0US002", "BrandY", "Wireless Earbuds", "运动蓝牙耳机", 39.99, 6200, 247938, 4.2, 4500, "15%", "27%"],
    ["B0US003", "BrandZ", "Wireless Earbuds", "高端无线耳机", 89.99, 1200, 107988, 4.6, 900, "40%", "35%"],
    ["B0US004", "BrandX", "Wireless Earbuds", "儿童耳机", 19.99, 3000, 59970, 3.9, 1200, "-5%", "20%"],
    ["B0US005", "BrandW", "Phone Case", "手机壳 透明", 9.99, 8000, 79920, 4.0, 5000, "8%", "45%"],
    ["B0US006", "BrandV", "Phone Case", "磁吸手机壳", 14.99, 5000, 74950, 4.3, 2200, "18%", "42%"],
]
us_columns = [
    "asin", "品牌", "category", "品名", "价格", "月销量", "月销售额", "评分", "评论数", "增长率", "利润率",
]

pd.DataFrame(de_rows, columns=de_columns).to_excel(os.path.join(OUT_DIR, "germany_sample.xlsx"), index=False)
pd.DataFrame(us_rows, columns=us_columns).to_excel(os.path.join(OUT_DIR, "us_sample.xlsx"), index=False)

print("生成完成:", os.listdir(OUT_DIR))
