"""
NeuroSync Memory System — Cortex Worker
Background service that processes unprocessed media assets:
  - Images → detailed captions via a vision model (llama-cpp-python / moondream)
  - Audio  → text transcription via faster-whisper

The generated descriptions are stored back into the DB and vectorized
via MemoryManager for semantic search.

Run:
    python -m backend.memory.cortex_worker

Environment Variables:
    DATABASE_URL              PostgreSQL connection string
    MEDIA_STORAGE_PATH        Path to media files (default: ./media)
    VISION_MODEL_PATH         Path to GGUF vision model (default: ./models/moondream2.gguf)
    WHISPER_MODEL_SIZE        Whisper model size (default: base)
    POLL_INTERVAL_SECONDS     How often to check for new media (default: 30)
"""

import os
import sys
import time
import signal
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("neurosync.cortex")
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
VISION_MODEL_PATH = os.getenv("VISION_MODEL_PATH", "./models/moondream2.gguf")
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "30"))

# Graceful shutdown
_shutdown = False


def _signal_handler(signum, frame):
    global _shutdown
    logger.info("Shutdown signal received. Finishing current task …")
    _shutdown = True


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


# ─── Image Processing ────────────────────────────────────────────

class ImageCaptioner:
    """
    Generates detailed text captions from images using a local vision model.
    Uses llama-cpp-python with a multimodal GGUF model (e.g. moondream2).
    """

    def __init__(self, model_path: str):
        self.model_path = model_path
        self._model = None

    def _load_model(self):
        """Lazy-load the vision model to avoid startup delay if not needed."""
        if self._model is not None:
            return

        try:
            from llama_cpp import Llama
            from llama_cpp.llama_chat_format import MoondreamChatHandler

            logger.info(f"Loading vision model from {self.model_path} …")

            # Try moondream chat handler first
            chat_handler = MoondreamChatHandler.from_pretrained(
                repo_id="vikhyatk/moondream2",
                filename="*mmproj*",
            )

            self._model = Llama.from_pretrained(
                repo_id="vikhyatk/moondream2",
                filename="*text-model*",
                chat_handler=chat_handler,
                n_ctx=2048,
                verbose=False,
            )

            logger.info("Vision model loaded successfully.")
        except ImportError:
            logger.error(
                "llama-cpp-python not installed. "
                "Install with: pip install llama-cpp-python"
            )
            raise
        except Exception as e:
            logger.error(f"Failed to load vision model: {e}")
            raise

    def generate_caption(self, file_path: str) -> str:
        """
        Generate a detailed text description of an image.

        The prompt asks for a description rich enough for semantic search,
        e.g. "A photo of a whiteboard with a diagram of a React Native
        app architecture, showing component hierarchy and data flow."

        Args:
            file_path: Absolute path to the image file.

        Returns:
            A detailed text description of the image.
        """
        self._load_model()

        import base64

        with open(file_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")

        # Determine MIME type
        ext = Path(file_path).suffix.lower()
        mime_map = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp"}
        mime = mime_map.get(ext, "image/jpeg")

        data_uri = f"data:{mime};base64,{image_b64}"

        result = self._model.create_chat_completion(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": data_uri}},
                        {
                            "type": "text",
                            "text": (
                                "Describe this image in rich detail for a searchable knowledge base. "
                                "Include: what objects/people are visible, any text/labels, colors, "
                                "spatial layout, and the likely context or purpose of the image. "
                                "Be thorough — this description will be used for semantic search."
                            ),
                        },
                    ],
                }
            ],
        )

        return result["choices"][0]["message"]["content"].strip()


# ─── Audio Processing ─────────────────────────────────────────────

class AudioTranscriber:
    """
    Transcribes audio files to text using faster-whisper.
    Supports CPU and GPU acceleration.
    """

    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self._model = None

    def _load_model(self):
        """Lazy-load whisper model."""
        if self._model is not None:
            return

        try:
            from faster_whisper import WhisperModel

            logger.info(f"Loading Whisper model (size={self.model_size}) …")

            # Use CPU by default; switch to "cuda" if GPU available
            self._model = WhisperModel(
                self.model_size,
                device="cpu",
                compute_type="int8",
            )

            logger.info("Whisper model loaded successfully.")
        except ImportError:
            logger.error(
                "faster-whisper not installed. "
                "Install with: pip install faster-whisper"
            )
            raise

    def transcribe(self, file_path: str) -> str:
        """
        Transcribe an audio file to text.

        Args:
            file_path: Absolute path to the audio file.

        Returns:
            The full transcription text.
        """
        self._load_model()

        segments, info = self._model.transcribe(file_path, beam_size=5)

        logger.info(
            f"Detected language: {info.language} "
            f"(probability: {info.language_probability:.2f})"
        )

        # Concatenate all segments
        transcript = " ".join(segment.text.strip() for segment in segments)
        return transcript


# ─── Index Loop ───────────────────────────────────────────────────

