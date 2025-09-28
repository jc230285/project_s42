import requests
import json

# Test getting a project record
url = 'http://localhost:8150/nocodb/table/mftsk8hkw23m8q1'

try:
    response = requests.get(url)
    print(f'Status: {response.status_code}')
    if response.status_code == 200:
        data = response.json()
        records = data.get('list', [])
        print(f'Found {len(records)} records')
        if records:
            first_record = records[0]
            print(f'First record ID: {first_record.get("Id")}')
            print(f'First record keys: {list(first_record.keys())[:10]}')
            # Look for a simple field to update
            simple_fields = [k for k in first_record.keys() if k not in ['Id', 'CreatedAt', 'UpdatedAt'] and isinstance(first_record[k], str)]
            if simple_fields:
                print(f'Available fields to update: {simple_fields[:5]}')
    else:
        print(f'Error: {response.text}')
except Exception as e:
    print(f'Error: {e}')