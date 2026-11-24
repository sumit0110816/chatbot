from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, conversations, users
from app.core.config import get_settings
from app.database.session import Base, engine


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Ensure schema exists when starting locally if migrations haven't been manually invoked
    Base.metadata.create_all(bind=engine)
    yield


settings = get_settings()

app = FastAPI(
    title="NOVA AI API",
    description="Backend API for NOVA AI Intelligent Chatbot Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "nova-ai-fastapi"}


app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["Conversations"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
