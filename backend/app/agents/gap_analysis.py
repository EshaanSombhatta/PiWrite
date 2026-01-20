"""
Instructional Gap Analysis Module

Implements the 6-step gap computation pipeline:
1. Retrieve SOL expectations (RAG)
2. Extract structured expectations from SOL text
3. Analyze student writing for evidence
4. Compute missing skills (gaps)
5. Rank gaps by importance
6. Return structured gaps for prompt generation
"""
from typing import List, Optional, Tuple
from pydantic import BaseModel
from app.agents.state import InstructionalGap, StandardReference
from app.core.llm import get_llm
from app.rag.retrieval import retrieve_sol_standards_sync
from app.rag.tavily_search import search_tavily_educational
from langsmith import traceable
from langchain_core.messages import SystemMessage, HumanMessage
import json

# Skill domains that can be identified
SKILL_DOMAINS = [
    "ideas",           # Generating and developing ideas
    "organization",    # Structure and flow
    "voice",           # Author's voice and audience awareness
    "word_choice",     # Vocabulary and language use
    "sentence_fluency", # Sentence variety and flow
    "conventions",     # Grammar, spelling, punctuation
    "focus",           # Staying on topic
    "elaboration",     # Adding details and examples
]


EXPECTATION_EXTRACTION_PROMPT = """You are an educational standards analyst. Given the following SOL (Standards of Learning) text for Grade {grade_level} students in the {stage} stage of writing, extract the specific skill expectations.

SOL Standards:
{standards_text}

For each standard, identify:
1. The skill domain (one of: ideas, organization, voice, word_choice, sentence_fluency, conventions, focus, elaboration)
2. What the student should be able to do at this grade level
3. Observable indicators of mastery

Return a JSON array of expectations:
```json
[
  {{
    "skill_domain": "...",
    "expectation": "What the student should do",
    "indicators": ["Observable sign 1", "Observable sign 2"]
  }}
]
```

Only return the JSON array, no other text."""


EVIDENCE_ANALYSIS_PROMPT = """You are an educational writing analyst. Analyze this Grade {grade_level} student's writing for evidence of the following skills.

Student's Writing:
{student_text}

Skills to Look For:
{expectations_json}

INSTRUCTIONS:
For each skill, look for ANY evidence.
- If the student uses descriptive adjectives (e.g., "bright yellow", "big factory"), mark Elaboration/Word Choice as "yes".
- If the student includes character traits (e.g., "hard working", "brave"), MARK AS EVIDENCE found.
- Do NOT require perfect elaboration. If they have *one* good detail, give them credit ("yes" or "partially").
- Only mark "no" if the skill is completely absent.

CRITICAL INSTRUCTIONS FOR CONVENTIONS (Spelling/Grammar):
- Be EXTREMELY CAREFUL not to flag correct text as errors.
- DO NOT flag words like "pizza", "picnic", or common proper nouns as spelling errors.
- ONLY mark a skill as 'partially' or 'no' if there are CLEAR, OBJECTIVE errors.
- If in doubt about a spelling, assume it is CORRECT.

CRITICAL INSTRUCTIONS FOR ORGANIZATION (Transitions):
- Transitions are NOT just single words (like "however").
- Look for PHRASES like "Of course", "In addition", "For example", "As a result", "Later that day".
- If the student uses these phrases to connect ideas, mark Organization/Sentence Fluency as "yes" or "partially".
- Do NOT flag "lack of transitions" if they are using these conversational bridges.

CRITICAL INSTRUCTIONS FOR NEGATIVE EXAMPLES:
- You MUST quote the EXACT text from the student's writing that demonstrates the error or missing skill.
- COPY-PASTE directly. Do not fix spelling in the quote. Do not change punctuation.
- If the error is an omission (e.g., missing punctuation), quote the word *before* where the punctuation should be.
- The frontend uses this quote to highlight the text. IF YOU CHANGE IT, HIGHLIGHTING FAILS.

NEGATIVE CONSTRAINTS (STRICTLY FORBIDDEN):
- DO NOT generate quotes that don't exist in the student's writing.
- DO NOT use phrases like "The student uses..." or "The writing shows..." - these are NOT student text.
- DO NOT create analysis language as if it were a quote.
- EVERY negative_example MUST be a word-for-word substring of the student's writing above.
- If you cannot find exact text to quote, leave negative_examples as an empty array [].

For each skill, identify:
1. Whether there is evidence the student demonstrates this skill (yes/partially/no)
2. Positive examples: Quotes showing they DO have the skill.
3. Negative examples: Quotes showing ERRORS or MISSING parts (e.g. misspelled words). QUOTE THE EXACT TEXT.
4. What's missing or needs development

Return a JSON array:
```json
[
  {{
    "skill_domain": "...",
    "evidence_level": "yes|partially|no",
    "positive_examples": ["quote correct usage"],
    "negative_examples": ["EXACT QUOTE OF TEXT WITH ERROR"],
    "missing": "What needs improvement"
  }}
]
```

Only return the JSON array, no other text."""


