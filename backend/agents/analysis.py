import io
import requests
from typing import List, Dict, Any, Tuple
from pypdf import PdfReader
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from agents.discovery import rate_limit_arxiv

class PaperAnalysis(BaseModel):
    executive_summary: str = Field(description="A high-level executive summary of the paper for quick understanding (1-2 paragraphs)")
    technical_summary: str = Field(description="A technical summary detailing the methodology, design, and architecture (2-3 paragraphs)")
    key_contributions: List[str] = Field(description="List of the paper's primary contributions")
    key_findings: List[str] = Field(description="List of key insights, results, or findings from the paper")

def extract_pdf_content(pdf_url: str) -> str:
    # Enforce arXiv rate limiting rules before downloading PDF
    rate_limit_arxiv()
    
    headers = {
        'User-Agent': 'arXivAgent/1.0 (https://github.com/cash/arXivAgent; contact: developer@example.com)'
    }
    response = requests.get(pdf_url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Failed to download PDF from {pdf_url}: Status {response.status_code}")
        
    pdf_file = io.BytesIO(response.content)
    reader = PdfReader(pdf_file)
    
    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"
            
    return text

def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 250) -> List[str]:
    chunks = []
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += (chunk_size - overlap)
        
    return chunks

def generate_embeddings(chunks: List[str], api_key: str, model: str = "text-embedding-3-large") -> List[List[float]]:
    # Initialize OpenAI client to get embeddings
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    
    embeddings = []
    # Process in batches of 100 chunks
    batch_size = 100
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i+batch_size]
        response = client.embeddings.create(
            input=batch,
            model=model
        )
        embeddings.extend([data.embedding for data in response.data])
        
    return embeddings

def run_analysis_agent(text: str, openai_key: str = None, gemini_key: str = None, openai_model: str = "gpt-4o-mini", gemini_model: str = "gemini-1.5-flash") -> Dict[str, Any]:
    # Use the first 12,000 characters for paper summary, which includes introduction and contributions
    sample_text = text[:12000]
    
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
        # Fallback
        return {
            "executive_summary": "API key required to generate executive summary.",
            "technical_summary": "API key required to generate technical summary.",
            "key_contributions": ["API key required"],
            "key_findings": ["API key required"]
        }

    structured_llm = llm.with_structured_output(PaperAnalysis)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Paper Analysis Agent. Analyze the beginning of this research paper and extract its executive summary, technical summary, key contributions, and key findings. Provide a professional, deep-dive academic assessment."),
        ("user", "Paper Context:\n\n{text}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        res = chain.invoke({"text": sample_text})
        return {
            "executive_summary": res.executive_summary,
            "technical_summary": res.technical_summary,
            "key_contributions": res.key_contributions,
            "key_findings": res.key_findings
        }
    except Exception as e:
        return {
            "executive_summary": f"Failed to generate summary: {str(e)}",
            "technical_summary": f"Failed to generate summary: {str(e)}",
            "key_contributions": ["Extraction failed"],
            "key_findings": ["Extraction failed"]
        }
