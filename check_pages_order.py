import requests

response = requests.get('http://localhost:8000/pages-mysql')
if response.status_code == 200:
    pages = response.json()
    print(f'Total pages: {len(pages)}')
    print('\nAll Pages:')
    for p in pages:
        print(f"  {p['id']:5} | {p['name']:20} | Category: {p.get('category', 'None'):15} | Order: {p.get('order_index', 'None')}")
    
    # Group by category
    print('\n\nGrouped by Category:')
    categories = {}
    for p in pages:
        cat = p.get('category', 'None')
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(p)
    
    for cat, cat_pages in sorted(categories.items()):
        print(f'\n{cat}:')
        for p in cat_pages:
            print(f"  - {p['name']} (Order: {p.get('order_index', 'None')})")
else:
    print(f'Error: {response.status_code}')
