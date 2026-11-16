from rag.knowledge_base import (
    add_knowledge,
    retrieve_knowledge,
    knowledge_count,
)

# Sample approved brand knowledge
add_knowledge(
    knowledge_id="claim_001",
    text="Brandora helps organizations maintain consistent brand messaging.",
    category="claim",
    metadata={"approved": True},
)

add_knowledge(
    knowledge_id="guideline_001",
    text="Avoid absolute claims such as best, guaranteed, and 100% unless approved evidence exists.",
    category="guideline",
    metadata={"approved": True},
)

print("Knowledge count:", knowledge_count())

results = retrieve_knowledge(
    "Can we claim our product is the best?",
    limit=3,
)

print("\nRetrieved knowledge:")

for item in results:
    print("\nID:", item["id"])
    print("Text:", item["text"])
    print("Distance:", item["distance"])
