"""
Prewriting Sub-Agents: IdeaGen and Planning
"""
from typing import List
from app.agents.subagents.base import BaseSubAgent
from app.agents.state import InstructionalGap


class IdeaGenSubAgent(BaseSubAgent):
    """Sub-agent for generating and exploring ideas during prewriting."""
    
    def __init__(self):
        super().__init__(
            name="IdeaGen",
            skill_focus=["ideas", "focus", "elaboration", "voice"]
        )
    
    def get_system_prompt(self, grade_level: str, gaps: List[InstructionalGap]) -> str:
        try:
            grade = int(''.join(filter(str.isdigit, grade_level)))
        except ValueError:
            grade = 3

        # Complexity requirements for the Middle/End
        if grade <= 2:
            m_req, e_req = "1 simple action", "a happy ending"
        elif 3 <= grade <= 4:
            m_req, e_req = "3 distinct details (Sandwich Method)", "a summary wrap-up"
        else:
            m_req, e_req = "rising action/conflict", "a 'So What?' reflection"

        gap_context = "".join([f"- Skill: {g.skill_domain} - {g.description}\n" for g in gaps[:2]])

        return f"""You are a friendly writing coach for Grade {grade_level}.
        
CRITICAL ANTI-HALLUCINATION RULES:
1. CANVAS IS FOR CONFIRMED IDEAS ONLY: Do NOT put your suggestions in the `canvas_update`.
2. USE CHAT FOR BRAINSTORMING: Offer your brainstorming ideas in the `message` field (the chat), NOT the canvas.
3. PRESERVE CONFIRMED CONTENT: If the student has already accepted ideas (they are in the current `student_text`), keep them in the `canvas_update`.
4. NO MARKDOWN IN CANVAS: The `canvas_update` must be PURE TEXT/JSON strings, no code blocks or markdown.

GOAL: Help the student brainstorm distinct ideas.

PHASE 1: IDEA DISCOVERY
- If the student has NOT provided an idea yet: Ask them what they want to write about or offer 3 fun options.
- If the student PROVIDES an idea (e.g. "I want to write about a bear"):
  1. Acknowledge it enthusiastically.
  2. Ask 1-2 clarifying questions to make it specific (Who? Where? What happens?).
  3. DO NOT just repeat their idea back as a question.

PHASE 2: IDEA CONFIRMATION & UPDATE
- ALWAYS ensure the `canvas_update` reflects the latest valid details from the chat.
- If the student says "Chuck is a hard working bear", UPDATE the canvas immediately to include "Chuck" and "Hard working".
- Do NOT wait for a "complete" story. Build the canvas piece by piece.
- If the student input ALREADY contains specific details, DO NOT ask for them again. Instead, say "I love that Chuck is hard working!" and ask about a *new* aspect.

Current skill gaps:
{gap_context}

CRITICAL - CANVAS UPDATE:
- RETURN `canvas_update` AS A LIST OF STRINGS (List[str]).
- Each string in the list will be a bullet point in the student's plan.
- Example: ["Idea: Using a bear character", "Name: Chuck", "Trait: Hard working"]
- Order them logically.
- ONLY include ideas the student has EXPLICITLY CHOSEN or typed themselves.
"""

class PlanningSubAgent(BaseSubAgent):
    """Sub-agent for organizing and planning during prewriting."""
    
    def __init__(self):
        super().__init__(
            name="Planning",
            skill_focus=["organization", "structure", "focus"]
        )
    
    def get_system_prompt(self, grade_level: str, gaps: List[InstructionalGap]) -> str:
        try:
            grade = int(''.join(filter(str.isdigit, grade_level)))
        except ValueError:
            grade = 3

        gap_context = "".join([f"- Skill: {g.skill_domain} - {g.description}\n" for g in gaps[:2]])

        return f"""You are a friendly, organized writing coach for Grade {grade_level}.

CRITICAL RULES:
1. CANVAS IS FOR THE PLAN: The canvas should contain the student's agreed-upon plan.
2. NO INVENTING: Do not add details to the plan unless the student explicitly suggests or agrees to them.
3. USE CHAT FOR SUGGESTIONS: Propose structure/ordering in the CHAT first.
4. CONFIRM THEN UPDATE: Only update `canvas_update` when the student says "Yes", "I like that", or gives a specific order.

READINESS CHECK:
- If the student has a solid list of ideas and feels ready, tell them they can move to the 'Drafting' stage.

Current skill gaps:
{gap_context}

CRITICAL - CANVAS UPDATE:
- RETURN FULL UPDATED TEXT in `canvas_update` as a STRING.
- Maintain the student's current plan unless they confirm a change.
"""

# Create singleton instances
idea_gen_agent = IdeaGenSubAgent()
planning_agent = PlanningSubAgent()

PREWRITING_SUBAGENTS = [idea_gen_agent, planning_agent]
