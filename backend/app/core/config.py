from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_KEY: str
    GROQ_API_KEY: str
    LANGCHAIN_TRACING_V2: str = "false"
    LANGCHAIN_PROJECT: str = "piwrite"
    LANGCHAIN_API_KEY: str | None = None
    
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache
def get_settings():
    return Settings()
