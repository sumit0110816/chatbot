from datetime import datetime, timedelta, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.rate_limit import auth_rate_limiter
from app.core.security import (
    bearer_scheme,
    create_access_token,
    extract_token_from_request,
    get_current_user,
    hash_password,
    hash_reset_token,
    verify_password,
)
from app.database.session import get_db
from app.models.models import PasswordResetToken, RevokedToken, User, UserSettings
from app.schemas.schemas import (
    AuthResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserLoginRequest,
    UserRegisterRequest,
)

router = APIRouter()


def _set_auth_cookie(request: Request, response: Response, token: str, max_age_seconds: int) -> None:
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        key="nova_session",
        value=token,
        max_age=max_age_seconds,
        path="/",
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserRegisterRequest,
    request: Request,
    response: Response,
    _rate=Depends(auth_rate_limiter),
    db: Session = Depends(get_db),
):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    normalized_email = payload.email.strip().lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email address already exists.")

    user = User(
        full_name=payload.full_name.strip(),
        email=normalized_email,
        password_hash=hash_password(payload.password),
        is_active=True,
    )
    db.add(user)
    db.flush()

    settings_row = UserSettings(user_id=user.id)
    db.add(settings_row)
    db.commit()
    db.refresh(user)
    db.refresh(settings_row)

    token, max_age = create_access_token(user.id, user.email, remember_me=False)
    _set_auth_cookie(request, response, token, max_age)

    return AuthResponse(access_token=token, user=user, settings=settings_row)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: UserLoginRequest,
    request: Request,
    response: Response,
    _rate=Depends(auth_rate_limiter),
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email, User.is_active.is_(True)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    settings_row = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if not settings_row:
        settings_row = UserSettings(user_id=user.id)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)

    token, max_age = create_access_token(user.id, user.email, remember_me=payload.remember_me)
    _set_auth_cookie(request, response, token, max_age)

    return AuthResponse(access_token=token, user=user, settings=settings_row)


@router.post("/demo", response_model=AuthResponse)
def demo_login(
    request: Request,
    response: Response,
    _rate=Depends(auth_rate_limiter),
    db: Session = Depends(get_db),
):
    demo_email = "demo@nova-ai.local"
    user = db.query(User).filter(User.email == demo_email).first()
    if not user:
        user = User(
            full_name="Alex Mercer (Demo)",
            email=demo_email,
            password_hash=hash_password(secrets.token_hex(24)),
            is_active=True,
        )
        db.add(user)
        db.flush()
        db.add(UserSettings(user_id=user.id))
        db.commit()
        db.refresh(user)

    settings_row = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    token, max_age = create_access_token(user.id, user.email, remember_me=False)
    _set_auth_cookie(request, response, token, max_age)
    return AuthResponse(access_token=token, user=user, settings=settings_row)


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    token = extract_token_from_request(request, credentials)
    if token:
        cfg = get_settings()
        try:
            decoded = jwt.decode(token, cfg.jwt_secret, algorithms=[cfg.ALGORITHM])
            jti = decoded.get("jti")
            exp_ts = decoded.get("exp")
            if jti:
                expires_at = (
                    datetime.fromtimestamp(exp_ts, tz=timezone.utc)
                    if exp_ts
                    else datetime.now(timezone.utc) + timedelta(days=1)
                )
                if not db.query(RevokedToken).filter(RevokedToken.jti == jti).first():
                    db.add(RevokedToken(jti=jti, expires_at=expires_at))
                    db.commit()
        except JWTError:
            pass

    response.delete_cookie(key="nova_session", path="/")
    return {"ok": True, "message": "Logged out successfully."}


@router.get("/me")
def me(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    token = extract_token_from_request(request, credentials)
    settings_row = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    return {"access_token": token, "user": current_user, "settings": settings_row}


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    _rate=Depends(auth_rate_limiter),
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email, User.is_active.is_(True)).first()
    settings = get_settings()

    preview_token = None
    if user:
        raw_token = secrets.token_hex(24)
        token_row = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        db.add(token_row)
        db.commit()
        if not settings.SMTP_HOST:
            preview_token = raw_token

    response_data = {
        "message": "If an account exists for that email address, a password reset link has been generated."
    }
    if preview_token:
        response_data["reset_token"] = preview_token
    return response_data


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    _rate=Depends(auth_rate_limiter),
    db: Session = Depends(get_db),
):
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match.")

    token_hash = hash_reset_token(payload.token.strip())
    reset_row = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == token_hash)
        .first()
    )

    if not reset_row or reset_row.used_at is not None:
        raise HTTPException(
            status_code=400,
            detail="This password reset link is invalid or has already been used.",
        )

    expires_at = reset_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="This password reset link has expired. Please request a new one.",
        )

    user = db.query(User).filter(User.id == reset_row.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    now = datetime.now(timezone.utc)
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = now
    reset_row.used_at = now
    db.commit()

    return {"message": "Your password has been reset. You can now log in with your new password."}
