from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user, hash_password, verify_password
from app.database.session import get_db
from app.models.models import User, UserSettings
from app.schemas.schemas import (
    ChangePasswordRequest,
    UpdateProfileRequest,
    UpdateSettingsRequest,
    UserResponse,
    UserSettingsResponse,
)

router = APIRouter()

DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$")


@router.get("/profile")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    settings_row = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    return {
        "user": UserResponse.model_validate(current_user),
        "settings": UserSettingsResponse.model_validate(settings_row) if settings_row else None,
    }


@router.patch("/profile")
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    changed = False
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
        changed = True

    if payload.profile_image is not None:
        if payload.profile_image == "":
            current_user.profile_image = None
            changed = True
        elif DATA_IMAGE_RE.match(payload.profile_image) and len(payload.profile_image) <= 2_000_000:
            current_user.profile_image = payload.profile_image
            changed = True
        else:
            raise HTTPException(
                status_code=400,
                detail="Profile image must be a valid PNG, JPEG, WEBP, or GIF image under 1.5MB.",
            )

    if not changed:
        raise HTTPException(status_code=400, detail="No profile fields provided to update.")

    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    return {"user": UserResponse.model_validate(current_user)}


@router.patch("/password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="New passwords do not match.")
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "message": "Password updated successfully."}


@router.patch("/settings")
def update_settings(
    payload: UpdateSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings_row = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if not settings_row:
        settings_row = UserSettings(user_id=current_user.id)
        db.add(settings_row)

    if payload.theme is not None:
        settings_row.theme = payload.theme
    if payload.language is not None:
        settings_row.language = payload.language.strip()
    if payload.response_preferences is not None:
        settings_row.response_preferences = payload.response_preferences.strip()

    settings_row.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings_row)
    return {"settings": UserSettingsResponse.model_validate(settings_row)}
