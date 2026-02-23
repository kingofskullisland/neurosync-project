"""
NeuroSync Memory System — MemoryManager
Handles embedding generation, semantic storage, and vector search.

Usage:
    mm = MemoryManager(database_url="postgresql://user:pass@localhost:5432/neurosync")
    mm.save_interaction(user_id="kosi", text="Hello world", role="user", device_id="pixel_9")
    results = mm.recall_memories("What did I say earlier?")
"""

import logging
import uuid
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Any, Dict, List, Optional

import numpy as np
from sentence_transformers import SentenceTransformer
from sqlalchemy import text as sa_text
from sqlalchemy.exc import SQLAlchemyError

from .models import (
    EMBEDDING_DIM,
    Conversation,
    MediaAsset,
    Message,
    SemanticMemory,
    get_engine,
    get_session_factory,
    init_db,
)

logger = logging.getLogger("neurosync.memory")


class MemoryManager:
    """
    Central class for the NeuroSync semantic memory pipeline.

    Responsibilities:
      - Load and manage the sentence-transformer embedding model
      - Store interactions (messages + embeddings) as atomic transactions
      - Perform cosine-similarity vector search over semantic_memory
    """

    def __init__(
        self,
        database_url: str,
        embedding_model_name: str = "all-MiniLM-L6-v2",
        create_tables: bool = True,
    ):
        """
        Initialize MemoryManager.

        Args:
            database_url: PostgreSQL connection string (must have pgvector).
            embedding_model_name: HuggingFace model ID for sentence-transformers.
            create_tables: If True, auto-create tables on startup.
        """
        # ── Database ──────────────────────────────────────────────
        logger.info("Connecting to database …")
        self.engine = get_engine(database_url)
        self.SessionFactory = get_session_factory(self.engine)

        if create_tables:
            init_db(self.engine)
            logger.info("Database tables initialized.")

        # ── Embedding Model ───────────────────────────────────────
        logger.info(f"Loading embedding model: {embedding_model_name}")
        self.embedder = SentenceTransformer(embedding_model_name)
        self._embedding_dim = self.embedder.get_sentence_embedding_dimension()

        if self._embedding_dim != EMBEDDING_DIM:
            logger.warning(
                f"Model dimension ({self._embedding_dim}) != schema dimension ({EMBEDDING_DIM}). "
                "Update EMBEDDING_DIM in models.py to match."
            )

        logger.info(f"MemoryManager ready. Embedding dim = {self._embedding_dim}")

    # ─── Session Helper ───────────────────────────────────────────

    @contextmanager
    def _session_scope(self):
        """Provide a transactional scope around a series of operations."""
        session = self.SessionFactory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    # ─── Embedding ────────────────────────────────────────────────

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate a normalized embedding vector for the given text.

        Args:
            text: The input string to embed.

        Returns:
            A list of floats (length = embedding_dim).
        """
        vector = self.embedder.encode(text, normalize_embeddings=True)
        return vector.tolist()

    # ─── Save Interaction ─────────────────────────────────────────

    def save_interaction(
        self,
        user_id: str,
        text: str,
        role: str = "user",
        device_id: Optional[str] = None,
        tag: Optional[str] = None,
        conversation_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Store a message and its vector embedding in a single atomic transaction.

        Steps:
          1. Find or create a Conversation for this user/device.
          2. Insert the message into `messages`.
          3. Generate the embedding vector.
          4. Insert the vector into `semantic_memory`.
          5. Commit as one transaction (rollback on any failure).

        Args:
            user_id:         Unique identifier for the user.
            text:            The message content.
            role:            "user", "assistant", or "system".
            device_id:       Origin device identifier.
            tag:             Optional tag for the semantic memory (e.g. "daily_summary").
            conversation_id: If provided, attach to this conversation instead of creating one.

        Returns:
            Dict with conversation_id, message_id, and memory_id.

        Raises:
            RuntimeError: If the transaction fails.
        """
        try:
            with self._session_scope() as session:
                # ── 1. Conversation ───────────────────────────────
                if conversation_id:
                    conversation = session.query(Conversation).filter_by(id=conversation_id).first()
                    if not conversation:
                        raise ValueError(f"Conversation {conversation_id} not found.")
                else:
                    # Find the most recent open conversation for this user+device,
                    # or create a new one.
                    conversation = (
                        session.query(Conversation)
                        .filter_by(user_id=user_id, device_id=device_id)
                        .order_by(Conversation.updated_at.desc())
                        .first()
                    )
                    if not conversation:
                        conversation = Conversation(user_id=user_id, device_id=device_id)
                        session.add(conversation)
                        session.flush()  # get the ID

                # Touch the conversation timestamp
                conversation.updated_at = datetime.now(timezone.utc)

                # ── 2. Message ────────────────────────────────────
                message = Message(
                    conversation_id=conversation.id,
                    role=role,
                    content=text,
                    device_origin=device_id,
                )
                session.add(message)
                session.flush()

                # ── 3. Generate Embedding ─────────────────────────
                embedding = self.generate_embedding(text)

                # ── 4. Semantic Memory ────────────────────────────
                memory = SemanticMemory(
                    message_id=message.id,
                    embedding=embedding,
                    tag=tag,
                )
                session.add(memory)
                session.flush()

                result = {
                    "conversation_id": str(conversation.id),
                    "message_id": str(message.id),
                    "memory_id": str(memory.id),
                }

                logger.info(f"Saved interaction: {result}")
                return result

        except SQLAlchemyError as e:
            logger.error(f"Database error in save_interaction: {e}")
            raise RuntimeError(f"Failed to save interaction: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error in save_interaction: {e}")
            raise RuntimeError(f"Failed to save interaction: {e}") from e

    # ─── Recall Memories ──────────────────────────────────────────

    def recall_memories(
        self,
        query_text: str,
        limit: int = 5,
        tag_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Perform cosine similarity search against semantic_memory and return
        the most relevant messages with their content and timestamps.

        Args:
            query_text:  The search query to embed.
            limit:       Max number of results to return.
            tag_filter:  If set, only search memories with this tag.

        Returns:
            List of dicts: [{content, role, device_origin, similarity, created_at, tag}, ...]
        """
        try:
            query_embedding = self.generate_embedding(query_text)
            embedding_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

            # Build the SQL query with cosine distance operator (<=>)
            # Lower distance = higher similarity, so we ORDER ASC.
            sql = sa_text("""
                SELECT
                    m.content,
                    m.role,
                    m.device_origin,
                    m.created_at,
                    sm.tag,
                    sm.id AS memory_id,
                    sm.retrieval_count,
                    (sm.embedding <=> :embedding) AS distance
                FROM semantic_memory sm
                JOIN messages m ON m.id = sm.message_id
                WHERE (:tag IS NULL OR sm.tag = :tag)
                ORDER BY sm.embedding <=> :embedding
                LIMIT :limit
            """)

            with self._session_scope() as session:
                rows = session.execute(
                    sql,
                    {
                        "embedding": embedding_str,
                        "tag": tag_filter,
                        "limit": limit,
                    },
                ).fetchall()

                results = []
                memory_ids = []
                for row in rows:
                    similarity = 1.0 - float(row.distance)  # cosine distance → similarity
                    results.append({
                        "content": row.content,
                        "role": row.role,
                        "device_origin": row.device_origin,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "tag": row.tag,
                        "similarity": round(similarity, 4),
                    })
                    memory_ids.append(row.memory_id)

                # Increment retrieval_count for returned memories
                if memory_ids:
                    session.execute(
                        sa_text("""
                            UPDATE semantic_memory
                            SET retrieval_count = retrieval_count + 1
                            WHERE id = ANY(:ids)
                        """),
                        {"ids": memory_ids},
                    )

                logger.info(
                    f"Recalled {len(results)} memories for query: "
                    f"{query_text[:60]}{'…' if len(query_text) > 60 else ''}"
                )
                return results

        except SQLAlchemyError as e:
            logger.error(f"Database error in recall_memories: {e}")
            raise RuntimeError(f"Failed to recall memories: {e}") from e
        except Exception as e:
            logger.error(f"Unexpected error in recall_memories: {e}")
            raise RuntimeError(f"Failed to recall memories: {e}") from e

    # ─── Utility Methods ──────────────────────────────────────────

    def get_conversation_messages(
        self,
        conversation_id: uuid.UUID,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve raw messages from a conversation, ordered chronologically."""
        with self._session_scope() as session:
            messages = (
                session.query(Message)
                .filter_by(conversation_id=conversation_id)
                .order_by(Message.created_at.asc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": str(m.id),
                    "role": m.role,
                    "content": m.content,
                    "device_origin": m.device_origin,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                }
                for m in messages
            ]

    def get_recent_conversations(
        self,
        hours: int = 24,
        limit: int = 100,
    ) -> List[Conversation]:
        """Retrieve conversations updated within the last N hours."""
        from datetime import timedelta

        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        with self._session_scope() as session:
            return (
                session.query(Conversation)
                .filter(Conversation.updated_at >= cutoff)
                .order_by(Conversation.updated_at.desc())
                .limit(limit)
                .all()
            )

    def get_top_retrieved_memories(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch the most-retrieved memories (for dreaming/re-indexing)."""
        sql = sa_text("""
            SELECT
                m.content,
                m.role,
                sm.tag,
                sm.retrieval_count,
                m.created_at
            FROM semantic_memory sm
            JOIN messages m ON m.id = sm.message_id
            ORDER BY sm.retrieval_count DESC
            LIMIT :limit
        """)
        with self._session_scope() as session:
            rows = session.execute(sql, {"limit": limit}).fetchall()
            return [
                {
                    "content": row.content,
                    "role": row.role,
                    "tag": row.tag,
                    "retrieval_count": row.retrieval_count,
                    "created_at": row.created_at.isoformat() if row.created_at else None,
                }
                for row in rows
            ]
