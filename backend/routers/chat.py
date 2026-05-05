from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models.database import get_db
from models.conversation import Conversation, Message
from schemas.chat import (
    ConversationCreate,
    ConversationResponse,
    ConversationDetail,
    MessageResponse,
)

router = APIRouter(prefix="/api", tags=["chat"])


# ── 健康检查 ──

@router.get("/health")
def health_check():
    return {"status": "ok"}


# ── 对话 CRUD ──

@router.post("/conversations", response_model=ConversationResponse)
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    conv = Conversation(title=body.title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/conversations", response_model=list[ConversationResponse])
def list_conversations(db: Session = Depends(get_db)):
    return db.query(Conversation).order_by(Conversation.updated_at.desc()).all()


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    return conv


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    db.delete(conv)
    db.commit()
    return {"status": "deleted"}
