"""
RAG Embeddings using OpenAI text-embedding-3-small.
"""
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache()
def get_embedding_model():
    """Get (and cache) the Google Generative AI embedding model instance."""
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    from app.core.config import get_settings

    settings = get_settings()
    model = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
        google_api_key=settings.GEMINI_API_KEY,
    )
    logger.info("Google Generative AI embedding model initialized (models/embedding-001)")
    return model


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using Google Generative AI embeddings."""
    model = get_embedding_model()
    embeddings = await model.aembed_documents(texts)
    return embeddings


async def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    model = get_embedding_model()
    return await model.aembed_query(query)
