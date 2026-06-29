"use client";

import { useState, useMemo } from "react";
import { FileUpload } from "@/components/upload/FileUpload";
import { WeightAdjuster } from "@/components/dashboard/WeightAdjuster";
import { ProductTable } from "@/components/dashboard/ProductTable";
import { ChartsDashboard } from "@/components/dashboard/ChartsDashboard";
import { ParseWarnings } from "@/components/dashboard/ParseWarnings";
import { analyzeFiles, ApiError } from "@/lib/api";
import { recomputeRecommendations } from "@/lib/scoring";
import {
  AnalysisResponse, CountryFile, Weights, DEFAULT_WEIGHTS, DEFAULT_THRESHOLDS,
} from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart2 } from "lucide-react";
import { AiInsight } from "@/components/dashboard/AiInsight";

export default function HomePage() {
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [aiReasons, setAiReasons] = useState<Record<string, string>>({});

  async function handleAnalyze(files: CountryFile[]) {
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeFiles(files, weights, DEFAULT_THRESHOLDS);
      setResult(data);
      setAiReasons({});
    } catch (e) {
      if (e instanceof ApiError) {
        const detail = e.detail;
        if (detail && typeof detail === "object" && "message" in detail) {
          setError((detail as { message: string }).message);
        } else {
          setError(e.message);
        }
      } else {
        setError("请求失败，请确认后端服务已启动（http://localhost:8000）");
      }
    } finally {
      setLoading(false);
    }
  }

  // 权重变更时前端本地重算，不发请求
  const recomputedProducts = useMemo(() => {
    if (!result) return null;
    return recomputeRecommendations(result.products, weights, DEFAULT_THRESHOLDS);
  }, [result, weights]);

  const recomputedSummary = useMemo(() => {
    if (!result || !recomputedProducts) return null;
    const breakdown: Record<string, number> = {};
    recomputedProducts.forEach((p) => {
      if (p.recommendation) breakdown[p.recommendation] = (breakdown[p.recommendation] ?? 0) + 1;
    });
    return { ...result.summary, recommendation_breakdown: breakdown };
  }, [result, recomputedProducts]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <BarChart2 className="size-5 text-primary" />
          <span className="font-semibold text-sm tracking-tight">跨境选品四要素分析</span>
          <span className="ml-auto text-xs text-muted-foreground">MVP v0.1</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 flex flex-col gap-8">
        {/* 上传区 */}
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <FileUpload onAnalyze={handleAnalyze} loading={loading} />
          </div>
          <div>
            <WeightAdjuster weights={weights} onChange={setWeights} />
          </div>
        </section>

        {/* 错误提示 */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* 结果区 */}
        {result && recomputedProducts && recomputedSummary && (
          <section className="flex flex-col gap-6">
            <ParseWarnings warnings={result.summary.parse_warnings} />

            <AiInsight
              products={recomputedProducts}
              summary={recomputedSummary}
              onReasonsReady={setAiReasons}
            />

            <Tabs defaultValue="charts">
              <TabsList>
                <TabsTrigger value="charts">可视化概览</TabsTrigger>
                <TabsTrigger value="table">
                  产品明细
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs tabular-nums text-primary">
                    {recomputedProducts.length}
                  </span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="charts" className="pt-2">
                <ChartsDashboard
                  products={recomputedProducts}
                  summary={recomputedSummary}
                />
              </TabsContent>
              <TabsContent value="table" className="pt-2">
                <ProductTable products={recomputedProducts} reasons={aiReasons} />
              </TabsContent>
            </Tabs>
          </section>
        )}

        {/* 空态 */}
        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <BarChart2 className="size-12 opacity-20" />
            <p className="text-sm">上传各国Excel数据，开始四要素分析</p>
            <p className="text-xs opacity-70">支持中英文表头自动识别 · 最多同时分析5个国家</p>
          </div>
        )}
      </main>
    </div>
  );
}
