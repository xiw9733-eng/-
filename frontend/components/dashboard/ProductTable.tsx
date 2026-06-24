"use client";

import { useState } from "react";
import { ArrowUpDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ScoredProduct } from "@/lib/types";

type BadgeVariant = "strong" | "recommended" | "observe" | "avoid";

function getRecBadgeVariant(rec: string | null): BadgeVariant {
  if (!rec) return "avoid";
  if (rec.includes("Strong")) return "strong";
  if (rec.includes("Recommended")) return "recommended";
  if (rec.includes("Observe")) return "observe";
  return "avoid";
}

function fmt(v: number | null, isPercent = false): string {
  if (v === null) return "—";
  if (isPercent) return `${(v * 100).toFixed(1)}%`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(1);
}

type SortKey = "total_score" | "monthly_revenue" | "growth_rate" | "hhi";

interface ProductTableProps {
  products: ScoredProduct[];
}

export function ProductTable({ products }: ProductTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("total_score");
  const [asc, setAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc((v) => !v);
    else { setSortKey(key); setAsc(false); }
  }

  const sorted = [...products].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return asc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const SortBtn = ({ col }: { col: SortKey }) => (
    <Button variant="ghost" size="sm" className="-ml-2 h-7 text-xs" onClick={() => toggleSort(col)}>
      <ArrowUpDown className="size-3" />
    </Button>
  );

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8 text-center">#</TableHead>
            <TableHead>ASIN</TableHead>
            <TableHead>标题</TableHead>
            <TableHead>品牌</TableHead>
            <TableHead>品类</TableHead>
            <TableHead>国家</TableHead>
            <TableHead>月销售额 <SortBtn col="monthly_revenue" /></TableHead>
            <TableHead>增速 <SortBtn col="growth_rate" /></TableHead>
            <TableHead>HHI <SortBtn col="hhi" /></TableHead>
            <TableHead>利润率</TableHead>
            <TableHead>总分 <SortBtn col="total_score" /></TableHead>
            <TableHead>推荐</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((p, i) => (
            <TableRow key={`${p.asin}-${p.country}-${i}`}>
              <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
              <TableCell className="font-mono text-xs">{p.asin}</TableCell>
              <TableCell className="max-w-[200px] truncate text-sm" title={p.title}>
                {p.title}
              </TableCell>
              <TableCell className="text-sm">{p.brand}</TableCell>
              <TableCell className="text-sm">{p.category}</TableCell>
              <TableCell className="text-sm">{p.country}</TableCell>
              <TableCell className="tabular-nums text-sm">{fmt(p.monthly_revenue)}</TableCell>
              <TableCell className="tabular-nums text-sm">{fmt(p.growth_rate, true)}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1 tabular-nums text-sm">
                  {fmt(p.hhi)}
                  {!p.hhi_reliable && p.hhi !== null && (
                    <AlertTriangle className="size-3 text-rec-observe" aria-label="样本过少，仅供参考" />
                  )}
                </span>
              </TableCell>
              <TableCell className="tabular-nums text-sm">{fmt(p.profit_margin, true)}</TableCell>
              <TableCell className="tabular-nums text-sm font-medium">
                {p.total_score?.toFixed(3) ?? "—"}
              </TableCell>
              <TableCell>
                <Badge variant={getRecBadgeVariant(p.recommendation)}>
                  {p.recommendation ?? "—"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
