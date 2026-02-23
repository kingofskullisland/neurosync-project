"""
NeuroSync Router - Decision Matrix & Orchestration
Routes queries to appropriate AI backend based on complexity
"""

from typing import AsyncGenerator, Optional
from dataclasses import dataclass
from enum import Enum
import logging

from .config import settings
from .scorer import scorer, ComplexityScore
from .prompts import get_prompt_for_route, get_system_prompt, Persona
from .governor import governor

logger = logging.getLogger(__name__)


class RouteTarget(str, Enum):
    LOCAL = "LOCAL"    # -> OVERSEER (Llama 3.2)
    OLLAMA = "OLLAMA"  # -> SERVITOR (Gemma 2b)
    GEMINI = "GEMINI"  # -> OMNISSIAH (Gemini 3)
    CLAUDE = "CLAUDE"  # -> Fallback


@dataclass
class RouteDecision:
    target: RouteTarget
    reason: str
    complexity: float
    persona: str
    context: Optional[str] = None


@dataclass
class StreamChunk:
    content: str
    route: RouteTarget
    done: bool = False


class Router:
    """
    Central routing orchestrator (The Cognitive Governor's Actuator).
    """
    
    def __init__(self):
        self._gemini_available = bool(settings.GEMINI_API_KEY)
        self._claude_available = bool(settings.ANTHROPIC_API_KEY)
        self._ollama_available = True # Assume true, let governor handle check
    
    async def check_backends(self) -> dict[str, bool]:
        """Check availability of all backends"""
        # Governor can handle this, but keeping for legacy compatibility
        return {
            'gemini': self._gemini_available,
            'ollama': True
        }
    
    async def route(
        self,
        query: str,
        has_image: bool = False,
        has_screen: bool = False,
        image_data: Optional[str] = None,
        rag_context: Optional[str] = None,
    ) -> RouteDecision:
        """Determine route using Cognitive Governor"""
        
        # 1. Ask Governor for Intent (Returns RoutingDecision object)
        gov_decision = governor.classify_intent(query)
        
        target = RouteTarget.LOCAL
        
        if gov_decision.target == "OMNISSIAH":
            if self._gemini_available:
                target = RouteTarget.GEMINI
            else:
                target = RouteTarget.OLLAMA # Fallback
                
        elif gov_decision.target == "SERVITOR":
            target = RouteTarget.OLLAMA
            
        elif gov_decision.target == "OVERSEER":
            target = RouteTarget.LOCAL
            
        return RouteDecision(
            target=target,
            reason=gov_decision.complexity.reasoning,
            complexity=gov_decision.complexity.score, # Float, usually
            persona=gov_decision.persona,
            context=rag_context,
        )

    async def execute(
        self,
        query: str,
        decision: RouteDecision,
        image_data: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Execute query on the determined backend"""
        
        # Inject System State into Prompt
        system_state = await governor.get_system_state()
        
        full_query = query
        if decision.context:
            full_query = f"Context:\n{decision.context}\n\nQuery:\n{query}"
        
        target = decision.target
        
        if target == RouteTarget.LOCAL:
            async for chunk in self._handle_local(query, system_state):
                yield chunk
        
        elif target == RouteTarget.OLLAMA:
            async for chunk in self._call_servitor(full_query, system_state):
                yield chunk
                
        elif target == RouteTarget.GEMINI:
            async for chunk in self._call_omnissiah(full_query, image_data, system_state):
                yield chunk

    async def _handle_local(self, query: str, system_state: str) -> AsyncGenerator[StreamChunk, None]:
        """Handle simple queries via OVERSEER (Llama 3.2)"""
        
        query_lower = query.lower().strip()
        
        # Hardcoded Reflexes (Nexus-Link logic emulation)
        if query_lower in ('hello', 'hi', 'hey', 'status'):
            yield StreamChunk(f"[Reflex] {system_state}", RouteTarget.LOCAL, done=True)
            return

        # Use Hadron Overseer -> Llama 3.2
        prompt_config = get_prompt_for_route("LOCAL", enable_cot=False)
        formatted_prompt = prompt_config.prompt.replace("{system_state}", system_state)
        
        import httpx
        url = f"{settings.OLLAMA_URL}/api/chat"
        
        messages = [
            {"role": "system", "content": formatted_prompt},
            {"role": "user", "content": query}
        ]
        
        payload = {
            "model": settings.OLLAMA_MODEL, # OVERSEER MODEL
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": prompt_config.temperature,
                "num_predict": prompt_config.max_tokens,
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    async for line in response.aiter_lines():
                        if line:
                            import json
                            try:
                                data = json.loads(line)
                                delta = data.get("message", {})
                                text = delta.get("content", "")
                                if text:
                                    yield StreamChunk(text, RouteTarget.LOCAL)
                            except: pass
            yield StreamChunk("", RouteTarget.LOCAL, done=True)
        except Exception as e:
            logger.error(f"Overseer error: {e}")
            yield StreamChunk(f"Overseer Offline: {e}", RouteTarget.LOCAL, done=True)

    async def _call_servitor(self, query: str, system_state: str) -> AsyncGenerator[StreamChunk, None]:
        """Call SERVITOR (Gemma) via Ollama"""
        import httpx
        
        # Use Servitor Prompt
        prompt_config = get_prompt_for_route("OLLAMA", enable_cot=False)
        formatted_prompt = prompt_config.prompt.replace("{system_state}", system_state)
        
        url = f"{settings.OLLAMA_URL}/api/chat"
        
        messages = [
            {"role": "system", "content": formatted_prompt},
            {"role": "user", "content": query}
        ]
        
        payload = {
            "model": settings.GEMMA_MODEL, # SERVITOR MODEL
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": prompt_config.temperature,
                "num_predict": prompt_config.max_tokens,
            }
        }
        
        # Wrapper Header (Hadron's Disapproval)
        yield StreamChunk("[Hadron] Delegating to Servitor-Unit. Processing:\n\n", RouteTarget.OLLAMA)
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload) as response:
                    async for line in response.aiter_lines():
                        if line:
                            import json
                            try:
                                data = json.loads(line)
                                delta = data.get("message", {})
                                text = delta.get("content", "")
                                if text:
                                    yield StreamChunk(text, RouteTarget.OLLAMA)
                            except: pass
            yield StreamChunk("", RouteTarget.OLLAMA, done=True)
        except Exception as e:
            yield StreamChunk(f"Servitor Malfunction: {e}", RouteTarget.OLLAMA, done=True)

    async def _call_omnissiah(self, query: str, image_data: str, system_state: str) -> AsyncGenerator[StreamChunk, None]:
        """Call OMNISSIAH (Gemini)"""
        import httpx
        
        prompt_config = get_prompt_for_route("GEMINI", enable_cot=True)
        formatted_prompt = prompt_config.prompt.replace("{system_state}", system_state)
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:streamGenerateContent"
        
        parts = [{"text": query}]
        if image_data:
             parts.append({"inline_data": {"mime_type": "image/jpeg", "data": image_data}})

        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "systemInstruction": {"parts": [{"text": formatted_prompt}]},
            "generationConfig": {
                "temperature": prompt_config.temperature,
                "maxOutputTokens": prompt_config.max_tokens,
            }
        }
        
        yield StreamChunk("[Communing with the Omnissiah...] \n\n", RouteTarget.GEMINI)
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", url, json=payload, params={"key": settings.GEMINI_API_KEY}) as response:
                     async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            import json
                            data = json.loads(line[6:])
                            if "candidates" in data:
                                text = data["candidates"][0]["content"]["parts"][0].get("text", "")
                                if text:
                                    yield StreamChunk(text, RouteTarget.GEMINI)
            yield StreamChunk("", RouteTarget.GEMINI, done=True)
        except Exception as e:
            yield StreamChunk(f"Omnissiah Unreachable: {e}", RouteTarget.GEMINI, done=True)
            
    # Legacy stubs to satisfy interface if needed, or remove them
    async def _call_ollama(self, query): pass # Replaced by _call_servitor
    async def _call_gemini(self, query, image): pass # Replaced by _call_omnissiah
    async def _call_claude(self, query, image): pass # Deprecated

router = Router()
