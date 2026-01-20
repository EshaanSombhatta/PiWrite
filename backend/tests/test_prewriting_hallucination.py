import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.agents.subagents.prewriting import idea_gen_agent
from app.agents.state import InstructionalGap

async def test_hallucination():
    print("Testing IdeaGenSubAgent for hallucinations...")
    
    # Mock gaps
    gaps = [InstructionalGap(skill_domain="IDEAS", description="Needs help brainstorming", evidence="None")]
    
    # Scenario 1: fast start
    print("\n--- Scenario 1: Student says 'I want to write about a bird' ---")
    response = await idea_gen_agent.generate_prompt(
        grade_level="3",
        student_text="",
        student_response="I want to write about a bird",
        gaps=gaps,
        standards=[],
        messages=[]
    )
    
    print(f"Agent Message: {response.message}")
    print(f"Canvas Update: '{response.canvas_update}'")
    
    # Verification Logic
    if len(response.canvas_update) > 50:
         print("FAIL: Canvas update is too long, likely hallucinated specific ideas.")
    elif "•" in response.canvas_update and len(response.canvas_update.split("•")) > 2:
         print("FAIL: Canvas update contains a list of items not confirmed by student.")
    else:
         print("PASS: Canvas update is minimal/empty as expected.")

    # Scenario 2: Vague input
    print("\n--- Scenario 2: Student says 'I don't know' ---")
    response_vague = await idea_gen_agent.generate_prompt(
        grade_level="3",
        student_text="",
        student_response="I don't know what to write",
        gaps=gaps,
        standards=[],
        messages=[]
    )
    print(f"Agent Message: {response_vague.message}")
    print(f"Canvas Update: '{response_vague.canvas_update}'")

    if response_vague.canvas_update.strip() == "":
        print("PASS: Canvas update is empty for vague input.")
    else:
        print(f"FAIL: Canvas should be empty but was: {response_vague.canvas_update}")

if __name__ == "__main__":
    asyncio.run(test_hallucination())
