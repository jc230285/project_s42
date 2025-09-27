#!/usrimport requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration - Update these with your NocoDB details
NOCODB_API_URL = "https://nocodb.edbmotte.com"
NOCODB_API_TOKEN = os.getenv("NOCODB_API_TOKEN")  # Set this in your environment
BASE_ID = "pjqgy4ri85jks06"  # Your NocoDB base IDpython3
"""
Setup script for NocoDB Comments and Audit Tables
This script helps you create the necessary tables in NocoDB for comments and audit functionality.
"""

import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration - Update these with your NocoDB details
NOCODB_API_URL = "https://nocodb.edbmotte.com"
NOCODB_API_TOKEN = os.getenv("NOCODB_API_TOKEN")  # Set this in your environment
BASE_ID = "pjqgy4ri85jks06"  # Your NocoDB base ID

def create_comments_table():
    """Create the comments table in NocoDB"""
    print("Creating Comments Table...")

    table_data = {
        "table_name": "comments",
        "title": "Comments",
        "columns": [
            {
                "column_name": "record_id",
                "title": "Record ID",
                "uidt": "SingleLineText",
                "required": True
            },
            {
                "column_name": "table_name",
                "title": "Table Name",
                "uidt": "SingleLineText",
                "required": True
            },
            {
                "column_name": "comment_text",
                "title": "Comment Text",
                "uidt": "LongText",
                "required": True
            },
            {
                "column_name": "user_id",
                "title": "User ID",
                "uidt": "SingleLineText",
                "required": True
            },
            {
                "column_name": "user_email",
                "title": "User Email",
                "uidt": "Email",
                "required": True
            },
            {
                "column_name": "created_at",
                "title": "Created At",
                "uidt": "DateTime",
                "required": True
            },
            {
                "column_name": "updated_at",
                "title": "Updated At",
                "uidt": "DateTime",
                "required": False
            }
        ]
    }

    url = f"{NOCODB_API_URL}/api/v2/meta/bases/{BASE_ID}/tables"
    headers = {
        "xc-token": NOCODB_API_TOKEN,
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=table_data, headers=headers, verify=False)

    if response.status_code in [200, 201]:
        data = response.json()
        table_id = data.get("id")
        print(f"SUCCESS: Comments table created successfully! Table ID: {table_id}")
        print(f"   Add this to your environment: NOCODB_COMMENTS_TABLE_ID={table_id}")
        return table_id
    else:
        print(f"ERROR: Failed to create comments table: {response.status_code} - {response.text}")
        return None

def create_audit_table():
    """Create the audit table in NocoDB"""
    print("Creating Audit Table...")

    table_data = {
        "table_name": "audit_trail",
        "title": "Audit Trail",
        "columns": [
            {
                "column_name": "record_id",
                "title": "Record ID",
                "uidt": "SingleLineText",
                "required": True
            },
            {
                "column_name": "table_name",
                "title": "Table Name",
                "uidt": "SingleLineText",
                "required": True
            },
            {
                "column_name": "action",
                "title": "Action",
                "uidt": "SingleSelect",
                "dtxp": "CREATE,UPDATE,DELETE",
                "required": True
            },
            {
                "column_name": "old_values",
                "title": "Old Values",
                "uidt": "LongText",
                "required": False
            },
            {
                "column_name": "new_values",
                "title": "New Values",
                "uidt": "LongText",
                "required": False
            },
            {
                "column_name": "user_id",
                "title": "User ID",
                "uidt": "SingleLineText",
                "required": True
            },
            {
                "column_name": "user_email",
                "title": "User Email",
                "uidt": "Email",
                "required": True
            },
            {
                "column_name": "timestamp",
                "title": "Timestamp",
                "uidt": "DateTime",
                "required": True
            },
            {
                "column_name": "field_changed",
                "title": "Field Changed",
                "uidt": "SingleLineText",
                "required": False
            }
        ]
    }

    url = f"{NOCODB_API_URL}/api/v2/meta/bases/{BASE_ID}/tables"
    headers = {
        "xc-token": NOCODB_API_TOKEN,
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=table_data, headers=headers, verify=False)

    if response.status_code in [200, 201]:
        data = response.json()
        table_id = data.get("id")
        print(f"SUCCESS: Audit table created successfully! Table ID: {table_id}")
        print(f"   Add this to your environment: NOCODB_AUDIT_TABLE_ID={table_id}")
        return table_id
    else:
        print(f"ERROR: Failed to create audit table: {response.status_code} - {response.text}")
        return None

def test_tables(comments_table_id, audit_table_id):
    """Test that the tables were created and are accessible"""
    print("\n🧪 Testing Tables...")

    headers = {
        "xc-token": NOCODB_API_TOKEN,
        "Content-Type": "application/json"
    }

    # Test comments table
    if comments_table_id:
        url = f"{NOCODB_API_URL}/api/v2/tables/{comments_table_id}/records"
        response = requests.get(url, headers=headers, verify=False)
        if response.status_code == 200:
            print("SUCCESS: Comments table is accessible")
        else:
            print(f"ERROR: Comments table test failed: {response.status_code}")

    # Test audit table
    if audit_table_id:
        url = f"{NOCODB_API_URL}/api/v2/tables/{audit_table_id}/records"
        response = requests.get(url, headers=headers, verify=False)
        if response.status_code == 200:
            print("SUCCESS: Audit table is accessible")
        else:
            print(f"ERROR: Audit table test failed: {response.status_code}")

def main():
    print("NocoDB Comments and Audit Setup")
    print("=" * 40)

    if not NOCODB_API_TOKEN:
        print("ERROR: Please set NOCODB_API_TOKEN environment variable")
        return

    # Create tables
    comments_table_id = create_comments_table()
    audit_table_id = create_audit_table()

    # Test tables
    if comments_table_id or audit_table_id:
        test_tables(comments_table_id, audit_table_id)

    print("\n📋 Next Steps:")
    print("1. Add these environment variables to your .env file:")
    if comments_table_id:
        print(f"   NOCODB_COMMENTS_TABLE_ID={comments_table_id}")
    if audit_table_id:
        print(f"   NOCODB_AUDIT_TABLE_ID={audit_table_id}")
    print("2. Restart your backend service")
    print("3. Test the new endpoints:")
    print("   GET /comments/projects/1")
    print("   POST /comments/projects/1")
    print("   GET /audit/projects/1")
    print("   POST /audit/projects/1")

if __name__ == "__main__":
    main()