"use client";

import { WordCloudTab } from "@/components/dashboard/WordCloudTab";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoredProduct, AnalysisSummary } from "@/lib/types";

const REC_COLORS: Record<string, string> = {
  "🔥 Strong Opportunity": "var(--rec-strong)",
  "✅ Recommended":        "var(--rec-recommended)",
  "⚠ Observe":            "var(--rec-observe)",
  "❌ Avoid":              "var(--rec-avoid)",
};

function pct(v: number | null) {
  return v !== null ? `${(v * 100).toFixed(1)}%` : "—";
}
function fmtRevenue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

/* ─── 1. 产品总分排名（卡片列表 + Amazon图片，Top 20）─── */
const REC_BG: Record<string, string> = {
  "🔥 Strong Opportunity": "bg-rec-strong/10 text-rec-strong border-rec-strong/20",
  "✅ Recommended":        "bg-rec-recommended/10 text-rec-recommended border-rec-recommended/20",
  "⚠ Observe":            "bg-rec-observe/10 text-rec-observe border-rec-observe/20",
  "❌ Avoid":              "bg-rec-avoid/10 text-rec-avoid border-rec-avoid/20",
};

function ScoreBar({ score, rec }: { score: number; rec: string }) {
  const color =
    rec.includes("Strong") ? "bg-rec-strong" :
    rec.includes("Recommended") ? "bg-rec-recommended" :
    rec.includes("Observe") ? "bg-rec-observe" : "bg-rec-avoid";
  return (
    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score * 100}%` }} />
    </div>
  );
}

function ProductImage({ asin }: { asin: string }) {
  const [errored, setErrored] = useState(false);
  const src = `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
  if (errored) {
    return (
      <div className="size-14 shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground text-xs">
        No img
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={asin}
      className="size-14 shrink-0 rounded-md object-contain bg-muted"
      onError={() => setErrored(true)}
    />
  );
}

function RankingChart({ products }: { products: ScoredProduct[] }) {
  const ranked = [...products]
    .filter((p) => p.total_score !== null)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-2">
      {ranked.map((p, i) => {
        const rec = p.recommendation ?? "";
        const badgeCls = REC_BG[rec] ?? "bg-muted text-muted-foreground border-border";
        return (
          <div
            key={`${p.asin}-${p.country}-${i}`}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40 transition-colors"
          >
            {/* 排名 */}
            <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular-nums">
              {i + 1}
            </span>

            {/* Amazon产品图 */}
            <ProductImage asin={p.asin} />

            {/* 主信息 */}
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{p.asin}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">{p.country}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground truncate max-w-[160px]">{p.brand}</span>
              </div>
              <p className="text-sm font-medium leading-snug line-clamp-1 text-foreground">
                {p.title}
              </p>
              <ScoreBar score={p.total_score ?? 0} rec={rec} />
            </div>

            {/* 右侧指标 */}
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badgeCls}`}>
                {rec || "—"}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                <span title="月销售额">💰 {fmtRevenue(p.monthly_revenue)}</span>
                {p.growth_rate !== null && (
                  <span title="增速" className={p.growth_rate >= 0 ? "text-rec-strong" : "text-rec-avoid"}>
                    {p.growth_rate >= 0 ? "↑" : "↓"} {Math.abs(p.growth_rate * 100).toFixed(1)}%
                  </span>
                )}
                <span className="font-semibold text-foreground">{p.total_score?.toFixed(3)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── 2. HHI 分布（散点图：market_revenue vs HHI，按国家着色）─── */
const COUNTRY_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#14b8a6",
];

function HHIScatterChart({ products }: { products: ScoredProduct[] }) {
  const countries = [...new Set(products.map((p) => p.country))];
  const colorMap = Object.fromEntries(countries.map((c, i) => [c, COUNTRY_COLORS[i % COUNTRY_COLORS.length]]));

  // 95分位截断：避免少数大品类把X轴拉得过宽，超出的点夹在边界显示
  const allRevenues = products.map((p) => p.monthly_revenue).sort((a, b) => a - b);
  const p95 = allRevenues[Math.floor(allRevenues.length * 0.95)] ?? 0;
  const xMax = Math.ceil(p95 / 50000) * 50000;
  const clippedCount = products.filter((p) => p.monthly_revenue > xMax).length;

  const byCountry = countries.map((country) => ({
    country,
    color: colorMap[country],
    data: products
      .filter((p) => p.country === country && p.hhi !== null)
      .map((p) => ({
        x: Math.min(p.monthly_revenue, xMax),
        y: p.hhi,
        name: p.asin,
        reliable: p.hhi_reliable,
        clipped: p.monthly_revenue > xMax,
        realX: p.monthly_revenue,
      })),
  }));

  return (
    <div className="flex flex-col gap-3">
      {/* HHI说明框 */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <p className="font-medium text-foreground mb-1">什么是 HHI？</p>
        <p>HHI（赫芬达尔-赫希曼指数）衡量市场集中程度，按同一国家 + 同一品类分组计算：</p>
        <p className="font-mono my-1.5 text-foreground">HHI = Σ ( 品牌销售额 / 品类总销售额 )²</p>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-6 mt-1">
          <span><span className="text-rec-strong font-medium">HHI 低（接近 0）</span> → 市场分散，多品牌竞争，更容易切入</span>
          <span><span className="text-rec-avoid font-medium">HHI 高（接近 1）</span> → 市场集中，少数品牌垄断，进入壁垒高</span>
        </div>
        <p className="mt-1.5 opacity-70">⚠ 标记表示该分组品牌数不足 3 个，HHI 仅供参考</p>
      </div>

      {clippedCount > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          ※ 为使图形可读，已将 {clippedCount} 个月销售额 &gt; {fmtRevenue(xMax)} 的点截断显示在右边界，鼠标悬停可查看真实值
        </p>
      )}
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ left: 8, right: 24, top: 8, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="x" name="月销售额" type="number"
            domain={[0, xMax]}
            tickFormatter={fmtRevenue} tick={{ fontSize: 11 }}
            label={{ value: "月销售额（95分位截断）", position: "insideBottom", offset: -12, fontSize: 11 }}
          />
          <YAxis
            dataKey="y" name="HHI" type="number" domain={[0, 1]}
            tick={{ fontSize: 11 }}
            label={{ value: "HHI", angle: -90, position: "insideLeft", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-card p-2 text-xs shadow">
                  <p className="font-medium">{d.name}</p>
                  <p>月销售额：{fmtRevenue(d.realX ?? d.x)}{d.clipped ? "（截断）" : ""}</p>
                  <p>HHI：{d.y?.toFixed(4)}{!d.reliable ? " ⚠ 样本不足" : ""}</p>
                </div>
              );
            }}
          />
          <Legend />
          {byCountry.map(({ country, color, data }) => (
            <Scatter key={country} name={country} data={data} fill={color} opacity={0.75} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── 3. 市场规模分布（各品类月销售额堆叠条形图）─── */
// 品类路径取最后两段（冒号分隔），避免完整路径太长
function shortCat(cat: string): string {
  const parts = cat.split(/[:>\/]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return cat;
  return parts.slice(-2).join(" › ");
}

function MarketSizeChart({ products }: { products: ScoredProduct[] }) {
  const categories = [...new Set(products.map((p) => p.category))];
  const countries = [...new Set(products.map((p) => p.country))];
  const colorMap = Object.fromEntries(countries.map((c, i) => [c, COUNTRY_COLORS[i % COUNTRY_COLORS.length]]));

  const data = categories.map((cat) => {
    const row: Record<string, string | number> = {
      category: cat,
      label: shortCat(cat),   // 显示用短名
    };
    countries.forEach((c) => {
      row[c] = products
        .filter((p) => p.category === cat && p.country === c)
        .reduce((sum, p) => sum + p.monthly_revenue, 0);
    });
    return row;
  }).sort((a, b) => {
    const sumA = countries.reduce((s, c) => s + (a[c] as number), 0);
    const sumB = countries.reduce((s, c) => s + (b[c] as number), 0);
    return sumB - sumA;
  }).slice(0, 15);

  const ROW_H = 40;

  return (
    <ResponsiveContainer width="100%" height={Math.max(320, data.length * ROW_H + 60)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tickFormatter={fmtRevenue} tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="label"
          width={200}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.length > 28 ? v.slice(0, 27) + "…" : v}
        />
        <Tooltip
          formatter={(v: unknown, name: unknown) => [fmtRevenue(v as number), name as string]}
          labelFormatter={(label: unknown) => {
            const row = data.find((d) => d.label === label);
            return row ? String(row.category) : String(label);
          }}
          contentStyle={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 8, maxWidth: 340 }}
        />
        <Legend />
        {countries.map((c) => (
          <Bar key={c} dataKey={c} stackId="a" fill={colorMap[c]} maxBarSize={26} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─── 4. 国家分布（饼图：各国月销售额占比）─── */
function CountryPieChart({ summary }: { summary: AnalysisSummary }) {
  const data = summary.countries.map((c, i) => ({
    name: c.country,
    value: c.total_monthly_revenue,
    color: COUNTRY_COLORS[i % COUNTRY_COLORS.length],
  }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="name"
            cx="50%" cy="50%" innerRadius={70} outerRadius={110}
            paddingAngle={3}
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: unknown) => [fmtRevenue(v as number), "月销售额"]}
            contentStyle={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 8 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
        {summary.countries.map((c, i) => (
          <div key={c.country} className="flex items-center gap-2">
            <span
              className="inline-block size-3 rounded-full shrink-0"
              style={{ backgroundColor: COUNTRY_COLORS[i % COUNTRY_COLORS.length] }}
            />
            <span className="font-medium">{c.country}</span>
            <span className="tabular-nums text-muted-foreground">
              {((c.total_monthly_revenue / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── 推荐概况卡片行 ─── */
function SummaryCards({ summary }: { summary: AnalysisSummary }) {
  const rec = summary.recommendation_breakdown;
  const cards = [
    { label: "🔥 Strong Opportunity", color: "text-rec-strong" },
    { label: "✅ Recommended",        color: "text-rec-recommended" },
    { label: "⚠ Observe",            color: "text-rec-observe" },
    { label: "❌ Avoid",              color: "text-rec-avoid" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map(({ label, color }) => (
        <Card key={label}>
          <CardContent className="pt-4 pb-3 flex flex-col gap-1">
            <span className={`text-2xl font-semibold tabular-nums ${color}`}>
              {rec[label] ?? 0}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">{label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── 主图表面板 ─── */
interface ChartsDashboardProps {
  products: ScoredProduct[];
  summary: AnalysisSummary;
}

export function ChartsDashboard({ products, summary }: ChartsDashboardProps) {
  return (
    <div className="flex flex-col gap-5">
      <SummaryCards summary={summary} />
      <Card>
        <CardHeader>
          <CardTitle>可视化分析</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ranking">
            <TabsList>
              <TabsTrigger value="ranking">产品排名</TabsTrigger>
              <TabsTrigger value="hhi">HHI 分布</TabsTrigger>
              <TabsTrigger value="market">市场规模</TabsTrigger>
              <TabsTrigger value="country">国家分布</TabsTrigger>
              <TabsTrigger value="wordcloud">词云分析</TabsTrigger>
            </TabsList>
            <TabsContent value="ranking" className="pt-4">
              <RankingChart products={products} />
            </TabsContent>
            <TabsContent value="hhi" className="pt-4">
              <HHIScatterChart products={products} />
            </TabsContent>
            <TabsContent value="market" className="pt-4">
              <MarketSizeChart products={products} />
            </TabsContent>
            <TabsContent value="country" className="pt-4">
              <CountryPieChart summary={summary} />
            </TabsContent>
            <TabsContent value="wordcloud" className="pt-4">
              <WordCloudTab products={products} topN={100} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
