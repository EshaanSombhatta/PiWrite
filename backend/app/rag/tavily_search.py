import os
from tavily import TavilyClient
from typing import List

def search_tavily_educational(query: str, max_results: int = 3) -> List[str]:
    """
    Search Tavily for educational resources, prioritizing .edu and .org domains.
    Serves as a fallback when internal RAG validity is low.
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        print("Warning: TAVILY_API_KEY not found. Skipping Tavily search.")
        return []

    client = TavilyClient(api_key=api_key)
    
    # Construct a query that targets educational standards/resources
    enhanced_query = f"{query} educational standards common core virginia sol"
    
    print(f"  Tavily Fallback Search: '{enhanced_query}'")
    
    try:
        # Prioritize high-quality educational domains
        # We try to get results from .edu and .org first
        response = client.search(
            query=enhanced_query,
            search_depth="advanced",
            include_domains=["education.virginia.gov", "doe.virginia.gov", "commoncore.org", "ncte.org"],
            max_results=max_results
        )
        
        # If strict domain search yields nothing, broaden it
        if not response.get("results"):
            print("  No strict domain results, broadening search...")
            response = client.search(
                query=enhanced_query,
                search_depth="advanced",
                max_results=max_results
            )

        results = []
        for r in response.get("results", []):
            content = r.get("content", "")
            title = r.get("title", "")
            url = r.get("url", "")
            # Format to look similar to vector store text chunks
            formatted_result = f"SOURCE[WEB]: {title} ({url})\nCONTENT: {content}"
            results.append(formatted_result)
            
        print(f"  Tavily found {len(results)} results.")
        return results
        
    except Exception as e:
        print(f"Tavily search error: {e}")
        return []