GAP_RANKING_PROMPT = """You are an educational coach prioritizing learning gaps for a Grade {grade_level} student in the {stage} stage.

Identified Gaps:
{gaps_json}

Current Writing Stage: {stage}

Rank these gaps from most to least important to address NOW, considering:
1. What's most developmentally appropriate for this grade
2. What will have the biggest impact on their writing (Ideas/Organization > Conventions usually)
3. What's most relevant to the current stage ({stage})
4. DEPRIORITIZE gaps with weak evidence (only 1-2 minor instances).
5. DEPRIORITIZE "transitions" if the student is using natural phrases (like "then", "so") unless significantly choppy.

Return a JSON array of the gaps in priority order (highest priority first), with severity added:
```json
[
  {{
    "skill_domain": "...",
    "description": "What they need to work on",
    "sol_reference": "The expectation they're not meeting",
    "severity": "high|medium|low",
    "evidence": "What was observed"
  }}
]
```

Only return the JSON array, no other text."""


SUFFICIENCY_CHECK_PROMPT = """You are an educational data analyst validating RAG retrieval results.
Goal: Determine if the retrieved SOL standards are SUFFICIENT and RELEVANT for the current task.

Task Context:
- Grade Level: {grade_level}
- Writing Stage: {stage}

Retrieved Standards:
{standards_text}

Constraints:
1. Grade Level Match: The standards MUST strictly match Grade {grade_level}.
2. Stage Relevance: The standards MUST be relevant to the '{stage}' stage. 
   - Prewriting: Ideas, planning, brainstorming.
   - Drafting: Writing sentences, structure, elaboration.
   - Revising: Content, organization, improvements.
   - Editing: Grammar, punctuation, spelling (conventions).
   - Publishing: Presentation, sharing.

Return a JSON object:
```json
{{
  "sufficient": true|false,
  "reason": "Brief explanation",
  "missing_elements": "What is missing (e.g. 'Grade 3 standards missing', 'Editing rules missing')"
}}
```
Check Stage Relevance.
Only return the JSON object."""


@traceable(run_type="chain", name="Extract Expectations")
async def extract_expectations(
    standards_text: str,
    grade_level: str,
    stage: str
) -> List[dict]:
    """Step 2: Extract structured expectations from SOL text."""
    llm = get_llm()
    
    prompt = EXPECTATION_EXTRACTION_PROMPT.format(
        grade_level=grade_level,
        stage=stage,
        standards_text=standards_text
    )
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are an educational standards analyst. Return only valid JSON."),
            HumanMessage(content=prompt)
        ])
        
        # Extract JSON from response
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content.strip())
    except Exception as e:
        print(f"CRITICAL ERROR in extract_expectations: {str(e)}")
        import traceback
        traceback.print_exc()
        # Fallback: return basic expectation
        return [{"skill_domain": "general", "expectation": standards_text[:100] + "...", "indicators": []}]


@traceable(run_type="chain", name="Analyze Student Evidence")
async def analyze_student_evidence(
    student_text: str,
    grade_level: str,
    expectations: List[dict]
) -> List[dict]:
    """Step 3: Analyze student writing for evidence of skills."""
    if not student_text or not student_text.strip():
        # No text to analyze - all skills are gaps
        return [
            {
                "skill_domain": exp.get("skill_domain", "general"),
                "evidence_level": "no",
                "examples": [],
                "missing": exp.get("expectation", "No writing provided")
            }
            for exp in expectations
        ]
    
    llm = get_llm()
    
    prompt = EVIDENCE_ANALYSIS_PROMPT.format(
        grade_level=grade_level,
        student_text=student_text[:2000],  # Limit length
        expectations_json=json.dumps(expectations, indent=2)
    )
    
    response = await llm.ainvoke([
        SystemMessage(content="You are an educational writing analyst. Return only valid JSON."),
        HumanMessage(content=prompt)
    ])
    
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        # Fallback: mark all as needing work
        return [
            {
                "skill_domain": exp.get("skill_domain", "general"),
                "evidence_level": "partially",
                "positive_examples": [],
                "negative_examples": [],
                "missing": "Unable to analyze"
            }
            for exp in expectations
        ]


