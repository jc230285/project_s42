import requests

# Test update endpoint
response = requests.put(
    'http://localhost:8000/pages/14',
    json={"description": "UPDATED BY TEST"},
    headers={'Content-Type': 'application/json'}
)

print(f"Status: {response.status_code}")
print(f"Response: {response.text}")
