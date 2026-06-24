"""模块1：Excel导入。

把不同来源（卖家精灵/H10/Jungle Scout等导出）、中英文表头不一致的Excel，
统一解析成 Product 字段。设计成"别名匹配"而不是要求用户改表头。
"""
import io
import re
import math
from typing import Optional, List, Dict, Tuple

import pandas as pd

# 字段别名表：尽量覆盖常见中英文表头。匹配时大小写/空格/下划线都会被忽略。
COLUMN_ALIASES: Dict[str, List[str]] = {
    "asin": ["asin"],
    "title": ["title", "producttitle", "product", "品名", "标题", "商品名称", "产品名称", "商品标题"],
    "brand": ["brand", "品牌"],
    "category": ["category", "categorypath", "节点", "品类", "类目", "分类", "node", "category_path"],
    "price": ["price", "价格", "单价", "售价", "amount", "buyboxprice"],
    "monthly_sales": ["monthlysales", "monthly_sales", "sales", "月销量", "月销售量", "销量", "estsales"],
    "monthly_revenue": ["monthlyrevenue", "monthly_revenue", "revenue", "月销售额", "月销额", "销售额", "estrevenue"],
    "rating": ["rating", "评分", "星级", "stars"],
    "reviews": ["reviews", "reviewcount", "评论数", "评价数", "numreviews"],
    "growth_rate": ["growthrate", "growth_rate", "growth", "增长率", "增速", "同比增长", "环比增长", "yoy", "mom"],
    "profit_margin": ["profitmargin", "profit_margin", "margin", "利润率", "毛利率"],
}

REQUIRED_FIELDS = ["asin", "title", "brand", "category", "price", "monthly_sales", "monthly_revenue"]
OPTIONAL_FIELDS = ["rating", "reviews", "growth_rate", "profit_margin"]


def _normalize_header(h: str) -> str:
    h = str(h).strip().lower()
    h = re.sub(r"[\s_\-/\(\)（）]+", "", h)
    return h


def _match_columns(columns) -> Dict[str, str]:
    """返回 {统一字段名: 原始列名} 的映射，找不到的字段不出现在结果里。"""
    normalized = {_normalize_header(c): c for c in columns}
    mapping: Dict[str, str] = {}
    for field, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            alias_n = _normalize_header(alias)
            if alias_n in normalized:
                mapping[field] = normalized[alias_n]
                break
        else:
            for norm_col, orig_col in normalized.items():
                if any(_normalize_header(a) in norm_col for a in aliases):
                    mapping[field] = orig_col
                    break
    return mapping


def _parse_number(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return None if (isinstance(value, float) and math.isnan(value)) else float(value)
    s = str(value).strip()
    if not s or s.lower() in ("nan", "none", "-", "n/a"):
        return None
    s = re.sub(r"[^\d.\-]", "", s)
    if not s or s in ("-", "."):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _parse_percentage(value) -> Optional[float]:
    """统一转换成小数形式的比例（12.5% 或 0.125 或 12.5 都转成 0.125）。"""
    if value is None:
        return None
    had_percent_sign = isinstance(value, str) and "%" in value
    num = _parse_number(value)
    if num is None:
        return None
    if had_percent_sign:
        return num / 100
    return num / 100 if abs(num) > 1 else num


def parse_excel_file(file_bytes: bytes, filename: str, country: str) -> Tuple[List[dict], List[str]]:
    """解析单个Excel文件（对应一个国家），返回 (products, warnings)。"""
    warnings: List[str] = []
    try:
        sheets = pd.read_excel(io.BytesIO(file_bytes), sheet_name=None, dtype=str)
    except Exception as e:
        return [], [f"[{filename}] 无法打开文件：{e}"]

    products: List[dict] = []
    any_sheet_usable = False

    for sheet_name, df in sheets.items():
        if df.empty:
            continue
        mapping = _match_columns(df.columns)
        missing_required = [f for f in REQUIRED_FIELDS if f not in mapping]
        if missing_required:
            warnings.append(
                f"[{filename} / {sheet_name}] 缺少必需字段 {missing_required}，跳过该sheet"
            )
            continue
        any_sheet_usable = True

        skipped_rows = 0
        for _, row in df.iterrows():
            record = {}
            for field in REQUIRED_FIELDS:
                raw = row.get(mapping[field])
                if field in ("price", "monthly_sales", "monthly_revenue"):
                    record[field] = _parse_number(raw)
                else:
                    record[field] = None if pd.isna(raw) else str(raw).strip()

            if any(record[f] in (None, "") for f in REQUIRED_FIELDS):
                skipped_rows += 1
                continue

            for field in OPTIONAL_FIELDS:
                if field in mapping:
                    raw = row.get(mapping[field])
                    if field in ("growth_rate", "profit_margin"):
                        record[field] = _parse_percentage(raw)
                    elif field == "reviews":
                        n = _parse_number(raw)
                        record[field] = int(n) if n is not None else None
                    else:
                        record[field] = _parse_number(raw)
                else:
                    record[field] = None

            record["country"] = country
            record["source_file"] = filename
            products.append(record)

        if skipped_rows:
            warnings.append(f"[{filename} / {sheet_name}] {skipped_rows} 行因必需字段缺失被跳过")

    if not any_sheet_usable:
        warnings.append(f"[{filename}] 所有sheet都缺少必需字段，整个文件未被解析")

    # 按 (asin, country) 去重，同一商品在多个品类下重复出现时保留第一条
    seen: set = set()
    deduped: List[dict] = []
    dup_count = 0
    for r in products:
        key = (r["asin"], r["country"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)
        else:
            dup_count += 1
    if dup_count:
        warnings.append(f"[{filename}] 发现 {dup_count} 条重复ASIN已自动去重（保留首次出现的行）")

    return deduped, warnings
