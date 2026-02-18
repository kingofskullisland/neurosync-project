"""
NeuroSync Router - Configuration
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment"""
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8082
    DEBUG: bool = False
    
    # Ollama (Local)
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11435")
    OLLAMA_MODEL: str = "llama3.2:latest"
    GEMMA_MODEL: str = "gemma2:latest"
    OLLAMA_TIMEOUT: int = 120
    
    # Gemini
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-pro"
    
    # Claude
    ANTHROPIC_API_KEY: Optional[str] = None
    CLAUDE_MODEL: str = "claude-3-5-sonnet-20241022"
    
    # RAG
    CHROMA_PERSIST_DIR: str = "./chroma_db"
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    
    # Routing thresholds
    COMPLEXITY_THRESHOLD: float = 0.4
    
    # Security
    DANGEROUS_ACTIONS: list = [
        "delete", "remove", "rm ", "rmdir",
        "format", "sudo", "chmod 777",
        "DROP TABLE", "TRUNCATE"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
