from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
import os
import json
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
import base64
import nocodb_sync

# Custom JSON encoder for datetime and decimal objects
def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Verify user session via Authorization header
    Expected format: "Bearer {base64_encoded_user_info}"
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Remove "Bearer " prefix
        if not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization format",
            )
        
        token = authorization[7:]  # Remove "Bearer "
        
        # For now, we'll accept any valid-looking token as authenticated
        # In production, you'd validate this against your auth provider
        if len(token) < 10:  # Basic validation
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
        
        # Parse user info from token (this would be from NextAuth in production)
        try:
            user_info = json.loads(base64.b64decode(token).decode('utf-8'))
            return user_info
        except:
            # If it's not base64 JSON, just return a basic user object
            return {"email": "authenticated@user.com", "authenticated": True}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://s42.edbmotte.com", "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/debug")
def debug():
    return {
        "DB_HOST": os.getenv("DB_HOST", "NOT_SET"),
        "DB_USER": os.getenv("DB_USER", "NOT_SET"), 
        "DB_NAME": os.getenv("DB_NAME", "NOT_SET"),
        "DB_PORT": os.getenv("DB_PORT", "NOT_SET"),
        "fallback_host": "mariadb"
    }

def get_db():
    # Debug: print environment variables
    print(f"DB_HOST: {os.getenv('DB_HOST', 'NOT_SET')}")
    print(f"DB_USER: {os.getenv('DB_USER', 'NOT_SET')}")
    print(f"DB_NAME: {os.getenv('DB_NAME', 'NOT_SET')}")
    print(f"DB_PORT: {os.getenv('DB_PORT', 'NOT_SET')}")
    
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "10.1.8.51"),  # Use your working IP
        user=os.getenv("DB_USER", "s42project"),
        password=os.getenv("DB_PASSWORD", "9JA_)j(WSqJUJ9Y]"),  # Use your working password
        database=os.getenv("DB_NAME", "nocodb"),
        port=int(os.getenv("DB_PORT", "3306")),
    )
    return conn

