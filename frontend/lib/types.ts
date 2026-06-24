export interface ScoredProduct {
  asin: string;
  title: string;
  brand: string;
  category: string;
  country: string;
  price: number;
  monthly_sales: number;
  monthly_revenue: number;
  rating: number | null;
  reviews: number | null;
  growth_rate: number | null;
  profit_margin: number | null;
  source_file: string | null;

  growth_score: number | null;
  market_size_score: number | null;
  competition_score: number | null;
  margin_score: number | null;

  hhi: number | null;
  hhi_group_size: number | null;
  hhi_reliable: boolean;

  total_score: number | null;
  recommendation: string | null;
}

export interface CountrySummary {
  country: string;
  product_count: number;
  avg_growth_rate: number | null;
  avg_profit_margin: number | null;
  total_monthly_revenue: number;
}

export interface AnalysisSummary {
  total_products: number;
  countries: CountrySummary[];
  recommendation_breakdown: Record<string, number>;
  parse_warnings: string[];
}

export interface Weights {
  growth: number;
  market_size: number;
  competition: number;
  profit_margin: number;
}

export interface Thresholds {
  strong_opportunity: number;
  recommended: number;
  observe: number;
}

export interface AnalysisResponse {
  products: ScoredProduct[];
  summary: AnalysisSummary;
  weights_used: Weights;
  thresholds_used: Thresholds;
}

export const DEFAULT_WEIGHTS: Weights = {
  growth: 0.25,
  market_size: 0.25,
  competition: 0.25,
  profit_margin: 0.25,
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  strong_opportunity: 0.75,
  recommended: 0.55,
  observe: 0.35,
};

export const RECOMMENDATION_LABELS = {
  strong: "🔥 Strong Opportunity",
  recommended: "✅ Recommended",
  observe: "⚠ Observe",
  avoid: "❌ Avoid",
} as const;

export interface CountryFile {
  country: string;
  file: File;
}
