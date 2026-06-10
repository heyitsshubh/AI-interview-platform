"""
RAG Embeddings using OpenAI text-embedding-3-small.
"""
import logging
from functools import lru_cache

logger = logging.getLogger(__name__)


@lru_cache()
def get_embedding_model():
    """Get (and cache) the OpenAI embedding model instance."""
    from langchain_openai import OpenAIEmbeddings
    from app.core.config import get_settings

    settings = get_settings()
    model = OpenAIEmbeddings(
        model="text-embedding-3-small",
        openai_api_key=settings.OPENAI_API_KEY,
    )
    logger.info("OpenAI embedding model initialized (text-embedding-3-small)")
    return model


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts using OpenAI embeddings."""
    model = get_embedding_model()
    embeddings = await model.aembed_documents(texts)
    return embeddings


async def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    model = get_embedding_model()
    return await model.aembed_query(query)
