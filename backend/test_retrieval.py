"""
Test script for RAG retrieval functionality.
"""
import asyncio
from dotenv import load_dotenv

load_dotenv()

from app.rag.retrieval import retrieve_sol_standards_sync

def test_retrieval():
    print("=" * 60)
    print("RAG RETRIEVAL TEST")
    print("=" * 60)
    
    # Test query 1: Writing topic
    query1 = "writing about a topic with supporting details"
    print(f"\nQuery 1: '{query1}'")
    print("-" * 40)
    results1 = retrieve_sol_standards_sync(query1, match_count=3)
    if results1:
        for i, result in enumerate(results1, 1):
            print(f"  Result {i}: {result[:200]}...")
    else:
        print("  No results found")
    
    # Test query 2: Grade-specific
    query2 = "punctuation and capitalization"
    print(f"\nQuery 2: '{query2}' (Grade 3)")
    print("-" * 40)
    results2 = retrieve_sol_standards_sync(query2, grade_level="3", match_count=3)
    if results2:
        for i, result in enumerate(results2, 1):
            print(f"  Result {i}: {result[:200]}...")
    else:
        print("  No results found")
    
    # Test query 3: Prewriting stage
    query3 = "brainstorming ideas and planning"
    print(f"\nQuery 3: '{query3}'")
    print("-" * 40)
    results3 = retrieve_sol_standards_sync(query3, match_count=3)
    if results3:
        for i, result in enumerate(results3, 1):
            print(f"  Result {i}: {result[:200]}...")
    else:
        print("  No results found")
    
    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    
    # Summary
    total_results = len(results1) + len(results2) + len(results3)
    print(f"\nSummary: Retrieved {total_results} total documents across 3 queries")
    return total_results > 0

if __name__ == "__main__":
    success = test_retrieval()
    exit(0 if success else 1)
