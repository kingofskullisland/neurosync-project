"""
NeuroSync Memory System — Nightly Routine
Autonomous maintenance script that runs at 3 AM nightly.

Three main jobs:
  1. CONSOLIDATION — Summarize today's conversations, prune trivial messages
  2. FILE CLEANUP  — Deduplicate media files by SHA-256 hash
  3. DREAMING      — Re-index top memories, generate novel insights

Run:
    python -m backend.memory.nightly_routine

Environment Variables:
    DATABASE_URL          PostgreSQL connection string
    MEDIA_STORAGE_PATH    Local directory for media files (default: ./media)
    LLAMA_URL             Llama 3 server URL (default: http://localhost:8080)
"""

import os
import sys
import hashlib
import logging
from pathlib import Path
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Dict

import httpx
import schedule
import time

logger = logging.getLogger("neurosync.nightly")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)

# ─── Configuration ────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neurosync:neurosync@localhost:5432/neurosync",
)
MEDIA_STORAGE_PATH = Path(os.getenv("MEDIA_STORAGE_PATH", "./media"))
LLAMA_URL = os.getenv("LLAMA_URL", "http://localhost:8080").rstrip("/")

# Trivial messages to prune (case-insensitive)
TRIVIAL_PATTERNS = {
    "ok", "okay", "k", "thanks", "thank you", "thx", "ty",
    "yes", "no", "yeah", "yep", "nope", "sure", "cool",
    "got it", "understood", "alright", "fine", "hmm", "hm",
    "lol", "haha", "lmao",
}


# ─── Llama 3 Helper ──────────────────────────────────────────────

