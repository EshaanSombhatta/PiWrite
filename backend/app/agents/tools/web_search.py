"""
Tavily Web Search Utility for safe, educational content retrieval.
"""
import os
from typing import List
from tavily import TavilyClient

# Global client instance
_tavily_client = None

def get_tavily_client():
    global _tavily_client
    if not _tavily_client:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            print("WARNING: TAVILY_API_KEY not found in environment.")
            return None
        _tavily_client = TavilyClient(api_key=api_key)
    return _tavily_client

def tavily_search_safe(query: str, grade_level: str) -> List[str]:
    """
    Performs a web search using Tavily with strict safety and educational constraints.
    
    Args:
        query: Base search term (e.g., "revising skills")
        grade_level: Student grade level
        
    Returns:
        List of content strings from search results.
    """
    client = get_tavily_client()
    if not client:
        return []
    
    # Construct safe, prioritized query
    # 1. Base intent
    base_query = f"{query} grade {grade_level} writing standards"
    
    # 2. Site prioritization (edu/org)
    priorities = "site:.edu OR site:.org"
    
    # 3. Safety/Audience constraint
    safety = "safe for kids education"
    
    final_query = f"{base_query} {priorities} {safety}"
    
    print(f"--- TAVILY SEARCH QUERY: {final_query} ---")
    
    try:
        response = client.search(
            query=final_query,
            search_depth="advanced",
            max_results=5,
            include_domains=[], # Can strictly enforce domains if needed, but query hints help
            exclude_domains=["reddit.com", "quora.com", "twitter.com", "facebook.com", "tiktok.com"]
        )
        
        results = []
        if response and "results" in response:
            for res in response["results"]:
                # Format: [Title](URL): Content...
                content = f"[{res.get('title', 'Web Result')}]({res.get('url', '#')}): {res.get('content', '')[:500]}"
                results.append(content)
        
        print(f"  Retrieved {len(results)} web results.")
        return results
        
    except Exception as e:
        print(f"  Tavily Search Error: {e}")
        return []