class CortexWorker:
    """
    Polls the database for unprocessed media assets and processes them.

    Flow:
      1. Query media_assets WHERE description IS NULL
      2. Process based on media_type (image → caption, audio → transcript)
      3. Update media_assets.description
      4. Call MemoryManager.save_interaction() to vectorize the description
    """

    def __init__(
        self,
        database_url: str,
        vision_model_path: str = VISION_MODEL_PATH,
        whisper_model_size: str = WHISPER_MODEL_SIZE,
    ):
        from .memory_manager import MemoryManager
        from .models import MediaAsset, get_engine, get_session_factory

        self.memory_manager = MemoryManager(
            database_url=database_url,
            create_tables=False,  # Tables already exist
        )

        engine = get_engine(database_url)
        self.SessionFactory = get_session_factory(engine)

        # Lazy-initialized processors
        self._captioner = ImageCaptioner(vision_model_path)
        self._transcriber = AudioTranscriber(whisper_model_size)

        logger.info("CortexWorker initialized.")

    def _get_unprocessed_assets(self, batch_size: int = 5):
        """Fetch media assets that haven't been described yet."""
        from .models import MediaAsset

        session = self.SessionFactory()
        try:
            assets = (
                session.query(MediaAsset)
                .filter(MediaAsset.description.is_(None))
                .limit(batch_size)
                .all()
            )
            # Detach from session so we can use them outside
            for a in assets:
                session.expunge(a)
            return assets
        finally:
            session.close()

    def _update_asset_description(self, asset_id, description: str):
        """Update the media asset with the generated description."""
        from .models import MediaAsset

        session = self.SessionFactory()
        try:
            asset = session.query(MediaAsset).filter_by(id=asset_id).first()
            if asset:
                asset.description = description
                session.commit()
                logger.info(f"Updated description for asset {asset_id}")
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to update asset {asset_id}: {e}")
        finally:
            session.close()

    def process_asset(self, asset) -> Optional[str]:
        """
        Process a single media asset and return the text description.

        Args:
            asset: A MediaAsset ORM object.

        Returns:
            The generated description, or None if processing failed.
        """
        file_path = asset.filepath

        if not Path(file_path).exists():
            logger.warning(f"File not found: {file_path} — skipping asset {asset.id}")
            return None

        try:
            if asset.media_type == "image":
                logger.info(f"Captioning image: {asset.filename}")
                description = self._captioner.generate_caption(file_path)
            elif asset.media_type == "audio":
                logger.info(f"Transcribing audio: {asset.filename}")
                description = self._transcriber.transcribe(file_path)
            else:
                logger.warning(f"Unknown media type: {asset.media_type}")
                return None

            logger.info(
                f"Generated description ({len(description)} chars): "
                f"{description[:100]}{'…' if len(description) > 100 else ''}"
            )
            return description

        except Exception as e:
            logger.error(f"Failed to process {asset.filename}: {e}")
            return None

    def run_once(self):
        """Run a single pass of the index loop."""
        assets = self._get_unprocessed_assets()

        if not assets:
            logger.debug("No unprocessed assets found.")
            return 0

        logger.info(f"Found {len(assets)} unprocessed asset(s). Processing …")
        processed = 0

        for asset in assets:
            if _shutdown:
                break

            description = self.process_asset(asset)
            if description is None:
                continue

            # Step 1: Update the media_assets row with the description
            self._update_asset_description(asset.id, description)

            # Step 2: Vectorize the description via MemoryManager
            # This makes the media searchable by meaning
            try:
                self.memory_manager.save_interaction(
                    user_id="cortex_worker",
                    text=f"[{asset.media_type.upper()}] {asset.filename}: {description}",
                    role="system",
                    device_id="cortex",
                    tag=f"media_{asset.media_type}",
                )
                processed += 1
            except Exception as e:
                logger.error(f"Failed to vectorize description for {asset.filename}: {e}")

        return processed

    def run_loop(self, interval: int = POLL_INTERVAL):
        """
        Main polling loop. Checks for new assets every `interval` seconds.
        Gracefully shuts down on SIGINT/SIGTERM.
        """
        logger.info(
            f"Starting CortexWorker loop (poll every {interval}s). "
            f"Press Ctrl+C to stop."
        )

        while not _shutdown:
            try:
                count = self.run_once()
                if count > 0:
                    logger.info(f"Processed {count} asset(s) this cycle.")
            except Exception as e:
                logger.error(f"Error in processing cycle: {e}")

            # Sleep in small increments for responsive shutdown
            for _ in range(interval):
                if _shutdown:
                    break
                time.sleep(1)

        logger.info("CortexWorker stopped.")


# ─── Entrypoint ───────────────────────────────────────────────────

def main():
    """CLI entrypoint for the cortex worker."""
    worker = CortexWorker(database_url=DATABASE_URL)
    worker.run_loop()


if __name__ == "__main__":
    main()