@app.get("/land-plots-sites")
def get_land_plots_sites(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM `Land Plots, Sites`")
        data = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(data, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/hoyanger-power-data")
def get_hoyanger_power_data(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM `Hoyanger Power Data`")
        data = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(data, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/users")
def get_users(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # First, ensure the users table exists
        create_users_table(cursor)
        
        cursor.execute("SELECT * FROM users ORDER BY created_at DESC")
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(users, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/groups")
def get_groups(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # First, ensure the groups table exists
        create_groups_table(cursor)
        
        cursor.execute("SELECT * FROM groups ORDER BY name")
        groups = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(groups, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/users/create-or-update")
def create_or_update_user(current_user: dict = Depends(get_current_user)):
    try:
        user_email = current_user.get("email")
        user_name = current_user.get("name", "")
        
        if not user_email:
            return JSONResponse(content={"error": "No email in user data"}, status_code=400)
        
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Ensure tables exist
        create_users_table(cursor)
        create_groups_table(cursor)
        
        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (user_email,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            # Update last login
            cursor.execute(
                "UPDATE users SET name = %s, last_login = NOW() WHERE email = %s",
                (user_name, user_email)
            )
            user_id = existing_user['id']
        else:
            # Create new user
            cursor.execute(
                "INSERT INTO users (email, name, created_at, last_login) VALUES (%s, %s, NOW(), NOW())",
                (user_email, user_name)
            )
            user_id = cursor.lastrowid
        
        # Assign user to group based on email domain
        assign_user_to_group(cursor, user_id, user_email)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return JSONResponse(content={"message": "User created/updated successfully", "user_id": user_id})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

def create_users_table(cursor):
    """Create users table if it doesn't exist"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            group_id INT,
            INDEX idx_email (email)
        )
    """)

def create_groups_table(cursor):
    """Create groups table if it doesn't exist"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            domain VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_domain (domain)
        )
    """)
    
    # Create default groups
    default_groups = [
        ("Guests", None),
        ("Scale42", "scale-42.com"),
        ("Scale42", "edbmotte.com"),
    ]
    
    for group_name, domain in default_groups:
        cursor.execute(
            "INSERT IGNORE INTO groups (name, domain) VALUES (%s, %s)",
            (group_name, domain)
        )

def assign_user_to_group(cursor, user_id, email):
    """Assign user to appropriate group based on email domain"""
    domain = email.split('@')[1] if '@' in email else None
    
    if domain:
        # Try to find a group for this domain
        cursor.execute("SELECT id FROM groups WHERE domain = %s", (domain,))
        group = cursor.fetchone()
        
        if group:
            group_id = group['id']
        else:
            # No specific group found, assign to Guests
            cursor.execute("SELECT id FROM groups WHERE name = 'Guests' AND domain IS NULL")
            guest_group = cursor.fetchone()
            group_id = guest_group['id'] if guest_group else None
    else:
        # No domain, assign to Guests
        cursor.execute("SELECT id FROM groups WHERE name = 'Guests' AND domain IS NULL")
        guest_group = cursor.fetchone()
        group_id = guest_group['id'] if guest_group else None
    
    if group_id:
        cursor.execute(
            "UPDATE users SET group_id = %s WHERE id = %s",
            (group_id, user_id)
        )

@app.get("/projects")
def get_projects(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Projects")
        projects = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(projects, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/test-import")
def test_import():
    try:
        import nocodb_sync
        return {"status": "success", "message": "Import successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/nocodb-sync")
def run_nocodb_sync_endpoint():
    """
    Run the NocoDB schema synchronization
    This endpoint triggers the sync process that updates the schema table
    with metadata from source tables and pushes descriptions back
    """
    try:
        import nocodb_sync
        print("About to call run_nocodb_sync")
        result = nocodb_sync.run_nocodb_sync()
        print(f"Sync completed with status: {result.get('status')}")
        return JSONResponse(content=result)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in nocodb-sync endpoint: {str(e)}")
        print(f"Traceback: {error_details}")
        return JSONResponse(content={
            "status": "error",
            "message": f"Failed to run NocoDB sync: {str(e)}",
            "traceback": error_details
        }, status_code=500)

@app.get("/nocodb-schema-info")
async def get_nocodb_schema_info():
    """
    Get comprehensive schema information from NocoDB
    """
    try:
        # Get API versions
        api_versions = nocodb_sync.check_api_versions()
        
        # Get all bases
        bases = nocodb_sync.list_bases()
        
        # Get tables for the configured base
        tables = nocodb_sync.list_tables_for_base(nocodb_sync.BASE_ID)
        
        # Get detailed table metadata for each table
        table_details = []
        for table in tables.get("list", []):
            try:
                metadata = nocodb_sync.get_table_metadata(table['id'])
                table_details.append({
                    'table': table,
                    'metadata': metadata
                })
            except Exception as e:
                print(f"Error getting metadata for table {table.get('title', table['id'])}: {str(e)}")
                table_details.append({
                    'table': table,
                    'metadata': None,
                    'error': str(e)
                })
        
        result = {
            "status": "success",
            "api_versions": api_versions,
            "bases": bases,
            "tables": tables,
            "table_details": table_details,
            "total_tables": len(tables.get("list", [])),
            "total_bases": len(bases.get("list", []))
        }
        
        return JSONResponse(content=result)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in nocodb-schema-info endpoint: {str(e)}")
        print(f"Traceback: {error_details}")
        return JSONResponse(content={
            "status": "error",
            "message": f"Failed to get NocoDB schema info: {str(e)}",
            "traceback": error_details
        }, status_code=500)

@app.get("/nocodb-schema-table")
async def get_nocodb_schema_table():
    """
    Get the complete schema table from NocoDB (table ID: m72851bbm1z0qul)
    """
    try:
        table_id = "m72851bbm1z0qul"
        records = nocodb_sync.list_table_records(table_id)
        
        result = {
            "status": "success",
            "table_id": table_id,
            "records": records,
            "total_records": len(records) if records else 0
        }
        
        return JSONResponse(content=result)
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error in nocodb-schema-table endpoint: {str(e)}")
        print(f"Traceback: {error_details}")
        return JSONResponse(content={
            "status": "error",
            "message": f"Failed to get NocoDB schema table: {str(e)}",
            "traceback": error_details
        }, status_code=500)
