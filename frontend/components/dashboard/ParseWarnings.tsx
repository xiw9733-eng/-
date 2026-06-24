"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface ParseWarningsProps {
  warnings: string[];
}

export function ParseWarnings({ warnings }: ParseWarningsProps) {
  const [dismissed, setDismissed] = useState(false);
  if (!warnings.length || dismissed) return null;

  return (
    <div className="rounded-lg border border-rec-observe/30 bg-rec-observe/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rec-observe" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-rec-observe">
              解析时有 {warnings.length} 个提示
            </p>
            <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
