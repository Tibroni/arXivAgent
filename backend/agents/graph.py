import time
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from qdrant_client.models import Filter, FieldCondition, MatchValue

from db.store import qdrant_client, COLLECTION_NAME
from agents.verification import run_verification_agent
from agents.evaluator import run_evaluation_agent
from agents.analysis import generate_embeddings

class AgentState(TypedDict):
    question: str
    workspace_id: str
    paper_ids: Optional[List[str]]  # If empty, query all papers in workspace
    history: List[Dict[str, str]]
    api_keys: Dict[str, str]
    openai_model: str
    gemini_model: str
    
    # Outputs/State updates
    retrieved_chunks: List[Dict[str, Any]]
    answer: str
    verification_report: Dict[str, Any]
    evaluation_metrics: Dict[str, Any]
    traces: List[Dict[str, Any]]
    token_usage: Dict[str, int]
    execution_time_ms: Dict[str, float]

def add_trace(state: AgentState, step_name: str, details: str, duration_ms: float):
    if "traces" not in state or state["traces"] is None:
        state["traces"] = []
    state["traces"].append({
        "step": step_name,
        "details": details,
        "timestamp": time.time(),
        "duration_ms": duration_ms
    })

# Node 1: Retrieve chunks
def retrieve_node(state: AgentState) -> Dict[str, Any]:
    start_time = time.time()
    question = state["question"]
    workspace_id = state["workspace_id"]
    paper_ids = state.get("paper_ids", [])
    api_keys = state["api_keys"]
    
    openai_key = api_keys.get("openai_key")
    if not openai_key:
        return {
            "retrieved_chunks": [],
            "traces": state.get("traces", []) + [{
                "step": "Retrieval",
                "details": "Skipped: OpenAI key missing for query embedding generation.",
                "duration_ms": 0
            }]
        }
        
    try:
        # Generate question embedding
        question_emb = generate_embeddings([question], openai_key)[0]
        
        # Build Filter conditions
        conditions = [
            FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))
        ]
        
        # If specific papers are selected, restrict to those papers
        if paper_ids:
            # MatchValue matches a single value, to match any we can do multiple conditions or custom logic.
            # In Qdrant we can do MatchAny if supported, or filter client-side.
            # Let's filter client-side to ensure robust compatibility with all in-memory setups.
            pass
            
        # Perform vector search using modern query_points API
        search_results = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=question_emb,
            query_filter=Filter(must=conditions),
            limit=8
        ).points
        
        retrieved_chunks = []
        for res in search_results:
            payload = res.payload
            # Client-side filtering by paper_ids if specified
            if paper_ids and payload.get("paper_id") not in paper_ids:
                continue
                
            retrieved_chunks.append({
                "paper_id": payload.get("paper_id"),
                "arxiv_id": payload.get("arxiv_id"),
                "title": payload.get("title"),
                "chunk_id": payload.get("chunk_id"),
                "text": payload.get("text"),
                "score": res.score
            })
        duration = (time.time() - start_time) * 1000
        trace = {
            "step": "Vector Retrieval",
            "details": f"Retrieved {len(retrieved_chunks)} chunks from Qdrant.",
            "duration_ms": duration
        }
        return {
            "retrieved_chunks": retrieved_chunks,
            "traces": state.get("traces", []) + [trace]
        }
        
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        trace = {
            "step": "Vector Retrieval",
            "details": f"Retrieval failed: {str(e)}",
            "duration_ms": duration
        }
        return {
            "retrieved_chunks": [],
            "traces": state.get("traces", []) + [trace]
        }

