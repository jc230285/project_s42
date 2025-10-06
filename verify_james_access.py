import requests
import json

print("=" * 80)
print("VERIFICATION TEST FOR JAMES@SCALE-42.COM")
print("=" * 80)

# Test 1: Get user info
print("\n1. USER INFO AND GROUPS:")
response = requests.get('http://localhost:8000/user-info/james@scale-42.com')
if response.status_code == 200:
    data = response.json()
    groups = data.get('groups', [])
    print(f"   ✓ User found with {len(groups)} groups:")
    for g in groups:
        print(f"     - {g['name']}")
else:
    print(f"   ✗ Error: {response.status_code}")

# Test 2: Get visible pages
print("\n2. VISIBLE PAGES:")
response = requests.get('http://localhost:8000/pages/user-mysql/james@scale-42.com')
if response.status_code == 200:
    pages = response.json()
    print(f"   ✓ User can see {len(pages)} pages")
    
    # Check specific pages
    page_names = [p['name'] for p in pages]
    
    print("\n   Navigation pages:")
    if 'Dashboard' in page_names:
        print("     ✓ Dashboard")
    
    print("\n   Development pages:")
    if 'Debug' in page_names:
        print("     ✓ Debug (Developers group)")
    
    print("\n   Management pages:")
    if 'Page Management' in page_names:
        print("     ✓ Page Management (Scale42 group)")
    if 'Users' in page_names:
        print("     ✓ Users (Scale42 group)")
    
    print("\n   Project pages:")
    for page in ['Hoyanger', 'Map', 'Projects', 'Schema']:
        if page in page_names:
            print(f"     ✓ {page}")
    
    print("\n   Tools pages:")
    for page in ['N8N', 'NocoDb', 'Drive', 'Notion']:
        if page in page_names:
            print(f"     ✓ {page}")
else:
    print(f"   ✗ Error: {response.status_code}")

# Test 3: Check Debug page permissions
print("\n3. DEBUG PAGE PERMISSIONS:")
response = requests.get('http://localhost:8000/pages-mysql')
if response.status_code == 200:
    all_pages = response.json()
    debug_page = next((p for p in all_pages if p['name'] == 'Debug'), None)
    if debug_page:
        print(f"   ✓ Debug page exists")
        print(f"   ✓ Permissions: {debug_page.get('permissions', 'None')}")
    else:
        print("   ✗ Debug page not found")
else:
    print(f"   ✗ Error: {response.status_code}")

print("\n" + "=" * 80)
print("CONCLUSION:")
print("=" * 80)
print("If you don't see the Debug page in the menu:")
print("1. Clear your browser cache (Ctrl+Shift+Delete)")
print("2. Sign out and sign back in")
print("3. Hard refresh the page (Ctrl+F5)")
print("=" * 80)
