import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import analyze, wordcloud

app = FastAPI(
    title="跨境选品四要素分析 API",
    description="模块1 Excel导入 → 模块2 四要素打分 → 模块3 推荐引擎 → 模块4 数据由前端可视化",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://productselection.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
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
    return {"status": "ok"}
