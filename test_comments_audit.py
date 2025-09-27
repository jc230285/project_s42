#!/usr/bin/env python3
"""
Test script for the NocoDB comments and audit trail endpoints
Updated: These endpoints now return informative messages about NocoDB API limitations
instead of attempting to call non-existent API endpoints.
"""
import requests
import json
import sys

# Configuration
BASE_URL = "http://localhost:8150"
AUTH_TOKEN = "eyJlbWFpbCI6ImphbWVzQHNjYWxlLTQyLmNvbSIsIm5hbWUiOiJKYW1lcyBDb2xsaW5zIiwiaW1hZ2UiOiIifQ=="  # Replace with actual token

HEADERS = {
    "Authorization": f"Bearer {AUTH_TOKEN}",
    "Accept": "application/json"
}

def test_endpoint(url, description):
    """Test an endpoint and print results"""
    print(f"\n🧪 Testing: {description}")
    print(f"📡 URL: {url}")

    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        print(f"📊 Status: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print("✅ Success!")
            print(f"📄 Response keys: {list(data.keys())}")

            # Print summary info
            if 'comments' in data:
                comments = data.get('comments', [])
                print(f"💬 Comments count: {len(comments)}")
                if comments:
                    print(f"💬 First comment: {comments[0].get('comment_text', 'N/A')[:50]}...")
            elif 'audit_trail' in data:
                audit_entries = data.get('audit_trail', [])
                print(f"📋 Audit trail count: {len(audit_entries)}")
                if audit_entries:
                    print(f"� First entry: {audit_entries[0].get('action', 'N/A')[:50]}...")
            elif 'error' in data:
                print(f"❌ Error: {data.get('error', 'Unknown error')}")
                return False
            else:
                print(f"⚠️  Unexpected response structure: {list(data.keys())}")

            return True
        else:
            print("❌ Failed!")
            print(f"📝 Error: {response.text}")
            return False

    except requests.exceptions.RequestException as e:
        print("❌ Request failed!")
        print(f"📝 Error: {str(e)}")
        return False

def main():
    print("🚀 Testing NocoDB Comments and Audit Trail Endpoints")
    print("=" * 60)

# Test data - using row ID 1 as requested
test_record_id = "1"  # Test with row ID 1

endpoints = [
    (f"{BASE_URL}/comments/projects/{test_record_id}", "Projects Comments"),
    (f"{BASE_URL}/audit/projects/{test_record_id}", "Projects Audit Trail"),
    (f"{BASE_URL}/comments/plots/{test_record_id}", "Plots Comments"),
    (f"{BASE_URL}/audit/plots/{test_record_id}", "Plots Audit Trail"),
]

results = []
for url, description in endpoints:
    success = test_endpoint(url, description)
    results.append((description, success))

    print("\n" + "=" * 60)
    print("📊 SUMMARY:")
    for description, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {description}: {status}")

    success_count = sum(1 for _, success in results if success)
    print(f"\n🎯 Overall: {success_count}/{len(results)} endpoints working")

    if success_count < len(results):
        print("\n💡 Note: If endpoints fail, check that:")
        print("   - The backend server is running on port 8150")
        print("   - The record IDs exist in NocoDB")
        print("   - The authentication token is valid")
        print("   - NocoDB API is accessible")

if __name__ == "__main__":
    main()