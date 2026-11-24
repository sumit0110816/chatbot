from datetime import datetime, timezone
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.rate_limit import chat_rate_limiter
from app.core.security import get_current_user
from app.database.session import SessionLocal, get_db
from app.models.models import Conversation, Message, User, UserSettings
from app.schemas.schemas import (
    ConversationCreateRequest,
    ConversationDetailResponse,
    ConversationRenameRequest,
    ConversationResponse,
    MessageCreateRequest,
    MessageResponse,
)
from app.services.ai_provider import AttachmentData, ChatHistoryTurn, get_ai_provider

router = APIRouter()


def _get_owned_conversation(db: Session, conv_id: int, user_id: int) -> Conversation:
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conv_id, Conversation.user_id == user_id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conv


def _build_system_instruction(db: Session, user_id: int) -> str:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    language = settings.language if settings else "English"
    prefs = settings.response_preferences if settings else "Balanced, clear, and well-structured"
    return (
        "You are NOVA AI, an intelligent, thoughtful, and reliable AI assistant. "
        f"Preferred response language: {language}. "
        f"User response style preference: {prefs}. "
        "Format answers cleanly using Markdown when helpful, including fenced code blocks with language tags for code."
    )


def _derive_title(prompt: str, attachment_name: Optional[str]) -> str:
    base = prompt.strip() or (f"Analysis: {attachment_name}" if attachment_name else "New Conversation")
    single_line = " ".join(base.split())
    return f"{single_line[:49].strip()}..." if len(single_line) > 52 else single_line


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


