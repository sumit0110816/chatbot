from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str
    terms_accepted: bool

    @field_validator("terms_accepted")
    @classmethod
    def check_terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the Terms and Conditions.")
        return v


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    remember_me: bool = False


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: str
    profile_image: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    theme: Literal["light", "dark"]
    language: str
    response_preferences: str
    created_at: datetime
    updated_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    settings: UserSettingsResponse


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    profile_image: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str


class UpdateSettingsRequest(BaseModel):
    theme: Optional[Literal["light", "dark"]] = None
    language: Optional[str] = Field(default=None, min_length=2, max_length=40)
    response_preferences: Optional[str] = Field(default=None, min_length=2, max_length=500)


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = Field(default="New Conversation", max_length=120)


class ConversationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0
    last_message: Optional[str] = None


class AttachmentInput(BaseModel):
    name: str = Field(max_length=200)
    mimeType: str = Field(max_length=120)
    dataBase64: Optional[str] = None
    textContent: Optional[str] = None


class MessageCreateRequest(BaseModel):
    content: str = Field(default="", max_length=32000)
    attachment: Optional[AttachmentInput] = None
    editMessageId: Optional[int] = None


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    conversation_id: int
    role: Literal["user", "assistant", "system"]
    content: str
    attachment_name: Optional[str] = None
    attachment_mime: Optional[str] = None
    token_usage: Optional[int] = None
    created_at: datetime


class ConversationDetailResponse(BaseModel):
    conversation: ConversationResponse
    messages: List[MessageResponse]
