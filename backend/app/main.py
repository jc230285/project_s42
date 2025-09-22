from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Response
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import mysql.connector
import os
import json
import requests
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
import base64
from . import nocodb_sync

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
    allow_origins=["https://s42.edbmotte.com", "http://localhost:3000"],
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

# NocoDB API configuration from environment variables
NOCODB_API_URL = os.getenv("NOCODB_API_URL", "https://nocodb.edbmotte.com")
NOCODB_API_TOKEN = os.getenv("NOCODB_API_TOKEN")
NOCODB_BASE_ID = os.getenv("NOCODB_BASE_ID", "pjqgy4ri85jks06")
NOCODB_LANDPLOTS_TABLE_ID = os.getenv("NOCODB_LANDPLOTS_TABLE_ID")
NOCODB_PROJECTS_TABLE_ID = os.getenv("NOCODB_PROJECTS_TABLE_ID")
NOCODB_PLOTS_TABLE_ID = os.getenv("NOCODB_PLOTS_TABLE_ID")

# NocoDB headers
def get_nocodb_headers():
    return {
        "xc-token": NOCODB_API_TOKEN,
        "Content-Type": "application/json"
    }

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

@app.get("/api/debug/env", tags=["Debug"])
def get_debug_env(current_user: dict = Depends(get_current_user)):
    """
    Debug endpoint to check environment variables
    """
    return JSONResponse(content={
        "NOCODB_API_URL": NOCODB_API_URL,
        "NOCODB_BASE_ID": NOCODB_BASE_ID, 
        "NOCODB_PROJECTS_TABLE_ID": NOCODB_PROJECTS_TABLE_ID,
        "NOCODB_LANDPLOTS_TABLE_ID": NOCODB_LANDPLOTS_TABLE_ID,
        "NOCODB_PLOTS_TABLE_ID": NOCODB_PLOTS_TABLE_ID,
        "NOCODB_API_TOKEN": NOCODB_API_TOKEN[:10] + "..." if NOCODB_API_TOKEN else None
    })

