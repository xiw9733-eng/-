"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScoredProduct, AnalysisSummary } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface AiInsightResult {
  summary: string;
  reasons: Record<string, string>;
}

interface AiInsightProps {
  products: ScoredProduct[];
  summary: AnalysisSummary;
  onReasonsReady: (reasons: Record<string, string>) => void;
}

export function AiInsight({ products, summary, onReasonsReady }: AiInsightProps) {
  const [result, setResult] = useState<AiInsightResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      // 只发top20产品的关键字段，省token
      const top20 = [...products]
        .filter((p) => p.total_score !== null)
        .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
        .slice(0, 20)
        .map(({ asin, country, category, growth_rate, monthly_revenue, hhi, profit_margin, total_score, recommendation }) => ({
          asin, country, category, growth_rate, monthly_revenue, hhi, profit_margin, total_score, recommendation,
        }));

      const summaryStats = {
        countries: summary.countries,
        recommendation_breakdown: summary.recommendation_breakdown,
      };

      const resp = await fetch(`${API_BASE}/api/insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: top20, summary_stats: summaryStats }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail ?? "AI分析失败");
      }

      const data: AiInsightResult = await resp.json();
      setResult(data);
      onReasonsReady(data.reasons);
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-primary">AI 市场总结</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {result && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-muted-foreground hover:text-foreground"
              >
                {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
            )}
            <Button
              size="sm"
              variant={result ? "outline" : "default"}
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="animate-spin size-3.5" />分析中…</>
              ) : result ? (
                "重新生成"
              ) : (
                <><Sparkles className="size-3.5" />一键生成 AI 分析</>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        )}

        {result && expanded && (
          <p className="mt-3 text-sm text-foreground leading-relaxed">
            {result.summary}
          </p>
        )}

        {!result && !loading && (
          <p className="mt-2 text-xs text-muted-foreground">
            点击按钮，AI 将自动分析市场机会并为每个产品生成推荐理由
          </p>
        )}
      </CardContent>
    </Card>
  );
}
