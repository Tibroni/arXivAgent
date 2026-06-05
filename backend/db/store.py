import os
import json
from typing import Dict, List, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

DB_FILE = os.path.join(os.path.dirname(__file__), "db.json")

# In-memory Qdrant client
qdrant_client = QdrantClient(":memory:")
COLLECTION_NAME = "arxiv_papers"
collection_initialized = False

def init_qdrant(vector_size: int = 3072):
    global collection_initialized
    try:
        qdrant_client.get_collection(COLLECTION_NAME)
    except Exception:
        qdrant_client.recreate_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
        )
    collection_initialized = True

def load_db() -> Dict[str, Any]:
    if not os.path.exists(DB_FILE):
        default_db = {
            "workspaces": [],
            "papers": [],
            "conversations": [],
            "evaluations": []
        }
        save_db(default_db)
        return default_db
    try:
        with open(DB_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return {"workspaces": [], "papers": [], "conversations": [], "evaluations": []}

def save_db(data: Dict[str, Any]):
    with open(DB_FILE, "w") as f:
        json.dump(data, f, indent=2)

def populate_qdrant_from_db():
    db = load_db()
    papers = db.get("papers", [])
    if not papers:
        return
    
    # Get vector size from first paper if available
    vector_size = 3072
    for paper in papers:
        chunks = paper.get("chunks", [])
        if chunks and "embedding" in chunks[0]:
            vector_size = len(chunks[0]["embedding"])
            break
            
    init_qdrant(vector_size)
    
    points = []
    point_idx = 1
    for paper in papers:
        for chunk in paper.get("chunks", []):
            if "embedding" in chunk and chunk["embedding"]:
                points.append(
                    PointStruct(
                        id=point_idx,
                        vector=chunk["embedding"],
                        payload={
                            "paper_id": paper["id"],
                            "arxiv_id": paper.get("arxiv_id", ""),
                            "title": paper["title"],
                            "chunk_id": chunk["id"],
                            "text": chunk["text"],
                            "workspace_id": paper.get("workspace_id", "")
                        }
                    )
                )
                point_idx += 1
                
    if points:
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )

# Initialize Qdrant upon import
try:
    populate_qdrant_from_db()
except Exception as e:
    print(f"Error pre-populating Qdrant: {e}")
