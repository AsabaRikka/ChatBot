from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.database import engine, Base
from routers.chat import router as chat_router

# 自动建表
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ChatBot API", version="1.0.0")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(chat_router)
