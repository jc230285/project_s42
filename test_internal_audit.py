import requests
import json
import os

# Test NocoDB internal audit API directly
nocodb_url = "https://nocodb.edbmotte.com"
base_id = "pjqgy4ri85jks06"
table_id = "mmqclkrvx9lbtpc"  # plots table
api_token = "K7_vnucrg7hRtRQT4fYkkOacFAd8jnIpAtSf8bgG"  # admin token

# Test internal audit API
audit_url = f"{nocodb_url}/api/v2/internal/nc/{base_id}"
params = {
    'operation': 'recordAuditList',
    'fk_model_id': table_id,
    'row_id': '1',
    'cursor': ''
}

headers = {
    "xc-token": api_token,
    "xc-auth": api_token,
    "Content-Type": "application/json",
    "xc-gui": "true"
}

print(f"Testing audit API: {audit_url}")
print(f"Params: {params}")
print(f"Headers: xc-token and xc-auth set to admin token")

try:
    response = requests.get(audit_url, params=params, headers=headers, verify=False)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text[:1000]}...")

    if response.status_code == 200:
        data = response.json()
        print(f"Full response: {json.dumps(data, indent=2)}")
    else:
        print(f"Error response: {response.text}")

except Exception as e:
    print(f"Error: {e}")