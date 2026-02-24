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
from .core.prompts import get_system_prompt, Persona
from .schemas.responses import ChatRequest, ChatResponse, HealthResponse, ModelListResponse

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

# Models imported from schemas




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
        "status": "online",
        "system": "NEUROSYNC_ROUTER",
        "ollama": "connected" if ollama_status == "online" else "unreachable",
        "bridge": "online"
    }


@app.get("/models")
async def list_models():
    """List available Ollama models"""
    ollama_url = os.getenv("OLLAMA_BASE_URL", settings.OLLAMA_URL)
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Proxy to Ollama /api/tags
            response = await client.get(f"{ollama_url}/api/tags")
            
            if response.status_code == 200:
                data = response.json()
                data = response.json()
                # Pass through the full model objects as expected by mobile app
                return {"models": data.get("models", [])}
            else:
                logger.error(f"Ollama /api/tags returned {response.status_code}")
                return {"error": f"Ollama returned {response.status_code}", "models": []}
                
    except Exception as e:
        logger.error(f"Failed to fetch models: {e}")
        return {"error": str(e), "models": []}




@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat endpoint with Hadron persona, conversation history, and proper config."""
    
    decision = await ai_router.route(
        query=request.prompt,
        has_image=bool(request.image),
        has_screen=bool(request.screen),
        image_data=request.image
    )
    
    decision_score = decision.complexity
    
    # Use Hadron persona config (temperature=0.7, max_tokens=2048)
    hadron_config = get_system_prompt(Persona.HADRON)
    system_prompt = hadron_config.prompt.format(system_state="Status: Nominal")
    
    # Build message list: system → history → current prompt
    messages = [{"role": "system", "content": system_prompt}]
    
    # Inject conversation history for multi-turn context
    if request.history:
        for msg in request.history[-20:]:  # Last 20 turns to avoid context overflow
            messages.append({"role": msg.role, "content": msg.content})
    
    messages.append({"role": "user", "content": request.prompt})
    
    # Use client-specified model or fall back to config
    model = request.model or settings.OLLAMA_MODEL
    
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": hadron_config.temperature,
            "num_predict": hadron_config.max_tokens,
        }
    }

    try:
        base_url = settings.OLLAMA_URL.rstrip('/')
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{base_url}/api/chat", 
                json=payload
            )
            
        if response.status_code == 200:
            data = response.json()
            ai_text = data.get('message', {}).get('content', "Err: Empty buffer.")
            
            return ChatResponse(
                response=ai_text,
                persona="HADRON",
                routing="LOCAL",
                model_used=model,
                complexity_score=decision_score
            )
        else:
            return ChatResponse(
                response=f"[COMM-FAILURE] Ollama returned {response.status_code}",
                persona="ERROR",
                routing="NONE",
                model_used="none",
                complexity_score=decision_score
            )

    except Exception as e:
        logger.error(f"Chat Error: {e}")
        return ChatResponse(
            response=f"[COMM-FAILURE] {str(e)}",
            persona="ERROR",
            routing="NONE",
            model_used="none",
            complexity_score=0.0
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
