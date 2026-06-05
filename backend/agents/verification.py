import re
from typing import List, Dict, Any, Optional
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

class VerifiedClaim(BaseModel):
    sentence: str = Field(description="The sentence from the AI's answer that is being verified")
    is_grounded: bool = Field(description="True if the sentence is fully supported by the retrieved chunks, False otherwise")
    supporting_chunk_ids: List[str] = Field(default_factory=list, description="IDs of the chunks that support this sentence (e.g. ['chunk_1', 'chunk_2'])")
    explanation: str = Field(description="Brief explanation of how the chunk supports the claim or why it is unsupported")

class VerificationReport(BaseModel):
    claims: List[VerifiedClaim] = Field(description="List of verified sentences in the answer")
    confidence_score: int = Field(description="Overall grounding confidence score from 0 to 100 based on grounded claims")
    summary: str = Field(description="Overall assessment of verification, highlighting any potential hallucinated claims")

def split_into_sentences(text: str) -> List[str]:
    # Simple regex to split text into sentences, avoiding decimal points in numbers
    sentences = re.split(r'(?<!\d)\.(?!\d)\s+|\n+', text)
    return [s.strip() + "." for s in sentences if s.strip() and not s.strip().endswith('.')]

def run_verification_agent(answer: str, retrieved_chunks: List[Dict[str, Any]], openai_key: str = None, gemini_key: str = None, openai_model: str = "gpt-4o-mini", gemini_model: str = "gemini-1.5-flash") -> Dict[str, Any]:
    if not answer or not retrieved_chunks:
        return {
            "claims": [],
            "confidence_score": 0,
            "summary": "No content or context available for verification."
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
            "claims": [],
            "confidence_score": 50,
            "summary": "API keys not available for verification."
        }

    structured_llm = llm.with_structured_output(VerificationReport)
    
    # Formulate context chunks description
    chunks_str = ""
    for idx, chunk in enumerate(retrieved_chunks):
        chunks_str += f"--- START CHUNK {chunk.get('chunk_id', idx)} ---\n"
        chunks_str += f"Paper Title: {chunk.get('title', 'Unknown')}\n"
        chunks_str += f"Content: {chunk.get('text', '')}\n"
        chunks_str += f"--- END CHUNK {chunk.get('chunk_id', idx)} ---\n\n"
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Citation Verification Agent. Your task is to verify whether the AI's answer is fully grounded in the provided retrieved source chunks. "
                   "Break down the AI's answer into individual key claims/sentences and verify each one. "
                   "For each sentence, determine: \n"
                   "1. If it is supported by any source chunk (is_grounded: True/False).\n"
                   "2. Which chunks support it (supporting_chunk_ids, e.g. ['chunk_0', 'chunk_1']).\n"
                   "3. A short explanation of your reasoning.\n\n"
                   "Calculate a confidence_score from 0 to 100 based on the ratio of grounded sentences to total sentences, and provide a summary report."),
        ("user", "Retrieved Source Chunks:\n{chunks}\n\nAI's Answer to Verify:\n{answer}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        res = chain.invoke({
            "chunks": chunks_str,
            "answer": answer
        })
        return {
            "claims": [claim.dict() for claim in res.claims],
            "confidence_score": res.confidence_score,
            "summary": res.summary
        }
    except Exception as e:
        # Fallback
        return {
            "claims": [],
            "confidence_score": 0,
            "summary": f"Verification execution failed: {str(e)}"
        }
