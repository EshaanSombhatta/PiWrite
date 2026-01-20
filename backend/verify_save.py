from app.services.book_service import book_service
import json

# Use a known ID or the one from logs
WRITING_ID = "ebd45d4d-09bf-4623-8ac5-58e5376daa48"

try:
    print(f"Fetching state for {WRITING_ID}...")
    data = book_service.get_book_state(WRITING_ID)
    
    if not data:
        print("No data found for this ID.")
    else:
        print("Data found.")
        pages = data.get("pages", [])
        print(f"Number of pages: {len(pages)}")
        
        has_images = False
        for p in pages:
            if p.get("image"):
                img_data = p["image"]
                print(f"Page {p.get('id')} has image. Length: {len(img_data)}")
                if img_data.startswith("data:image"):
                    print("Image is a Data URI.")
                    has_images = True
                else:
                    print("Image is NOT a Data URI (might be old URL).")
        
        if has_images:
            print("SUCCESS: Images are persisted.")
        else:
            print("WARNING: No images found in persisted state.")

except Exception as e:
    print(f"Error: {e}")
