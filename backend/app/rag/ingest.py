import asyncio
import os
from dotenv import load_dotenv

load_dotenv()
print("DEBUG: Environment loaded")

from llama_index.core import SimpleDirectoryReader, Settings
print("DEBUG: LlamaIndex Imported")
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core.node_parser import SentenceSplitter
from app.core.database import get_supabase_client

async def ingest_sols(directory: str = "data/sols"):
    """
    Ingests SOL documents using LlamaIndex for parsing/splitting/embedding
    and Supabase REST Client for storage.
    """
    print(f"--- Ingesting SOLs from {directory} ---")
    
    # 1. Setup LlamaIndex Settings
    print("Loading embedding model (MiniLM-L6-v2)...")
    embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
    Settings.embed_model = embed_model
    Settings.llm = None
    
    # 2. Load and Split Documents
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
        return

    print("Reading and parsing files (.docx, .txt, etc.)...")
    reader = SimpleDirectoryReader(input_dir=directory, recursive=False)
    documents = reader.load_data()
    print(f"Loaded {len(documents)} document pages.")
    
    parser = SentenceSplitter(chunk_size=1024, chunk_overlap=200)
    nodes = parser.get_nodes_from_documents(documents)
    print(f"Created {len(nodes)} text chunks.")
    
    # 3. Generate Embeddings (batch)
    print("Generating embeddings...")
    # LlamaIndex nodes have a 'get_embedding()' method if the model is attached, 
    # but it's often cleaner to batch embed the texts directly if possible.
    # We will iterate and embed.
    
    texts = [node.get_content() for node in nodes]
    # embed_documents is available on the internal model, usually.
    # HuggingFaceEmbedding has .get_text_embedding_batch
    
    embeddings = embed_model.get_text_embedding_batch(texts)
    
    # 4. Upload to Supabase
    supabase = get_supabase_client()
    
    # TRUNCATE existing data to avoid duplicates with bad metadata
    print("Clearing existing SOL standards...")
    supabase.table("sol_standards").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    records = []
    
    for node, vector in zip(nodes, embeddings):
        # Extract metadata from filename
        # Example: "3-Grade 3_Writing.docx"
        filename = node.metadata.get("file_name", "")
        
        meta = node.metadata.copy()
        
        # Simple heuristic tagging
        # Grade Parsing
        if "Grade 3" in filename or "3-" in filename or "3_" in filename:
            meta["grade"] = "3"
        elif "Grade 5" in filename or "5-" in filename or "5_" in filename:
            meta["grade"] = "5"
        elif "Grade 4" in filename or "4-" in filename or "4_" in filename:
            meta["grade"] = "4"
        elif "Grade 6" in filename or "6-" in filename or "6_" in filename:
            meta["grade"] = "6"
        elif "Grade 2" in filename or "2-" in filename or "2_" in filename:
            meta["grade"] = "2"
        elif "Grade 1" in filename or "1-" in filename or "1_" in filename:
            meta["grade"] = "1"
        elif "K-" in filename or "K_" in filename or "0-K" in filename:
            meta["grade"] = "K"
            
        # Add stage tags if filename contains them
        lower_name = filename.lower()
        if "prewriting" in lower_name:
            meta["stage"] = "prewriting"
        elif "drafting" in lower_name:
            meta["stage"] = "drafting"
        elif "revising" in lower_name:
            meta["stage"] = "revising"
        elif "editing" in lower_name:
            meta["stage"] = "editing"
        elif "publishing" in lower_name:
            meta["stage"] = "publishing"
            
        # If "Understanding the Standards" is in name, maybe it applies to ALL stages?
        # But for now, we leave stage empty if not found, and rely on stage filter being disabled/optional in retrieval.py.
        
        records.append({
            "content": node.get_content(),
            "metadata": meta,
            "embedding": vector
        })
        
    print(f"Uploading {len(records)} records to Supabase...")
    
    batch_size = 50
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        try:
            supabase.table("sol_standards").insert(batch).execute()
            print(f"Inserted batch {i // batch_size + 1}")
        except Exception as e:
            print(f"Error inserting batch {i // batch_size + 1}: {e}")

if __name__ == "__main__":
    asyncio.run(ingest_sols())
