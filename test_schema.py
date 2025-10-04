import requests
import json

token = 'eyJlbWFpbCI6Impra2VjMjNAZ21haWwuY29tIiwibmFtZSI6IkphbWVzIENvbGxpbnMiLCJpbWFnZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tvWHFDVWdnVDR6ZFFmdVIzR3BMaUVSQU56T0pRdlZJUTV3ZXREOXFyMXMtc2MyYXJ4dGc9czk2LWMifQ=='
headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
response = requests.get('http://localhost:8150/projects/schema', headers=headers)
data = response.json()

print('Status:', response.status_code)
print('fieldOptions Category:', data.get('fieldOptions', {}).get('Category', []))
print('fieldOptions Subcategory:', data.get('fieldOptions', {}).get('Subcategory', []))
print('\nFirst few records:')
for i, record in enumerate(data['list'][:3]):
    print(f'  Record {i}: Field="{record["Field Name"]}" Category="{record["Category"]}" category_order={record["category_order"]} Subcategory="{record["Subcategory"]}" subcategory_order={record["subcategory_order"]}')