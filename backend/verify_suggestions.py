import asyncio
import os
import sys

# Add the current directory to sys.path so we can import app modules
sys.path.append(os.getcwd())

from app.agents.subagents.base import BaseSubAgent, AgentResponse
from app.agents.state import InstructionalGap, StandardReference

# Mock SubAgent for testing
class MockSubAgent(BaseSubAgent):
    def get_system_prompt(self, grade, gaps):
        return "You are a helpful writing coach."

async def test_structured_output():
    print("Testing Structured Output...")
    
    agent = MockSubAgent("Mock", ["test"])
    
    # Needs GROQ_API_KEY env var set for real test, but we can check import structure
    try:
        from app.core.config import get_settings
        settings = get_settings()
        if not settings.GROQ_API_KEY:
            print("SKIPPING: No GROQ_API_KEY found.")
            return
            
        # Mock Data
        gap = InstructionalGap(skill_domain="Test", description="Test Gap", evidence="None", sol_reference=" None")
        
        print("Calling generate_prompt...")
        response = await agent.generate_prompt(
            grade_level="3",
            student_text="The cat sat on the mat.",
            student_response="Help me.",
            gaps=[gap],
            standards=[]
        )
        
        print(f"Response Type: {type(response)}")
        print(f"Message: {response.message}")
        print(f"Suggestions: {response.suggestions}")
        
        assert isinstance(response, AgentResponse)
        assert isinstance(response.message, str)
        assert isinstance(response.suggestions, list)
        assert len(response.suggestions) == 3
        
        print("✅ SUCCESS: Structured Output Working!")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_structured_output())
