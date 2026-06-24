"use client";

import { useRef, useState } from "react";
import { Upload, X, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CountryFile } from "@/lib/types";

const DEFAULT_COUNTRIES = ["德国", "法国", "意大利", "英国", "美国"];

interface FileUploadProps {
  onAnalyze: (files: CountryFile[]) => void;
  loading: boolean;
}

export function FileUpload({ onAnalyze, loading }: FileUploadProps) {
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedCount = Object.values(files).filter(Boolean).length;

  function setFile(country: string, file: File | undefined) {
    setFiles((prev) => ({ ...prev, [country]: file }));
  }

  function handleAnalyze() {
    const countryFiles: CountryFile[] = DEFAULT_COUNTRIES.filter((c) => files[c]).map((c) => ({
      country: c,
      file: files[c]!,
    }));
    onAnalyze(countryFiles);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>导入各国市场数据</CardTitle>
        <CardDescription>
          每个国家上传一份Excel，不要求全部上传齐；表头不用手动改，系统会自动识别中英文字段
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {DEFAULT_COUNTRIES.map((country) => {
            const file = files[country];
            return (
              <div
                key={country}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-12 shrink-0 text-sm font-medium text-foreground">
                    {country}
                  </span>
                  {file ? (
                    <span className="flex items-center gap-1.5 min-w-0 text-sm text-muted-foreground">
                      <FileSpreadsheet className="size-4 shrink-0 text-rec-strong" />
                      <span className="truncate">{file.name}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">未上传</span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <input
                    ref={(el) => {
                      inputRefs.current[country] = el;
                    }}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => setFile(country, e.target.files?.[0])}
                  />
                  {file ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setFile(country, undefined);
                        if (inputRefs.current[country]) inputRefs.current[country]!.value = "";
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => inputRefs.current[country]?.click()}
                    >
                      <Upload />
                      选择文件
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          className="mt-4 w-full"
          disabled={selectedCount === 0 || loading}
          onClick={handleAnalyze}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" />
              正在分析 {selectedCount} 个国家的数据...
            </>
          ) : (
            `开始分析${selectedCount > 0 ? `（已选 ${selectedCount} 国）` : ""}`
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
