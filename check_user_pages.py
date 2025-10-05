import requests

# Check james@scale-42.com's groups via backend API
response = requests.get('http://localhost:8000/user-info?email=james@scale-42.com')
if response.status_code == 200:
    user_info = response.json()
    print('Groups for james@scale-42.com:')
    for group in user_info.get('groups', []):
        print(f"  - {group}")
else:
    print(f'Error getting user info: {response.status_code}')
    print(response.text)

# Check what pages james@scale-42.com should see
response = requests.get('http://localhost:8000/pages/user-mysql/james@scale-42.com')
if response.status_code == 200:
    pages = response.json()
    print(f'\nPages visible to james@scale-42.com: {len(pages)}')
    for page in pages:
        print(f"  - {page['name']} (Category: {page.get('category', 'None')})")
else:
    print(f'Error getting pages: {response.status_code}')
    print(response.text)

# Check all pages
response = requests.get('http://localhost:8000/pages-mysql')
if response.status_code == 200:
    all_pages = response.json()
    print(f'\nAll pages in database: {len(all_pages)}')
    for page in all_pages:
        print(f"  - {page['name']} (Category: {page.get('category', 'None')}, Permissions: {page.get('permissions', 'None')})")
else:
    print(f'Error getting all pages: {response.status_code}')
