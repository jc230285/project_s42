import requests

response = requests.put(
    "http://localhost:8000/pages/14",
    json={"category": "Debug"},
    headers={"Content-Type": "application/json"}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
