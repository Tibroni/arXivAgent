from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

class RagasEvaluation(BaseModel):
    faithfulness: float = Field(description="Faithfulness score (0.0 to 1.0). Is the generated answer supported by the retrieved chunks?")
    relevance: float = Field(description="Answer relevance score (0.0 to 1.0). Does the answer directly and accurately address the user's question?")
    context_precision: float = Field(description="Context precision score (0.0 to 1.0). Are the retrieved chunks highly relevant to the question, with minimal noise?")
    context_recall: float = Field(description="Context recall score (0.0 to 1.0). Do the retrieved chunks contain all the necessary details required to formulate the answer?")
    hallucination_risk: float = Field(description="Hallucination risk score (0.0 to 1.0). What is the risk that the answer contains unsupported claims?")
    justification: str = Field(description="A detailed summary justification for these evaluation scores (2-3 sentences)")

def run_evaluation_agent(question: str, answer: str, retrieved_chunks: List[Dict[str, Any]], openai_key: str = None, gemini_key: str = None, openai_model: str = "gpt-4o-mini", gemini_model: str = "gemini-1.5-flash") -> Dict[str, Any]:
    if not answer or not retrieved_chunks:
        return {
            "faithfulness": 0.0,
            "relevance": 0.0,
            "context_precision": 0.0,
            "context_recall": 0.0,
            "hallucination_risk": 1.0,
            "justification": "Evaluation skipped: answer or retrieved chunks were empty."
        }
        
    # Choose LLM
    if gemini_key:
        llm = ChatGoogleGenerativeAI(
            model=gemini_model,
            google_api_key=gemini_key,
            temperature=0.0
        )
    elif openai_key:
        llm = ChatOpenAI(
            model=openai_model,
            api_key=openai_key,
            temperature=0.0
        )
    else:
        return {
            "faithfulness": 0.5,
            "relevance": 0.5,
            "context_precision": 0.5,
            "context_recall": 0.5,
            "hallucination_risk": 0.5,
            "justification": "API keys not available for evaluation scoring."
        }

    structured_llm = llm.with_structured_output(RagasEvaluation)
    
    # Formulate context chunks description
    chunks_str = ""
    for idx, chunk in enumerate(retrieved_chunks):
        chunks_str += f"Chunk {idx} (Title: {chunk.get('title', 'Unknown')}):\n"
        chunks_str += f"{chunk.get('text', '')}\n\n"
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Evaluation Agent. Evaluate the performance of our RAG pipeline for the given question, generated answer, and retrieved context chunks. "
                   "Provide scores between 0.0 and 1.0 for: \n"
                   "- Faithfulness (answer supported by context?)\n"
                   "- Relevance (answer addresses the question?)\n"
                   "- Context Precision (retrieved chunks relevant?)\n"
                   "- Context Recall (retrieved chunks contain all needed info?)\n"
                   "- Hallucination Risk (likelihood of unsupported assertions?)\n"
                   "Write a concise summary justification for your scores."),
        ("user", "User Question: {question}\n\nRetrieved Context Chunks:\n{chunks}\n\nGenerated Answer:\n{answer}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        res = chain.invoke({
            "question": question,
            "chunks": chunks_str,
            "answer": answer
        })
        return {
            "faithfulness": res.faithfulness,
            "relevance": res.relevance,
            "context_precision": res.context_precision,
            "context_recall": res.context_recall,
            "hallucination_risk": res.hallucination_risk,
            "justification": res.justification
        }
    except Exception as e:
        # Fallback
        return {
            "faithfulness": 0.0,
            "relevance": 0.0,
            "context_precision": 0.0,
            "context_recall": 0.0,
            "hallucination_risk": 1.0,
            "justification": f"Evaluation execution failed: {str(e)}"
        }
