
"""
NeuroSync Cognitive Governor
Orchestrates routing between Tier 2 (Overseer/Hadron), Tier 3 (Servitor/Gemma), and Tier 4 (Omnissiah/Gemini).
"""
import httpx
import logging
import json
from typing import Optional, Dict, Any
from .config import settings

logger = logging.getLogger(__name__)

from dataclasses import dataclass

@dataclass
class Complexity:
    score: float
    reasoning: str = ""

@dataclass
class RoutingDecision:
    target: str
    complexity: Complexity
    persona: str = "OVERSEER"

class CognitiveGovernor:
    """
    Decides which model handles a request based on complexity and intent.
    Injects live system state into prompts to prevent hallucinations.
    """
    
    def __init__(self):
        self.ollama_url = f"{settings.OLLAMA_URL}/api/tags"
        
    async def get_system_state(self) -> str:
        """
        Fetch real-time system state for prompt injection.
        """
        models = []
        gpu_status = "Unknown"
        
        try:
            # check OLLAMA
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(self.ollama_url)
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m["name"] for m in data.get("models", [])]
                    
            # In a real scenario, we might check nvidia-smi or rocm-smi
            # For now, hardcode the user's known hardware
            gpu_status = "AMD RX 6800 XT (Active)"
            
        except Exception as e:
            logger.error(f"State fetch failed: {e}")
            models = ["Connection Failed"]
            
        return f"System Status: Ollama Active. Models: {', '.join(models)}. Hardware: {gpu_status}. Mesh: Tailscale Active."

    def classify_intent(self, prompt: str) -> RoutingDecision:
        """
        Classifies prompt into a Tier.
        Returns: RoutingDecision
        """
        prompt_lower = prompt.lower()
        score = len(prompt.split()) / 50.0  # Simple heuristic
        
        # TIER 4: OMNISSIAH (Cloud/Gemini)
        if any(w in prompt_lower for w in ["research", "write a book", "deep analysis", "complex code", "architect", "study"]):
            if settings.GEMINI_API_KEY:
                return RoutingDecision(
                    target="OMNISSIAH",
                    complexity=Complexity(score=0.9, reasoning="High Logic Required"),
                    persona="ARCH_MAGOS"
                )
        
        # TIER 3: SERVITOR (Gemma 2b locally)
        if score > 0.3 or any(w in prompt_lower for w in ["explain", "tell me", "story", "chat"]):
            return RoutingDecision(
                target="SERVITOR",
                complexity=Complexity(score=score, reasoning="Conversational Task"),
                persona="SERVITOR"
            )
            
        # TIER 2: OVERSEER (Llama 3.2 locally)
        return RoutingDecision(
            target="OVERSEER",
            complexity=Complexity(score=0.1, reasoning="System/Command"),
            persona="OVERSEER"
        )

governor = CognitiveGovernor()
