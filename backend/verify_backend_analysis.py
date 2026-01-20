
import httpx
import asyncio
import json

async def verify():
    url = "http://localhost:8000/api/agents/analyze"
    
    payload = {
        "student_id": "test_user_123",
        "writing_id": "test_writing_123",
        "grade_level": "3",
        "current_stage": "prewriting",
        "student_text": "I want to write about a dragon but I don't know what to say. The dragon is big and green.",
        "last_prompt": "test",
        "student_response": "test",
        "retrieved_standards": [],
        "instructional_gaps": [],
        "messages": []
    }
    
    print(f"Sending request to {url}...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Response JSON keys:", data.keys())
            gaps = data.get("instructional_gaps", [])
            standards = data.get("referenced_standards", [])
            
            print(f"Number of gaps found: {len(gaps)}")
            print(f"Number of standards found: {len(standards)}")
            
            if gaps:
                print("First gap:", gaps[0])
            if standards:
                print("First standard:", standards[0])
        else:
            print("Error response:", response.text)
            
    except httpx.ConnectError:
        print("Could not connect to localhost:8000. Is the backend server running?")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    asyncio.run(verify())
