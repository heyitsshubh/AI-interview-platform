"""
FAISS Vector Store Manager.
Creates, saves, loads, and searches FAISS indexes locally.
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


class FAISSVectorStore:
    """Manages FAISS vector store operations."""

    def __init__(self):
        from app.ai.rag.embeddings import get_embedding_model
        self.embedding_model = get_embedding_model()

    def create_from_documents(self, docs: list, index_path: str) -> object:
        """
        Create a FAISS index from LangChain Documents and save to disk.
        Returns the FAISS object.
        """
        from langchain_community.vectorstores import FAISS

        if not docs:
            raise ValueError("Cannot create FAISS index from empty document list")

        vectorstore = FAISS.from_documents(docs, self.embedding_model)
        Path(index_path).mkdir(parents=True, exist_ok=True)
        vectorstore.save_local(index_path)
        logger.info(f"FAISS index created and saved to {index_path} ({len(docs)} docs)")
        return vectorstore

    def load(self, index_path: str) -> object:
        """Load a FAISS index from disk."""
        from langchain_community.vectorstores import FAISS

        if not Path(index_path).exists():
            raise FileNotFoundError(f"FAISS index not found at: {index_path}")

        vectorstore = FAISS.load_local(
            index_path,
            self.embedding_model,
            allow_dangerous_deserialization=True,
        )
        logger.info(f"FAISS index loaded from {index_path}")
        return vectorstore

    def similarity_search(
        self,
        index_path: str,
        query: str,
        k: int = 5,
    ) -> list:
        """
        Search the FAISS index for documents similar to query.
        Returns list of LangChain Document objects.
        """
        vectorstore = self.load(index_path)
        results = vectorstore.similarity_search(query, k=k)
        logger.info(f"FAISS search: {len(results)} results for query '{query[:50]}'")
        return results

    def delete_index(self, index_path: str) -> None:
        """Delete a FAISS index from disk."""
        import shutil
        if Path(index_path).exists():
            shutil.rmtree(index_path)
            logger.info(f"FAISS index deleted: {index_path}")

    def index_exists(self, index_path: str) -> bool:
        """Check if a FAISS index exists at the given path."""
        return (Path(index_path) / "index.faiss").exists()

    async def create_resume_index(self, resume_text: str, user_id: str) -> str:
        """
        Create a FAISS index for a resume.
        Returns the index path.
        """
        from app.core.config import get_settings
        from app.ai.rag.loader import load_text_as_document, split_documents

        settings = get_settings()
        index_path = str(Path(settings.STORAGE_PATH) / "embeddings" / user_id)

        docs = load_text_as_document(resume_text, {"user_id": user_id})
        chunks = split_documents(docs)
        self.create_from_documents(chunks, index_path)
        return index_path
