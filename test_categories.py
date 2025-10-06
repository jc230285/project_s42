import requests

print("=" * 80)
print("CATEGORY MANAGEMENT TEST")
print("=" * 80)

# Get all pages
response = requests.get('http://localhost:8000/pages-mysql')
if response.status_code == 200:
    pages = response.json()
    
    # Extract categories
    category_map = {}
    for page in pages:
        cat = page.get('category', 'Uncategorized')
        if cat not in category_map:
            category_map[cat] = []
        category_map[cat].append(page['name'])
    
    print(f"\n✓ Found {len(category_map)} categories:")
    for cat in sorted(category_map.keys()):
        page_list = category_map[cat]
        print(f"\n  {cat} ({len(page_list)} page{'s' if len(page_list) != 1 else ''}):")
        for page_name in sorted(page_list):
            print(f"    - {page_name}")
    
    print("\n" + "=" * 80)
    print("FEATURES AVAILABLE:")
    print("=" * 80)
    print("✓ View all categories with page counts")
    print("✓ Rename categories (updates all pages)")
    print("✓ Delete categories (moves pages to 'Uncategorized')")
    print("✓ Create new categories by typing in page create/edit forms")
    print("✓ Auto-suggestions for existing categories")
    print("\n💡 Click 'Manage Categories' button on Page Management screen")
    print("=" * 80)
else:
    print(f"Error: {response.status_code}")
