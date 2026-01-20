from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from app.services.image_generation import image_service

router = APIRouter()

class GenerateImageRequest(BaseModel):
    prompt: str
    count: int = 1
    type: str = "illustration" # 'cover' or 'illustration'
    style: Optional[str] = "storybook"

class GenerateImageResponse(BaseModel):
    images: List[str]

@router.post("/generate", response_model=GenerateImageResponse)
async def generate_images(req: GenerateImageRequest):
    """
    Generate images based on text prompt.
    Applies kids-friendly guardrails to the prompt before sending.
    """
    # 1. Basic Safety/Guardrails on Prompt
    safe_prompt = f"Kids friendly, safe, {req.style} style: {req.prompt}"
    
    # 2. Call Service
    try:
        images = await image_service.generate_images(safe_prompt, req.count)
        return GenerateImageResponse(images=images)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
