import os
import sys
# Add backend to path to import agents
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.getcwd(), 'backend', '.env'))

try:
    from app.agents.tools.web_search import tavily_search_safe
    
    print("Testing Tavily Safe Search...")
    queries = ["Drafting tips"]
    
    for q in queries:
        print(f"\nQuerying: {q}")
        results = tavily_search_safe(q, "3")
        
        if results:
            print("SUCCESS: Retrieved results.")
            for i, res in enumerate(results[:2]):
                print(f"[{i+1}] {res[:100]}...")
            
            # Check for edu/org if possible (cannot strictly check content without parsing markup URLs, but logs show query)
        else:
            print("FAILURE: No results returned. Check API Key or Quota.")

except ImportError as e:
    print(f"Import Error: {e}")
except Exception as e:
    print(f"Test Error: {e}")
