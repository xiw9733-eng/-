import { RECOMMENDATION_LABELS } from "@/lib/types";

type BadgeVariant = "strong" | "recommended" | "observe" | "avoid" | "outline";

export function recommendationVariant(rec: string | null): BadgeVariant {
  if (!rec) return "outline";
  if (rec === RECOMMENDATION_LABELS.strong) return "strong";
  if (rec === RECOMMENDATION_LABELS.recommended) return "recommended";
  if (rec === RECOMMENDATION_LABELS.observe) return "observe";
  return "avoid";
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatRevenue(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function formatScore(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v.toFixed(3);
}
