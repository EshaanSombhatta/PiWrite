"""
Updated state models with structured output contract for agent responses.
"""
from typing import TypedDict, List, Optional, Annotated, Literal
import operator
from pydantic import BaseModel, Field


class StandardReference(BaseModel):
    """Reference to a retrieved SOL standard."""
    content: str = Field(..., description="The standard text content")
    grade_band: Optional[str] = Field(None, description="Grade band: K1, 2_3, 4_6")
    skill: Optional[str] = Field(None, description="Skill area: ideas, structure, conventions, etc.")
    source: Optional[str] = Field(None, description="Source document name")


class InstructionalGap(BaseModel):
    """An identified gap between SOL expectations and student evidence."""
    skill_domain: str = Field(..., description="e.g. 'organization', 'voice', 'ideas', 'conventions'")
    description: str = Field(..., description="What the student is missing or needs to develop")
    sol_reference: Optional[str] = Field(None, description="The SOL expectation text")
    severity: Literal["low", "medium", "high"] = Field("medium", description="Gap priority")
    evidence: Optional[str] = Field(None, description="What was observed in student writing")


class AgentOutput(BaseModel):
    """Structured output contract for all stage agents."""
    instructional_gaps: List[InstructionalGap] = Field(default_factory=list)
    student_prompts: List[str] = Field(default_factory=list, description="Dynamic prompts for student")
    referenced_standards: List[StandardReference] = Field(default_factory=list)
    sub_agent_used: Optional[str] = Field(None, description="Which sub-agent handled this")
    next_prompt: str = Field(..., description="The primary prompt to show the student")


class WritingState(TypedDict):
    """LangGraph state for writing workflow."""
    # Context
    student_id: str
    writing_id: str
    grade_level: str
    current_stage: str  # prewriting, drafting, revising, editing, publishing
    
    # Content
    student_text: str
    previous_student_text: Optional[str]
    last_prompt: str
    student_response: str
    
    # Agent State - accumulated across turns
    retrieved_standards: List[dict]  # StandardReference as dicts (Overwrite)
    instructional_gaps: List[dict]   # InstructionalGap as dicts (Overwrite)
    next_prompt: Optional[str]
    student_prompts: Annotated[List[str], operator.add]
    sub_agent_used: Optional[str]
    messages: Annotated[List[dict], operator.add]
    rag_status: Literal["pending", "sufficient", "insufficient", "expanded"]
    retrieval_attempts: int
