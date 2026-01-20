"""
Prewriting Stage Agent - orchestrates gap analysis and sub-agents for brainstorming/planning.
"""
from typing import List
from app.agents.state import WritingState, InstructionalGap, StandardReference
from app.agents.gap_analysis import compute_instructional_gaps
from app.agents.subagents.prewriting import PREWRITING_SUBAGENTS, idea_gen_agent, planning_agent


async def select_subagent(gaps: List[InstructionalGap]):
    """Select the best sub-agent based on the top gap."""
    if not gaps:
        return idea_gen_agent  # Default to idea generation
    
    top_gap = gaps[0]
    
    # Route based on skill domain
    for agent in PREWRITING_SUBAGENTS:
        if agent.matches_gap(top_gap):
            return agent
    
    # Default to idea gen
    return idea_gen_agent


async def prewriting_node(state: WritingState) -> dict:
    """
    Prewriting Stage Agent with full gap analysis pipeline.
    
    1. Computes instructional gaps via RAG + LLM analysis
    2. Routes to appropriate sub-agent (IdeaGen or Planning)
    3. Returns structured output with gaps, prompts, and standards
    """
    print("--- PREWRITING NODE ---")
    
    grade_level = state.get("grade_level", "3")
    student_text = state.get("student_text", "")
    student_response = state.get("student_response", "")
    
    # Extract pre-retrieved standards if they exist (from context expansion)
    retrieved_content = [s["content"] for s in state.get("retrieved_standards", [])]
    
    # Step 1: Compute instructional gaps
    gaps, standards = await compute_instructional_gaps(
        student_text=student_text,
        grade_level=grade_level,
        stage="prewriting",
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
        messages=state.get("messages", [])
    )

    # --- CANVAS UPDATE LOGIC ---
    # Goal: Automatically add ideas to the canvas (student_text) if in Prewriting
    # --- CANVAS UPDATE LOGIC ---
    # Goal: Automatically add ideas to the canvas (student_text) if in Prewriting
    updated_text = None
    
    # Use the AI's explicit extraction of the idea/plan
    if agent_response.canvas_update:
        raw_update = agent_response.canvas_update
        new_content = ""

        # Attempt to parse stringified JSON/Dicts (common with LLMs)
        if isinstance(raw_update, str):
            raw_update = raw_update.strip()
            if (raw_update.startswith("{") and raw_update.endswith("}")) or \
               (raw_update.startswith("[") and raw_update.endswith("]")):
                try:
                    import ast
                    # literal_eval handles python-style dicts (single quotes) which json.loads hates
                    raw_update = ast.literal_eval(raw_update)
                except:
                    pass # Keep as string if parsing fails

        # Handle different types (Model now allows Any)
        if isinstance(raw_update, str):
            # Special handling for IdeaGen: If it returns text, force it into a list structure
            if subagent.name == "IdeaGen":
                lines = [line.strip() for line in raw_update.split('\n') if line.strip()]
                clean_lines = []
                for line in lines:
                    # Strip common bullet markers
                    if line.startswith(("- ", "* ", "• ")):
                        clean_lines.append(line[2:].strip())
                    elif line[0].isdigit() and line[1:].lstrip().startswith("."):
                         # Handle "1. Idea" format
                         parts = line.split(".", 1)
                         if len(parts) > 1:
                             clean_lines.append(parts[1].strip())
                         else:
                             clean_lines.append(line)
                    else:
                        clean_lines.append(line)
                
                if clean_lines:
                    list_items = "".join([f"<li>{x}</li>" for x in clean_lines])
                    new_content = f"<ul>{list_items}</ul>"
                else:
                    new_content = raw_update.strip() # Fallback
            else:
                new_content = raw_update.strip()

        elif isinstance(raw_update, dict):
            # Convert Dict to HTML format for Tiptap
            lines = []
            # Sort keys to try to keep order 1., 2., 3.
            for k in sorted(raw_update.keys()):
                # Heading
                lines.append(f"<p><strong>{k}</strong></p>")
                
                val = raw_update[k]
                content_text = ""
                
                if isinstance(val, list):
                    # List of strings -> Join as paragraph
                    if val:
                        content_text = " ".join([str(v).strip() for v in val if v])
                elif isinstance(val, dict):
                    # Nested dict -> Extract values and join
                    inner_vals = []
                    for inner_k, inner_v in val.items():
                        if isinstance(inner_v, list):
                            inner_vals.extend([str(x).strip() for x in inner_v if x])
                        elif inner_v:
                            inner_vals.append(str(inner_v).strip())
                    if inner_vals:
                         content_text = " ".join(inner_vals)
                elif val:
                     # Simple string/number
                     content_text = str(val).strip()

                if content_text:
                    lines.append(f"<p>{content_text}</p>")
                else:
                    # Placeholder paragraph if empty to allow typing
                    lines.append("<p></p>")

            new_content = "".join(lines)
        elif isinstance(raw_update, list):
             # Render as bulleted list
             list_items = "".join([f"<li>{str(x)}</li>" for x in raw_update if x])
             new_content = f"<ul>{list_items}</ul>"
        
        # REPLACEMENT LOGIC: The sub-agent is now responsible for returning the FULL structured state.
        if new_content:
            updated_text = new_content
            print(f"  [Auto-Update] Canvas updated (overwrite). Length: {len(updated_text)}")
    
    # Build structured output
    result = {
        "next_prompt": agent_response.message,
        "student_prompts": agent_response.suggestions,
        "retrieved_standards": [s.model_dump() for s in standards],
        "instructional_gaps": [g.model_dump() for g in gaps],
        "sub_agent_used": subagent.name,
        "messages": [{"role": "assistant", "content": agent_response.message}]
    }

    # Only include student_text if it was actually updated by the AI
    if updated_text:
        result["student_text"] = updated_text

    return result
