"""
Base Sub-Agent class for all stage-specific sub-agents.
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from app.agents.state import InstructionalGap, StandardReference
from app.core.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage


from typing import List, Optional, Any, Union
from pydantic import BaseModel, Field

class AgentResponse(BaseModel):
    """Structured response from the writing coach."""
    message: str = Field(description="The coaching message to the student (encouragement + specific question/advice).")
    suggestions: List[str] = Field(description="3 specific, short reply options or questions the student might ask next.")
    canvas_update: Optional[Union[str, dict, list, Any]] = Field(None, description="Detailed text to ADD to the student's writing canvas. If nothing to add, leave null.")

    
class BaseSubAgent(ABC):
    """Base class for all sub-agents with common functionality."""
    
    def __init__(self, name: str, skill_focus: List[str]):
        """
        Args:
            name: Sub-agent identifier (e.g., "IdeaGen", "Planning")
            skill_focus: List of skill domains this agent handles
        """
        self.name = name
        self.skill_focus = skill_focus
    
    @abstractmethod
    def get_system_prompt(self, grade_level: str, gaps: List[InstructionalGap]) -> str:
        """Return the system prompt for this sub-agent."""
        pass
    
    def matches_gap(self, gap: InstructionalGap) -> bool:
        """Check if this sub-agent should handle the given gap."""
        return gap.skill_domain.lower() in [s.lower() for s in self.skill_focus]
    
    async def generate_prompt(
        self,
        grade_level: str,
        student_text: str,
        student_response: str,
        gaps: List[InstructionalGap],
        standards: List[StandardReference],
        messages: List[dict] = [],
        previous_student_text: Optional[str] = None
    ) -> AgentResponse:
        """
        Generate a student-facing prompt based on the instructional gaps.
        
        Args:
            grade_level: Student's grade
            student_text: Current writing content
            student_response: Student's last response
            gaps: Identified instructional gaps
            standards: Referenced SOL standards
            messages: Role/content chat history
        
        Returns:
            An AgentResponse object with message and suggestions.
        """
        # Filter gaps that this sub-agent handles
        relevant_gaps = [g for g in gaps if self.matches_gap(g)]
        if not relevant_gaps:
            relevant_gaps = gaps[:1]  # Fall back to top gap
        
        system_prompt = self.get_system_prompt(grade_level, relevant_gaps)
        
        # Build context for LLM
        gap_descriptions = "\n".join([
            f"- {g.skill_domain}: {g.description}" 
            for g in relevant_gaps[:3]
        ])
        
        standards_text = "\n".join([s.content for s in standards[:3]]) if standards else "Focus on grade-appropriate skills."
        
        user_content = f"""Student's current writing:
{student_text[:1500] if student_text else "(No writing yet)"}

PREVIOUS WRITING (Compare to Current):
{previous_student_text[:1500] if previous_student_text else "(No previous writing - this is the first turn)"}

Use the conversation history provided to maintain context.

Instructional Gaps to Address:
{gap_descriptions}

Relevant Standards:
{standards_text}

LATEST STUDENT INPUT (Respond to this):
"{student_response}"

CRITICAL - CHANGE DETECTION:
1. Compare "Student's current writing" with "PREVIOUS WRITING".
2. Did they make any changes?
   - NO CHANGE + User says "Done": Reply "I don't see any changes yet. Did you forget to save?"
   - MINOR CHANGE: Acknowledge it, but explain if it's not enough.
   - GOOD CHANGE: Praise it explicitly!

Task:
1. Analyze the student's writing and the identified gaps.
2. Generate a helpful, encouraging coaching message (1-3 sentences).
3. Generate 3 specific "Suggestion Chips" (reply options) for the student.

About Suggestion Chips:
- These are buttons the student can click to reply to YOU.
- They should be formatted as if the STUDENT is speaking (First Person "I").
- Examples: "Show me an example", "Help me with the beginning", "I'm stuck on ideas", "Does my spelling look okay?"
- Make them relevant to the specific advice you just gave.
"""

        # Convert history to LangChain format
        history_messages = []
        for msg in messages[-6:]: # Keep last 6 turns for context window
            if msg.get("role") == "user":
                history_messages.append(HumanMessage(content=msg.get("content", "")))
            elif msg.get("role") in ["assistant", "ai"]:
                history_messages.append(SystemMessage(content=msg.get("content", ""))) # Using SystemMessage for AI to avoid confusion
        
        # Use PydanticOutputParser for more robust JSON generation on Llama-3 models
        from langchain_core.output_parsers import PydanticOutputParser
        
        parser = PydanticOutputParser(pydantic_object=AgentResponse)
        
        # Inject format instructions
        user_content += f"\n\nIMPORTANT: {parser.get_format_instructions()}\n"
        
        # Update full prompt with instructions
        prompt_messages = [SystemMessage(content=system_prompt)] + history_messages + [HumanMessage(content=user_content)]
        
        llm = get_llm()
        # Call raw LLM
        response_msg = await llm.ainvoke(prompt_messages)
        
        content = response_msg.content
        # Manual clean-up of markdown code blocks common in LLM responses
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            content = content.split("```")[1].split("```")[0].strip()
            
        try:
            # Parse output
            return parser.parse(content)
        except Exception as e:
            print(f"JSON Parsing Failed. Raw content: {response_msg.content}")
            print(f"Cleaned content: {content}")
            print(f"Error: {e}")
            
            # Fallback for simple text if JSON fails
            return AgentResponse(
                message=response_msg.content[:500], # Trucate just in case
                suggestions=["Tell me more", "I need help", "What next?"],
                canvas_update=None
            )