async def compute_gaps(
    expectations: List[dict],
    evidence: List[dict],
    student_text: str = ""  # NEW: Pass student text for validation
) -> List[dict]:
    """Step 4: Compute missing skills (gaps) by comparing expectations to evidence."""
    gaps = []
    
    # Helper to validate if text actually exists in student writing
    def validate_evidence(quote: str) -> bool:
        if not quote or not student_text:
            return False
        # Normalize: lowercase, collapse whitespace
        normalized_quote = ' '.join(quote.lower().split())
        normalized_student = ' '.join(student_text.lower().split())
        # Check if first 25 chars of quote exist in student text (handles minor variations)
        check_portion = normalized_quote[:min(len(normalized_quote), 25)]
        return check_portion in normalized_student
    
    # Create lookup by skill domain
    evidence_map = {e.get("skill_domain"): e for e in evidence}
    
    for exp in expectations:
        skill = exp.get("skill_domain", "general")
        ev = evidence_map.get(skill, {})
        
        evidence_level = ev.get("evidence_level", "no")
        
        # Only create gap if evidence is partial or missing
        if evidence_level in ["no", "partially"]:
            # Determine evidence string: Use negative examples (errors) if available
            errors = ev.get("negative_examples", [])
            
            # VALIDATION: Filter out any errors that don't exist in student text
            if student_text:
                validated_errors = [e for e in errors if validate_evidence(e)]
            else:
                validated_errors = errors
            
            # FILTER: If no specific negative examples (quotes) are found, this evidence is weak.
            if not validated_errors:
                 evidence_str = ev.get("missing", "No specific errors cited")
            else:
                 evidence_str = ", ".join(validated_errors)
            
            gaps.append({
                "skill_domain": skill,
                "description": ev.get("missing", exp.get("expectation", "")),
                "sol_reference": exp.get("expectation", ""),
                "evidence": evidence_str
            })
    
    return gaps


@traceable(run_type="chain", name="Rank Gaps")
async def rank_gaps(
    gaps: List[dict],
    grade_level: str,
    stage: str
) -> List[InstructionalGap]:
    """Step 5: Rank gaps by importance and return structured objects."""
    if not gaps:
        return []
    
    llm = get_llm()
    
    prompt = GAP_RANKING_PROMPT.format(
        grade_level=grade_level,
        stage=stage,
        gaps_json=json.dumps(gaps, indent=2)
    )
    
    response = await llm.ainvoke([
        SystemMessage(content="You are an educational coach. Return only valid JSON."),
        HumanMessage(content=prompt)
    ])
    
    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        ranked = json.loads(content.strip())
        
        return [
            InstructionalGap(
                skill_domain=g.get("skill_domain", "general"),
                description=g.get("description", ""),
                sol_reference=g.get("sol_reference"),
                severity=g.get("severity", "medium"),
                evidence=g.get("evidence")
            )
            for g in ranked
        ]
    except (json.JSONDecodeError, IndexError):
        # Fallback: return unranked gaps
        return [
            InstructionalGap(
                skill_domain=g.get("skill_domain", "general"),
                description=g.get("description", ""),
                sol_reference=g.get("sol_reference"),
                severity="medium",
                evidence=g.get("evidence")
            )
            for g in gaps
        ]


@traceable(run_type="chain", name="Check Sufficiency")
async def check_sufficiency(
    standards_text: str,
    grade_level: str,
    stage: str
) -> dict:
    """Check if retrieved standards are sufficient and relevant."""
    llm = get_llm()
    prompt = SUFFICIENCY_CHECK_PROMPT.format(
        grade_level=grade_level,
        stage=stage,
        standards_text=standards_text[:4000]
    )
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are a strict data validation assistant. Return only valid JSON."),
            HumanMessage(content=prompt)
        ])
        
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        return json.loads(content.strip())
    except Exception as e:
        print(f"Error in check_sufficiency: {e}")
        return {"sufficient": True, "reason": "Error checking, assuming sufficient"}

