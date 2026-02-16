"""
NeuroSync Memory System — AgentBrain
Advanced RAG (Retrieval-Augmented Generation) chat agent with HyDE
(Hypothetical Document Embeddings) for improved semantic recall.

The HyDE technique:
  1. User asks a question
  2. We ask Llama 3 to generate a HYPOTHETICAL answer (no DB lookup)
  3. We embed that hypothetical answer
  4. We search semantic_memory with the hypothetical embedding
  5. The retrieved chunks are much more relevant than embedding the raw question
  6. We construct a final prompt with real context and get the real answer

Why HyDE works:
  - Raw questions like "What was that architecture thing?" produce poor embeddings
  - A hypothetical answer like "The architecture diagram showed React components..."
    is semantically closer to the actual stored memory
  - This dramatically improves recall for vague or conversational queries

Environment Variables:
    LLAMA_URL   URL of the Llama 3 server (default: http://localhost:8080)
"""

import logging
import socket
from datetime import datetime, timezone
from typing import AsyncGenerator, Optional

import httpx
import psutil

logger = logging.getLogger("neurosync.brain")


# ─── System Prompts ───────────────────────────────────────────────

HYDE_PROMPT = """You are a helpful AI generating a hypothetical answer.
The user asked the following question. Write a detailed, plausible answer
as if you had perfect knowledge. Do NOT say "I don't know" — make up a
realistic, detailed response. This will be used for semantic search, so
include specific details, names, dates, and technical terms that a real
answer would contain.

Question: {question}

Hypothetical Answer:"""

SYSTEM_PROMPT = """You are NeuroSync — a helpful AI assistant with access to the user's external memory.
You can recall past conversations, images, audio transcripts, and daily summaries.
When answering, naturally incorporate relevant context from memory.
If the context doesn't help, answer from your general knowledge.
Always be concise, accurate, and helpful.

Context from memory:
{context}

Current time: {timestamp}"""


