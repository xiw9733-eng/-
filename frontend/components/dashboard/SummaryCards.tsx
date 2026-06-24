"use client";

import { AnalysisSummary, RECOMMENDATION_LABELS } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { formatRevenue, formatPercent } from "@/lib/format";
import { Package, Globe, TrendingUp, DollarSign } from "lucide-react";

interface SummaryCardsProps {
  summary: AnalysisSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const totalRevenue = summary.countries.reduce((s, c) => s + c.total_monthly_revenue, 0);
  const avgGrowth = summary.countries.flatMap((c) =>
    c.avg_growth_rate !== null ? [c.avg_growth_rate] : []
  );
  const avgGrowthVal = avgGrowth.length > 0
    ? avgGrowth.reduce((s, v) => s + v, 0) / avgGrowth.length
    : null;

  const strong = summary.recommendation_breakdown[RECOMMENDATION_LABELS.strong] ?? 0;
  const recommended = summary.recommendation_breakdown[RECOMMENDATION_LABELS.recommended] ?? 0;

  const stats = [
    {
      label: "产品总数",
      value: summary.total_products,
      sub: `${summary.countries.length} 个国家`,
      icon: Package,
    },
    {
      label: "月总销售额",
      value: formatRevenue(totalRevenue),
      sub: "全部国家合计",
      icon: DollarSign,
    },
    {
      label: "平均增速",
      value: formatPercent(avgGrowthVal),
      sub: "有增速数据的品类均值",
      icon: TrendingUp,
    },
    {
      label: "优质机会",
      value: strong + recommended,
      sub: `🔥 ${strong} · ✅ ${recommended}`,
      icon: Globe,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map(({ label, value, sub, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                  {value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
              </div>
              <div className="rounded-md bg-secondary p-2">
                <Icon className="size-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
