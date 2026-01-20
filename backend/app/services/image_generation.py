import os
import random
import asyncio
from typing import List, Optional

# Mock images for testing/safety
MOCK_COVERS = [
    "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1629992101753-56d196c8aabb?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=600&auto=format&fit=crop"
]

MOCK_ILLUSTRATIONS = [
    "https://images.unsplash.com/photo-1578301978693-85ea9ec2a20c?q=80&w=600&auto=format&fit=crop", 
    "https://images.unsplash.com/photo-1618331835717-801e976710b2?q=80&w=600&auto=format&fit=crop"
]

class ImageGenerationService:
    def __init__(self):
        # Determine if we should mock: 
        # 1. Explicit env var MOCK_IMAGES=true
        self.mock_mode = os.getenv("MOCK_IMAGES", "false").lower() == "true"

    async def generate_images(self, prompt: str, count: int = 1, aspect_ratio: str = "1:1") -> List[str]:
        """
        Generate images using Hugging Face Flux.1 Schnell model via InferenceClient.
        Returns Base64 encoded image data string.
        """
        token = os.getenv("HF_TOKEN")
        if not token:
            print("W: HF_TOKEN not found. Falling back to mock.")
            pool = MOCK_COVERS if "cover" in prompt.lower() else MOCK_ILLUSTRATIONS
            return [random.choice(pool) for _ in range(count)]

        if self.mock_mode:
            print(f"I: Generating {count} mock images for: {prompt}")
            await asyncio.sleep(1)
            pool = MOCK_COVERS if "cover" in prompt.lower() else MOCK_ILLUSTRATIONS
            return [random.choice(pool) for _ in range(count)]

        try:
            from huggingface_hub import AsyncInferenceClient
            import base64
            from io import BytesIO
            from langchain_groq import ChatGroq
            from langchain_core.messages import HumanMessage
            
            # --- 1. Refine Prompt with Groq (Llama 3) ---
            # We assume the 'prompt' contains rich context (Story + Page).
            # We use Llama 3 to distill this into a high-quality visual description for Flux.
            
            groq_api_key = os.getenv("GROQ_API_KEY")
            final_prompt = prompt
            
            if groq_api_key and len(prompt) > 50: # Only refine if we have a key and reasonable content
                try:
                    llm = ChatGroq(
                        temperature=0.7, 
                        model_name="llama-3.3-70b-versatile",
                        api_key=groq_api_key
                    )
                    
                    system_instruction = (
                        "You are an expert visual prompt engineer for AI image generators (Flux.1). "
                        "The user will provide a Story Context and a specific Page Scene. "
                        "Your task is to write a single, detailed, descriptive prompt for generating an illustration of that specific page. "
                        "1. Describe the scene's action and setting based on the Page Scene. "
                        "2. Ensure CHARACTERS match the description in the Story Context (consistency). "
                        "3. Style: Children's book illustration, vibrant, expressive. "
                        "4. SAFETY CRITICAL: The image MUST be safe for kids (G-Rated). NO violence, NO gore, NO scary monsters, NO inappropriate attire, NO weapons. "
                        "5. NO TEXT: Do NOT include any words, titles, names, or text inside the image. The text will be added as an overlay later. "
                        "6. Output ONLY the prompt string, no pleasantries."
                    )
                    
                    messages = [
                        HumanMessage(content=f"{system_instruction}\n\nINPUT TEXT:\n{prompt}")
                    ]
                    
                    response = await llm.ainvoke(messages)
                    refined = response.content.strip()
                    if refined:
                        print(f"I: Original Prompt: {prompt[:100]}...")
                        print(f"I: Refined Prompt: {refined}")
                        final_prompt = refined
                except Exception as llm_e:
                    print(f"W: Prompt refinement failed, using original. Error: {llm_e}")
            
            # --- 2. Generate Image with Flux ---
            
            # Using the client abstracts the specific URL (inference vs router)
            client = AsyncInferenceClient(token=token)
            model_id = "black-forest-labs/FLUX.1-schnell"

            generated_images = []
            
            for _ in range(count):
                try:
                    # text_to_image returns a PIL Image by default
                    image = await client.text_to_image(final_prompt, model=model_id)
                    
                    # Convert PIL Image to Base64
                    buffered = BytesIO()
                    image.save(buffered, format="PNG")
                    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
                    data_uri = f"data:image/png;base64,{img_str}"
                    
                    # --- 3. Safety Check with Vision Model ---
                    if groq_api_key:
                        try:
                            # Use Llama 4 Maverick (Multimodal) to inspect the image since 3.2 Vision is deprecated
                            safety_llm = ChatGroq(
                                temperature=0.0,
                                model_name="meta-llama/llama-4-maverick-17b-128e-instruct",
                                api_key=groq_api_key
                            )
                            
                            safety_msg = HumanMessage(
                                content=[
                                    {"type": "text", "text": "Is this image safe for a children's book? It should contain NO violence, gore, nudity, scary monsters, or weapons. Answer with 'SAFE' or 'UNSAFE' only."},
                                    {"type": "image_url", "image_url": {"url": data_uri}}
                                ]
                            )
                            
                            safety_response = await safety_llm.ainvoke([safety_msg])
                            safety_verdict = safety_response.content.strip().upper()
                            
                            print(f"I: Safety Verdict: {safety_verdict}")
                            
                            if "UNSAFE" in safety_verdict:
                                print("W: Image flagged as UNSAFE. Discarding.")
                                # Fallback to a safe mock if real generation was unsafe
                                generated_images.append(random.choice(MOCK_COVERS if "cover" in prompt.lower() else MOCK_ILLUSTRATIONS))
                                continue
                                
                        except Exception as safe_e:
                            print(f"W: Safety check failed ({safe_e}). Assuming safe.")
                    
                    generated_images.append(data_uri)
                    
                except Exception as gen_e:
                    print(f"E: Single image generation failed: {gen_e}")
                    generated_images.append(random.choice(MOCK_COVERS))
            
            print(f"I: Generated {len(generated_images)} HF Images")
            return generated_images

        except Exception as e:
            print(f"E: Image generation failed: {e}")
            # Fallback for this specific failure
            pool = MOCK_COVERS if "cover" in prompt.lower() else MOCK_ILLUSTRATIONS
            return [random.choice(pool) for _ in range(count)]

image_service = ImageGenerationService()
