from typing import Dict, Any, Optional
from app.core.database import get_supabase_client

class BookService:
    def __init__(self):
        pass

    def save_book_state(self, writing_id: str, book_data: Dict[str, Any], auth_token: Optional[str] = None):
        """
        Saves the book state with Auth context.
        """
        client = get_supabase_client()
        if auth_token:
            client.postgrest.auth(auth_token)
        
        # Upsert logic
        data = {
            "writing_id": writing_id,
            "book_data": book_data,
        }
        
        response = client.table("published_books").upsert(data, on_conflict="writing_id").execute()
        return response.data

    def get_book_state(self, writing_id: str, auth_token: Optional[str] = None) -> Optional[Dict[str, Any]]:
        supabase = get_supabase_client()
        if auth_token:
            supabase.postgrest.auth(auth_token)
            
        response = supabase.table("published_books").select("book_data").eq("writing_id", writing_id).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]["book_data"]
        return None

book_service = BookService()
