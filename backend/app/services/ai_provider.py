from abc import ABC, abstractmethod
import base64
from dataclasses import dataclass
from typing import Iterator, List, Optional

from google import genai
from google.genai import types

from app.core.config import get_settings


@dataclass
class ChatHistoryTurn:
    role: str
    content: str


@dataclass
class AttachmentData:
    name: str
    mime_type: str
    data_base64: Optional[str] = None
    text_content: Optional[str] = None


@dataclass
class StreamChunk:
    text: str = ""
    token_usage: Optional[int] = None


class BaseAIProvider(ABC):
    """Modular provider abstraction allowing Gemini, OpenAI, or Ollama implementations."""

    @abstractmethod
    def stream_chat(
        self,
        history: List[ChatHistoryTurn],
        user_message: str,
        system_instruction: str,
        attachment: Optional[AttachmentData] = None,
    ) -> Iterator[StreamChunk]:
        raise NotImplementedError


class GeminiProvider(BaseAIProvider):
    def __init__(self, api_key: str, model_name: str):
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError(
                "GEMINI_API_KEY is not configured in backend environment variables."
            )
        self.client = genai.Client(api_key=api_key)
        self.model_name = model_name

    def stream_chat(
        self,
        history: List[ChatHistoryTurn],
        user_message: str,
        system_instruction: str,
        attachment: Optional[AttachmentData] = None,
    ) -> Iterator[StreamChunk]:
        contents: List[types.Content] = []
        for turn in history:
            if turn.role == "system":
                continue
            role = "model" if turn.role == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=turn.content)]))

        user_parts: List[types.Part] = []
        if attachment:
            if attachment.data_base64 and (
                attachment.mime_type.startswith("image/")
                or attachment.mime_type == "application/pdf"
            ):
                raw_bytes = base64.b64decode(attachment.data_base64)
                user_parts.append(
                    types.Part.from_bytes(data=raw_bytes, mime_type=attachment.mime_type)
                )
            if attachment.text_content:
                user_parts.append(
                    types.Part.from_text(
                        text=f"Attached document ({attachment.name}):\n\n{attachment.text_content}"
                    )
                )

        if user_message.strip():
            user_parts.append(types.Part.from_text(text=user_message))
        elif attachment:
            user_parts.append(
                types.Part.from_text(
                    text=f'Please analyze and summarize the attached file "{attachment.name}".'
                )
            )

        contents.append(types.Content(role="user", parts=user_parts))

        response_stream = self.client.models.generate_content_stream(
            model=self.model_name,
            contents=contents,
            config=types.GenerateContentConfig(system_instruction=system_instruction),
        )

        for chunk in response_stream:
            usage = None
            if getattr(chunk, "usage_metadata", None) and getattr(
                chunk.usage_metadata, "total_token_count", None
            ):
                usage = chunk.usage_metadata.total_token_count
            yield StreamChunk(text=chunk.text or "", token_usage=usage)


def get_ai_provider() -> BaseAIProvider:
    settings = get_settings()
    provider_name = settings.AI_PROVIDER.lower().strip()
    if provider_name == "gemini":
        return GeminiProvider(api_key=settings.GEMINI_API_KEY, model_name=settings.GEMINI_MODEL)
    raise ValueError(f"Unsupported AI provider configured: {provider_name}")
