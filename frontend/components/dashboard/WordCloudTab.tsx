"use client";

import { useState } from "react";
import { Loader2, ScanSearch, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScoredProduct } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface WordFreq {
  word_freq: Record<string, number>;
  total_analyzed: number;
  total_requested: number;
  failed_count: number;
}

// 词频 → 字体大小（px），映射到 14~52px
function calcFontSize(count: number, min: number, max: number): number {
  if (max === min) return 28;
  const ratio = (count - min) / (max - min);
  return Math.round(14 + ratio * 38);
}

// 词频 → 颜色，高频用主色调，低频用浅色
const WORD_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7",
  "#2563eb", "#0284c7", "#0891b2",
  "#059669", "#16a34a",
  "#d97706", "#ea580c",
  "#71717a",
];
function pickColor(index: number, total: number): string {
  const tier = Math.floor((index / total) * WORD_COLORS.length);
  return WORD_COLORS[Math.min(tier, WORD_COLORS.length - 1)];
}

interface WordCloudProps {
  products: ScoredProduct[];
  topN?: number;
}

export function WordCloudTab({ products, topN = 100 }: WordCloudProps) {
  const [result, setResult] = useState<WordFreq | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 取总分前 topN 的产品
  const topProducts = [...products]
    .filter((p) => p.total_score !== null)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, topN);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(`${API_BASE}/api/wordcloud`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asins: topProducts.map((p) => p.asin), top_n: 60 }),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail ?? "识图分析失败");
      }
      setResult(await resp.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  const words = result
    ? Object.entries(result.word_freq).sort((a, b) => b[1] - a[1])
    : [];
  const counts = words.map(([, c]) => c);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);

  return (
    <div className="flex flex-col gap-4">
      {/* 触发区 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-muted-foreground">
          将对总分前 <span className="font-medium text-foreground">{topProducts.length}</span> 名产品的主图进行识图分析，提取外观关键词
        </div>
        <Button onClick={handleAnalyze} disabled={loading || topProducts.length === 0}>
          {loading ? (
            <><Loader2 className="animate-spin" />识图中，请稍候…</>
          ) : (
            <><ScanSearch />开始识图分析</>
          )}
        </Button>
      </div>

      {/* 错误 */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
          {error.includes("DASHSCOPE_API_KEY") && (
            <span className="block mt-1 text-xs opacity-80">
              请在后端 .env 文件中设置 DASHSCOPE_API_KEY=sk-xxx
            </span>
          )}
        </div>
      )}

      {/* 分析结果 */}
      {result && (
        <div className="flex flex-col gap-4">
          {/* 统计摘要 */}
          <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
            <span>✅ 成功识图 <strong className="text-foreground">{result.total_analyzed}</strong> 张</span>
            <span>📊 共提取 <strong className="text-foreground">{Object.keys(result.word_freq).length}</strong> 个关键词</span>
            {result.failed_count > 0 && (
              <span className="flex items-center gap-1">
                <ImageOff className="size-3" />
                {result.failed_count} 张图片加载失败（已跳过）
              </span>
            )}
          </div>

          {/* 词云主体 */}
          <div className="rounded-xl border border-border bg-muted/20 p-6 min-h-[260px] flex flex-wrap gap-x-4 gap-y-3 items-center justify-center">
            {words.map(([word, count], i) => (
              <span
                key={word}
                title={`出现 ${count} 次`}
                style={{
                  fontSize: calcFontSize(count, minCount, maxCount),
                  color: pickColor(i, words.length),
                  fontWeight: count >= maxCount * 0.6 ? 700 : count >= maxCount * 0.3 ? 500 : 400,
                  lineHeight: 1.2,
                  cursor: "default",
                  transition: "opacity 0.15s",
                }}
                className="hover:opacity-70"
              >
                {word}
              </span>
            ))}
          </div>

          {/* 频次明细表（Top 20）*/}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
              查看词频明细（Top 20）
            </summary>
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              {words.slice(0, 20).map(([word, count]) => (
                <div key={word} className="flex items-center justify-between gap-2 py-0.5 border-b border-border/50">
                  <span className="font-medium text-foreground">{word}</span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* 空态提示 */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
          <ScanSearch className="size-10 opacity-20" />
          <p className="text-sm">点击「开始识图分析」，系统将调用 Qwen Vision 对每张产品图提取关键词</p>
          <p className="text-xs opacity-60">100张图约需 30-60 秒，依网速和并发限额而定</p>
        </div>
      )}
    </div>
  );
}
