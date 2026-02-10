"""
NeuroSync Router - FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import json
import logging
import httpx
import os

from .core.config import settings
from .core.router import router as ai_router, RouteTarget
from .core.scorer import scorer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events"""
    logger.info("NeuroSync Router starting...")
    backends = await ai_router.check_backends()
    logger.info(f"Backend status: {backends}")
    yield
    logger.info("NeuroSync Router shutting down...")


app = FastAPI(
    title="NeuroSync Router",
    description="Tier 2 — Intelligent AI Request Router",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# MODELS
# =============================================================================

class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    image: Optional[str] = None  # Base64
    screen: Optional[str] = None  # Base64


class ChatResponse(BaseModel):
    response: str
    route: str
    complexity: float
    reasoning: str  # Routing decision explanation
    persona: str  # SPARK | CORE



class HealthResponse(BaseModel):
    status: str
    system: str
    backends: dict
    ollama: Optional[str] = None  # 'connected' | 'unreachable' for mobile app



# =============================================================================
# REST ENDPOINTS
# =============================================================================

@app.get("/health")
async def health():
    """Health check with backend status"""
    ollama_url = os.getenv("OLLAMA_BASE_URL", settings.OLLAMA_URL)
    ollama_status = "offline"
    
    try:
        # Ping /api/tags because it's lightweight and proves Ollama is up
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{ollama_url}/api/tags")
            if resp.status_code == 200:
                ollama_status = "online"
    except:
        pass  # Status remains offline

    return {
        "bridge": "online",
        "ollama": ollama_status
    }


@app.get("/models")
async def list_models():
    """List available Ollama models"""
    ollama_url = os.getenv("OLLAMA_BASE_URL", settings.OLLAMA_URL)
    
    try:
        async with httpx.AsyncClient() as client:
            # CRITICAL FIX: Ollama uses /api/tags, not /models
            response = await client.get(f"{ollama_url}/api/tags")
            
            if response.status_code == 200:
                data = response.json()
                # Extract just the model names for the UI
                model_names = [m["name"] for m in data.get("models", [])]
                return {"models": model_names}
            else:
                return {"error": f"Ollama returned {response.status_code}"}
                
    except Exception as e:
        return {"error": str(e)}




@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Non-streaming chat endpoint.
    For streaming, use WebSocket /ws
    """
    decision = await ai_router.route(
        query=req.prompt,
        has_image=bool(req.image),
        has_screen=bool(req.screen),
        image_data=req.image,
    )
    
    # Collect full response
    response_parts = []
    async for chunk in ai_router.execute(req.prompt, decision, req.image):
        response_parts.append(chunk.content)
    
    return ChatResponse(
        response="".join(response_parts),
        route=decision.target.value,
        complexity=decision.complexity.score,
        reasoning=decision.complexity.reasoning,
        persona=decision.persona,
    )



@app.get("/score")
async def score_query(query: str):
    """Debug endpoint: score a query without executing"""
    result = scorer.score(query)
    return {
        "score": result.score,
        "factors": result.factors,
        "recommendation": result.recommendation,
    }


# =============================================================================
# WEBSOCKET (STREAMING)
# =============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for streaming AI responses.
    
    Client sends:
    {
        "type": "text" | "voice" | "image" | "screen",
        "payload": "...",
        "streamId": "...",
        "context": {"battery": 85, "screen": "..."}
    }
    
    Server sends:
    {
        "type": "token" | "complete" | "error",
        "content": "...",
        "route": "LOCAL" | "GEMINI" | "CLAUDE" | "OLLAMA",
        "streamId": "..."
    }
    """
    await websocket.accept()
    logger.info("WebSocket client connected")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type", "text")
            payload = message.get("payload", "")
            stream_id = message.get("streamId", "default")
            context = message.get("context", {})
            
            # Determine content type
            has_image = msg_type == "image"
            has_screen = msg_type == "screen"
            image_data = payload if (has_image or has_screen) else None
            query = payload if msg_type == "text" else "Analyze this image"
            
            # Route the request
            decision = await ai_router.route(
                query=query,
                has_image=has_image,
                has_screen=has_screen,
                image_data=image_data,
            )
            
            logger.info(f"Routing to {decision.target.value}: {decision.reason}")
            
            # Stream response
            async for chunk in ai_router.execute(query, decision, image_data):
                await websocket.send_text(json.dumps({
                    "type": "complete" if chunk.done else "token",
                    "content": chunk.content,
                    "route": chunk.route.value,
                    "streamId": stream_id,
                }))
    
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "content": str(e),
                "route": "LOCAL",
                "streamId": "error",
            }))
        except:
            pass


# =============================================================================
# ENTRYPOINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
