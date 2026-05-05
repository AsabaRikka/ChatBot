from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ── 请求模型 ──

class ConversationCreate(BaseModel):
    title: Optional[str] = "新对话"


class ChatRequest(BaseModel):
    conversation_id: str
    content: str


# ── 响应模型 ──

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    reasoning_content: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse]

    class Config:
        from_attributes = True


class ChatStreamChunk(BaseModel):
    type: str  # "content" | "reasoning" | "done" | "error"
    data: str
