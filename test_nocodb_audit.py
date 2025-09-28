import requests

# Test NocoDB internal audit API
url = 'https://nocodb.edbmotte.com/api/v2/internal/nc/pjqgy4ri85jks06'
params = {
    'operation': 'recordAuditList',
    'fk_model_id': 'mmqclkrvx9lbtpc',
    'row_id': '1',
    'cursor': ''
}

headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'dnt': '1',
    # Removed if-none-match to force fresh response
    'priority': 'u=1, i',
    'referer': 'https://nocodb.edbmotte.com/dashboard/',
    'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    'xc-auth': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Impra2VjMjNAZ21haWwuY29tIiwiaWQiOiJ1c3N6eHU5Z2RycTBjZWY5Iiwicm9sZXMiOiJvcmctbGV2ZWwtY3JlYXRvcixzdXBlciIsInRva2VuX3ZlcnNpb24iOiJlMzhmYjBjNTgxZDAzYzA2M2NlNWY3ZWRiZTFkYWQ3MGU4OTk0OWMwYWJlYzMzYjQ2YTBiNjQ0ODM3MTIxOGQ0ZGFkZmRkZWRkOTM4MDVjZiIsImlhdCI6MTc1OTAzMzkzNiwiZXhwIjoxNzU5MDY5OTM2fQ.ximbE6xqMFrkRRZu2rHZjkJ_VumwwgvfSWEpnsFX3bw',
    'xc-gui': 'true'
}

try:
    response = requests.get(url, params=params, headers=headers, verify=False)
    print(f'Status Code: {response.status_code}')
    print(f'Headers: {dict(response.headers)}')
    print(f'Response: {response.text[:1000]}...')
except Exception as e:
    print(f'Error: {e}')