from fastapi import FastAPI, Depends, HTTPException, status, Header, Query, Body
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel
import mysql.connector
import requests
import urllib3
import os
import json
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
import base64
# import nocodb_sync  # Temporarily commented out - module not found

# Disable SSL warnings for NocoDB API calls
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Pydantic models for request bodies
class NocoDBAPIUpdate(BaseModel):
    nocodbapi: str

# Create FastAPI app first with metadata
app = FastAPI(
    title="S42 Project API",
    description="API for renewable energy project management and monitoring",
    version="1.0.0",
    tags_metadata=[
        {
            "name": "health",
            "description": "Health check and system status endpoints"
        },
        {
            "name": "authentication",
            "description": "User authentication and session management"
        },
        {
            "name": "projects",
            "description": "Project management and data retrieval"
        },
        {
            "name": "land-data",
            "description": "Land plots and site information"
        },
        {
            "name": "power-data",
            "description": "Power generation and monitoring data"
        },
        {
            "name": "users",
            "description": "User management and access control"
        },
        {
            "name": "groups",
            "description": "Group management and permissions"
        },
        {
            "name": "map",
            "description": "Map visualization and geographic data"
        }
    ]
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://s42.edbmotte.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

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



def _extract_first(data: dict, *candidates: str):
    """Return the first matching key (case insensitive) from the data."""
    if not data:
        return None
    lowered = {key.lower(): key for key in data.keys()}
    for candidate in candidates:
        key = lowered.get(candidate.lower())
        if key is not None:
            return data[key]
    return None


def _coerce_float(value):
    if value in (None, '', 'null'):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://s42.edbmotte.com", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/land-plots-sites", tags=["Projects"])
def get_land_plots_sites(current_user: dict = Depends(get_current_user)):
    """Get all land plots and sites data"""
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


@app.get("/projects", tags=["projects"])
def get_projects(current_user: dict = Depends(get_current_user)):
    """Get all renewable energy projects from NocoDB API v2"""
    try:
        # Get NocoDB configuration from environment
        nocodb_api_url = os.getenv("NOCODB_API_URL", "https://nocodb.edbmotte.com")
        nocodb_api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_base_id = os.getenv("NOCODB_BASE_ID")
        nocodb_projects_table_id = os.getenv("NOCODB_PROJECTS_TABLE_ID", "mftsk8hkw23m8q1")
        
        if not nocodb_api_token or not nocodb_base_id:
            return JSONResponse(
                content={"error": "NocoDB configuration missing"}, 
                status_code=500
            )
        
        # Construct NocoDB API v2 URL
        api_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_projects_table_id}/records"
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": nocodb_api_token,
            "Content-Type": "application/json"
        }
        
        # Make request to NocoDB API with SSL verification disabled for now
        response = requests.get(api_url, headers=headers, verify=False)
        
        if response.status_code != 200:
            return JSONResponse(
                content={
                    "error": f"NocoDB API error: {response.status_code} - {response.text}",
                    "url": api_url,
                    "config": {
                        "nocodb_api_url": nocodb_api_url,
                        "nocodb_projects_table_id": nocodb_projects_table_id,
                        "has_token": bool(nocodb_api_token),
                        "has_base_id": bool(nocodb_base_id)
                    }
                }, 
                status_code=500
            )
        
        # Parse and return the data
        data = response.json()
        projects = data.get("list", [])
        
        # Show first 2 records with all fields for debugging
        sample_projects = projects[:2] if len(projects) >= 2 else projects
        all_fields = set()
        
        # Collect all field names from the sample records
        for project in sample_projects:
            all_fields.update(project.keys())
        
        return JSONResponse(content={
            "projects": projects,
            "count": len(projects),
            "source": "NocoDB API v2",
            "sample_records": sample_projects,
            "all_fields": sorted(list(all_fields)),
            "config": {
                "api_url": api_url,
                "table_id": nocodb_projects_table_id
            }
        })
        
    except requests.exceptions.RequestException as e:
        return JSONResponse(
            content={"error": f"Network error: {str(e)}"}, 
            status_code=500
        )
    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"}, 
            status_code=500
        )


# Map API endpoints added at the end
@app.get('/api/map-data', tags=["projects"])
def get_map_data_endpoint():
    """Get map visualization data"""
    return {"status": "Map data endpoint works"}

@app.get('/api/map-stats', tags=["projects"])  
def get_map_stats_endpoint():
    """Get map statistics and analytics"""
    return {"status": "Map stats endpoint works"}



@app.get("/hoyanger-power-data", tags=["Hoyanger Power Data"])
def get_hoyanger_power_data(current_user: dict = Depends(get_current_user)):
    """Get Hoyanger power generation data"""
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



@app.get("/users", tags=["User Management"])
def get_users(current_user: dict = Depends(get_current_user)):
    """Get all registered users"""
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

@app.get("/groups", tags=["User Management"])
def get_groups(current_user: dict = Depends(get_current_user)):
    """Get all user groups"""
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

@app.post("/users/create-or-update", tags=["User Management"])
def create_or_update_user(current_user: dict = Depends(get_current_user)):
    """Create or update user profile based on authentication data"""
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

@app.put("/users/{user_id}/nocodbapi", tags=["User Management"])
def update_user_nocodbapi(user_id: int, request: NocoDBAPIUpdate, current_user: dict = Depends(get_current_user)):
    """Update the NocodB API token for a specific user"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Ensure tables exist
        create_users_table(cursor)
        
        # Check if user exists
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        existing_user = cursor.fetchone()
        
        if not existing_user:
            cursor.close()
            conn.close()
            return JSONResponse(content={"error": "User not found"}, status_code=404)
        
        # Update nocodbapi field
        cursor.execute(
            "UPDATE users SET nocodbapi = %s WHERE id = %s",
            (request.nocodbapi, user_id)
        )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return JSONResponse(content={"message": "NocodB API token updated successfully", "user_id": user_id})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/users/{user_id}/nocodbapi", tags=["User Management"])
def get_user_nocodbapi(user_id: int, current_user: dict = Depends(get_current_user)):
    """Get the NocodB API token for a specific user"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Ensure tables exist
        create_users_table(cursor)
        
        # Get user's nocodbapi
        cursor.execute("SELECT id, email, name, nocodbapi FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not user:
            return JSONResponse(content={"error": "User not found"}, status_code=404)
        
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(user, default=json_serial))
        return JSONResponse(content=json_data)
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
            nocodbapi VARCHAR(255),
            INDEX idx_email (email)
        )
    """)
    
    # Add nocodbapi column if it doesn't exist (for existing tables)
    try:
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN nocodbapi VARCHAR(255)
        """)
    except Exception:
        # Column already exists or other error, ignore
        pass

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


@app.get("/health", tags=["Debug"])
def health():
    """Health check endpoint to verify API is running"""
    return {"status": "ok"}

@app.get("/debug", tags=["Debug"])
def debug():
    """Debug endpoint to check environment variables and configuration"""
    return {
        "DB_HOST": os.getenv("DB_HOST", "NOT_SET"),
        "DB_USER": os.getenv("DB_USER", "NOT_SET"), 
        "DB_NAME": os.getenv("DB_NAME", "NOT_SET"),
        "DB_PORT": os.getenv("DB_PORT", "NOT_SET"),
        "fallback_host": "mariadb"
    }

@app.get('/api/map-stats', tags=["Debug"])
def get_map_stats_placeholder():
    """Get map statistics - placeholder endpoint"""
    return {"placeholder": "to be implemented"}
