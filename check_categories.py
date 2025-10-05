import requests

# Check current categories in use
response = requests.get('http://localhost:8000/pages-mysql')
if response.status_code == 200:
    pages = response.json()
    categories = set()
    for page in pages:
        if page.get('category'):
            categories.add(page['category'])
    
    print(f"Current categories in use: {len(categories)}")
    for cat in sorted(categories):
        print(f"  - {cat}")
else:
    print(f"Error: {response.status_code}")
