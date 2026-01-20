import os
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

if not url or not key:
    print("❌ Missing Request Environment Variables (SUPABASE_URL, SUPABASE_KEY)")
    exit(1)

supabase: Client = create_client(url, key)

async def check_permissions():
    print("1. Checking 'published_books' table existence...")
    try:
        # Try to select 0 rows
        res = supabase.table("published_books").select("*").limit(1).execute()
        print("✅ Table 'published_books' exists.")
        print(f"   Rows found: {len(res.data)}")
    except Exception as e:
        print(f"❌ Table check failed: {e}")
        print("   This likely means the migration '01_create_published_books.sql' was not run.")
        return

    print("\n2. Checking Write Permissions...")
    try:
        # We can't easily check write without a valid user token if RLS is on.
        # But we can check if we catch a specific RLS error vs a schema error.
        print("   (Skipping write check as it requires Auth context, but schema presence is the main blocker)")
        pass
    except Exception as e:
        print(f"   Write check error: {e}")

if __name__ == "__main__":
    asyncio.run(check_permissions())
