import os
import uuid
import time
import json
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, Header, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from db.store import load_db, save_db, qdrant_client, COLLECTION_NAME, init_qdrant
from qdrant_client.models import PointStruct
from agents.discovery import search_arxiv, run_discovery_agent
from agents.analysis import extract_pdf_content, chunk_text, generate_embeddings, run_analysis_agent
from agents.comparison import run_comparison_agent
from agents.graph import chat_graph

app = FastAPI(title="arXivAgent API", description="Backend server for arXivAgent Research Intelligence Platform")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local development, or list ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class WorkspaceCreate(BaseModel):
    name: str

class SearchRequest(BaseModel):
    query: Optional[str] = None
    id_list: Optional[List[str]] = None
    start: Optional[int] = 0
    max_results: Optional[int] = 15

class IngestRequest(BaseModel):
    workspace_id: str
    arxiv_id: str
    title: str
    abstract: str
    authors: List[str]
    publication_date: str
    categories: List[str]
    pdf_url: str

class ThreadCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ChatRequest(BaseModel):
    workspace_id: str
    paper_ids: Optional[List[str]] = None
    question: str
    history: List[Dict[str, str]] = []
    openai_model: Optional[str] = "gpt-4o-mini"
    gemini_model: Optional[str] = "gemini-1.5-flash"
    thread_id: Optional[str] = None

class CompareRequest(BaseModel):
    paper_ids: List[str]

# Helper to configure LangSmith environment variables dynamically
def setup_langsmith(langsmith_key: Optional[str], langsmith_project: Optional[str]):
    if langsmith_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = langsmith_key
        os.environ["LANGCHAIN_PROJECT"] = langsmith_project or "arXivAgent"
    else:
        os.environ["LANGCHAIN_TRACING_V2"] = "false"

# Routes
@app.get("/api/workspaces")
async def get_workspaces():
    db = load_db()
    return db.get("workspaces", [])

