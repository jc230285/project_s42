import requests

# Get a sample page to see its structure
response = requests.get('http://localhost:8000/pages-mysql')
if response.status_code == 200:
    pages = response.json()
    if pages:
        print("Sample page structure:")
        print(pages[0].keys())
        print("\nFull sample:")
        import json
        print(json.dumps(pages[0], indent=2))
