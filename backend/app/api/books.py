from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.services.book_service import book_service
import traceback

router = APIRouter()

class SaveBookRequest(BaseModel):
    writing_id: str
    book_data: Dict[str, Any]  # { coverImage, author, pages: [...] }

@router.post("/save")
async def save_book(request: SaveBookRequest, req: Request):
    try:
        # Extract Bearer token
        auth_header = req.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
        result = book_service.save_book_state(request.writing_id, request.book_data, auth_token=token)
        return {"status": "success", "data": result}
    except Exception as e:
        traceback.print_exc()
        # Fallback explanation if table missing
        if "relation \"published_books\" does not exist" in str(e):
             raise HTTPException(status_code=500, detail="Database table 'published_books' missing. Please run migration.")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{writing_id}")
async def get_book(writing_id: str, req: Request):
    try:
        # Extract Bearer token
        auth_header = req.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        data = book_service.get_book_state(writing_id, auth_token=token)
        return data if data else {}
    except Exception as e:
        if "relation \"published_books\" does not exist" in str(e):
             return {} # Fail gracefully if table missing
        raise HTTPException(status_code=500, detail=str(e))