@router.get("")
def list_conversations(
    q: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Conversation).filter(Conversation.user_id == current_user.id)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        query = query.outerjoin(Message).filter(
            or_(Conversation.title.ilike(pattern), Message.content.ilike(pattern))
        ).distinct()

    convs = query.order_by(Conversation.updated_at.desc(), Conversation.id.desc()).all()
    results = []
    for c in convs:
        msg_count = db.query(func.count(Message.id)).filter(Message.conversation_id == c.id).scalar() or 0
        last_msg = (
            db.query(Message.content)
            .filter(Message.conversation_id == c.id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .first()
        )
        results.append(
            ConversationResponse(
                id=c.id,
                user_id=c.user_id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=msg_count,
                last_message=last_msg[0] if last_msg else None,
            )
        )
    return {"conversations": results}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = (payload.title or "New Conversation").strip()[:120] or "New Conversation"
    conv = Conversation(user_id=current_user.id, title=title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"conversation": ConversationResponse.model_validate(conv)}


@router.delete("")
def clear_all_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(Conversation).filter(Conversation.user_id == current_user.id).delete()
    db.commit()
    return {"ok": True, "message": "All conversations cleared."}


@router.get("/{conv_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_owned_conversation(db, conv_id, current_user.id)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    return ConversationDetailResponse(
        conversation=ConversationResponse.model_validate(conv),
        messages=[MessageResponse.model_validate(m) for m in messages],
    )


@router.patch("/{conv_id}")
def rename_conversation(
    conv_id: int,
    payload: ConversationRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_owned_conversation(db, conv_id, current_user.id)
    conv.title = payload.title.strip()[:120]
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conv)
    return {"conversation": ConversationResponse.model_validate(conv)}


@router.delete("/{conv_id}")
def delete_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_owned_conversation(db, conv_id, current_user.id)
    db.delete(conv)
    db.commit()
    return {"ok": True}


@router.get("/{conv_id}/messages")
def list_messages(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_conversation(db, conv_id, current_user.id)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    return {"messages": [MessageResponse.model_validate(m) for m in messages]}


@router.post("/{conv_id}/messages")
def send_message(
    conv_id: int,
    payload: MessageCreateRequest,
    _rate=Depends(chat_rate_limiter),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = _get_owned_conversation(db, conv_id, current_user.id)
    text_content = payload.content.strip()
    if not text_content and not payload.attachment:
        raise HTTPException(status_code=400, detail="Message content or an attachment is required.")

    if payload.editMessageId:
        target = (
            db.query(Message)
            .filter(Message.id == payload.editMessageId, Message.conversation_id == conv_id)
            .first()
        )
        if not target or target.role != "user":
            raise HTTPException(status_code=400, detail="Only existing user messages can be edited.")
        db.query(Message).filter(Message.conversation_id == conv_id, Message.id >= target.id).delete()
        db.flush()

    prior_rows = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    history = [ChatHistoryTurn(role=m.role, content=m.content) for m in prior_rows]

    display_content = text_content or f"Analyze attached document: {payload.attachment.name}"
    now = datetime.now(timezone.utc)
    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=display_content,
        attachment_name=payload.attachment.name if payload.attachment else None,
        attachment_mime=payload.attachment.mimeType if payload.attachment else None,
        created_at=now,
    )
    db.add(user_msg)

    if conv.title == "New Conversation" and len(prior_rows) == 0:
        conv.title = _derive_title(display_content, payload.attachment.name if payload.attachment else None)
    conv.updated_at = now
    db.commit()
    db.refresh(user_msg)
    db.refresh(conv)

    system_instruction = _build_system_instruction(db, current_user.id)
    attachment_data = (
        AttachmentData(
            name=payload.attachment.name,
            mime_type=payload.attachment.mimeType,
            data_base64=payload.attachment.dataBase64,
            text_content=payload.attachment.textContent,
        )
        if payload.attachment
        else None
    )

    user_msg_dict = MessageResponse.model_validate(user_msg).model_dump()
    conv_dict = ConversationResponse.model_validate(conv).model_dump()

    def event_stream():
        yield _sse("user_message", user_msg_dict)
        yield _sse("conversation", conv_dict)

        full_text = []
        token_usage = None
        try:
            provider = get_ai_provider()
            for chunk in provider.stream_chat(
                history=history,
                user_message=display_content,
                system_instruction=system_instruction,
                attachment=attachment_data,
            ):
                if chunk.text:
                    full_text.append(chunk.text)
                    yield _sse("chunk", {"text": chunk.text})
                if chunk.token_usage is not None:
                    token_usage = chunk.token_usage

            final_content = "".join(full_text).strip()
            if not final_content:
                yield _sse("error", {"error": "The model returned an empty response."})
                return

            with SessionLocal() as stream_db:
                assistant_now = datetime.now(timezone.utc)
                assistant_msg = Message(
                    conversation_id=conv_id,
                    role="assistant",
                    content=final_content,
                    token_usage=token_usage,
                    created_at=assistant_now,
                )
                stream_db.add(assistant_msg)
                c = stream_db.query(Conversation).filter(Conversation.id == conv_id).first()
                if c:
                    c.updated_at = assistant_now
                stream_db.commit()
                stream_db.refresh(assistant_msg)
                yield _sse(
                    "done",
                    {"message": MessageResponse.model_validate(assistant_msg).model_dump()},
                )
        except Exception as exc:
            yield _sse("error", {"error": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/{conv_id}/regenerate")
def regenerate_response(
    conv_id: int,
    _rate=Depends(chat_rate_limiter),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_conversation(db, conv_id, current_user.id)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
        .all()
    )
    if not messages:
        raise HTTPException(status_code=400, detail="Cannot regenerate an empty conversation.")

    last_user_idx = next((i for i in range(len(messages) - 1, -1, -1) if messages[i].role == "user"), -1)
    if last_user_idx == -1:
        raise HTTPException(status_code=400, detail="No user prompt found to regenerate from.")

    last_user_msg = messages[last_user_idx]
    history = [ChatHistoryTurn(role=m.role, content=m.content) for m in messages[:last_user_idx]]

    db.query(Message).filter(
        Message.conversation_id == conv_id, Message.id > last_user_msg.id
    ).delete()
    db.commit()

    system_instruction = _build_system_instruction(db, current_user.id)

    def event_stream():
        full_text = []
        token_usage = None
        try:
            provider = get_ai_provider()
            for chunk in provider.stream_chat(
                history=history,
                user_message=last_user_msg.content,
                system_instruction=system_instruction,
            ):
                if chunk.text:
                    full_text.append(chunk.text)
                    yield _sse("chunk", {"text": chunk.text})
                if chunk.token_usage is not None:
                    token_usage = chunk.token_usage

            final_content = "".join(full_text).strip()
            if not final_content:
                yield _sse("error", {"error": "The model returned an empty response."})
                return

            with SessionLocal() as stream_db:
                assistant_now = datetime.now(timezone.utc)
                assistant_msg = Message(
                    conversation_id=conv_id,
                    role="assistant",
                    content=final_content,
                    token_usage=token_usage,
                    created_at=assistant_now,
                )
                stream_db.add(assistant_msg)
                c = stream_db.query(Conversation).filter(Conversation.id == conv_id).first()
                if c:
                    c.updated_at = assistant_now
                stream_db.commit()
                stream_db.refresh(assistant_msg)
                yield _sse(
                    "done",
                    {"message": MessageResponse.model_validate(assistant_msg).model_dump()},
                )
        except Exception as exc:
            yield _sse("error", {"error": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")
