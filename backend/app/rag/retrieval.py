"""
RAG Retrieval module for querying SOL standards from Supabase.
"""
from typing import List, Optional
from app.core.database import get_supabase_client
from app.rag.embeddings import Embeddings


async def retrieve_sol_standards(
    query: str,
    grade_level: Optional[str] = None,
    stage: Optional[str] = None,
    match_count: int = 5,
    match_threshold: float = 0.5
) -> List[str]:
    """
    Retrieves relevant SOL standards based on semantic similarity.
    
    Args:
        query: The search query (student text or context)
        grade_level: Optional grade level filter (K, 1, 2, etc.)
        stage: Optional writing stage filter (prewriting, drafting, etc.)
        match_count: Number of results to return
        match_threshold: Minimum similarity threshold (0-1)
    
    Returns:
        List of relevant SOL standard content strings
    """
    # Generate embedding for the query
    embed_model = Embeddings.get_embeddings()
    query_embedding = embed_model.embed_query(query)
    
    # Build filter metadata
    filter_metadata = {}
    if grade_level:
        filter_metadata["grade"] = grade_level
    # if stage:
    #     filter_metadata["stage"] = stage
    
    # Query Supabase using the match_sol_standards RPC function
    supabase = get_supabase_client()
    
    try:
        response = supabase.rpc(
            "match_sol_standards",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count,
                "filter_metadata": filter_metadata if filter_metadata else {}
            }
        ).execute()
        
        if response.data:
            print(f"\n[RAG] Query: '{query}' | Grade: {grade_level} | Stage: {stage}")
            print(f"[RAG] Retrieved {len(response.data)} standards:")
            for i, item in enumerate(response.data):
                meta = item.get("metadata", {})
                content_preview = item["content"][:100] + "..." if len(item["content"]) > 100 else item["content"]
                print(f"  {i+1}. [Sim: {item.get('similarity', 'N/A'):.4f}] {content_preview} (Meta: {meta})")
            
            return [item["content"] for item in response.data]
        
        print(f"\n[RAG] Query: '{query}' - No results found.")
        return []
    
    except Exception as e:
        print(f"Error retrieving SOL standards: {e}")
        return []


def retrieve_sol_standards_sync(
    query: str,
    grade_level: Optional[str] = None,
    stage: Optional[str] = None,
    match_count: int = 5,
    match_threshold: float = 0.5
) -> List[str]:
    """
    Synchronous version of retrieve_sol_standards for use in sync contexts.
    """
    # Generate embedding for the query
    embed_model = Embeddings.get_embeddings()
    query_embedding = embed_model.embed_query(query)
    
    # Build filter metadata
    filter_metadata = {}
    if grade_level:
        filter_metadata["grade"] = grade_level
    # if stage:
    #     filter_metadata["stage"] = stage
    
    # Query Supabase
    supabase = get_supabase_client()
    
    try:
        response = supabase.rpc(
            "match_sol_standards",
            {
                "query_embedding": query_embedding,
                "match_threshold": match_threshold,
                "match_count": match_count,
                "filter_metadata": filter_metadata if filter_metadata else {}
            }
        ).execute()
        
        if response.data:
            print(f"\n[RAG_SYNC] Query: '{query}' | Grade: {grade_level} | Stage: {stage}")
            print(f"[RAG_SYNC] Retrieved {len(response.data)} standards:")
            for i, item in enumerate(response.data):
                meta = item.get("metadata", {})
                content_preview = item["content"][:100] + "..." if len(item["content"]) > 100 else item["content"]
                print(f"  {i+1}. [Sim: {item.get('similarity', 'N/A'):.4f}] {content_preview} (Meta: {meta})")
            
            return [item["content"] for item in response.data]
        
        print(f"\n[RAG_SYNC] Query: '{query}' - No results found.")
        return []
    
    except Exception as e:
        print(f"Error retrieving SOL standards: {e}")
        return []
