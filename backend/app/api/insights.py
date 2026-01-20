from fastapi import APIRouter, HTTPException, Request
from app.core.database import get_supabase_client
from typing import List, Dict, Any
import collections

router = APIRouter()

@router.get("/student")
async def get_student_insights(req: Request):
    """
    Aggregates insights for the logged-in student.
    Calculates strengths (skills with few gaps) and focus areas (skills with many gaps).
    """
    try:
        # 1. Auth & User ID
        auth_header = req.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Missing Authorization Header")
        
        token = auth_header.split(" ")[1]
        supabase = get_supabase_client()
        supabase.postgrest.auth(token)
        
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
             raise HTTPException(status_code=401, detail="Invalid Token")
        
        user_id = user_resp.user.id

        # 2. Fetch all writings for this student
        writings_resp = supabase.table("writings")\
            .select("id, title, current_stage, updated_at")\
            .eq("student_id", user_id)\
            .execute()
        
        writings = writings_resp.data or []
        if not writings:
            return {
                "stats": {"total_stories": 0, "active_stories": 0},
                "strengths": [],
                "weaknesses": []
            }
            
        writing_ids = [w["id"] for w in writings]
        
        # 3. Fetch instructional gaps for these writings
        # We need to query 'instructional_state' where writing_id is in our list.
        # Supabase-py 'in_' filter uses a tuple or list.
        gaps_resp = supabase.table("instructional_state")\
            .select("writing_id, detected_gaps")\
            .in_("writing_id", writing_ids)\
            .execute()
            
        all_gaps = []
        for row in gaps_resp.data:
            # detected_gaps is a JSONB column (list of dicts)
            gaps = row.get("detected_gaps") or []
            all_gaps.extend(gaps)

        # 4. Aggregate Logic
        # Count frequency of each 'skill_domain'
        skill_counts = collections.Counter()
        severity_weights = {"low": 1, "medium": 2, "high": 3}
        
        for gap in all_gaps:
            domain = gap.get("skill_domain", "Uncategorized").title()
            severity = gap.get("severity", "medium")
            weight = severity_weights.get(severity, 1)
            skill_counts[domain] += weight

        # Define 'Strengths' as known domains that appear LESS frequently or not at all?
        # A better approach for now might be: 
        # - Top 3 domains with HIGHEST comparison count -> Weaknesses
        # - We assume existence of standard domains. If a domain has 0 gaps, it's a strength.
        # For simplicity in this iteration:
        # Weaknesses = Top 3 detected gap domains
        # Strengths = Hardcoded list of Core Skills MINUS Weaknesses (or just "General writing flow" if empty)
        
        common_domains = ["Ideas", "Organization", "Voice", "Sentence Fluency", "Word Choice", "Conventions"]
        
        # Identify Weaknesses
        sorted_gaps = skill_counts.most_common()
        weaknesses = [{"domain": k, "score": v} for k, v in sorted_gaps[:3]]
        
        # Identify Strengths (Domains with low/zero score)
        # If we have data, we look for domains with count 0 or low count.
        strengths_candidates = []
        current_weakness_domains = [w["domain"] for w in weaknesses]
        
        for domain in common_domains:
            if domain not in current_weakness_domains:
                strengths_candidates.append(domain)
        
        # If no gaps at all, everything is a strength
        if not all_gaps:
             strengths = [{"domain": "All Core Skills", "message": "Great job! No major gaps detected yet."}]
             weaknesses = []
        else:
             strengths = [{"domain": d, "message": "Consistent performance"} for d in strengths_candidates[:3]]

        # 5. Stats
        stats = {
            "total_stories": len(writings),
            "active_stories": sum(1 for w in writings if w['current_stage'] != 'published'),
            "total_gaps_identified": len(all_gaps)
        }

        return {
            "stats": stats,
            "strengths": strengths,
            "weaknesses": weaknesses,
            # debug data
            # "raw_gaps_count": len(all_gaps) 
        }

    except Exception as e:
        print(f"Insights Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