def call_llama(prompt: str, max_tokens: int = 512, temperature: float = 0.3) -> str:
    """
    Synchronous call to the Llama 3 server.

    Args:
        prompt:      The user message / instruction.
        max_tokens:  Max response length.
        temperature: Sampling temperature.

    Returns:
        The model's response text.
    """
    try:
        with httpx.Client(timeout=120) as client:
            resp = client.post(
                f"{LLAMA_URL}/v1/chat/completions",
                json={
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.error(f"Llama call failed: {e}")
        return ""


# ═══════════════════════════════════════════════════════════════════
# JOB 1: CONSOLIDATION
# ═══════════════════════════════════════════════════════════════════

def run_consolidation(memory_manager):
    """
    Summarize the last 24 hours of conversations into a "Daily Summary"
    and prune trivial noise messages.

    Steps:
      1. Fetch all conversations updated in the last 24h.
      2. Gather their messages.
      3. Feed messages to Llama 3 for a bulleted daily summary.
      4. Save the summary as a tagged semantic memory ("daily_summary").
      5. Delete trivial messages (keep their vectors if they exist).
    """
    from .models import Conversation, Message, SemanticMemory, get_engine, get_session_factory

    logger.info("═══ JOB 1: CONSOLIDATION ═══")

    engine = get_engine(DATABASE_URL)
    SessionFactory = get_session_factory(engine)
    session = SessionFactory()

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

        # ── Fetch recent conversations ────────────────────────────
        conversations = (
            session.query(Conversation)
            .filter(Conversation.updated_at >= cutoff)
            .all()
        )

        if not conversations:
            logger.info("No conversations in the last 24h. Skipping consolidation.")
            return

        logger.info(f"Found {len(conversations)} conversation(s) to consolidate.")

        # ── Gather all messages ───────────────────────────────────
        all_messages = []
        trivial_ids = []

        for conv in conversations:
            messages = (
                session.query(Message)
                .filter_by(conversation_id=conv.id)
                .order_by(Message.created_at.asc())
                .all()
            )
            for msg in messages:
                entry = {
                    "role": msg.role,
                    "content": msg.content,
                    "time": msg.created_at.strftime("%H:%M") if msg.created_at else "??:??",
                }
                all_messages.append(entry)

                # Flag trivial messages for pruning
                if msg.content.strip().lower() in TRIVIAL_PATTERNS:
                    trivial_ids.append(msg.id)

        if not all_messages:
            logger.info("No messages found. Skipping.")
            return

        # ── Generate daily summary via Llama 3 ────────────────────
        transcript = "\n".join(
            f"[{m['time']}] {m['role']}: {m['content']}"
            for m in all_messages[:200]  # Cap to avoid token overflow
        )

        prompt = f"""Below is a transcript of today's conversations. 
Create a concise daily summary as a bulleted list. 
Focus on key topics discussed, decisions made, questions asked, 
and any important information shared. Omit greetings and small talk.

Transcript:
{transcript}

Daily Summary (bulleted list):"""

        summary = call_llama(prompt, max_tokens=512, temperature=0.2)

        if summary:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            memory_manager.save_interaction(
                user_id="system",
                text=f"[Daily Summary — {today}]\n{summary}",
                role="system",
                device_id="nightly_routine",
                tag="daily_summary",
            )
            logger.info(f"Daily summary saved ({len(summary)} chars).")
        else:
            logger.warning("Llama returned empty summary.")

        # ── Prune trivial messages ────────────────────────────────
        if trivial_ids:
            # Delete semantic_memory entries for trivial messages first
            session.query(SemanticMemory).filter(
                SemanticMemory.message_id.in_(trivial_ids)
            ).delete(synchronize_session="fetch")

            # Then delete the messages themselves
            deleted = session.query(Message).filter(
                Message.id.in_(trivial_ids)
            ).delete(synchronize_session="fetch")

            session.commit()
            logger.info(f"Pruned {deleted} trivial message(s).")

    except Exception as e:
        session.rollback()
        logger.error(f"Consolidation error: {e}")
    finally:
        session.close()


# ═══════════════════════════════════════════════════════════════════
# JOB 2: FILE CLEANUP (DEDUP)
# ═══════════════════════════════════════════════════════════════════

def run_file_cleanup():
    """
    Scan the media folder for duplicate files (by SHA-256 hash).
    Keep the first copy, delete duplicates, and update DB references.
    """
    from .models import MediaAsset, get_engine, get_session_factory

    logger.info("═══ JOB 2: FILE CLEANUP ═══")

    engine = get_engine(DATABASE_URL)
    SessionFactory = get_session_factory(engine)
    session = SessionFactory()

    try:
        # ── Build hash → [assets] mapping ─────────────────────────
        assets = session.query(MediaAsset).all()

        if not assets:
            logger.info("No media assets found. Skipping cleanup.")
            return

        hash_groups: Dict[str, List] = defaultdict(list)

        for asset in assets:
            file_path = Path(asset.filepath)

            # Compute hash if not stored
            if not asset.file_hash and file_path.exists():
                sha = hashlib.sha256()
                with open(file_path, "rb") as f:
                    for chunk in iter(lambda: f.read(65536), b""):
                        sha.update(chunk)
                asset.file_hash = sha.hexdigest()

            if asset.file_hash:
                hash_groups[asset.file_hash].append(asset)

        session.commit()  # Persist any newly computed hashes

        # ── Delete duplicates ─────────────────────────────────────
        total_deleted = 0

        for file_hash, group in hash_groups.items():
            if len(group) <= 1:
                continue

            # Keep the oldest file, delete the rest
            group.sort(key=lambda a: a.created_at or datetime.min.replace(tzinfo=timezone.utc))
            keeper = group[0]
            duplicates = group[1:]

            for dup in duplicates:
                dup_path = Path(dup.filepath)

                # Delete the physical file
                if dup_path.exists():
                    dup_path.unlink()
                    logger.info(f"Deleted duplicate file: {dup_path}")

                # Remove the DB record
                session.delete(dup)
                total_deleted += 1

        session.commit()
        logger.info(f"Cleanup complete. Removed {total_deleted} duplicate(s).")

    except Exception as e:
        session.rollback()
        logger.error(f"File cleanup error: {e}")
    finally:
        session.close()


# ═══════════════════════════════════════════════════════════════════
# JOB 3: DREAMING (RE-INDEXING)
# ═══════════════════════════════════════════════════════════════════

def run_dreaming(memory_manager):
    """
    "Dreaming" — Fetch the most-retrieved memories of the week and
    ask Llama 3 to derive new insights from them.

    This simulates "learning" by creating high-value synthesized memories
    that connect disparate pieces of information.
    """
    logger.info("═══ JOB 3: DREAMING ═══")

    try:
        # ── Fetch top memories ────────────────────────────────────
        top_memories = memory_manager.get_top_retrieved_memories(limit=10)

        if not top_memories:
            logger.info("No retrieved memories found. Skipping dreaming.")
            return

        logger.info(f"Analyzing {len(top_memories)} top-retrieved memories …")

        # ── Format memories for Llama ─────────────────────────────
        memory_text = "\n\n".join(
            f"Memory {i+1} (retrieved {m['retrieval_count']}x, "
            f"from {m['created_at']}):\n{m['content']}"
            for i, m in enumerate(top_memories)
        )

        prompt = f"""You are an AI that helps process and synthesize memories.

Below are the 10 most frequently retrieved memories from this week.
Analyze them for patterns, connections, and emergent insights.

Your task:
1. Identify common themes or topics across these memories.
2. Note any contradictions or evolving viewpoints.
3. Generate 2-3 NEW insights that connect information across memories
   in ways that weren't explicitly stated.

Memories:
{memory_text}

New Insights (be specific and actionable):"""

        insights = call_llama(prompt, max_tokens=512, temperature=0.5)

        if insights:
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            memory_manager.save_interaction(
                user_id="system",
                text=f"[Dream Insights — {today}]\n{insights}",
                role="system",
                device_id="nightly_routine",
                tag="insight",
            )
            logger.info(f"Dream insights saved ({len(insights)} chars).")
        else:
            logger.warning("Llama returned empty insights.")

    except Exception as e:
        logger.error(f"Dreaming error: {e}")


# ═══════════════════════════════════════════════════════════════════
# SCHEDULER
# ═══════════════════════════════════════════════════════════════════

def run_all_jobs():
    """Execute all nightly maintenance jobs in sequence."""
    from .memory_manager import MemoryManager

    logger.info("╔══════════════════════════════════════════════════════╗")
    logger.info("║         NEUROSYNC NIGHTLY ROUTINE — START           ║")
    logger.info("╚══════════════════════════════════════════════════════╝")

    start = datetime.now(timezone.utc)

    try:
        mm = MemoryManager(database_url=DATABASE_URL, create_tables=False)

        run_consolidation(mm)
        run_file_cleanup()
        run_dreaming(mm)

    except Exception as e:
        logger.error(f"Fatal error in nightly routine: {e}")

    elapsed = (datetime.now(timezone.utc) - start).total_seconds()
    logger.info(f"Nightly routine completed in {elapsed:.1f}s.")


def main():
    """
    Entrypoint: schedule the nightly routine at 3:00 AM and run the
    scheduler loop. Also runs immediately on first start for testing.
    """
    logger.info("NeuroSync Nightly Routine scheduler starting.")
    logger.info("Scheduled: Every day at 03:00.")

    # Schedule the nightly job
    schedule.every().day.at("03:00").do(run_all_jobs)

    # Run immediately on first start (useful for testing)
    if "--now" in sys.argv:
        logger.info("Running nightly routine immediately (--now flag).")
        run_all_jobs()

    # Keep the scheduler alive
    logger.info("Scheduler loop running. Press Ctrl+C to stop.")
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    except KeyboardInterrupt:
        logger.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