@app.post("/api/workspaces")
async def create_workspace(body: WorkspaceCreate):
    db = load_db()
    workspace_id = str(uuid.uuid4())
    new_workspace = {
        "id": workspace_id,
        "name": body.name,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    db["workspaces"].append(new_workspace)
    save_db(db)
    return new_workspace


@app.get("/api/workspaces/{workspace_id}/threads")
async def get_workspace_threads(workspace_id: str):
    db = load_db()
    if "threads" not in db:
        db["threads"] = []
        save_db(db)
        
    threads = [t for t in db["threads"] if t.get("workspace_id") == workspace_id]
    
    # If no threads exist in this workspace, automatically create a default thread
    if not threads:
        thread_id = str(uuid.uuid4())
        default_thread = {
            "id": thread_id,
            "workspace_id": workspace_id,
            "title": "New Chat",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        db["threads"].append(default_thread)
        
        # Migrate existing conversations (which don't have thread_id) in this workspace to this default thread
        conversations_updated = False
        for c in db.get("conversations", []):
            if c.get("workspace_id") == workspace_id and not c.get("thread_id"):
                c["thread_id"] = thread_id
                conversations_updated = True
        
        save_db(db)
        threads = [default_thread]
        
    # Sort threads by created_at desc
    threads.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return threads

@app.post("/api/workspaces/{workspace_id}/threads")
async def create_workspace_thread(workspace_id: str, body: ThreadCreate):
    db = load_db()
    if "threads" not in db:
        db["threads"] = []
        
    thread_id = str(uuid.uuid4())
    new_thread = {
        "id": thread_id,
        "workspace_id": workspace_id,
        "title": body.title or "New Chat",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    db["threads"].append(new_thread)
    save_db(db)
    return new_thread

@app.delete("/api/threads/{thread_id}")
async def delete_chat_thread(thread_id: str):
    db = load_db()
    if "threads" not in db:
        db["threads"] = []
        
    # Find thread
    thread_exists = False
    new_threads = []
    for t in db["threads"]:
        if t["id"] == thread_id:
            thread_exists = True
        else:
            new_threads.append(t)
            
    if not thread_exists:
        raise HTTPException(status_code=404, detail="Chat thread not found.")
        
    # Cascade delete conversations and evaluations
    conv_ids_to_delete = []
    new_conversations = []
    for c in db.get("conversations", []):
        if c.get("thread_id") == thread_id:
            conv_ids_to_delete.append(c["id"])
        else:
            new_conversations.append(c)
            
    new_evaluations = [e for e in db.get("evaluations", []) if e.get("answer_id") not in conv_ids_to_delete]
    
    db["threads"] = new_threads
    db["conversations"] = new_conversations
    db["evaluations"] = new_evaluations
    save_db(db)
    
    return {"status": "success", "message": "Chat thread and all associated messages deleted successfully."}

@app.get("/api/threads/{thread_id}/messages")
async def get_thread_messages(thread_id: str):
    db = load_db()
    # Find all conversations belonging to the thread
    conversations = [c for c in db.get("conversations", []) if c.get("thread_id") == thread_id]
    
    # Sort conversations by timestamp/chronologically
    conversations.sort(key=lambda x: x.get("timestamp", ""))
    
    # Attach evaluations
    evals = {e["answer_id"]: e for e in db.get("evaluations", [])}
    for c in conversations:
        c["evaluation"] = evals.get(c["id"])
        
    return conversations


@app.get("/api/workspaces/{workspace_id}/papers")
async def get_workspace_papers(workspace_id: str):
    db = load_db()
    papers = [p for p in db.get("papers", []) if p.get("workspace_id") == workspace_id]
    
    # Strip chunks for list payload to save bandwidth
    minimal_papers = []
    for p in papers:
        p_copy = p.copy()
        p_copy.pop("chunks", None)
        minimal_papers.append(p_copy)
    return minimal_papers

@app.post("/api/arxiv/search")
async def search_papers(
    body: SearchRequest,
    x_openai_key: Optional[str] = Header(None),
    x_gemini_key: Optional[str] = Header(None)
):
    from fastapi.responses import StreamingResponse

    async def event_generator():
        try:
            # Yield step 1: Querying arXiv
            query_desc = f"\"{body.query}\"" if body.query else f"IDs: {', '.join(body.id_list)}"
            yield f"data: {json.dumps({'type': 'info', 'step': 'arXiv Query', 'message': f'Querying export.arxiv.org for {query_desc} (start={body.start}, count={body.max_results})...'})}\n\n"
            await asyncio.sleep(0.05)
            
            raw_papers = search_arxiv(
                query=body.query,
                id_list=body.id_list,
                start=body.start,
                max_results=body.max_results,
                openai_key=x_openai_key,
                gemini_key=x_gemini_key
            )
            
            yield f"data: {json.dumps({'type': 'info', 'step': 'arXiv Query', 'message': f'Retrieved {len(raw_papers)} papers. Starting Discovery Agent relevance analysis...'})}\n\n"
            await asyncio.sleep(0.05)
            
            if not raw_papers:
                yield f"data: {json.dumps({'type': 'done', 'papers': []})}\n\n"
                return
                
            scored_papers = []
            
            # Evaluate relevance for each paper
            for idx, paper in enumerate(raw_papers):
                paper_title_short = paper.get("title", "")[:55]
                yield f"data: {json.dumps({'type': 'agent_thought', 'step': 'Discovery Agent', 'message': f'[{idx+1}/{len(raw_papers)}] Analyzing relevance for: \"{paper_title_short}...\"'})}\n\n"
                await asyncio.sleep(0.02)
                
                yield f"data: {json.dumps({'type': 'tool_call', 'step': 'Discovery Agent', 'message': 'Invoking relevance LLM agent with paper abstract and user search query...'})}\n\n"
                await asyncio.sleep(0.02)
                
                # Assess paper relevance using agent
                scored = run_discovery_agent(
                    query=body.query,
                    papers=[paper],
                    openai_key=x_openai_key,
                    gemini_key=x_gemini_key
                )[0]
                
                scored_papers.append(scored)
                
                relevance_score = scored.get("relevance_score", 0)
                relevance_just = scored.get("relevance_justification", "")
                yield f"data: {json.dumps({'type': 'agent_result', 'step': 'Discovery Agent', 'message': f'Paper Relevance: {relevance_score}% - \"{relevance_just}\"'})}\n\n"
                await asyncio.sleep(0.02)
                
            # Sort by relevance desc
            scored_papers.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
            
            yield f"data: {json.dumps({'type': 'done', 'papers': scored_papers})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Search pipeline failed: {str(e)}'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/arxiv/ingest")
async def ingest_paper(
    body: IngestRequest,
    x_openai_key: Optional[str] = Header(None),
    x_gemini_key: Optional[str] = Header(None)
):
    if not x_openai_key:
        raise HTTPException(status_code=400, detail="OpenAI API key is required to generate chunk embeddings.")
        
    db = load_db()
    
    # Check if paper is already ingested in this workspace
    existing = [p for p in db["papers"] if p["arxiv_id"] == body.arxiv_id and p["workspace_id"] == body.workspace_id]
    if existing:
        return existing[0]

    try:
        # 1. Download PDF & Extract Text
        try:
            text = extract_pdf_content(body.pdf_url)
        except Exception as pdf_err:
            print(f"PDF extraction failed ({pdf_err}). Falling back to abstract-only chunking.")
            text = f"Title: {body.title}\n\nAbstract:\n{body.abstract}"
        
        # 2. Chunk text
        chunks = chunk_text(text)
        
        # 3. Generate Embeddings for chunks (using text-embedding-3-large, 3072 dims)
        embeddings = generate_embeddings(chunks, x_openai_key)
        
        # 4. Generate Paper Summary via Analysis Agent
        analysis = run_analysis_agent(
            text=text,
            openai_key=x_openai_key,
            gemini_key=x_gemini_key
        )
        
        paper_id = str(uuid.uuid4())
        
        # Format chunks with embeddings for database
        db_chunks = []
        for idx, (chunk_text_content, emb) in enumerate(zip(chunks, embeddings)):
            db_chunks.append({
                "id": f"chunk_{idx}",
                "text": chunk_text_content,
                "embedding": emb
            })
            
        new_paper = {
            "id": paper_id,
            "workspace_id": body.workspace_id,
            "arxiv_id": body.arxiv_id,
            "title": body.title,
            "abstract": body.abstract,
            "authors": body.authors,
            "publication_date": body.publication_date,
            "categories": body.categories,
            "pdf_url": body.pdf_url,
            "analysis": analysis,
            "chunks": db_chunks
        }
        
        # 5. Populate chunks in Qdrant
        init_qdrant(len(embeddings[0]))
        points = []
        for idx, (chunk_text_content, emb) in enumerate(zip(chunks, embeddings)):
            points.append(
                PointStruct(
                    id=int(hash(f"{paper_id}_chunk_{idx}") % 10**8),  # Generate unique numeric ID
                    vector=emb,
                    payload={
                        "paper_id": paper_id,
                        "arxiv_id": body.arxiv_id,
                        "title": body.title,
                        "chunk_id": f"chunk_{idx}",
                        "text": chunk_text_content,
                        "workspace_id": body.workspace_id
                    }
                )
            )
            
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
        
        # 6. Save in JSON DB
        db["papers"].append(new_paper)
        save_db(db)
        
        # Clean up chunk embeddings in return payload to reduce response size
        return_paper = new_paper.copy()
        return_paper.pop("chunks", None)
        return return_paper
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.post("/api/chat")
async def chat_with_papers(
    body: ChatRequest,
    x_openai_key: Optional[str] = Header(None),
    x_gemini_key: Optional[str] = Header(None),
    x_langsmith_key: Optional[str] = Header(None),
    x_langsmith_project: Optional[str] = Header(None)
):
    setup_langsmith(x_langsmith_key, x_langsmith_project)
    
    # Check if we have papers in this workspace
    db = load_db()
    workspace_papers = [p for p in db.get("papers", []) if p.get("workspace_id") == body.workspace_id]
    if not workspace_papers:
        raise HTTPException(status_code=400, detail="No papers ingested in this workspace. Please search and ingest a paper first.")

    # 1. Resolve or create thread
    thread_id = body.thread_id
    if "threads" not in db:
        db["threads"] = []
        
    thread_found = False
    if thread_id:
        for t in db["threads"]:
            if t["id"] == thread_id and t.get("workspace_id") == body.workspace_id:
                thread_found = True
                break
                
    if not thread_found:
        # Fallback to the most recent thread in the workspace, or create one
        ws_threads = [t for t in db["threads"] if t.get("workspace_id") == body.workspace_id]
        if ws_threads:
            # Sort by created_at desc
            ws_threads.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            thread_id = ws_threads[0]["id"]
        else:
            # Create a brand new default thread
            thread_id = str(uuid.uuid4())
            title = "New Chat"
            if body.paper_ids:
                db_papers = db.get("papers", [])
                selected_papers = [p for p in db_papers if p.get("id") in body.paper_ids]
                if len(selected_papers) == 1:
                    t_val = selected_papers[0].get("title", "")
                    title = f"Chat: {t_val}" if len(t_val) <= 40 else f"Chat: {t_val[:37]}..."
                elif len(selected_papers) == 2:
                    t1 = selected_papers[0].get("title", "")
                    t2 = selected_papers[1].get("title", "")
                    name1 = t1 if len(t1) <= 18 else f"{t1[:15]}..."
                    name2 = t2 if len(t2) <= 18 else f"{t2[:15]}..."
                    title = f"{name1} & {name2}"
                elif len(selected_papers) > 2:
                    title = f"Compare: {len(selected_papers)} Papers"

            new_thread = {
                "id": thread_id,
                "workspace_id": body.workspace_id,
                "title": title,
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            db["threads"].append(new_thread)

    # 2. Rename thread if it's currently "New Chat"
    for t in db["threads"]:
        if t["id"] == thread_id and t.get("title") == "New Chat":
            title = body.question.strip()
            if len(title) > 40:
                title = title[:40] + "..."
            t["title"] = title
            break

    state = {
        "question": body.question,
        "workspace_id": body.workspace_id,
        "paper_ids": body.paper_ids,
        "history": body.history,
        "api_keys": {
            "openai_key": x_openai_key,
            "gemini_key": x_gemini_key
        },
        "openai_model": body.openai_model,
        "gemini_model": body.gemini_model,
        "retrieved_chunks": [],
        "answer": "",
        "verification_report": {},
        "evaluation_metrics": {},
        "traces": []
    }
    
    try:
        # Execute LangGraph workflow
        result = chat_graph.invoke(state)
        
        # Save conversation in DB
        conversation_id = str(uuid.uuid4())
        new_conv = {
            "id": conversation_id,
            "thread_id": thread_id,
            "workspace_id": body.workspace_id,
            "question": body.question,
            "answer": result.get("answer"),
            "paper_ids": body.paper_ids,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "retrieved_chunks": result.get("retrieved_chunks", []),
            "verification_report": result.get("verification_report", {}),
            "traces": result.get("traces", [])
        }
        db["conversations"].append(new_conv)
        
        # Save evaluation
        evaluation_id = str(uuid.uuid4())
        new_eval = {
            "id": evaluation_id,
            "answer_id": conversation_id,
            **result.get("evaluation_metrics", {})
        }
        db["evaluations"].append(new_eval)
        save_db(db)
        
        return {
            "conversation_id": conversation_id,
            "thread_id": thread_id,
            "answer": result.get("answer"),
            "retrieved_chunks": result.get("retrieved_chunks", []),
            "verification_report": result.get("verification_report", {}),
            "evaluation_metrics": result.get("evaluation_metrics", {}),
            "traces": result.get("traces", [])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare")
async def compare_papers(
    body: CompareRequest,
    x_openai_key: Optional[str] = Header(None),
    x_gemini_key: Optional[str] = Header(None)
):
    db = load_db()
    papers = [p for p in db.get("papers", []) if p["id"] in body.paper_ids]
    if not papers:
        raise HTTPException(status_code=400, detail="Selected papers not found.")
        
    try:
        comparison = run_comparison_agent(
            papers=papers,
            openai_key=x_openai_key,
            gemini_key=x_gemini_key
        )
        return comparison
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/conversations/{workspace_id}")
async def get_conversations(workspace_id: str):
    db = load_db()
    conversations = [c for c in db.get("conversations", []) if c.get("workspace_id") == workspace_id]
    
    # Attach evaluations
    evals = {e["answer_id"]: e for e in db.get("evaluations", [])}
    for c in conversations:
        c["evaluation"] = evals.get(c["id"])
        
    return conversations

@app.delete("/api/papers/{paper_id}")
async def delete_paper(paper_id: str):
    db = load_db()
    
    # Check if paper exists
    paper_exists = False
    new_papers = []
    for p in db.get("papers", []):
        if p["id"] == paper_id:
            paper_exists = True
        else:
            new_papers.append(p)
            
    if not paper_exists:
        raise HTTPException(status_code=404, detail="Paper not found in database.")
        
    # Save updated list to database
    db["papers"] = new_papers
    save_db(db)
    
    # Delete points from Qdrant client
    try:
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="paper_id",
                        match=MatchValue(value=paper_id)
                    )
                ]
            )
        )
    except Exception as q_err:
        print(f"Failed to delete embeddings from Qdrant: {q_err}")
        
    return {"status": "success", "message": "Paper deleted successfully from workspace."}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
