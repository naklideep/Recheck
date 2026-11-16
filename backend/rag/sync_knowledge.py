
from rag.knowledge_base import add_knowledge, delete_knowledge
import json


def document_to_text(document: dict) -> str:
    """Convert MongoDB knowledge document into searchable text."""

    excluded = {"_id", "createdAt", "updatedAt"}

    parts = []

    for key, value in document.items():
        if key in excluded or value is None:
            continue

        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)

        parts.append(f"{key}: {value}")

    return "\n".join(parts)


async def sync_knowledge(db):
    """
    Sync MongoDB claims, terms, and guidelines into ChromaDB.
    MongoDB remains the source of truth.
    """

    synced_ids = []

    # 1. Approved claims
    claims = await db.claims.find().to_list(500)

    for claim in claims:
        cid = str(claim["_id"])
        text = document_to_text(claim)

        add_knowledge(
            knowledge_id=f"claim_{cid}",
            text=text,
            category="claim",
            metadata={"source_id": cid},
        )

        synced_ids.append(f"claim_{cid}")

    # 2. Terminology
    terms = await db.terms.find().to_list(500)

    for term in terms:
        tid = str(term["_id"])
        text = document_to_text(term)

        add_knowledge(
            knowledge_id=f"term_{tid}",
            text=text,
            category="terminology",
            metadata={"source_id": tid},
        )

        synced_ids.append(f"term_{tid}")

    # 3. Main guidelines
    guideline = await db.guidelines.find_one({"_id": "main"})

    if guideline and guideline.get("body"):
        add_knowledge(
            knowledge_id="guidelines_main",
            text=guideline["body"],
            category="guideline",
            metadata={"source_id": "main"},
        )

        synced_ids.append("guidelines_main")

    # 4. Remove stale entries belonging to these collections
    existing = collection_ids = None

    from rag.knowledge_base import collection

    existing = collection.get()

    for existing_id in existing["ids"]:
        if existing_id.startswith(("claim_", "term_", "guidelines_")):
            if existing_id not in synced_ids:
                delete_knowledge(existing_id)

    return {
        "claims": len(claims),
        "terms": len(terms),
        "guidelines": bool(guideline and guideline.get("body")),
        "total_synced": len(synced_ids),
    }
