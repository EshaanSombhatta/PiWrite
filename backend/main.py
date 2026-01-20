from fastapi import FastAPI
from dotenv import load_dotenv
import os

# Load env vars
load_dotenv()

from app.api import agents

app = FastAPI(title="PiWrite Backend")

app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
from app.api import images
app.include_router(images.router, prefix="/api/images", tags=["images"])

from app.api import books
app.include_router(books.router, prefix="/api/books", tags=["books"])

from app.api import insights
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to PiWrite API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
