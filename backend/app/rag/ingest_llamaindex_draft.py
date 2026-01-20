import asyncio
import os
from llama_index.core import SimpleDirectoryReader, StorageContext, VectorStoreIndex, Settings
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from app.core.config import get_settings

async def ingest_with_llamaindex(directory: str = "data/sols"):
    print(f"--- Ingesting with LlamaIndex from {directory} ---")
    
    settings = get_settings()
    
    # 1. Configure Settings (Embeddings)
    # Use MiniLM-L6-v2 (384 dimensions)
    print("Loading embedding model...")
    Settings.embed_model = HuggingFaceEmbedding(
        model_name="sentence-transformers/all-MiniLM-L6-v2"
    )
    # Don't need LLM for ingestion
    Settings.llm = None 
    
    # 2. Load Documents (.docx, .txt supported natively)
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
        return

    print("Reading files...")
    reader = SimpleDirectoryReader(input_dir=directory, recursive=False)
    documents = reader.load_data()
    print(f"Loaded {len(documents)} document pages.")
    
    # 3. Connect to Supabase Vector Store
    print("Connecting to Supabase...")
    vector_store = SupabaseVectorStore(
        postgres_connection_string=settings.SUPABASE_URL, # CAREFUL: This library usually wants the Postgres URI (postgresql://...) not the API URL
        collection_name="sol_standards",
        dimension=384,
    )
    # ERROR HANDLING: user has likely only provided the REST URL. 
    # SupabaseVectorStore requires the DIRECT PG connection string usually 
    # OR calls via vecswrap. Let's check. 
    # The official SupabaseVectorStore in llama-index often uses `vecs` or direct SQL.
    # WAIT. The `llama-index-vector-stores-supabase` often uses the Python `supabase` client OR `postgres_connection_string`.
    # Let's check standard usage. It uses `postgres_connection_string`.
    
    # If we don't have the PG string, we can't use this specific integration easily without it.
    # ALTERNATIVE: Use generic Supabase client and manual insertion (as I wrote before) BUT with LlamaIndex for parsing/embedding.
    
    # Let's stick to the manual insert method for reliability if we only have API keys, 
    # OR ask user for DB URI. User provided SUPABASE_URL (https://...).
    # I will assume we need to use the previous manual method but utilizing LlamaIndex for the heavy lifting (parsing + embedding).
    
    pass 

if __name__ == "__main__":
    # asyncio.run(ingest_with_llamaindex())
    pass