class AgentBrain:
    """
    The NeuroSync "Brain" — connects Llama 3 with the semantic memory system.

    Implements HyDE (Hypothetical Document Embeddings) for high-quality
    retrieval-augmented generation.
    
    Tailscale Smart Forwarding:
      - Detects Tailscale VPN interface (tailscale0/tun0)
      - Routes to cloud (100.110.208.79:8080) when VPN is active
      - Routes locally (localhost:8080) when VPN is down
      - Passes context to cloud for better responses
    """

    # Tailscale configuration
    TAILSCALE_IP = "100.110.208.79"
    TAILSCALE_PORT = 8080
    TAILSCALE_TIMEOUT = 0.3  # Quick check to avoid latency

    def __init__(
        self,
        memory_manager,
        llama_url: str = "http://localhost:8080",
        hyde_enabled: bool = True,
    ):
        """
        Args:
            memory_manager: An instance of MemoryManager for vector search.
            llama_url:      URL of the LOCAL Llama 3 completion server.
            hyde_enabled:   If True, use HyDE for improved recall. If False,
                            embed the raw query directly (faster but less accurate).
        """
        self.memory = memory_manager
        self.local_llama_url = llama_url.rstrip("/")
        self.cloud_llama_url = f"http://{self.TAILSCALE_IP}:{self.TAILSCALE_PORT}"
        self.hyde_enabled = hyde_enabled

        logger.info(
            f"AgentBrain initialized. Local: {self.local_llama_url}, "
            f"Cloud: {self.cloud_llama_url}, HyDE: {'enabled' if hyde_enabled else 'disabled'}"
        )

    # ─── Tailscale VPN Detection ──────────────────────────────────

    def is_tailscale_up(self) -> bool:
        """
        Checks if Tailscale VPN is active and reachable.

        Method:
          1. Check for tailscale0 or tun0 network interface (Linux/Android)
          2. Quick socket ping to cloud IP:port (300ms timeout)

        Returns:
            True if VPN is up and cloud is reachable, False otherwise.
        """
        try:
            # Step 1: Check for Tailscale interface
            interfaces = psutil.net_if_addrs()
            has_tailscale_if = "tailscale0" in interfaces or "tun0" in interfaces

            if not has_tailscale_if:
                return False

            # Step 2: Quick connectivity test
            socket.create_connection(
                (self.TAILSCALE_IP, self.TAILSCALE_PORT),
                timeout=self.TAILSCALE_TIMEOUT
            )
            logger.debug(f"Tailscale VPN detected: {self.TAILSCALE_IP}:{self.TAILSCALE_PORT}")
            return True

        except (OSError, socket.timeout) as e:
            logger.debug(f"Tailscale VPN not reachable: {e}")
            return False
        except Exception as e:
            logger.warning(f"Unexpected error in VPN detection: {e}")
            return False

    # ─── HyDE: Generate Hypothetical Answer ───────────────────────

    async def _generate_hypothetical_answer(self, question: str) -> str:
        """
        Step 1 of HyDE: Ask Llama 3 to hallucinate a plausible answer.

        This hypothetical answer is NOT shown to the user — it's only used
        to create a better embedding for semantic search.

        Args:
            question: The user's original question.

        Returns:
            A hypothetical answer string.
        """
        prompt = HYDE_PROMPT.format(question=question)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self.llama_url}/v1/chat/completions",
                    json={
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 256,
                        "temperature": 0.7,  # Some creativity for diverse embeddings
                        "stream": False,
                    },
                )
                response.raise_for_status()
                data = response.json()
                hypothetical = data["choices"][0]["message"]["content"].strip()

                logger.debug(
                    f"HyDE hypothetical ({len(hypothetical)} chars): "
                    f"{hypothetical[:100]}…"
                )
                return hypothetical

        except httpx.HTTPStatusError as e:
            logger.warning(f"HyDE generation failed (HTTP {e.response.status_code}). Falling back to raw query.")
            return question
        except Exception as e:
            logger.warning(f"HyDE generation failed: {e}. Falling back to raw query.")
            return question

    # ─── Context Assembly ─────────────────────────────────────────

    async def _retrieve_context(self, query: str, limit: int = 5) -> str:
        """
        Step 2-3 of HyDE: Embed the query (or hypothetical) and search memory.

        If HyDE is enabled:
          - Generate a hypothetical answer
          - Embed the hypothetical answer (not the raw question)
          - Search semantic_memory with that embedding

        If HyDE is disabled:
          - Embed the raw question directly

        Returns:
            Formatted context block with timestamps.
        """
        # ── HyDE: Generate hypothetical answer for better embedding ──
        if self.hyde_enabled:
            search_text = await self._generate_hypothetical_answer(query)
        else:
            search_text = query

        # ── Search semantic memory ────────────────────────────────
        try:
            memories = self.memory.recall_memories(
                query_text=search_text,
                limit=limit,
            )
        except Exception as e:
            logger.error(f"Memory recall failed: {e}")
            memories = []

        if not memories:
            return "(No relevant memories found.)"

        # ── Format context block ──────────────────────────────────
        context_lines = []
        for i, mem in enumerate(memories, 1):
            timestamp = mem.get("created_at", "unknown time")
            role = mem.get("role", "unknown")
            content = mem.get("content", "")
            device = mem.get("device_origin", "")
            similarity = mem.get("similarity", 0)
            tag = mem.get("tag", "")

            header = f"[Memory {i}] ({timestamp})"
            if tag:
                header += f" [tag: {tag}]"
            header += f" [sim: {similarity:.2f}]"

            context_lines.append(f"{header}")
            context_lines.append(f"  [{role}] {content}")
            if device:
                context_lines.append(f"  (from: {device})")
            context_lines.append("")

        return "\n".join(context_lines)

    # ─── Streaming Response ───────────────────────────────────────

    async def generate_response(
        self,
        user_message: str,
        limit: int = 5,
    ) -> AsyncGenerator[str, None]:
        """
        Full HyDE RAG pipeline with streaming output + Tailscale smart routing.

        Flow:
          1. Check if Tailscale VPN is active
          2. If VPN: route to cloud with context, else: local without context
          3. (HyDE) Generate hypothetical answer for the user's question
          4. Embed the hypothetical answer
          5. Search semantic_memory with that embedding
          6. Format retrieved chunks into a context block
          7. Construct system prompt with context
          8. Stream the final response from selected Llama 3 endpoint

        Args:
            user_message: The user's question/message.
            limit:        Max number of context chunks to retrieve.

        Yields:
            Tokens from Llama 3 as they arrive (for snappy UI).
        """
        # ── Step 0: Determine routing target ──────────────────────
        use_cloud = self.is_tailscale_up()
        target_url = self.cloud_llama_url if use_cloud else self.local_llama_url
        
        logger.info(
            f"Routing to: {'CLOUD' if use_cloud else 'LOCAL'} ({target_url})"
        )
        # ── Step 1-3: Retrieve context (with HyDE if enabled) ─────
        # Only fetch context for cloud (local saves compute)
        if use_cloud:
            context = await self._retrieve_context(user_message, limit=limit)
        else:
            context = "(Local processing — no context retrieval)"

        # ── Step 4: Construct system prompt ───────────────────────
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        system_prompt = SYSTEM_PROMPT.format(context=context, timestamp=now)

        # ── Step 5: Stream from Llama 3 ──────────────────────────
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream(
                    "POST",
                    f"{target_url}/v1/chat/completions",
                    json={
                        "messages": messages,
                        "max_tokens": 1024,
                        "temperature": 0.7,
                        "stream": True,
                    },
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        # SSE format: "data: {...}"
                        if not line.startswith("data: "):
                            continue

                        data_str = line[6:]  # Strip "data: " prefix
                        if data_str.strip() == "[DONE]":
                            break

                        try:
                            import json
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            token = delta.get("content", "")
                            if token:
                                yield token
                        except Exception:
                            continue

        except httpx.HTTPStatusError as e:
            error_msg = f"[Error: {'Cloud' if use_cloud else 'Local'} server returned HTTP {e.response.status_code}]"
            logger.error(error_msg)
            yield error_msg
        except httpx.ConnectError:
            error_msg = f"[Error: Cannot connect to {'cloud' if use_cloud else 'local'} server at {target_url}]"
            logger.error(error_msg)
            yield error_msg
        except Exception as e:
            error_msg = f"[Error: {str(e)}]"
            logger.error(f"Streaming error: {e}")
            yield error_msg

    # ─── Non-Streaming Convenience ────────────────────────────────

    async def ask(self, question: str, limit: int = 5) -> str:
        """
        Non-streaming convenience method. Returns the complete response.

        Args:
            question: The user's question.
            limit:    Max context chunks.

        Returns:
            The full response string.
        """
        tokens = []
        async for token in self.generate_response(question, limit=limit):
            tokens.append(token)
        return "".join(tokens)
