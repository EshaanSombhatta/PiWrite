"""
Revising Stage Agent - orchestrates gap analysis and sub-agents for content/organization revision.
"""
from typing import List
from app.agents.state import WritingState, InstructionalGap, StandardReference
from app.agents.gap_analysis import compute_instructional_gaps
from app.agents.subagents.revising import REVISING_SUBAGENTS, content_agent, organization_agent


async def select_subagent(gaps: List[InstructionalGap]):
    """Select the best sub-agent based on the top gap."""
    if not gaps:
        return content_agent  # Default to content revision
    
    top_gap = gaps[0]
    
    for agent in REVISING_SUBAGENTS:
        if agent.matches_gap(top_gap):
            return agent
    
    return content_agent


async def revising_node(state: WritingState) -> dict:
    """
    Revising Stage Agent with full gap analysis pipeline.
    
    1. Computes instructional gaps via RAG + LLM analysis
    2. Routes to appropriate sub-agent (Content or Organization)
    3. Returns structured output with gaps, prompts, and standards
    """
    print("--- REVISING NODE ---")
    
    grade_level = state.get("grade_level", "3")
    student_text = state.get("student_text", "")
    student_response = state.get("student_response", "")
    
    previous_text = state.get("previous_student_text")
    
    # Extract pre-retrieved standards if they exist (from context expansion)
    retrieved_content = [s["content"] for s in state.get("retrieved_standards", [])]
    
    # Step 1: Compute instructional gaps
    gaps, standards = await compute_instructional_gaps(
        student_text=student_text,
        grade_level=grade_level,
        stage="revising",
        retrieved_standards=retrieved_content if retrieved_content else None
    )
    
    # Check for RAG sufficiency signal
    if gaps and gaps[0].skill_domain == "SYSTEM" and gaps[0].description == "INSUFFICIENT_CONTEXT":
        print(f"  RAG Insufficient: {gaps[0].evidence}")
        return {"rag_status": "insufficient"}
    
    # Step 2: Select appropriate sub-agent
    subagent = await select_subagent(gaps)
    print(f"  Selected sub-agent: {subagent.name}")
    
    # Step 3: Generate student prompt via sub-agent
    agent_response = await subagent.generate_prompt(
        grade_level=grade_level,
        student_text=student_text,
        student_response=student_response,
        gaps=gaps,
        standards=standards,
        messages=state.get("messages", []),
        previous_student_text=previous_text
    )
    
    return {
        "next_prompt": agent_response.message,
        "student_prompts": agent_response.suggestions,
        "retrieved_standards": [s.model_dump() for s in standards],
        "instructional_gaps": [g.model_dump() for g in gaps],
        "sub_agent_used": subagent.name,
        "messages": [{"role": "assistant", "content": agent_response.message}],
        "previous_student_text": student_text # Update state for next turn
    }
