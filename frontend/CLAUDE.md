@AGENTS.md

# 项目：跨境选品四要素分析工具

## 技术栈
前端：Next.js 16 + TypeScript + Tailwind v4 + Recharts（shadcn组件手动安装，不通过CLI）
后端：FastAPI + Pandas（Python）

## 目录结构
- `frontend/` → Vercel部署，入口 `app/page.tsx`
- `backend/` → Railway/Render部署，入口 `app/main.py`
- `backend/tests/` → 端到端测试 + 样本Excel（`germany_sample.xlsx` / `us_sample.xlsx`）

## 核心数据流
上传Excel → POST /api/analyze → 返回 ScoredProduct[] → 前端渲染

## 关键约定
1. 权重调整在前端本地计算（`lib/scoring.ts`），不打API，逻辑与后端 `services/recommendation.py` 保持一致
2. HHI按 (country, category) 分组计算，组内品牌数<3时 hhi_reliable=False
3. Excel表头用别名匹配（`services/excel_parser.py` 的 COLUMN_ALIASES），加新表头在这里加
4. 四档推荐：🔥 Strong Opportunity / ✅ Recommended / ⚠ Observe / ❌ Avoid
5. CSS变量颜色：--rec-strong / --rec-recommended / --rec-observe / --rec-avoid，不要硬编码颜色值

## 本地启动
后端：`cd backend && uvicorn app.main:app --reload`（需要Python 3.11+）
前端：`cd frontend && npm run dev`（需要Node 18+）
后端测试：`cd backend && python tests/test_pipeline.py`

## 常见坑 / 注意事项
1. **shadcn 组件不能用 CLI 安装**（`npx shadcn add` 会报网络错误），需要新组件直接手写到 `components/ui/` 里
2. **Tailwind v4 语法不同**：CSS 变量在 `globals.css` 的 `@theme inline {}` 块里声明，不是 `tailwind.config.ts` 里，别去改 tailwind 配置文件
3. **Recharts 的 Tooltip `formatter` 参数类型是 `(v: unknown)`**，不是 `(v: number)`，否则 TypeScript 报错
