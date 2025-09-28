import requests
import json

# Test getting actual records first
url = 'http://localhost:8150/nocodb/table/mftsk8hkw23m8q1'  # projects table

try:
    response = requests.get(url)
    print(f'Projects table - Status: {response.status_code}')
    if response.status_code == 200:
        data = response.json()
        records = data.get('list', [])
        print(f'Found {len(records)} project records')
        if records:
            first_record = records[0]
            print(f'First project ID: {first_record.get("Id")}')
            
            # Test audit for this project
            audit_url = f'http://localhost:8150/audit/projects/{first_record.get("Id")}'
            audit_response = requests.get(audit_url)
            print(f'Audit for project {first_record.get("Id")} - Status: {audit_response.status_code}')
            if audit_response.status_code == 200:
                audit_data = audit_response.json()
                print(f'Audit entries: {audit_data.get("total_count", 0)}')
                if audit_data.get("audit_trail"):
                    print(f'First audit entry: {audit_data["audit_trail"][0] if audit_data["audit_trail"] else "None"}')
    else:
        print(f'Error: {response.text}')
except Exception as e:
    print(f'Error: {e}')

print("\n" + "="*50)

# Test plots table
url = 'http://localhost:8150/nocodb/table/mmqclkrvx9lbtpc'  # plots table

try:
    response = requests.get(url)
    print(f'Plots table - Status: {response.status_code}')
    if response.status_code == 200:
        data = response.json()
        records = data.get('list', [])
        print(f'Found {len(records)} plot records')
        if records:
            first_record = records[0]
            print(f'First plot ID: {first_record.get("Id")}')
            
            # Test audit for this plot
            audit_url = f'http://localhost:8150/audit/plots/{first_record.get("Id")}'
            audit_response = requests.get(audit_url)
            print(f'Audit for plot {first_record.get("Id")} - Status: {audit_response.status_code}')
            if audit_response.status_code == 200:
                audit_data = audit_response.json()
                print(f'Audit entries: {audit_data.get("total_count", 0)}')
                if audit_data.get("audit_trail"):
                    print(f'First audit entry: {audit_data["audit_trail"][0] if audit_data["audit_trail"] else "None"}')
    else:
        print(f'Error: {response.text}')
except Exception as e:
    print(f'Error: {e}')