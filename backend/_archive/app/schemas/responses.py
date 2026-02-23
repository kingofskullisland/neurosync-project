from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    prompt: str
    model: Optional[str] = None
    image: Optional[str] = None  # Base64
    screen: Optional[str] = None  # Base64
    history: Optional[List[ChatMessage]] = None  # Prior conversation turns

class ChatResponse(BaseModel):
    response: str
    persona: str = "HADRON"
    routing: str = "LOCAL"
    model_used: str
    complexity_score: float

class ModelInfo(BaseModel):
    name: str
    details: Dict[str, Any]

class ModelListResponse(BaseModel):
    models: List[ModelInfo]

class HealthResponse(BaseModel):
    status: str
    system: str
    ollama: Optional[str] = None
    bridge: str