# Node 2: Generate answer
def generate_node(state: AgentState) -> Dict[str, Any]:
    start_time = time.time()
    question = state["question"]
    chunks = state["retrieved_chunks"]
    api_keys = state["api_keys"]
    history = state.get("history", [])
    
    openai_key = api_keys.get("openai_key")
    gemini_key = api_keys.get("gemini_key")
    
    # Choose model
    if gemini_key:
        llm = ChatGoogleGenerativeAI(
            model=state.get("gemini_model", "gemini-1.5-flash"),
            google_api_key=gemini_key,
            temperature=0.3
        )
    elif openai_key:
        llm = ChatOpenAI(
            model=state.get("openai_model", "gpt-4o-mini"),
            api_key=openai_key,
            temperature=0.3
        )
    else:
        return {
            "answer": "Please enter your API keys (OpenAI or Gemini) in Settings to interact with papers.",
            "traces": state.get("traces", []) + [{
                "step": "Generation",
                "details": "Skipped: API keys missing.",
                "duration_ms": 0
            }]
        }
        
    # Formulate context
    context_str = ""
    if chunks:
        for idx, chunk in enumerate(chunks):
            context_str += f"[{idx+1}] \"{chunk['title']}\" (Chunk {chunk['chunk_id']}):\n{chunk['text']}\n\n"
    else:
        context_str = "No papers found or selected in the active workspace. Please search arXiv and ingest papers first."
        
    # Build history context
    history_str = ""
    for msg in history:
        history_str += f"{msg.get('role', 'user')}: {msg.get('content', '')}\n"
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an advanced Paper Analysis Agent in a Research Intelligence Platform. "
                   "Answer the user's question about the ingested papers using the retrieved context chunks. "
                   "Format your answer beautifully in markdown. "
                   "For every claim you make, cite the paper and chunk index using brackets like [1] or [2] etc. "
                   "If the context does not contain the answer, explain what is missing instead of fabricating claims."),
        ("user", "Previous Conversation History:\n{history}\n\nRetrieved Context Chunks:\n{context}\n\nUser Question: {question}")
    ])
    
    chain = prompt | llm
    
    try:
        response = chain.invoke({
            "history": history_str,
            "context": context_str,
            "question": question
        })
        answer = response.content
        duration = (time.time() - start_time) * 1000
        trace = {
            "step": "Answer Generation",
            "details": f"Generated markdown response using {llm.model}.",
            "duration_ms": duration
        }
        return {
            "answer": answer,
            "traces": state.get("traces", []) + [trace]
        }
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        trace = {
            "step": "Answer Generation",
            "details": f"Generation failed: {str(e)}",
            "duration_ms": duration
        }
        return {
            "answer": f"Error generating answer: {str(e)}",
            "traces": state.get("traces", []) + [trace]
        }

# Node 3: Verify citations
def verify_node(state: AgentState) -> Dict[str, Any]:
    start_time = time.time()
    answer = state["answer"]
    chunks = state["retrieved_chunks"]
    api_keys = state["api_keys"]
    
    openai_key = api_keys.get("openai_key")
    gemini_key = api_keys.get("gemini_key")
    
    report = run_verification_agent(
        answer=answer,
        retrieved_chunks=chunks,
        openai_key=openai_key,
        gemini_key=gemini_key,
        openai_model=state.get("openai_model", "gpt-4o-mini"),
        gemini_model=state.get("gemini_model", "gemini-1.5-flash")
    )
    
    duration = (time.time() - start_time) * 1000
    trace = {
        "step": "Citation Verification Agent",
        "details": f"Verified grounding: confidence score {report.get('confidence_score', 0)}%. {report.get('summary', '')}",
        "duration_ms": duration
    }
    return {
        "verification_report": report,
        "traces": state.get("traces", []) + [trace]
    }

# Node 4: Evaluate answer
def evaluate_node(state: AgentState) -> Dict[str, Any]:
    start_time = time.time()
    question = state["question"]
    answer = state["answer"]
    chunks = state["retrieved_chunks"]
    api_keys = state["api_keys"]
    
    openai_key = api_keys.get("openai_key")
    gemini_key = api_keys.get("gemini_key")
    
    metrics = run_evaluation_agent(
        question=question,
        answer=answer,
        retrieved_chunks=chunks,
        openai_key=openai_key,
        gemini_key=gemini_key,
        openai_model=state.get("openai_model", "gpt-4o-mini"),
        gemini_model=state.get("gemini_model", "gemini-1.5-flash")
    )
    
    duration = (time.time() - start_time) * 1000
    trace = {
        "step": "RAGAS Evaluation Agent",
        "details": f"Answer scored: Faithfulness {metrics.get('faithfulness', 0)}, Relevance {metrics.get('relevance', 0)}.",
        "duration_ms": duration
    }
    return {
        "evaluation_metrics": metrics,
        "traces": state.get("traces", []) + [trace]
    }

# Compile Graph
def compile_chat_graph():
    builder = StateGraph(AgentState)
    
    # Add Nodes
    builder.add_node("retrieve", retrieve_node)
    builder.add_node("generate", generate_node)
    builder.add_node("verify", verify_node)
    builder.add_node("evaluate", evaluate_node)
    
    # Add Edges
    builder.set_entry_point("retrieve")
    builder.add_edge("retrieve", "generate")
    builder.add_edge("generate", "verify")
    builder.add_edge("verify", "evaluate")
    builder.add_edge("evaluate", END)
    
    return builder.compile()

# Compile global graph
chat_graph = compile_chat_graph()
