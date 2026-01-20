from langchain_groq import ChatGroq
from app.core.config import get_settings

_llm_instance = None

def get_llm() -> ChatGroq:
    """Returns a singleton ChatGroq LLM instance."""
    global _llm_instance
    if _llm_instance is None:
        settings = get_settings()
        _llm_instance = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
    return _llm_instance
