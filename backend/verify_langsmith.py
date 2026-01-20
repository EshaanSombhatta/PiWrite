import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage

# Load env
load_dotenv()

def verify():
    print("Verifying LangSmith Integration...")
    print(f"Endpoint: {os.getenv('LANGCHAIN_ENDPOINT')}")
    print(f"Tracing: {os.getenv('LANGCHAIN_TRACING_V2')}")
    print(f"Project: {os.getenv('LANGCHAIN_PROJECT')}")
    
    # Check for API Key presence (don't print it)
    if os.getenv("LANGCHAIN_API_KEY"):
        print("LANGCHAIN_API_KEY is found.")
    else:
        print("WARNING: LANGCHAIN_API_KEY is missing!")

    try:
        # Using a model that is likely available on Groq
        llm = ChatGroq(model="llama-3.1-8b-instant") 
        print("Invoking ChatGroq to trigger a trace...")
        response = llm.invoke([HumanMessage(content="Hello, ensures LangSmith tracing is working.")])
        print(f"Response: {response.content}")
        print("\nSUCCESS: Invocation completed. Please check LangSmith for the trace.")
    except Exception as e:
        print(f"\nERROR: {e}")

if __name__ == "__main__":
    verify()