@app.get("/api/nocodb/tables", tags=["Debug"])
def get_nocodb_tables(current_user: dict = Depends(get_current_user)):
    """
    Get all available tables from NocoDB base
    """
    try:
        tables_url = f"{NOCODB_API_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables"
        response = requests.get(tables_url, headers=get_nocodb_headers(), verify=False)
        response.raise_for_status()
        tables_data = response.json()
        
        return JSONResponse(content={
            "tables": tables_data.get("list", []),
            "base_id": NOCODB_BASE_ID,
            "total_tables": len(tables_data.get("list", []))
        })
        
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/api/debug/verify-projects-table", tags=["Debug"])
def verify_projects_table(current_user: dict = Depends(get_current_user)):
    """
    Verify the Projects table exists and get its correct structure
    """
    try:
        # First, list all tables to confirm our table exists
        tables_url = f"{NOCODB_API_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables"
        tables_response = requests.get(tables_url, headers=get_nocodb_headers(), verify=False)
        tables_response.raise_for_status()
        tables_data = tables_response.json()
        
        # Find the Projects table
        projects_table = None
        for table in tables_data.get("list", []):
            if table.get("title") == "Projects" or table.get("id") == NOCODB_PROJECTS_TABLE_ID:
                projects_table = table
                break
        
        if not projects_table:
            return JSONResponse(content={
                "error": "Projects table not found",
                "available_tables": [{"id": t.get("id"), "title": t.get("title")} for t in tables_data.get("list", [])],
                "looking_for_id": NOCODB_PROJECTS_TABLE_ID
            }, status_code=404)
        
        # Try to get the table structure with the correct ID
        correct_table_id = projects_table.get("id")
        columns_url = f"{NOCODB_API_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables/{correct_table_id}"
        columns_response = requests.get(columns_url, headers=get_nocodb_headers(), verify=False)
        columns_response.raise_for_status()
        columns_data = columns_response.json()
        
        # Get a sample of the field IDs
        field_samples = []
        for col in columns_data.get("columns", [])[:10]:
            field_samples.append({
                "id": col.get("id"),
                "title": col.get("title"),
                "column_name": col.get("column_name")
            })
        
        return JSONResponse(content={
            "table_found": True,
            "env_table_id": NOCODB_PROJECTS_TABLE_ID,
            "actual_table_id": correct_table_id,
            "table_title": projects_table.get("title"),
            "columns_count": len(columns_data.get("columns", [])),
            "sample_fields": field_samples
        })
        
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/api/projects-partners", tags=["Projects"])
def get_projects_partners(current_user: dict = Depends(get_current_user)):
    """Get distinct Primary_Project_Partner values for filtering"""
    try:
        # Try NocoDB API first
        projects_table_id = NOCODB_PROJECTS_TABLE_ID
        if projects_table_id:
            try:
                records_url = f"{NOCODB_API_URL}/api/v2/tables/{projects_table_id}/records"
                records_response = requests.get(records_url, headers=get_nocodb_headers(), verify=False)
                records_response.raise_for_status()
                response_data = records_response.json()
                projects_data = response_data.get("list", [])
                
                # Extract unique partners from NocoDB data
                partners = set()
                for project in projects_data:
                    partner = project.get("Primary Project Partner")
                    if partner and partner.strip() and partner != "N/A":
                        partners.add(partner.strip())
                
                partner_list = sorted(list(partners))
                return JSONResponse(content={"partners": partner_list, "source": "nocodb"})
                
            except Exception as nocodb_error:
                print(f"NocoDB API failed for partners: {nocodb_error}")
                # Fall back to database
                pass
        
        # Fallback to database
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT DISTINCT Primary_Project_Partner
            FROM Projects
            WHERE Primary_Project_Partner IS NOT NULL AND Primary_Project_Partner != '' AND Primary_Project_Partner != 'N/A'
            ORDER BY Primary_Project_Partner
        """)
        partners = cursor.fetchall()

        cursor.close()
        conn.close()

        # Extract the values from dictionary rows
        partner_list = []
        for row in partners:
            if isinstance(row, dict) and "Primary_Project_Partner" in row:
                partner_list.append(row["Primary_Project_Partner"])
        partner_list.sort()

        return JSONResponse(content={"partners": partner_list, "source": "database"})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/api/plots", tags=["Plots"])
def get_plots(
    project_partner: Optional[str] = None,
    search: Optional[str] = None,
    project_ids: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get plots data with filtering and search capabilities
    
    Parameters:
    - project_partner: Filter by Primary_Project_Partner
    - search: Search in project names, plot names, or addresses
    - project_ids: Comma-separated list of project IDs to show plots for
    """
    try:
        # First try the dedicated plots table if configured
        plots_table_id = NOCODB_PLOTS_TABLE_ID
        print(f"DEBUG: plots_table_id = {plots_table_id}")
        if plots_table_id:
            try:
                records_url = f"{NOCODB_API_URL}/api/v2/tables/{plots_table_id}/records?limit=100"
                print(f"DEBUG: Fetching from plots table: {records_url}")
                response = requests.get(records_url, headers=get_nocodb_headers(), verify=False)
                response.raise_for_status()
                plots_data = response.json().get("list", [])
                print(f"DEBUG: Retrieved {len(plots_data)} plots from plots table")
                
                # Return all plots from the land plots table since field IDs may have changed
                filtered_plots = []
                for plot in plots_data:
                    # Debug: Print the first plot's field names
                    if len(filtered_plots) == 0:
                        print(f"DEBUG: First plot field names: {list(plot.keys())}")
                    
                    # Look for any project name field by checking common field patterns
                    project_name = None
                    for key, value in plot.items():
                        if value and (
                            "project" in key.lower() and "name" in key.lower() or
                            key in ["Project Name", "Project_Name", "project_name"]
                        ):
                            project_name = value
                            break
                    
                    # Include all plots, enriching with project name if found
                    plot["project_name"] = project_name
                    plot["Project_Name"] = project_name
                    filtered_plots.append(plot)
                
                print(f"DEBUG: Plots table returned {len(plots_data)} total plots, {len(filtered_plots)} with project names")
                
                return JSONResponse(content={
                    "data": filtered_plots,
                    "total_plots": len(filtered_plots),
                    "filters_applied": {
                        "project_partner": project_partner,
                        "search": search,
                        "project_ids": project_ids.split(',') if project_ids else None
                    },
                    "source": "plots_table",
                    "debug_info": {
                        "total_plots_in_table": len(plots_data),
                        "plots_with_project_names": len(filtered_plots),
                        "plots_table_id": plots_table_id
                    }
                })
            except Exception as e:
                print(f"DEBUG: Error querying plots table: {e}")
                # Fall back to land plots approach
        
        # Fallback: Use NocoDB API for land plots (original implementation)
        print("DEBUG: Using land plots fallback approach")
        land_plots_table_id = NOCODB_LANDPLOTS_TABLE_ID
        projects_table_id = NOCODB_PROJECTS_TABLE_ID
        print(f"DEBUG: land_plots_table_id = {land_plots_table_id}")
        
        if not land_plots_table_id:
            return JSONResponse(
                content={"error": "NOCODB_LANDPLOTS_TABLE_ID not configured"}, 
                status_code=500
            )
        
        # Get all land plots with higher limit
        records_url = f"{NOCODB_API_URL}/api/v2/tables/{land_plots_table_id}/records?limit=100"
        print(f"DEBUG: Fetching land plots from: {records_url}")
        records_response = requests.get(records_url, headers=get_nocodb_headers(), verify=False)
        records_response.raise_for_status()
        landplots_data = records_response.json().get("list", [])
        print(f"DEBUG: Retrieved {len(landplots_data)} land plots from API")
        
        # Get all projects for filtering and enrichment with higher limit
        projects_records_url = f"{NOCODB_API_URL}/api/v2/tables/{projects_table_id}/records?limit=100"
        projects_response = requests.get(projects_records_url, headers=get_nocodb_headers(), verify=False)
        projects_response.raise_for_status()
        projects_data = projects_response.json().get("list", [])
        
        # Create a projects lookup by ID
        projects_lookup = {}
        for project in projects_data:
            project_id = project.get("Id")
            if project_id:
                projects_lookup[project_id] = project
        
        # Filter and enrich land plots with project data
        filtered_plots = []
        
        for plot in landplots_data:
            # Get linked project data
            projects_link = plot.get("Projects", [])
            project_id = projects_link[0] if projects_link and len(projects_link) > 0 else None
            linked_project = projects_lookup.get(project_id) if project_id else None
            
            # Apply project partner filter only if specified
            if project_partner and project_partner != "all":
                if not linked_project or linked_project.get("Primary Project Partner") != project_partner:
                    continue
            
            # Apply project IDs filter only if specified
            if project_ids:
                requested_project_ids = [id.strip() for id in project_ids.split(',') if id.strip()]
                if not project_id or str(project_id) not in requested_project_ids:
                    continue
            
            # Apply search filter only if specified
            if search:
                search_lower = search.lower()
                searchable_fields = [
                    plot.get("Plot_Name", ""),
                    plot.get("Site_Address", ""),
                    plot.get("Country", ""),
                    linked_project.get("Project Name", "") if linked_project else "",
                    linked_project.get("ProjectID", "") if linked_project else ""
                ]
                
                if not any(search_lower in str(field).lower() for field in searchable_fields if field):
                    continue
            
            # Include ALL plots, with or without project links
            enriched_plot = {
                **plot,
                "linked_project": linked_project,
                "project_name": linked_project.get("Project Name") if linked_project else None,
                "project_id": linked_project.get("ProjectID") if linked_project else None,
                "project_partner": linked_project.get("Primary Project Partner") if linked_project else None
            }
            
            filtered_plots.append(enriched_plot)
        
        return JSONResponse(content={
            "data": filtered_plots,
            "total_plots": len(filtered_plots),
            "filters_applied": {
                "project_partner": project_partner,
                "search": search,
                "project_ids": project_ids.split(',') if project_ids else None
            },
            "source": "nocodb"
        })
        
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/api/projects-summary", tags=["Projects"])
def get_projects_summary(
    partner: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a summary of projects with basic info for selection/filtering
    
    Parameters:
    - partner: Filter by Primary_Project_Partner
    - search: Search in project names or IDs
    """
    try:
        projects_table_id = NOCODB_PROJECTS_TABLE_ID
        
        if not projects_table_id:
            return JSONResponse(
                content={"error": "NOCODB_PROJECTS_TABLE_ID not configured"}, 
                status_code=500
            )
        
        # Get projects data
        records_url = f"{NOCODB_API_URL}/api/v2/tables/{projects_table_id}/records"
        records_response = requests.get(records_url, headers=get_nocodb_headers(), verify=False)
        records_response.raise_for_status()
        projects_data = records_response.json().get("list", [])
        
        filtered_projects = []
        for project in projects_data:
            # Apply partner filter
            if partner and partner != "all":
                if project.get("Primary Project Partner") != partner:
                    continue
            
            # Apply search filter
            if search:
                search_lower = search.lower()
                searchable_fields = [
                    project.get("Project Name", ""),
                    project.get("ProjectID", ""),
                    project.get("Project Lead", "")
                ]
                
                if not any(search_lower in str(field).lower() for field in searchable_fields if field):
                    continue
            
            # Create summary object
            project_summary = {
                "id": project.get("Id"),
                "project_id": project.get("ProjectID"),
                "project_name": project.get("Project Name"),
                "project_lead": project.get("Project Lead"),
                "partner": project.get("Primary Project Partner"),
                "sites_count": project.get("Sites", 0),
                "power_min": project.get("Power Availability (Min)"),
                "power_max": project.get("Power Availability (Max)"),
                "status": project.get("Status"),
                "country": project.get("Country"),
                "updated_at": project.get("UpdatedAt")
            }
            
            filtered_projects.append(project_summary)
        
        return JSONResponse(content={
            "data": filtered_projects,
            "total_projects": len(filtered_projects),
            "filters_applied": {
                "partner": partner,
                "search": search
            },
            "source": "nocodb"
        })
        
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/projects", tags=["Projects"])
def get_projects(
    partner: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get Projects data from NocoDB API in the exact format for Plot Selection
    
    Parameters:
    - partner: Optional project partner filter. If provided, filters by Primary_Project_Partner
    """
    try:
        # Use table IDs from environment variables
        projects_table_id = NOCODB_PROJECTS_TABLE_ID
        
        if not projects_table_id:
            return JSONResponse(
                content={"error": "NOCODB_PROJECTS_TABLE_ID not configured in environment"}, 
                status_code=500
            )
        
        # Get all records from NocoDB
        records_url = f"{NOCODB_API_URL}/api/v2/tables/{projects_table_id}/records?limit=100"
        print(f"DEBUG: Fetching projects from: {records_url}")
        records_response = requests.get(records_url, headers=get_nocodb_headers(), verify=False)
        records_response.raise_for_status()
        response_data = records_response.json()
        projects_data = response_data.get("list", [])
        
        print(f"DEBUG: Retrieved {len(projects_data)} projects from NocoDB")
        
        # Transform data to match the exact structure provided by user
        formatted_projects = []
        for project in projects_data:
            # Map NocoDB fields to the required format
            formatted_project = {
                "id": project.get("id"),
                "created_at": project.get("created_at"),
                "updated_at": project.get("updated_at"), 
                "created_by": project.get("created_by"),
                "updated_by": project.get("updated_by"),
                "nc_order": project.get("nc_order"),
                "Project_Name": project.get("Project Name") or project.get("Project_Name"),
                "Project_Sites": project.get("Project Sites") or project.get("Project_Sites"),
                "Country": project.get("Country"),
                "Project_Description": project.get("Project Description") or project.get("Project_Description"),
                "Priority": project.get("Priority"),
                "Primary_Project_Partner": project.get("Primary Project Partner") or project.get("Primary_Project_Partner"),
                "Location": project.get("Location"),
                "Status": project.get("Status"),
                "Priority_Pipeline_Project": project.get("Priority Pipeline Project") or project.get("Priority_Pipeline_Project"),
                "Power_Availability__Min_": project.get("Power Availability (Min)") or project.get("Power_Availability__Min_"),
                "Power_Availability__Max_": project.get("Power Availability (Max)") or project.get("Power_Availability__Max_"),
                "Next_Project_Steps": project.get("Next Project Steps") or project.get("Next_Project_Steps"),
                "Land_Plots_Identified": project.get("Land Plots Identified") or project.get("Land_Plots_Identified"),
                "Plots_Secured": project.get("Plots Secured") or project.get("Plots_Secured"),
                "Power_Conflict": project.get("Power Conflict") or project.get("Power_Conflict"),
                "FDI_or_Customer_Restrictions": project.get("FDI or Customer Restrictions") or project.get("FDI_or_Customer_Restrictions"),
                "Substation_Data": project.get("Substation Data") or project.get("Substation_Data"),
                "Gas_Availability": project.get("Gas Availability") or project.get("Gas_Availability"),
                "Power_Questions": project.get("Power Questions") or project.get("Power_Questions"),
                "PPA_Considerations": project.get("PPA Considerations") or project.get("PPA_Considerations"),
                "Regional_Tax_Information": project.get("Regional Tax Information") or project.get("Regional_Tax_Information"),
                "Local_Sentiment_Analysis": project.get("Local Sentiment Analysis") or project.get("Local_Sentiment_Analysis"),
                "Non_ESG_leverage_areas": project.get("Non ESG leverage areas") or project.get("Non_ESG_leverage_areas"),
                "Dashboard_inclusion": project.get("Dashboard inclusion") or project.get("Dashboard_inclusion"),
                "Labour_Considerations": project.get("Labour Considerations") or project.get("Labour_Considerations"),
                "End_User_Scenario_Planning": project.get("End User Scenario Planning") or project.get("End_User_Scenario_Planning"),
                "Stakeholder_Presentations": project.get("Stakeholder Presentations") or project.get("Stakeholder_Presentations"),
                "Project_Budget__to_FID_": project.get("Project Budget (to FID)") or project.get("Project_Budget__to_FID_"),
                "FEL_Stage_gate": project.get("FEL Stage gate") or project.get("FEL_Stage_gate"),
                "DSO___TSO_synergies": project.get("DSO / TSO synergies") or project.get("DSO___TSO_synergies"),
                "Local_Population": project.get("Local Population") or project.get("Local_Population"),
                "Project_Lead": project.get("Project Lead") or project.get("Project_Lead"),
                "Agent": project.get("Agent"),
                "Key_Project_Contacts": project.get("Key Project Contacts") or project.get("Key_Project_Contacts"),
                "Project_Team_Document": project.get("Project Team Document") or project.get("Project_Team_Document"),
                "Project_Document": project.get("Project Document") or project.get("Project_Document"),
                "CheckBox_TEST": project.get("CheckBox TEST") or project.get("CheckBox_TEST", 0),
                "MultiSelect_TEST": project.get("MultiSelect TEST") or project.get("MultiSelect_TEST"),
                "Date_Test": project.get("Date Test") or project.get("Date_Test"),
                "Currency___TEST": project.get("Currency $ TEST") or project.get("Currency___TEST"),
                "__Test": project.get("% Test") or project.get("__Test"),
                "Rating_Test": project.get("Rating Test") or project.get("Rating_Test", "0"),
                "Roolup_No_Test": project.get("Roolup No Test") or project.get("Roolup_No_Test"),
                "user_test": project.get("user test") or project.get("user_test"),
                "user_test_1": project.get("user test 1") or project.get("user_test_1"),
                "date_time": project.get("date time") or project.get("date_time"),
                "Project_Thumbnail": project.get("Project Thumbnail") or project.get("Project_Thumbnail"),
                "json": project.get("json"),
                "testmu": project.get("testmu"),
                "ph": project.get("ph"),
                "field": project.get("field"),
                "field_1": project.get("field_1"),
                "Project_AI_Summary": project.get("Project AI Summary") or project.get("Project_AI_Summary")
            }
            
            # Apply partner filter if specified
            if partner and partner != "all":
                if formatted_project.get("Primary_Project_Partner") != partner:
                    continue
            
            formatted_projects.append(formatted_project)
        
        print(f"DEBUG: Formatted {len(formatted_projects)} projects for response")
        print(f"DEBUG: Response will be direct array format (not wrapped in data object)")
        print(f"DEBUG: First project keys: {list(formatted_projects[0].keys()) if formatted_projects else 'No projects'}")
        
        # Return the projects array directly (as shown in user's JSON)
        return JSONResponse(content=formatted_projects)
        
    except requests.exceptions.RequestException as e:
        return JSONResponse(content={"error": f"NocoDB API error: {str(e)}"}, status_code=500)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/debug/projects", tags=["Debug"])
def debug_projects():
    """
    Debug endpoint to test projects format without authentication
    """
    try:
        # Use table IDs from environment variables
        projects_table_id = NOCODB_PROJECTS_TABLE_ID
        
        if not projects_table_id:
            return JSONResponse(
                content={"error": "NOCODB_PROJECTS_TABLE_ID not configured in environment"}, 
                status_code=500
            )
        
        # Get all records from NocoDB
        records_url = f"{NOCODB_API_URL}/api/v2/tables/{projects_table_id}/records?limit=5"
        print(f"DEBUG: Fetching projects from: {records_url}")
        records_response = requests.get(records_url, headers=get_nocodb_headers(), verify=False)
        records_response.raise_for_status()
        response_data = records_response.json()
        projects_data = response_data.get("list", [])
        
        print(f"DEBUG: Retrieved {len(projects_data)} projects from NocoDB")
        
        # Transform data to match the exact structure provided by user
        formatted_projects = []
        for project in projects_data:
            # Map NocoDB fields to the required format
            formatted_project = {
                "id": project.get("id"),
                "Project_Name": project.get("Project Name") or project.get("Project_Name"),
                "Project_Sites": project.get("Project Sites") or project.get("Project_Sites"),
                "Country": project.get("Country"),
                "Status": project.get("Status"),
                "Primary_Project_Partner": project.get("Primary Project Partner") or project.get("Primary_Project_Partner"),
                "_debug_raw_keys": list(project.keys())  # Debug info to see what fields are available
            }
            formatted_projects.append(formatted_project)
        
        print(f"DEBUG: Formatted {len(formatted_projects)} projects for response")
        
        # Return the projects array directly (as shown in user's JSON)
        return JSONResponse(content=formatted_projects)
        
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/api/nocodb/landplots/{record_id}", tags=["NocoDB"])
def get_nocodb_land_plot_by_id(record_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get a single Land Plot/Site by its NocoDB record ID with linked Projects data and column IDs
    """
    try:
        # Use table IDs from environment variables
        land_plots_table_id = NOCODB_LANDPLOTS_TABLE_ID
        projects_table_id = NOCODB_PROJECTS_TABLE_ID
        
        if not land_plots_table_id:
            return JSONResponse(
                content={"error": "NOCODB_LANDPLOTS_TABLE_ID not configured in environment"}, 
                status_code=500
            )
        
        # Get column information for Land Plots, Sites table
        columns_url = f"{NOCODB_API_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables/{land_plots_table_id}"
        columns_response = requests.get(columns_url, headers=get_nocodb_headers(), verify=False)
        columns_response.raise_for_status()
        columns_data = columns_response.json()
        
        # Get specific record from Land Plots, Sites table
        record_url = f"{NOCODB_API_URL}/api/v2/tables/{land_plots_table_id}/records/{record_id}"
        record_response = requests.get(record_url, headers=get_nocodb_headers(), verify=False)
        record_response.raise_for_status()
        record_data = record_response.json()
        
        # Get Projects table column info if available
        projects_columns_data = None
        if projects_table_id:
            projects_columns_url = f"{NOCODB_API_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables/{projects_table_id}"
            projects_columns_response = requests.get(projects_columns_url, headers=get_nocodb_headers(), verify=False)
            if projects_columns_response.status_code == 200:
                projects_columns_data = projects_columns_response.json()
        
        return JSONResponse(content={
            "data": record_data,
            "columns": {
                "land_plots_sites": columns_data.get("columns", []),
                "projects": projects_columns_data.get("columns", []) if projects_columns_data else []
            },
            "table_info": {
                "land_plots_sites_table_id": land_plots_table_id,
                "projects_table_id": projects_table_id
            }
        })
        
    except requests.exceptions.RequestException as e:
        if "404" in str(e):
            return JSONResponse(content={"error": f"Record {record_id} not found"}, status_code=404)
        return JSONResponse(content={"error": f"NocoDB API error: {str(e)}"}, status_code=500)
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

@app.get("/api/map-data", tags=["Map"])
def get_map_data(partner: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get projects and sites data for map visualization"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # Base query using the join structure
        base_query = """
            SELECT
                p.id AS ProjectID,
                p.ProjectID AS Project_Code,
                p.Primary_Project_Partner,
                p.Project_Name,
                lps.id AS LandPlotID,
                lps.Plot_Name AS SiteID,
                lps.Plot_Name AS Plot_Name,
                lps.Country,
                lps.Site_Address,
                lps.Coordinates,
                lps.landsize,
                lps.Projects_id
            FROM `Land Plots, Sites` lps
            LEFT JOIN Projects p ON lps.Projects_id = p.id
            WHERE lps.Coordinates IS NOT NULL AND lps.Coordinates != ''
        """

        # Add filtering if partner specified
        if partner and partner != "all":
            base_query += " AND p.Primary_Project_Partner = %s"

        cursor.execute(base_query, (partner,) if partner and partner != "all" else ())
        sites = cursor.fetchall()

        # Process coordinates and geojson data
        for site in sites:
            coords_value = site.get('Coordinates')  # type: ignore
            if coords_value and isinstance(coords_value, str):
                try:
                    # Try to parse coordinates
                    coords = coords_value.strip()
                    if ',' in coords:
                        lat_str, lng_str = coords.split(',', 1)
                        site['latitude'] = float(lat_str.strip())  # type: ignore
                        site['longitude'] = float(lng_str.strip())  # type: ignore
                    else:
                        # If not comma-separated, try to extract numbers
                        import re
                        numbers = re.findall(r'[-+]?\d*\.?\d+', coords)
                        if len(numbers) >= 2:
                            site['latitude'] = float(numbers[0])  # type: ignore
                            site['longitude'] = float(numbers[1])  # type: ignore
                except (ValueError, IndexError):
                    site['latitude'] = None  # type: ignore
                    site['longitude'] = None  # type: ignore
            else:
                site['latitude'] = None  # type: ignore
                site['longitude'] = None  # type: ignore

            # Process geojson data from landsize column
            landsize_value = site.get('landsize')  # type: ignore
            if landsize_value and isinstance(landsize_value, str):
                try:
                    # Check if landsize contains JSON (geojson data)
                    if landsize_value.strip().startswith('{') and landsize_value.strip().endswith('}'):
                        # Parse as JSON
                        geojson_data = json.loads(landsize_value)
                        site['geojson'] = geojson_data  # type: ignore
                    else:
                        site['geojson'] = None  # type: ignore
                except (json.JSONDecodeError, ValueError):
                    site['geojson'] = None  # type: ignore
            else:
                site['geojson'] = None  # type: ignore

        # Filter out sites without valid coordinates
        sites = [site for site in sites if site.get('latitude') is not None and site.get('longitude') is not None]  # type: ignore

        cursor.close()
        conn.close()

        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps({
            "sites": sites
        }, default=json_serial))

        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/api/map-stats", tags=["Map"])
def get_map_stats(current_user: dict = Depends(get_current_user)):
    """Get statistics for map display"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # Get project count
        cursor.execute("SELECT COUNT(*) as total_projects FROM Projects")
        project_result = cursor.fetchone()
        total_projects = 0
        if project_result and 'total_projects' in project_result:
            try:
                total_projects = int(project_result['total_projects'])  # type: ignore
            except (ValueError, TypeError):
                total_projects = 0

        # Get site statistics - use Coordinates column for coords and landsize column for geojson
        cursor.execute("""
            SELECT
                COUNT(*) as total_sites,
                COUNT(CASE WHEN Coordinates IS NOT NULL AND Coordinates != '' THEN 1 END) as sites_with_coords,
                COUNT(CASE WHEN landsize IS NOT NULL AND landsize != '' AND landsize LIKE '%{%' THEN 1 END) as sites_with_geojson
            FROM `Land Plots, Sites`
        """)
        site_stats = cursor.fetchone()

        cursor.close()
        conn.close()

        total_sites = 0
        sites_with_coords = 0
        sites_with_geojson = 0

        if site_stats:
            try:
                total_sites = int(site_stats.get('total_sites', 0))  # type: ignore
                sites_with_coords = int(site_stats.get('sites_with_coords', 0))  # type: ignore
                sites_with_geojson = int(site_stats.get('sites_with_geojson', 0))  # type: ignore
            except (ValueError, TypeError, AttributeError):
                pass

        stats = {
            "total_projects": total_projects,
            "total_sites": total_sites,
            "sites_with_coords": sites_with_coords,
            "sites_with_geojson": sites_with_geojson
        }

        return JSONResponse(content=stats)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

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

@app.get("/api/nocodb/landplots", tags=["NocoDB"])
def get_nocodb_land_plots(
    ids: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get Land Plots data from NocoDB API with column IDs and linked Projects
    
    Parameters:
    - ids: Optional comma-separated list of record IDs. If not provided, returns all records.
           Example: "rec123,rec456,rec789"
    """
    try:
        # Use table IDs from environment variables
        land_plots_table_id = NOCODB_LANDPLOTS_TABLE_ID
        projects_table_id = NOCODB_PROJECTS_TABLE_ID
        
        if not land_plots_table_id:
            return JSONResponse(
                content={"error": "NOCODB_LANDPLOTS_TABLE_ID not configured in environment"}, 
                status_code=500
            )
        
        # Get column information for Land Plots, Sites table
        columns_url = f"{NOCODB_API_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables/{land_plots_table_id}"
        columns_response = requests.get(columns_url, headers=get_nocodb_headers(), verify=False)
        columns_response.raise_for_status()
        columns_data = columns_response.json()
        
        # Get records based on whether IDs are specified
        if ids:
            # Parse comma-separated IDs
            record_ids = [id.strip() for id in ids.split(',') if id.strip()]
            records_data = []
            
            # Fetch each record individually
            for record_id in record_ids:
                try:
                    record_url = f"{NOCODB_API_URL}/api/v2/tables/{land_plots_table_id}/records/{record_id}"
                    record_response = requests.get(record_url, headers=get_nocodb_headers(), verify=False)
                    if record_response.status_code == 200:
                        record_data = record_response.json()
                        records_data.append(record_data)
                    else:
                        # Add error info for this specific record
                        records_data.append({
                            "error": f"Record {record_id} not found",
                            "record_id": record_id,
                            "status_code": record_response.status_code
                        })
                except Exception as e:
                    records_data.append({
                        "error": f"Error fetching record {record_id}: {str(e)}",
                        "record_id": record_id
                    })
            
            total_records = len([r for r in records_data if "error" not in r])
            total_requested = len(record_ids)
        else:
            # Get all records from Land Plots, Sites table
            records_url = f"{NOCODB_API_URL}/api/v2/tables/{land_plots_table_id}/records"
            records_response = requests.get(records_url, headers=get_nocodb_headers(), verify=False)
            records_response.raise_for_status()
            response_data = records_response.json()
            records_data = response_data.get("list", [])
            total_records = len(records_data)
            total_requested = None
        
        # Get Projects table column info if available
        projects_columns_data = None
        if projects_table_id:
            projects_columns_url = f"{NOCODB_API_URL}/api/v2/meta/bases/{NOCODB_BASE_ID}/tables/{projects_table_id}"
            projects_columns_response = requests.get(projects_columns_url, headers=get_nocodb_headers(), verify=False)
            if projects_columns_response.status_code == 200:
                projects_columns_data = projects_columns_response.json()
        
        response_content = {
            "data": records_data,
            "columns": {
                "land_plots_sites": columns_data.get("columns", []),
                "projects": projects_columns_data.get("columns", []) if projects_columns_data else []
            },
            "table_info": {
                "land_plots_sites_table_id": land_plots_table_id,
                "projects_table_id": projects_table_id
            },
            "total_records": total_records,
            "query_info": {
                "requested_ids": ids.split(',') if ids else None,
                "total_requested": total_requested,
                "fetch_mode": "specific_ids" if ids else "all_records"
            }
        }
        
        return JSONResponse(content=response_content)
        
    except requests.exceptions.RequestException as e:
        return JSONResponse(content={"error": f"NocoDB API error: {str(e)}"}, status_code=500)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
