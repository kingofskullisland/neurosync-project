"""
NeuroSync Memory System — SQLAlchemy ORM Models
Defines the schema for conversations, messages, semantic_memory, and media_assets.
Requires PostgreSQL with the pgvector extension enabled.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from pgvector.sqlalchemy import Vector

# ─── Constants ────────────────────────────────────────────────────
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension

Base = declarative_base()


# ─── Tables ───────────────────────────────────────────────────────

class Conversation(Base):
    """
    A logical grouping of messages.
    One conversation per user session or per device context.
    """
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(128), nullable=False, index=True)
    device_id = Column(String(128), nullable=True)
    metadata_ = Column("metadata", Text, nullable=True)  # JSON blob for extensibility
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Conversation {self.id} user={self.user_id}>"


class Message(Base):
    """
    A single chat message within a conversation.
    """
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(32), nullable=False)           # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    device_origin = Column(String(128), nullable=True)  # e.g. "mobile_pixel", "desktop_pc"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    semantic_memory = relationship("SemanticMemory", back_populates="message", uselist=False, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Message {self.id} role={self.role}>"


class SemanticMemory(Base):
    """
    Vector embedding of a message for semantic search.
    Each message has exactly one embedding vector.
    """
    __tablename__ = "semantic_memory"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id = Column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    embedding = Column(Vector(EMBEDDING_DIM), nullable=False)
    tag = Column(String(64), nullable=True, index=True)   # e.g. "daily_summary", "insight"
    retrieval_count = Column(Integer, default=0)           # Track how often this is retrieved
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    message = relationship("Message", back_populates="semantic_memory")

    def __repr__(self):
        return f"<SemanticMemory {self.id} msg={self.message_id}>"


class MediaAsset(Base):
    """
    Metadata for uploaded media files (images, audio).
    The actual binary lives on the local SSD.
    """
    __tablename__ = "media_assets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(512), nullable=False)
    filepath = Column(Text, nullable=False)
    media_type = Column(String(32), nullable=False)         # "image", "audio"
    file_hash = Column(String(64), nullable=True, index=True)  # SHA-256 for dedup
    description = Column(Text, nullable=True)               # Set by cortex_worker
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<MediaAsset {self.filename} type={self.media_type}>"


# ─── Engine / Session Factory ────────────────────────────────────

def get_engine(database_url: str):
    """Create a SQLAlchemy engine with connection pooling."""
    return create_engine(
        database_url,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False,
    )


def get_session_factory(engine):
    """Create a session factory bound to the given engine."""
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db(engine):
    """
    Create all tables and enable pgvector extension.
    Safe to call multiple times (IF NOT EXISTS).
    """
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()
    Base.metadata.create_all(engine)
