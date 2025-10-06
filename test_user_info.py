import requests
import json

print("=" * 80)
print("DEBUGGING USER-INFO ENDPOINT")
print("=" * 80)

# Test the user-info endpoint
email = "james@scale-42.com"
print(f"\nFetching user info for: {email}")

response = requests.get(f'http://localhost:8000/user-info/{email}')

print(f"\nStatus Code: {response.status_code}")
print(f"\nResponse Headers:")
for key, value in response.headers.items():
    print(f"  {key}: {value}")

if response.status_code == 200:
    data = response.json()
    print(f"\nResponse Body:")
    print(json.dumps(data, indent=2))
    
    print(f"\n--- ANALYSIS ---")
    if 'groups' in data:
        print(f"Groups found: {len(data['groups'])}")
        for group in data['groups']:
            print(f"  - {group.get('name', 'NO NAME')} (ID: {group.get('id', 'NO ID')})")
    else:
        print("❌ No 'groups' key in response!")
    
    if 'user' in data:
        print(f"\nUser info:")
        print(f"  Email: {data['user'].get('email', 'N/A')}")
        print(f"  Name: {data['user'].get('name', 'N/A')}")
        print(f"  ID: {data['user'].get('id', 'N/A')}")
    else:
        print("❌ No 'user' key in response!")
else:
    print(f"\n❌ Error Response:")
    print(response.text)

print("\n" + "=" * 80)
