from fastapi import APIRouter, HTTPException
from app.agents.master import master_graph
from app.models.requests import WritingStateRequest

router = APIRouter()

@router.post("/invoke")
async def invoke_agent(request: WritingStateRequest):
    """
    Invokes the agent graph with the provided state.
    """
    from app.core.database import get_supabase_client
    
    try:
        # LangGraph invoke returns the final state
        result = await master_graph.ainvoke(request.model_dump())
        
        # Ensure result is a dict (LangGraph State)
        if hasattr(result, "dict"): 
            result = result.dict()
        elif hasattr(result, "model_dump"):
            result = result.model_dump()
        elif not isinstance(result, dict):
            # If it's some other object (like AgentResponse class), try to convert it
            try:
                result = dict(result)
            except:
                # Force cleanup if simple dict conversion fails
                if hasattr(result, "__dict__"):
                     result = result.__dict__
        
        # Save Chat History
        supabase = get_supabase_client()
        
        # 1. Save User Message
        if request.student_response:
             supabase.table("chat_messages").insert({
                "writing_id": request.writing_id,
                "role": "user",
                "content": request.student_response
            }).execute()

        # 2. Save AI Response
        ai_response = None
        if result.get("messages") and len(result["messages"]) > 0:
            last_msg = result["messages"][-1]
            if isinstance(last_msg, dict):
                 ai_response = last_msg.get("content")
            elif hasattr(last_msg, "content"):
                 ai_response = last_msg.content
            elif hasattr(last_msg, "model_dump"): # Handle Pydantic objects directly
                 # If it's an AgentResponse or similar, it might be the whole object.
                 # We probably just want a string representation or a specific field.
                 # Let's try to get a 'content' field or dump as JSON string.
                 dump = last_msg.model_dump()
                 ai_response = dump.get("content") or str(dump)
            else:
                 ai_response = str(last_msg)
        
        # Fallback if no explicit message
        if not ai_response and result.get("next_prompt"):
            prompt = result["next_prompt"]
            if hasattr(prompt, "content"):
                ai_response = prompt.content
            else:
                ai_response = str(prompt)
            
        if ai_response:
             # Final safety check: Ensure it is a string
             if not isinstance(ai_response, str):
                 ai_response = str(ai_response)

             supabase.table("chat_messages").insert({
                "writing_id": request.writing_id,
                "role": "assistant",
                "content": ai_response
            }).execute()

        return result
    except Exception as e:
        print(f"Agent Invoke Error: {e}")
        # Return a safe error state instead of 500 to keep UI alive if possible, 
        # or just raise 500 but log detailed type
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Serialization Error: {str(e)}")


@router.get("/history/{writing_id}")
async def get_chat_history(writing_id: str):
    """
    Fetches chat history for a given writing ID.
    """
    from app.core.database import get_supabase_client
    
    try:
        supabase = get_supabase_client()
        print(f"Fetching chat history for writing_id: {writing_id}")
        response = supabase.table("chat_messages")\
            .select("*")\
            .eq("writing_id", writing_id)\
            .order("created_at", desc=False)\
            .execute()
            
        print(f"Retrieved {len(response.data)} messages.")
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_writing(request: WritingStateRequest):
    """
    Analyzes the writing to identify instructional gaps and saves the result.
    """
    from app.agents.gap_analysis import compute_instructional_gaps
    from app.core.database import get_supabase_client

    try:
        # 1. Compute Gaps
        gaps, standards = await compute_instructional_gaps(
            student_text=request.student_text,
            grade_level=request.grade_level,
            stage=request.current_stage
        )

        # 2. Save to Supabase
        supabase = get_supabase_client()
        
        # Prepare data for insertion
        data = {
            "writing_id": request.writing_id,
            "detected_gaps": [g.model_dump() for g in gaps],
            "active_prompts": [], # Analysis only, no prompts generated here
            "context_summary": "Auto-Analysis on Save",
            "retrieved_standards": [s.model_dump() for s in standards]
        }
        
        supabase.table("instructional_state").insert(data).execute()

        return {
            "instructional_gaps": gaps,
            "referenced_standards": standards
        }

    except Exception as e:
        print(f"Error in analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))
