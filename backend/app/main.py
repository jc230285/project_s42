from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import mysql.connector
import os
import json
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
import base64
# import nocodb_sync  # Temporarily commented out - module not found

# Custom JSON encoder for datetime and decimal objects
def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, bytes):
        return obj.decode('utf-8', errors='ignore')
    elif obj is None:
        return None
    elif isinstance(obj, (int, float, str, bool)):
        return obj
    else:
        # For any other type, try to convert to string
        try:
            return str(obj)
        except Exception as e:
            print(f"Warning: Could not serialize {type(obj)}: {e}")
            return f"<unserializable {type(obj)}>"

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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Accept-Language",
        "Accept-Encoding",
        "X-Requested-With",
        "X-CSRF-Token",
        "Cache-Control",
        "Pragma",
        "Expires",
        "If-Modified-Since",
        "If-None-Match",
        "X-Forwarded-For",
        "X-Forwarded-Proto",
        "X-Real-IP",
        "User-Agent",
        "Referer",
        "Origin"
    ],
)

class CustomHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Add security headers to all responses
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

app.add_middleware(CustomHeaderMiddleware)

# Health endpoints
@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}

@app.get("/debug", tags=["Health"])
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


@app.get("/users", tags=["User Management"])
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

@app.get("/groups", tags=["User Management"])
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

@app.post("/users/create-or-update", tags=["User Management"])
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


@app.get("/land-plots-sites", tags=["Projects"])
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

@app.get("/projects", tags=["Projects"])
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


@app.get("/schema", tags=["Projects"])
def get_schema(current_user: dict = Depends(get_current_user)):
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM `schema`")
        schema_data = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Extract order mappings from Category and Subcategory fields
        category_order_map = {}
        subcategory_order_map = {}
        
        for row in schema_data:
            field_name = row.get('Field_Name')  # type: ignore
            options_data = row.get('Options')  # type: ignore
            
            if field_name == 'Category' and options_data and isinstance(options_data, str):
                # Parse the options string like "Database (Color: #ffdaf6, Order: 1, ID: sfn3s61u...)"
                options_str = str(options_data)
                if '|' in options_str:
                    options = options_str.split(' | ')
                    for option in options:
                        if 'Order: ' in option:
                            # Extract name and order
                            name_part = option.split(' (Color:')[0].strip()
                            order_part = option.split('Order: ')[1].split(',')[0].strip()
                            try:
                                category_order_map[name_part] = int(order_part)
                            except ValueError:
                                pass
                
            elif field_name == 'Subcategory' and options_data and isinstance(options_data, str):
                # Parse the options string for subcategories
                options_str = str(options_data)
                if '|' in options_str:
                    options = options_str.split(' | ')
                    for option in options:
                        if 'Order: ' in option:
                            # Extract name and order
                            name_part = option.split(' (Color:')[0].strip()
                            order_part = option.split('Order: ')[1].split(',')[0].strip()
                            try:
                                subcategory_order_map[name_part] = int(order_part)
                            except ValueError:
                                pass
        
        # Sort the data using the order mappings
        def sort_key(row):
            category_set = row.get('Category', set())  # type: ignore
            subcategory_set = row.get('Subcategory', set())  # type: ignore
            field_order = row.get('Field_Order', 0)  # type: ignore
            
            # Extract the first value from the set (Category/Subcategory are stored as sets)
            category = list(category_set)[0] if category_set else ''
            subcategory = list(subcategory_set)[0] if subcategory_set else ''
            
            # Get order values, defaulting to high numbers for items not in the mapping
            category_order = category_order_map.get(category, 999)  # type: ignore
            subcategory_order = subcategory_order_map.get(subcategory, 999)  # type: ignore
            
            return (category_order, subcategory_order, field_order)
        
        # Add sort keys to each record before sorting
        for row in schema_data:
            category_set = row.get('Category', set())  # type: ignore
            subcategory_set = row.get('Subcategory', set())  # type: ignore
            field_order = row.get('Field_Order', 0)  # type: ignore
            
            # Extract the first value from the set (Category/Subcategory are stored as sets)
            category = list(category_set)[0] if category_set else ''
            subcategory = list(subcategory_set)[0] if subcategory_set else ''
            
            # Get order values, defaulting to high numbers for items not in the mapping
            category_order = category_order_map.get(category, 999)  # type: ignore
            subcategory_order = subcategory_order_map.get(subcategory, 999)  # type: ignore
            
            # Add sort keys to the record
            row['category_order'] = category_order
            row['subcategory_order'] = subcategory_order
            # Note: field_order is already present as Field_Order, so we don't add it again
        
        schema_data.sort(key=sort_key)
        
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(schema_data, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/nocodb-sync", tags=["Projects"])
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

@app.get("/hoyanger-power-data", tags=["Hoyanger Power Data"])
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
