
import chromadb
from chromadb.utils.embedding_functions import (
    SentenceTransformerEmbeddingFunction,
)

# Persistent local vector database
client = chromadb.PersistentClient(path="./chroma_db")

embedding_function = SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

collection = client.get_or_create_collection(
    name="brand_knowledge",
    embedding_function=embedding_function,
    metadata={"hnsw:space": "cosine"},
)


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


def retrieve_knowledge(
    query: str,
    limit: int = 5,
    category: str | None = None,
):
    """
    Retrieve relevant approved brand knowledge.
    """

    where = {"category": category} if category else None

    results = collection.query(
        query_texts=[query],
        n_results=min(limit, collection.count() or 1),
        where=where,
    )

    retrieved = []

    if not results["documents"]:
        return retrieved

    for i, document in enumerate(results["documents"][0]):
        retrieved.append({
            "id": results["ids"][0][i],
            "text": document,
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })

    return retrieved


def delete_knowledge(knowledge_id: str):
    collection.delete(ids=[knowledge_id])


def knowledge_count():
    return collection.count()
