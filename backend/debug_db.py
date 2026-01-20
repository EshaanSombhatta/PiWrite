
import asyncio
from app.core.database import get_supabase_client

async def check_db():
    supabase = get_supabase_client()
    
    # Count rows
    response = supabase.table("sol_standards").select("*", count="exact").execute()
    print(f"Total rows in sol_standards: {response.count}")
    
    if response.data:
        print("\nSample Metadata:")
        for i, row in enumerate(response.data[:5]):
            print(f"{i+1}. {row.get('metadata')}")

if __name__ == "__main__":
    asyncio.run(check_db())
