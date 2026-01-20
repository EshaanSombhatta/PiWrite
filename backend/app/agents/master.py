from typing import Literal
from langgraph.graph import StateGraph, END
from app.agents.state import WritingState
from app.agents.stages.prewriting import prewriting_node
from app.agents.stages.drafting import drafting_node
from app.agents.stages.revising import revising_node
from app.agents.stages.editing import editing_node
from app.rag.retrieval import retrieve_sol_standards_sync

# --- Context Expansion Node ---
def expand_rag_context(state: WritingState) -> dict:
    """
    Expands the search query when retrieved standards are insufficient.
    Strictly maintains grade level but uses synonyms for the stage.
    """
    print("--- EXPANDING RAG CONTEXT ---")
    grade_level = state.get("grade_level", "3")
    stage = state.get("current_stage", "prewriting").lower()
    attempts = state.get("retrieval_attempts", 0)
    
    # 1. Check max attempts (limit to 2 retries)
    if attempts >= 2:
        print("  Max retries reached. Proceeding with available context.")
        return {
            "rag_status": "sufficient", # Force proceed
            "retrieval_attempts": attempts + 1
        }
    
    # Tiered Expansion Strategy
    retrieved_standards = []
    source_label = "expanded_db"

    # Attempt 0 -> 1: Synonym Expansion (Existing DB)
    if attempts == 0:
        # Generate expanded synonyms for the stage
        synonyms = {
            "prewriting": "brainstorming, planning, outlining, organizing ideas",
            "drafting": "writing paragraphs, sentence structure, elaboration, drafting",
            "revising": "improving content, organization, clarity, flow, revision",
            "editing": "grammar, punctuation, capitalization, spelling, editing"
        }
        
        stage_synonyms = synonyms.get(stage, stage)
        query = f"{stage_synonyms} skills grade {grade_level}"
        print(f"  Expansion Attempt {attempts+1}: Synonym Query: {query}")
        
        retrieved_standards = retrieve_sol_standards_sync(
            query=query,
            grade_level=grade_level,
            stage=stage,
            match_count=8 # Increase recall
        )

    # Attempt 1 -> 2: Tavily Web Search (Fallback)
    elif attempts == 1:
        from app.agents.tools.web_search import tavily_search_safe
        print(f"  Expansion Attempt {attempts+1}: Tavily Web Search Fallback")
        
        # We can use the simple stage name, the utility constructs the complex query
        web_results = tavily_search_safe(query=stage, grade_level=grade_level)
        retrieved_standards = web_results
        source_label = "web_search"

    
    # Pack as StandardReference dicts
    standards_list = [
        {"content": s, "source": source_label} 
        for s in retrieved_standards
    ]
    
    return {
        "retrieved_standards": standards_list,
        "rag_status": "expanded",
        "retrieval_attempts": attempts + 1
    }

# --- Router Logic ---
def master_router(state: WritingState) -> Literal["prewriting", "drafting", "revising", "editing", "expand_context", "__end__"]:
    """
    Routes to the appropriate stage agent based on 'current_stage'.
    """
    stage = state.get("current_stage", "prewriting").lower()
    rag_status = state.get("rag_status", "pending")
    
    # Check for insufficiency signal
    if rag_status == "insufficient":
        return "expand_context"
    
    if stage == "prewriting":
        return "prewriting"
    elif stage == "drafting":
        return "drafting"
    elif stage == "revising":
        return "revising"
    elif stage == "editing":
        return "editing"
    else:
        return END

# --- Graph Definition ---
workflow = StateGraph(WritingState)

# Add Nodes for all stages
workflow.add_node("prewriting", prewriting_node)
workflow.add_node("drafting", drafting_node)
workflow.add_node("revising", revising_node)
workflow.add_node("editing", editing_node)
workflow.add_node("expand_context", expand_rag_context)

# Add Edges
# Entry point: Route immediately based on state
workflow.set_conditional_entry_point(
    master_router,
    {
        "prewriting": "prewriting",
        "drafting": "drafting",
        "revising": "revising",
        "editing": "editing",
        "expand_context": "expand_context",
        END: END
    }
)

# --- Post-Stage Router ---
def post_stage_router(state: WritingState) -> Literal["expand_context", "__end__"]:
    """
    Checks if RAG context was insufficient after a stage run.
    If so, routes to expansion. Otherwise, ends.
    """
    rag_status = state.get("rag_status", "sufficient")
    if rag_status == "insufficient":
        return "expand_context"
    return END

# From each stage -> Post-Stage Router (Check for RAG failure)
# Removed "publishing" from stages list
stages = ["prewriting", "drafting", "revising", "editing"]
for stage in stages:
    workflow.add_conditional_edges(
        stage,
        post_stage_router,
        {
            "expand_context": "expand_context",
            END: END
        }
    )

# From expansion, go back to router (which will send to stage)
workflow.add_conditional_edges(
    "expand_context",
    master_router,
    {
        "prewriting": "prewriting",
        "drafting": "drafting",
        "revising": "revising",
        "editing": "editing",
        "expand_context": "expand_context", 
        END: END
    }
)

# Compile
master_graph = workflow.compile()
