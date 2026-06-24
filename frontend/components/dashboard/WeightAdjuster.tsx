"use client";

import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Weights, DEFAULT_WEIGHTS } from "@/lib/types";

interface WeightAdjusterProps {
  weights: Weights;
  onChange: (weights: Weights) => void;
}

const DIMENSIONS: { key: keyof Weights; label: string; hint: string }[] = [
  { key: "growth", label: "增速", hint: "growth_rate 同比/环比增长" },
  { key: "market_size", label: "市场容量", hint: "monthly_revenue 月销售额" },
  { key: "competition", label: "竞争度", hint: "1 - HHI，越分散分越高" },
  { key: "profit_margin", label: "利润率", hint: "profit_margin" },
];

export function WeightAdjuster({ weights, onChange }: WeightAdjusterProps) {
  const total = weights.growth + weights.market_size + weights.competition + weights.profit_margin || 1;

  function handleSlide(key: keyof Weights, value: number) {
    onChange({ ...weights, [key]: value / 100 });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>权重调整</CardTitle>
          <CardDescription>拖动滑块改变四要素在总分里的占比，结果实时刷新</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_WEIGHTS)}>
          <RotateCcw className="size-3.5" />
          重置
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5">
          {DIMENSIONS.map(({ key, label, hint }) => {
            const pct = Math.round((weights[key] / total) * 100);
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {hint} · 占比 {pct}%
                  </span>
                </div>
                <Slider
                  value={[weights[key] * 100]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={([v]) => handleSlide(key, v)}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
