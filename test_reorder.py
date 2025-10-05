import requests
import json

# Test data - swap Dashboard and Projects
updates = [
    {"page_id": 2, "display_order": 0},  # Projects first
    {"page_id": 1, "display_order": 1},  # Dashboard second
]

response = requests.put(
    "http://localhost:8000/pages/reorder",
    json={"updates": updates},
    headers={"Content-Type": "application/json"}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 200:
    # Check if it worked
    import mysql.connector
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "scale42_db")
    )
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name, display_order FROM pages WHERE id IN (1, 2) ORDER BY id")
    pages = cursor.fetchall()
    
    print("\n=== AFTER UPDATE ===")
    for p in pages:
        print(f"ID {p['id']}: {p['name']} - display_order={p['display_order']}")
    
    cursor.close()
    conn.close()
