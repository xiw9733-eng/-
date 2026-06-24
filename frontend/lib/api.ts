import { AnalysisResponse, CountryFile, Weights, Thresholds } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  detail: unknown;
  constructor(message: string, detail: unknown) {
    super(message);
    this.detail = detail;
  }
}

export async function analyzeFiles(
  countryFiles: CountryFile[],
  weights?: Weights,
  thresholds?: Thresholds
): Promise<AnalysisResponse> {
  const formData = new FormData();
  countryFiles.forEach(({ file }) => formData.append("files", file));
  formData.append("countries", countryFiles.map((c) => c.country).join(","));
  if (weights) formData.append("weights", JSON.stringify(weights));
  if (thresholds) formData.append("thresholds", JSON.stringify(thresholds));

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      typeof body.detail === "string" ? body.detail : "上传分析失败，请检查文件格式",
      body.detail
    );
  }

  return res.json();
}
