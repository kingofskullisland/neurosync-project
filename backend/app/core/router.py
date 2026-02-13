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
from .prompts import get_prompt_for_route, Persona


logger = logging.getLogger(__name__)


class RouteTarget(str, Enum):
    LOCAL = "LOCAL"
    GEMINI = "GEMINI"
    CLAUDE = "CLAUDE"
    OLLAMA = "OLLAMA"


@dataclass
class RouteDecision:
    target: RouteTarget
    reason: str
    complexity: ComplexityScore
    persona: str  # SPARK | CORE
    context: Optional[str] = None  # RAG context if any



@dataclass
class StreamChunk:
    content: str
    route: RouteTarget
    done: bool = False


class Router:
    """
    Central routing orchestrator.
    
    Decision flow:
    1. Score complexity
    2. Check RAG for relevant context
    3. Route to appropriate backend
    4. Stream response back
    """
    
    def __init__(self):
        self._gemini_available = bool(settings.GEMINI_API_KEY)
        self._claude_available = bool(settings.ANTHROPIC_API_KEY)
        self._ollama_checked = False
        self._ollama_available = False
    
    async def check_backends(self) -> dict[str, bool]:
        """Check availability of all backends"""
        import httpx
        
        status = {
            'gemini': self._gemini_available,
            'claude': self._claude_available,
            'ollama': False,
        }
        
        # Check Ollama
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{settings.OLLAMA_URL}/api/tags")
                status['ollama'] = resp.status_code == 200
                self._ollama_available = status['ollama']
        except Exception:
            pass
        
        self._ollama_checked = True
        return status
    
    async def route(
        self,
        query: str,
        has_image: bool = False,
        has_screen: bool = False,
        image_data: Optional[str] = None,
        rag_context: Optional[str] = None,
    ) -> RouteDecision:
        """Determine route for a query"""
        
        context_tokens = len(rag_context.split()) if rag_context else 0
        
        # Score complexity
        complexity = scorer.score(
            query=query,
            has_image=has_image,
            has_screen=has_screen,
            context_tokens=context_tokens,
        )
        
        # Map recommendation to target
        rec = complexity.recommendation
        target, reason = self._resolve_target(rec, has_image)
        
        # Select persona based on complexity
        persona = Persona.CORE if complexity.score > 0.4 else Persona.SPARK

        
        return RouteDecision(
            target=target,
            reason=reason,
            complexity=complexity,
            persona=persona.value,
            context=rag_context,
        )

    
    def _resolve_target(
        self,
        recommendation: str,
        has_image: bool,
    ) -> tuple[RouteTarget, str]:
        """Resolve recommendation to available target with fallback"""
        
        if recommendation == 'local':
            return RouteTarget.LOCAL, "Low complexity, handled locally"
        
        if recommendation == 'gemini':
            if self._gemini_available:
                return RouteTarget.GEMINI, "Routed to Gemini (speed + multimodal)"
            if self._claude_available:
                return RouteTarget.CLAUDE, "Gemini unavailable, fallback to Claude"
            if self._ollama_available:
                return RouteTarget.OLLAMA, "Cloud unavailable, fallback to Ollama"
            return RouteTarget.LOCAL, "No backends available"
        
        if recommendation == 'claude':
            if self._claude_available:
                return RouteTarget.CLAUDE, "Routed to Claude (code/research)"
            if self._gemini_available:
                return RouteTarget.GEMINI, "Claude unavailable, fallback to Gemini"
            if self._ollama_available:
                return RouteTarget.OLLAMA, "Cloud unavailable, fallback to Ollama"
            return RouteTarget.LOCAL, "No backends available"
        
        # Default fallback chain
        if self._ollama_available:
            return RouteTarget.OLLAMA, "Using local Ollama"
        return RouteTarget.LOCAL, "Offline mode"
    
    async def execute(
        self,
        query: str,
        decision: RouteDecision,
        image_data: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Execute query on the determined backend"""
        
        # Prepend RAG context if available
        full_query = query
        if decision.context:
            full_query = f"Context:\n{decision.context}\n\nQuery:\n{query}"
        
        target = decision.target
        
        if target == RouteTarget.LOCAL:
            async for chunk in self._handle_local(query):
                yield chunk
        
        elif target == RouteTarget.GEMINI:
            async for chunk in self._call_gemini(full_query, image_data):
                yield chunk
        
        elif target == RouteTarget.CLAUDE:
            async for chunk in self._call_claude(full_query, image_data):
                yield chunk
        
        elif target == RouteTarget.OLLAMA:
            async for chunk in self._call_ollama(full_query):
                yield chunk
    
    async def _handle_local(self, query: str) -> AsyncGenerator[StreamChunk, None]:
        """Handle simple queries locally"""
        
        query_lower = query.lower().strip()
        
        # Simple responses (no AI needed)
        if query_lower in ('hello', 'hi', 'hey'):
            yield StreamChunk("Yo, choom. What's the run?", RouteTarget.LOCAL, done=True)
            return
        
        if 'time' in query_lower and ('what' in query_lower or 'current' in query_lower):
            from datetime import datetime
            now = datetime.now().strftime("%H:%M:%S")
            yield StreamChunk(f"Current time: {now}", RouteTarget.LOCAL, done=True)
            return
        
        if 'date' in query_lower and ('what' in query_lower or 'today' in query_lower):
            from datetime import datetime
            today = datetime.now().strftime("%Y-%m-%d")
            yield StreamChunk(f"Today's date: {today}", RouteTarget.LOCAL, done=True)
            return
        
        # Fallback: route to Ollama if available (with Spark persona)
        if self._ollama_available:
            # Get Spark prompt for fast, concise responses
            prompt_config = get_prompt_for_route("LOCAL", enable_cot=False)
            full_query = f"{prompt_config.prompt}\n\nUser Query: {query}"
            
            # Call Ollama with Spark personality
            import httpx
            url = f"{settings.OLLAMA_URL}/api/generate"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "prompt": full_query,
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
                                data = json.loads(line)
                                text = data.get("response", "")
                                if text:
                                    yield StreamChunk(text, RouteTarget.LOCAL)
                                if data.get("done"):
                                    break
                yield StreamChunk("", RouteTarget.LOCAL, done=True)
            except Exception as e:
                logger.error(f"Local Ollama error: {e}")
                yield StreamChunk("Link unstable. Can't reach local chrome.", RouteTarget.LOCAL, done=True)
        else:
            yield StreamChunk(
                "Data corrupted. Need backend sync.",
                RouteTarget.LOCAL,
                done=True
            )

    
    async def _call_gemini(
        self,
        query: str,
        image_data: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Call Google Gemini API with streaming"""
        import httpx
        
        if not settings.GEMINI_API_KEY:
            yield StreamChunk("Gemini API key not configured", RouteTarget.GEMINI, done=True)
            return
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:streamGenerateContent"
        
        parts = [{"text": query}]
        if image_data:
            parts.append({
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": image_data
                }
            })
        
        # Get CORE persona for heavy cloud tasks
        prompt_config = get_prompt_for_route("GEMINI", enable_cot=False)
        
        payload = {
            "contents": [{
                "role": "user",
                "parts": parts
            }],
            "systemInstruction": {
                "parts": [{"text": prompt_config.prompt}]
            },
            "generationConfig": {
                "temperature": prompt_config.temperature,
                "maxOutputTokens": prompt_config.max_tokens,
            }
        }

        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    url,
                    json=payload,
                    params={"key": settings.GEMINI_API_KEY},
                ) as response:
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
            logger.error(f"Gemini error: {e}")
            yield StreamChunk(f"Gemini error: {str(e)}", RouteTarget.GEMINI, done=True)
    
    async def _call_claude(
        self,
        query: str,
        image_data: Optional[str] = None,
    ) -> AsyncGenerator[StreamChunk, None]:
        """Call Anthropic Claude API with streaming"""
        import httpx
        
        if not settings.ANTHROPIC_API_KEY:
            yield StreamChunk("Claude API key not configured", RouteTarget.CLAUDE, done=True)
            return
        
        url = "https://api.anthropic.com/v1/messages"
        
        content = [{"type": "text", "text": query}]
        if image_data:
            content.insert(0, {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": image_data,
                }
            })
        
        # Get CORE persona for heavy cloud tasks
        prompt_config = get_prompt_for_route("CLAUDE", enable_cot=False)
        
        payload = {
            "model": settings.CLAUDE_MODEL,
            "max_tokens": prompt_config.max_tokens,
            "temperature": prompt_config.temperature,
            "system": prompt_config.prompt,  # System prompt injection
            "stream": True,
            "messages": [{"role": "user", "content": content}]
        }

        
        headers = {
            "x-api-key": settings.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            import json
                            data = json.loads(line[6:])
                            if data.get("type") == "content_block_delta":
                                text = data.get("delta", {}).get("text", "")
                                if text:
                                    yield StreamChunk(text, RouteTarget.CLAUDE)
            
            yield StreamChunk("", RouteTarget.CLAUDE, done=True)
            
        except Exception as e:
            logger.error(f"Claude error: {e}")
            yield StreamChunk(f"Claude error: {str(e)}", RouteTarget.CLAUDE, done=True)
    
    async def _call_ollama(self, query: str) -> AsyncGenerator[StreamChunk, None]:
        """Call local Ollama with streaming"""
        import httpx
        
        # Get CORE prompt with Chain-of-Thought for heavy tasks
        prompt_config = get_prompt_for_route("OLLAMA", enable_cot=True)
        
        # Prepend system prompt to query
        full_query = f"{prompt_config.prompt}\n\nUser Query: {query}"
        
        url = f"{settings.OLLAMA_URL}/api/generate"
        payload = {
            "model": settings.OLLAMA_MODEL,
            "prompt": full_query,
            "stream": True,
            "options": {
                "temperature": prompt_config.temperature,
                "num_predict": prompt_config.max_tokens,
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT) as client:
                async with client.stream("POST", url, json=payload) as response:
                    async for line in response.aiter_lines():
                        if line:
                            import json
                            data = json.loads(line)
                            text = data.get("response", "")
                            if text:
                                yield StreamChunk(text, RouteTarget.OLLAMA)
                            if data.get("done"):
                                break
            
            yield StreamChunk("", RouteTarget.OLLAMA, done=True)
            
        except Exception as e:
            logger.error(f"Ollama error: {e}")
            yield StreamChunk(f"Ollama error: {str(e)}", RouteTarget.OLLAMA, done=True)



# Singleton
router = Router()
