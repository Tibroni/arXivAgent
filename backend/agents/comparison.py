from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

class PaperComparison(BaseModel):
    similarities: List[str] = Field(description="List of overlaps, common methodologies, or similar goals between the papers")
    differences: List[str] = Field(description="List of key differences in methodology, architecture, and evaluation metrics")
    strengths: Dict[str, List[str]] = Field(description="Dict of strengths for each paper, mapping the paper's title or arXiv ID to a list of strengths")
    weaknesses: Dict[str, List[str]] = Field(description="Dict of weaknesses or limitations for each paper, mapping the paper's title or arXiv ID to a list of weaknesses")
    research_gaps: List[str] = Field(description="List of research gaps or opportunities for future work identified from the comparison")

def run_comparison_agent(papers: List[Dict[str, Any]], openai_key: str = None, gemini_key: str = None, openai_model: str = "gpt-4o-mini", gemini_model: str = "gemini-1.5-flash") -> Dict[str, Any]:
    if not papers:
        return {
            "similarities": [],
            "differences": [],
            "strengths": {},
            "weaknesses": {},
            "research_gaps": []
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
            "similarities": ["API keys not available for comparison evaluation."],
            "differences": ["API keys not available."],
            "strengths": {p.get("title", f"Paper {i}"): ["API key required"] for i, p in enumerate(papers)},
            "weaknesses": {p.get("title", f"Paper {i}"): ["API key required"] for i, p in enumerate(papers)},
            "research_gaps": ["API keys not available."]
        }

    # Use function calling method for ChatOpenAI to support dynamic Dict mapping in response schema
    if isinstance(llm, ChatOpenAI):
        structured_llm = llm.with_structured_output(PaperComparison, method="function_calling")
    else:
        structured_llm = llm.with_structured_output(PaperComparison)
    
    # Formulate context comparing abstracts/summaries
    papers_str = ""
    for idx, paper in enumerate(papers):
        papers_str += f"=== Paper {idx+1} ===\n"
        papers_str += f"Title: {paper.get('title', 'Unknown')}\n"
        papers_str += f"Authors: {', '.join(paper.get('authors', []))}\n"
        papers_str += f"Abstract: {paper.get('abstract', '')}\n"
        # Add analysis summary if available
        summary = paper.get("analysis", {})
        if summary:
            papers_str += f"Executive Summary: {summary.get('executive_summary', '')}\n"
            papers_str += f"Technical Summary: {summary.get('technical_summary', '')}\n"
            papers_str += f"Key Contributions: {', '.join(summary.get('key_contributions', []))}\n"
        papers_str += "=====================\n\n"
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Comparison Agent. Compare the provided research papers, identifying their similarities, differences, strengths, weaknesses, and any research gaps. Return the results in a structured format."),
        ("user", "Here are the papers to compare:\n\n{papers}")
    ])
    
    chain = prompt | structured_llm
    
    try:
        res = chain.invoke({"papers": papers_str})
        return {
            "similarities": res.similarities,
            "differences": res.differences,
            "strengths": res.strengths,
            "weaknesses": res.weaknesses,
            "research_gaps": res.research_gaps
        }
    except Exception as e:
        # Fallback
        return {
            "similarities": [f"Comparison failed: {str(e)}"],
            "differences": [],
            "strengths": {},
            "weaknesses": {},
            "research_gaps": []
        }
