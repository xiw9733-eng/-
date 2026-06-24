import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analyze, wordcloud

app = FastAPI(
    title="跨境选品四要素分析 API",
    description="模块1 Excel导入 → 模块2 四要素打分 → 模块3 推荐引擎 → 模块4 数据由前端可视化",
    version="0.1.0",
)

cors_origins_str = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
cors_origins = [o.strip() for o in cors_origins_str.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(wordcloud.router)


@app.get("/")
def root():
    return {"status": "ok", "service": "market-analyzer-backend"}


@app.get("/api/health")
def health():
    return {"status": "ok", "cors_origins": cors_origins}
