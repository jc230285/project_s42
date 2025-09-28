import requests

# Test getting records from plots table with auth
table_url = 'http://localhost:8150/nocodb/table/mmqclkrvx9lbtpc'
auth_header = 'Bearer ' + 'test_token'
headers = {'Authorization': auth_header}

try:
    response = requests.get(table_url, headers=headers)
    print(f'Table request - Status: {response.status_code}')
    if response.status_code == 200:
        data = response.json()
        records = data.get('list', [])
        print(f'Found {len(records)} records')
        if records:
            print('First few record IDs:', [r.get('Id') for r in records[:3]])

            # Test audit for first record
            first_id = records[0].get('Id')
            audit_url = f'http://localhost:8150/audit/plots/{first_id}'
            audit_response = requests.get(audit_url, headers=headers)
            print(f'Audit for ID {first_id} - Status: {audit_response.status_code}')
            if audit_response.status_code == 200:
                audit_data = audit_response.json()
                print(f'Audit entries: {audit_data.get("total_count", 0)}')
                if audit_data.get("audit_trail"):
                    print("Sample audit entry:")
                    print(audit_data["audit_trail"][0])
    else:
        print(f'Error: {response.text[:200]}...')
except Exception as e:
    print(f'Error: {e}')