import requests
import json

# Test updating page 10 (Debug page) category
data = {
    "category": "Management"
}

response = requests.put(
    "http://localhost:8000/pages/10",
    json=data,
    headers={"Content-Type": "application/json"}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
