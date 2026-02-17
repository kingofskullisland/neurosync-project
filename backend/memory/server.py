"""
NeuroSync Memory System — FastAPI Server
API bridge exposing memory ingestion, retrieval, media upload, and chat.

Run:
    uvicorn backend.memory.server:app --host 0.0.0.0 --port 8001

Environment Variables:
    DATABASE_URL          PostgreSQL connection string (required)
    MEDIA_STORAGE_PATH    Local directory for uploaded media (default: ./media)
    LLAMA_URL             Llama 3 server URL (default: http://localhost:8080)
"""

import os
import uuid
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiofiles
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .memory_manager import MemoryManager
from .agent_brain import AgentBrain
from .models import MediaAsset, get_engine, get_session_factory

# ─── Configuration ────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neurosync:neurosync@localhost:5432/neurosync",
)
MEDIA_STORAGE_PATH = Path(os.getenv("MEDIA_STORAGE_PATH", "./media"))
LLAMA_URL = os.getenv("LLAMA_URL", "http://localhost:8080")

logger = logging.getLogger("neurosync.server")

# ─── App ──────────────────────────────────────────────────────────
app = FastAPI(
    title="NeuroSync Memory Server",
    description="Semantic memory ingestion, retrieval, media upload, and RAG chat.",
    version="1.0.0",
)

# CORS — allow Expo dev servers and LAN devices
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Singletons (initialized on startup) ─────────────────────────
memory_manager: Optional[MemoryManager] = None
agent_brain: Optional[AgentBrain] = None
_db_session_factory = None


@app.on_event("startup")
async def startup():
    global memory_manager, agent_brain, _db_session_factory

    # Ensure media directory exists
    MEDIA_STORAGE_PATH.mkdir(parents=True, exist_ok=True)

    # Initialize MemoryManager
    logger.info("Initializing MemoryManager …")
    memory_manager = MemoryManager(database_url=DATABASE_URL)

    # Session factory for direct DB access (media assets)
    engine = get_engine(DATABASE_URL)
    _db_session_factory = get_session_factory(engine)

    # Initialize AgentBrain
    logger.info("Initializing AgentBrain …")
    agent_brain = AgentBrain(
        memory_manager=memory_manager,
        llama_url=LLAMA_URL,
    )

    logger.info("NeuroSync Memory Server ready.")


# ─── Request / Response Models ────────────────────────────────────

class IngestRequest(BaseModel):
    text: str
    role: str = "user"
    device_id: str = "unknown"
    user_id: str = "default"
    timestamp: Optional[str] = None


class IngestResponse(BaseModel):
    status: str = "accepted"
    message: str = "Interaction queued for embedding."


class RetrieveRequest(BaseModel):
    query: str
    limit: int = 5
    tag: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"
    device_id: str = "unknown"


# ─── Background Task ─────────────────────────────────────────────

def _background_ingest(user_id: str, text: str, role: str, device_id: str):
    """
    Run the full embedding + DB insertion in the background.
    This keeps the /ingest endpoint non-blocking.
    """
    try:
        memory_manager.save_interaction(
            user_id=user_id,
            text=text,
            role=role,
            device_id=device_id,
        )
        logger.info(f"Background ingest completed for user={user_id}")
    except Exception as e:
        logger.error(f"Background ingest failed: {e}")


# ─── Endpoints ────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check."""
    return {
        "status": "online",
        "memory_manager": "ready" if memory_manager else "not_initialized",
        "agent_brain": "ready" if agent_brain else "not_initialized",
    }


@app.post("/v1/memory/ingest", response_model=IngestResponse)
async def ingest_memory(request: IngestRequest, background_tasks: BackgroundTasks):
    """
    Ingest a new interaction into semantic memory.

    The embedding generation happens in the background so the
    response is returned immediately (200 OK).
    """
    if not memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager not initialized")

    background_tasks.add_task(
        _background_ingest,
        user_id=request.user_id,
        text=request.text,
        role=request.role,
        device_id=request.device_id,
    )

    return IngestResponse()


@app.post("/v1/memory/retrieve")
async def retrieve_memory(request: RetrieveRequest):
    """
    Retrieve the top-N most relevant memory snippets for a query.

    Returns context chunks with similarity scores and timestamps.
    """
    if not memory_manager:
        raise HTTPException(status_code=503, detail="MemoryManager not initialized")

    try:
        results = memory_manager.recall_memories(
            query_text=request.query,
            limit=request.limit,
            tag_filter=request.tag,
        )
        return {"results": results, "count": len(results)}
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v1/media/upload")
async def upload_media(file: UploadFile = File(...)):
    """
    Upload an image or audio file.

    Saves the file to the local SSD and inserts metadata into media_assets.
    The cortex_worker will later process it and generate a description.
    """
    if not _db_session_factory:
        raise HTTPException(status_code=503, detail="Database not initialized")

    # Validate media type
    content_type = file.content_type or ""
    if content_type.startswith("image/"):
        media_type = "image"
    elif content_type.startswith("audio/"):
        media_type = "audio"
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported media type: {content_type}. Use image/* or audio/*.",
        )

    # Generate unique filename
    ext = Path(file.filename).suffix if file.filename else ".bin"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_path = MEDIA_STORAGE_PATH / unique_name

    # Stream file to disk and compute hash
    sha256 = hashlib.sha256()
    async with aiofiles.open(save_path, "wb") as f:
        while chunk := await file.read(1024 * 64):  # 64KB chunks
            sha256.update(chunk)
            await f.write(chunk)

    file_hash = sha256.hexdigest()

    # Insert metadata into DB
    session = _db_session_factory()
    try:
        asset = MediaAsset(
            filename=file.filename or unique_name,
            filepath=str(save_path.resolve()),
            media_type=media_type,
            file_hash=file_hash,
        )
        session.add(asset)
        session.commit()

        return {
            "status": "uploaded",
            "asset_id": str(asset.id),
            "filename": asset.filename,
            "media_type": media_type,
            "path": str(save_path),
        }
    except Exception as e:
        session.rollback()
        # Clean up the file if DB insert fails
        save_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to save asset: {e}")
    finally:
        session.close()


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    """
    RAG-powered chat endpoint using AgentBrain (HyDE).

    Generates a response using the full HyDE pipeline:
      1. Generate hypothetical answer
      2. Embed and search semantic memory
      3. Assemble context and generate final response

    Returns the full response (non-streaming).
    For streaming, use the /v1/chat/stream WebSocket.
    """
    if not agent_brain:
        raise HTTPException(status_code=503, detail="AgentBrain not initialized")

    try:
        # Collect the full streamed response
        full_response = ""
        async for token in agent_brain.generate_response(request.message):
            full_response += token

        # Also save the interaction to memory
        if memory_manager:
            try:
                memory_manager.save_interaction(
                    user_id=request.user_id,
                    text=request.message,
                    role="user",
                    device_id=request.device_id,
                )
                memory_manager.save_interaction(
                    user_id=request.user_id,
                    text=full_response,
                    role="assistant",
                    device_id="server",
                )
            except Exception as e:
                logger.warning(f"Failed to save chat to memory: {e}")

        return {
            "response": full_response,
            "model": "llama3",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0},
        }
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Entrypoint ───────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "memory.server:app",
        host="0.0.0.0",
        port=8082,
        reload=True,
    )