@traceable(run_type="chain", name="Gap Analysis Pipeline")
async def compute_instructional_gaps(
    student_text: str,
    grade_level: str,
    stage: str,
    retrieved_standards: Optional[List[str]] = None
) -> Tuple[List[InstructionalGap], List[StandardReference]]:
    """
    Complete 6-step instructional gap pipeline.
    
    Args:
        student_text: The student's current writing
        grade_level: Student's grade (K, 1, 2, etc.)
        stage: Current writing stage (prewriting, drafting, etc.)
        retrieved_standards: Optional pre-retrieved standards
    
    Returns:
        Tuple of (instructional_gaps, referenced_standards)
    """
    print(f"--- GAP ANALYSIS: {stage} for Grade {grade_level} ---")
    
    # Track if we had external standards (to skip validation)
    standards_pre_provided = retrieved_standards is not None and len(retrieved_standards) > 0
    
    # Step 1: Retrieve SOL standards if not provided
    if not retrieved_standards:
        query = f"{stage} writing skills grade {grade_level}"
        retrieved_standards = retrieve_sol_standards_sync(
            query=query,
            grade_level=grade_level,
            stage=stage,
            match_count=5
        )
    
    if not retrieved_standards:
        # No standards found - return empty
        return [], []
    
    # Create StandardReference objects
    standard_refs = [
        StandardReference(content=s, skill=None, grade_band=None, source=None)
        for s in retrieved_standards
    ]
    
    standards_text = "\n\n".join(retrieved_standards)
    
    # Step 1.5: Check Sufficiency (ONLY if we did a fresh retrieval)
    # If standards were pre-provided (e.g. from expanded search), we trust them.
    if not standards_pre_provided: 
        print("  Step 1.5: Checking RAG sufficiency...")
        sufficiency = await check_sufficiency(standards_text, grade_level, stage)
        print(f"    Sufficient: {sufficiency.get('sufficient')} - {sufficiency.get('reason')}")
        
        if not sufficiency.get("sufficient", True):
            print("  RAG Insufficient. Attempting Tavily Context Expansion...")
            
            # Map stages to specific keywords (Context of Agent/Subagent)
            stage_keywords = {
                "prewriting": "brainstorming planning ideas narrative outline",
                "drafting": "sentence structure paragraph development drafting composition",
                "revising": "revising writing organization word choice voice elaboration",
                "editing": "editing writing grammar punctuation capitalization spelling conventions"
            }
            
            keywords = stage_keywords.get(stage.lower(), "writing skills")
            
            # Fallback to Tavily
            tavily_results = search_tavily_educational(f"{stage} writing grade {grade_level} {keywords}")
            
            if tavily_results:
                print(f"  Context expanded with {len(tavily_results)} web results.")
                # Update standards text
                retrieved_standards.extend(tavily_results)
                
                # Regenerate StandardRefs
                standard_refs.extend([
                    StandardReference(content=s, skill="WEB_EXPANDED", grade_band=grade_level, source="Tavily")
                    for s in tavily_results
                ])
                
                standards_text = "\n\n".join(retrieved_standards)
            else:
                # Return special signal: Empty gaps but with a status flag
                return [InstructionalGap(
                    skill_domain="SYSTEM",
                    description="INSUFFICIENT_CONTEXT",
                    severity="high",
                    evidence=sufficiency.get("reason", "Retrieved context does not match grade/stage")
                )], []
    else:
        print("  Skipping sufficiency check (using provided/expanded standards).")

    # Step 2: Extract structured expectations
    print("  Step 2: Extracting expectations...")
    expectations = await extract_expectations(standards_text, grade_level, stage)
    
    # Step 3: Analyze student evidence
    print("  Step 3: Analyzing student evidence...")
    evidence = await analyze_student_evidence(student_text, grade_level, expectations)
    
    # Step 4: Compute gaps
    print("  Step 4: Computing gaps...")
    raw_gaps = await compute_gaps(expectations, evidence, student_text)
    
    # Step 5: Rank gaps
    print("  Step 5: Ranking gaps...")
    ranked_gaps = await rank_gaps(raw_gaps, grade_level, stage)
    
    print(f"  Found {len(ranked_gaps)} instructional gaps")
    for i, gap in enumerate(ranked_gaps):
        print(f"    Gap #{i+1} [{gap.severity.upper()}]: {gap.skill_domain} - {gap.description}")
        print(f"      Evidence: {gap.evidence}")
    
    # DEDUPLICATION LOGIC
    # 1. Deduplicate Gaps by (skill_domain, description)
    seen_gaps = set()
    unique_gaps = []
    for gap in ranked_gaps:
        gap_key = (gap.skill_domain, gap.description)
        if gap_key not in seen_gaps:
            seen_gaps.add(gap_key)
            unique_gaps.append(gap)
            
    # 2. Deduplicate Standards by content
    seen_standards = set()
    unique_standards = []
    for std in standard_refs:
        if std.content not in seen_standards:
            seen_standards.add(std.content)
            unique_standards.append(std)
    
    return unique_gaps, unique_standards
