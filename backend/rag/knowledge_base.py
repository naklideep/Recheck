
import os

import chromadb
from chromadb.utils.embedding_functions import (
    SentenceTransformerEmbeddingFunction,
)


# --------------------------------------------------
# CHROMA DB CONFIGURATION
# --------------------------------------------------

# Local default: ./chroma_db
# Render free deployment: /tmp/chroma_db
CHROMA_DB_PATH = os.getenv(
    "CHROMA_DB_PATH",
    "./chroma_db",
)

client = chromadb.PersistentClient(
    path=CHROMA_DB_PATH
)


# --------------------------------------------------
# EMBEDDING MODEL
# --------------------------------------------------

EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "all-MiniLM-L6-v2",
)

embedding_function = SentenceTransformerEmbeddingFunction(
    model_name=EMBEDDING_MODEL
)


# --------------------------------------------------
# KNOWLEDGE COLLECTION
# --------------------------------------------------

collection = client.get_or_create_collection(
    name="brand_knowledge",
    embedding_function=embedding_function,
    metadata={"hnsw:space": "cosine"},
)


# --------------------------------------------------
# ADD / UPDATE KNOWLEDGE
# --------------------------------------------------

def add_knowledge(
    knowledge_id: str,
    text: str,
    category: str,
    metadata: dict | None = None,
):
    """
    Add or update approved brand knowledge.

    Categories:
    - claim
    - guideline
    - terminology
    - brand_fact
    """

    document_metadata = {
        "category": category,
        **(metadata or {}),
    }

    collection.upsert(
        ids=[knowledge_id],
        documents=[text],
        metadatas=[document_metadata],
    )


# --------------------------------------------------
# RETRIEVE KNOWLEDGE
# --------------------------------------------------

def retrieve_knowledge(
    query: str,
    limit: int = 5,
    category: str | None = None,
):
    """
    Retrieve relevant approved brand knowledge.
    """

    if not query or not query.strip():
        return []

    if limit <= 0:
        return []

    total_documents = collection.count()

    if total_documents == 0:
        return []

    where = {"category": category} if category else None

    results = collection.query(
        query_texts=[query],
        n_results=min(limit, total_documents),
        where=where,
        include=[
            "documents",
            "metadatas",
            "distances",
        ],
    )

    retrieved = []

    documents = results.get("documents") or [[]]
    ids = results.get("ids") or [[]]
    metadatas = results.get("metadatas") or [[]]
    distances = results.get("distances") or [[]]

    if not documents or not documents[0]:
        return retrieved

    for i, document in enumerate(documents[0]):
        retrieved.append({
            "id": ids[0][i],
            "text": document,
            "metadata": (
                metadatas[0][i]
                if metadatas[0]
                else {}
            ),
            "distance": (
                distances[0][i]
                if distances[0]
                else None
            ),
        })

    return retrieved


# --------------------------------------------------
# DELETE KNOWLEDGE
# --------------------------------------------------

def delete_knowledge(knowledge_id: str):
    collection.delete(
        ids=[knowledge_id]
    )


# --------------------------------------------------
# KNOWLEDGE COUNT
# --------------------------------------------------

def knowledge_count():
    return collection.count()
