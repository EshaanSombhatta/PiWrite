from pydantic import BaseModel, Field
from typing import List, Optional

class InstructionalGapModel(BaseModel):
    skill_domain: str
    description: str
    sol_reference: Optional[str] = None

class WritingStateRequest(BaseModel):
    student_id: str
    writing_id: str
    grade_level: str
    current_stage: str
    student_text: str
    last_prompt: str
    student_response: str
    retrieved_standards: List[dict] = []
    instructional_gaps: List[InstructionalGapModel] = []
    next_prompt: Optional[str] = None
    messages: List[dict] = []
    previous_student_text: Optional[str] = None
