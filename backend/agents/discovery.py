import time
import threading
import urllib.parse
import xml.etree.ElementTree as ET
import requests
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

# Global rate limiter state
last_request_time = 0.0
arxiv_lock = threading.Lock()

def rate_limit_arxiv():
    global last_request_time
    with arxiv_lock:
        now = time.time()
        elapsed = now - last_request_time
        if elapsed < 3.0:
            time.sleep(3.0 - elapsed)
        last_request_time = time.time()

class RelevanceScoring(BaseModel):
    relevance_score: int = Field(description="Relevance score from 0 to 100")
    justification: str = Field(description="Brief 1-2 sentence explanation of why this score was given")

from typing import List, Dict, Any, Optional

def search_arxiv(query: Optional[str] = None, id_list: Optional[List[str]] = None, start: int = 0, max_results: int = 15, openai_key: str = None, gemini_key: str = None) -> List[Dict[str, Any]]:
    url = "https://export.arxiv.org/api/query"
    params = {}
    
    if id_list:
        params["id_list"] = ",".join(id_list)
    if query and query.strip():
        params["search_query"] = query.strip()
        params["sortBy"] = "relevance"
        params["sortOrder"] = "descending"
        params["start"] = start
        params["max_results"] = max_results
        
    if not params:
        return []
    
    headers = {
        'User-Agent': 'arXivAgent/1.0 (contact: cash@gemini-assistant.ai; scientific research agent; client-id: 11f728b5)'
    }
    
    max_retries = 3
    backoff = 2.0
    response = None
    
    for attempt in range(max_retries):
        # Enforce rate limit delay before attempting request
        rate_limit_arxiv()
        
        try:
            # Use requests params dictionary for clean auto-encoding of space/quotes
            # Increased timeout to 25.0 seconds for slower responses under load
            response = requests.get(url, params=params, headers=headers, timeout=25.0)
            if response.status_code == 200:
                break
            elif response.status_code in [429, 503]:
                # Rate limited: wait and retry with exponential backoff
                time.sleep(backoff)
                backoff *= 2
                continue
            else:
                raise Exception(f"Status {response.status_code} - {response.text}")
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise Exception(f"arXiv connection failed: {str(e)}")
            time.sleep(backoff)
            backoff *= 2
            continue
    else:
        raise Exception("arXiv API rate limit exceeded. Please wait a few seconds before trying again.")
        
    root = ET.fromstring(response.content)
    
    # Namespaces
    ns = {
        'atom': 'http://www.w3.org/2005/Atom',
        'arxiv': 'http://arxiv.org/schemas/atom'
    }
    
    papers = []
    for entry in root.findall('atom:entry', ns):
        # Extract ID
        id_url = entry.find('atom:id', ns).text
        if "errors" in id_url:
            continue
            
        arxiv_id = id_url.split('/abs/')[-1].split('/pdf/')[-1].split('v')[0]
        
        title_node = entry.find('atom:title', ns)
        title = title_node.text.strip().replace('\n', ' ') if title_node is not None else "Unknown Title"
        
        summary_node = entry.find('atom:summary', ns)
        summary = summary_node.text.strip().replace('\n', ' ') if summary_node is not None else ""
        
        published_node = entry.find('atom:published', ns)
        published = published_node.text[:10] if published_node is not None else time.strftime("%Y-%m-%d")
        
        authors = [author.find('atom:name', ns).text for author in entry.findall('atom:author', ns) if author.find('atom:name', ns) is not None]
        categories = [category.attrib.get('term') for category in entry.findall('atom:category', ns) if category.attrib.get('term') is not None]
        
        papers.append({
            "arxiv_id": arxiv_id,
            "title": title,
            "abstract": summary,
            "authors": authors,
            "publication_date": published,
            "categories": categories,
            "pdf_url": f"https://arxiv.org/pdf/{arxiv_id}.pdf"
        })
        
    return papers


def run_discovery_agent(query: str, papers: List[Dict[str, Any]], openai_key: str = None, gemini_key: str = None, openai_model: str = "gpt-4o-mini", gemini_model: str = "gemini-1.5-flash") -> List[Dict[str, Any]]:
    if not papers:
        return []
        
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
        # Fallback without LLM evaluation
        for p in papers:
            p["relevance_score"] = 50
            p["relevance_justification"] = "No API keys provided for relevance evaluation."
        return papers

    structured_llm = llm.with_structured_output(RelevanceScoring)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are the Research Discovery Agent. Evaluate the relevance of the following paper to the user's search query. Return a relevance score from 0 (completely irrelevant) to 100 (exactly matches the query) and a concise, single-sentence justification."),
        ("user", "User Search Query: {query}\n\nPaper Title: {title}\nPaper Abstract: {abstract}")
    ])
    
    chain = prompt | structured_llm
    
    scored_papers = []
    for paper in papers:
        try:
            res = chain.invoke({
                "query": query,
                "title": paper["title"],
                "abstract": paper["abstract"]
            })
            paper_copy = paper.copy()
            paper_copy["relevance_score"] = res.relevance_score
            paper_copy["relevance_justification"] = res.justification
            scored_papers.append(paper_copy)
        except Exception as e:
            # Fallback for this paper
            paper_copy = paper.copy()
            paper_copy["relevance_score"] = 50
            paper_copy["relevance_justification"] = f"Evaluation failed: {str(e)}"
            scored_papers.append(paper_copy)
            
    # Sort by relevance score desc
    scored_papers.sort(key=lambda x: x["relevance_score"], reverse=True)
    return scored_papers
