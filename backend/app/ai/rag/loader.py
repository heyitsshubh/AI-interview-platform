"""
RAG Document Loader
Loads and splits resume/job-description documents for embedding.
"""
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def load_pdf_document(file_path: str) -> list:
    """Load a PDF and return list of LangChain Document objects."""
    from langchain_community.document_loaders import PyPDFLoader

    loader = PyPDFLoader(file_path)
    docs = loader.load()
    logger.info(f"Loaded {len(docs)} pages from {file_path}")
    return docs


def split_documents(docs: list, chunk_size: int = 1000, overlap: int = 200) -> list:
    """Split documents into smaller chunks for embedding."""
    from langchain.text_splitter import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(docs)
    logger.info(f"Split {len(docs)} documents into {len(chunks)} chunks")
    return chunks


def load_and_split_resume(file_path: str) -> list:
    """Full pipeline: load PDF and split into chunks."""
    docs = load_pdf_document(file_path)
    return split_documents(docs)


def load_text_as_document(text: str, metadata: dict | None = None) -> list:
    """Wrap plain text into a LangChain Document for embedding."""
    from langchain_core.documents import Document

    doc = Document(
        page_content=text,
        metadata=metadata or {"source": "text_input"},
    )
    return [doc]
