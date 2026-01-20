from langchain_huggingface import HuggingFaceEmbeddings

class Embeddings:
    _instance = None

    @classmethod
    def get_embeddings(cls):
        if cls._instance is None:
            # lightweight, efficient and free
            model_name = "sentence-transformers/all-MiniLM-L6-v2"
            cls._instance = HuggingFaceEmbeddings(model_name=model_name)
        return cls._instance
