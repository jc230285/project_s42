from fastapi import FastAPI, Depends, HTTPException, status, Header, Query, Body, Request
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
from typing import Optional, Any
from collections import OrderedDict
import base64
from dotenv import load_dotenv
# import nocodb_sync  # Comment out for now since it's not needed for page management

# Load environment variables from .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

# Debug mode configuration
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"

def debug_print(*args, **kwargs):
    """Print debug messages only if DEBUG_MODE is enabled"""
    if DEBUG_MODE:
        print(*args, **kwargs)

# Disable SSL warnings for NocoDB API calls
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Pydantic models for request bodies
class NocoDBAPIUpdate(BaseModel):
    nocodbapi: str

class NocoDBRowUpdate(BaseModel):
    table_id: str
    row_id: str
    field_data: dict[str, Any]

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
        },
        {
            "name": "companies",
            "description": "Company data and analytics"
        }
    ]
)

# Custom CORS middleware - handles all CORS requests
@app.middleware("http")
async def cors_handler(request, call_next):
    print(f"?? CORS Request: {request.method} {request.url}")
    print(f"?? Origin: {request.headers.get('origin', 'None')}")
    print(f"?? Headers: {dict(request.headers)}")
    
    if request.method == "OPTIONS":
        print("? Handling OPTIONS preflight request")
        return JSONResponse(
            content={"message": "OK"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "3600",
            }
        )
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Custom JSON encoder for datetime and decimal objects
def json_serial(obj):
    import uuid
    if obj is None:
        return None
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, OrderedDict):
        return dict(obj)
    elif isinstance(obj, uuid.UUID):
        return str(obj)
    elif isinstance(obj, bytes):
        return obj.decode('utf-8', errors='ignore')
    elif isinstance(obj, set):
        return list(obj)
    elif hasattr(obj, '__dict__'):
        return obj.__dict__
    else:
        # Convert unknown types to string as last resort
        return str(obj)


# ===== UTILITY FUNCTIONS FOR USER NAME LOOKUP =====

def get_user_name_from_email(email: str) -> str:
    """
    Get user's display name from email address by querying the users table.
    Returns the user's name if found, otherwise returns the email address.
    """
    if not email:
        return "Unknown User"
    
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "10.1.8.51"),
            user=os.getenv("DB_USER", "s42project"),
            password=os.getenv("DB_PASSWORD", "s42project"),
            database=os.getenv("DB_NAME", "nocodb"),
            port=int(os.getenv("DB_PORT", "3306")),
        )
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT name FROM users WHERE email = %s", (email,))
        user_data = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if user_data and isinstance(user_data, dict) and user_data.get('name'):
            return user_data['name']
        else:
            return email  # Return email if no name found
    except Exception as e:
        print(f"Error fetching user name for {email}: {e}")
        return email  # Return email on error


def get_user_names_batch(emails: list) -> dict:
    """
    Get user names for multiple emails in a single database query.
    Returns a dictionary mapping email -> name.
    More efficient than individual queries when processing multiple items.
    """
    if not emails:
        return {}
    
    # Remove duplicates and filter out None/empty values
    unique_emails = list(set([email for email in emails if email]))
    
    if not unique_emails:
        return {}
    
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "10.1.8.51"),
            user=os.getenv("DB_USER", "s42project"),
            password=os.getenv("DB_PASSWORD", "s42project"),
            database=os.getenv("DB_NAME", "nocodb"),
            port=int(os.getenv("DB_PORT", "3306")),
        )
        cursor = conn.cursor(dictionary=True)
        
        # Create placeholders for IN clause
        placeholders = ', '.join(['%s'] * len(unique_emails))
        query = f"SELECT email, name FROM users WHERE email IN ({placeholders})"
        cursor.execute(query, tuple(unique_emails))
        results = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Build email -> name mapping
        email_to_name = {}
        for row in results:
            if isinstance(row, dict) and row.get('email') and row.get('name'):
                email_to_name[row['email']] = row['name']
        
        # Fill in missing emails with email as fallback
        for email in unique_emails:
            if email not in email_to_name:
                email_to_name[email] = email
        
        return email_to_name
    except Exception as e:
        print(f"Error fetching user names in batch: {e}")
        # Return dict with emails as fallback
        return {email: email for email in unique_emails}

# ===== END UTILITY FUNCTIONS =====


def process_schema_data(user_token: Optional[str] = None):
    """Helper function to process schema data with proper ordering from NocoDB dropdown options"""
    # Use user token if available, otherwise fall back to environment token
    api_token = user_token or os.getenv("NOCODB_API_TOKEN")
    nocodb_api_url = os.getenv("NOCODB_API_URL")
    nocodb_schema_table_id = "m72851bbm1z0qul"  # Schema table ID
    
    # Try to get the table structure to extract dropdown option orders
    category_order_map = {}
    subcategory_order_map = {}
    
    try:
        table_info_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_schema_table_id}"
        headers = {"xc-token": api_token, "Content-Type": "application/json"}
        
        table_response = requests.get(table_info_url, headers=headers, verify=False)
        if table_response.status_code == 200:
            table_info = table_response.json()
            
            # Extract dropdown option orders from table columns
            for column in table_info.get("columns", []):
                column_id = column.get("id")
                if column_id == "c3xywkmub993x24":  # Category field
                    options = column.get("colOptions", {}).get("options", [])
                    for option in options:
                        title = option.get("title", "")
                        order = option.get("order", 999)
                        if title:
                            category_order_map[title] = order
                elif column_id == "ceznmyuazlgngiw":  # Subcategory field
                    options = column.get("colOptions", {}).get("options", [])
                    for option in options:
                        title = option.get("title", "")
                        order = option.get("order", 999)
                        if title:
                            subcategory_order_map[title] = order
            
            print(f"?? Loaded {len(category_order_map)} category options and {len(subcategory_order_map)} subcategory options from table structure")
        else:
            print(f"??  Failed to fetch table structure (status {table_response.status_code}), using fallback ordering")
    except Exception as e:
        print(f"??  Exception fetching table structure: {e}, using fallback ordering")
    
    # If we couldn't get the dropdown orders, use fallback ordering
    if not category_order_map:
        print("?? Using fallback category ordering")
        FALLBACK_CATEGORY_ORDER = [
            "Database", "Project", "Contact", "Summary", "Location", "General",
            "LandPlot", "Power", "Connectivity", "AI"
        ]
        for i, category in enumerate(FALLBACK_CATEGORY_ORDER):
            category_order_map[category] = i + 1
    
    # Fetch raw schema data from NocoDB
    schema_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_schema_table_id}/records"
    headers = {"xc-token": api_token, "Content-Type": "application/json"}
    params = {"limit": 1000, "offset": 0}
    
    schema_response = requests.get(schema_url, headers=headers, params=params, verify=False)
    if schema_response.status_code != 200:
        raise HTTPException(status_code=500, detail="Failed to fetch schema")
    
    schema_data = schema_response.json()
    all_records = schema_data.get("list", [])
    
    # Process records with proper ordering from dropdown options
    processed_records = []
    
    def get_category_order(category_value):
        """Get order from NocoDB dropdown option definition"""
        return category_order_map.get(category_value, 999)
    
    def get_subcategory_order(subcategory_value):
        """Get order from NocoDB dropdown option definition"""
        return subcategory_order_map.get(subcategory_value, 999)
    
    for record in all_records:
        category_value = record.get("Category", "")
        subcategory_value = record.get("Subcategory", "")
        
        category_order = get_category_order(category_value)
        subcategory_order = get_subcategory_order(subcategory_value)
        
        processed_record = {
            "id": record.get("id"),
            "Field Name": record.get("Field Name", ""),
            "Description": record.get("Description", ""),
            "Field Order": record.get("Field Order", 999),
            "Category": category_value,
            "Subcategory": subcategory_value,
            "category_order": category_order,
            "subcategory_order": subcategory_order,
            "Type": record.get("Type", ""),
            "Field ID": record.get("Field ID", ""),
            "Table": record.get("Table", ""),
            "meta": record.get("meta", ""),
            "Options": record.get("Options", ""),
            "created_at": record.get("created_at"),
            "updated_at": record.get("updated_at")
        }
        processed_records.append(processed_record)
    
    # Sort by category_order, subcategory_order, then Field Order
    def safe_int(value, default=999):
        try:
            return int(value) if value is not None else default
        except (ValueError, TypeError):
            return default
    
    def sort_key_func(record):
        category_order = safe_int(record.get("category_order", 999))
        subcategory_order = safe_int(record.get("subcategory_order", 999))
        field_order = safe_int(record.get("Field Order", 999))
        return (category_order, subcategory_order, field_order)
    
    processed_records.sort(key=sort_key_func)
    return processed_records

async def get_current_user(authorization: Optional[str] = Header(None)):
    """
    Verify user session via Authorization header
    Expected format: "Bearer {base64_encoded_user_info}"
    """
    print(f"?? AUTH CHECK: {authorization}", flush=True)
    
    if not authorization:
        print("? NO AUTH HEADER", flush=True)
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
        
        # Allow internal authentication for auth flow
        if token == "internal-auth-check":
            return {"email": "internal", "authenticated": True}
        
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
    allow_origins=[
        "http://localhost:3000",  # Dev frontend
        "http://localhost:3150",  # Docker frontend
        "http://localhost:8000",  # Dev backend
        "http://localhost:8150",  # Docker backend
        "https://s42.edbmotte.com",  # Production frontend
        "https://s42api.edbmotte.com",  # Production backend
        os.getenv('FRONTEND_BASE_URL', 'http://localhost:3150'),
        os.getenv('BACKEND_BASE_URL', 'http://localhost:8150')
    ],
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
        password=os.getenv("DB_PASSWORD", "s42project"),  # Use your working password
        database=os.getenv("DB_NAME", "nocodb"),
        port=int(os.getenv("DB_PORT", "3306")),
    )
    return conn




######################################################################
# Scale42 Renewable Energy Projects endpoints
######################################################################
@app.get("/projects/project-partners", tags=["Projects"])
def get_unique_project_partners(current_user: dict = Depends(get_current_user)):
    """Get unique Primary Project Partner values from NocoDB API v2"""
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
        # Add limit parameter to get all records
        params = {"limit": 1000}  # Set high limit to get all projects
        response = requests.get(api_url, headers=headers, params=params, verify=False)
        
        if response.status_code != 200:
            return JSONResponse(
                content={
                    "error": f"NocoDB API error: {response.status_code} - {response.text}",
                    "url": api_url
                }, 
                status_code=500
            )
        
        # Parse the data and extract unique Primary Project Partners
        data = response.json()
        projects = data.get("list", [])
        
        # Extract Primary Project Partner values and get unique ones
        partners = set()
        for project in projects:
            partner = project.get("Primary Project Partner")
            if partner and partner.strip():  # Only add non-empty values
                partners.add(partner.strip())
        
        # Convert to sorted list
        unique_partners = sorted(list(partners))
        
        return JSONResponse(content={
            "unique_project_partners": unique_partners,
            "count": len(unique_partners),
            "source": "NocoDB API v2"
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


@app.get("/projects/projects", tags=["Projects"])
def get_projects(current_user: dict = Depends(get_current_user), partner_filter: Optional[str] = Query(None, description="Filter by Primary Project Partner")):
    """Get all renewable energy projects from NocoDB API v2 with optional filtering"""
    try:
        # Get NocoDB configuration from environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        nocodb_api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_base_id = os.getenv("NOCODB_BASE_ID")
        nocodb_projects_table_id = os.getenv("NOCODB_PROJECTS_TABLE_ID")
        
        # Validate required environment variables
        if not nocodb_api_url:
            return JSONResponse(
                content={"error": "NOCODB_API_URL environment variable not set"}, 
                status_code=500
            )
        if not nocodb_api_token:
            return JSONResponse(
                content={"error": "NOCODB_API_TOKEN environment variable not set"}, 
                status_code=500
            )
        if not nocodb_base_id:
            return JSONResponse(
                content={"error": "NOCODB_BASE_ID environment variable not set"}, 
                status_code=500
            )
        if not nocodb_projects_table_id:
            return JSONResponse(
                content={"error": "NOCODB_PROJECTS_TABLE_ID environment variable not set"}, 
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
        # Add limit parameter to get all records
        params = {"limit": 1000}  # Set high limit to get all projects
        response = requests.get(api_url, headers=headers, params=params, verify=False)
        
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
        
        print(f"?? Projects API: Retrieved {len(projects)} projects from NocoDB")
        
        # Apply partner filter if provided
        if partner_filter and partner_filter.strip():
            projects = [p for p in projects if p.get("Primary Project Partner") == partner_filter]
            print(f"?? Projects API: After partner filter '{partner_filter}': {len(projects)} projects")
        
        # Sort projects by Project Priority - higher priority first
        projects.sort(key=lambda x: x.get("Project Priority", 0), reverse=True)
        print(f"?? Projects API: Sorted {len(projects)} projects by priority (Project Priority)")
        
        # Helper function to parse plot information
        def parse_plot_info(plot_id_string):
            """Parse plot ID string and extract components"""
            if not plot_id_string:
                return None
            
            # Split by the last hyphen to separate plot name
            parts = plot_id_string.rsplit('-', 1)
            if len(parts) != 2:
                return {"raw": plot_id_string, "formatted": plot_id_string}
            
            prefix_part, plot_name = parts
            
            # Extract project ID (P###), site ID (S###), and project name
            # Format: P###-ProjectName-S###
            prefix_parts = prefix_part.split('-')
            if len(prefix_parts) < 3:
                return {"raw": plot_id_string, "formatted": plot_id_string}
            
            project_id = prefix_parts[0]  # P###
            site_id = None
            project_name = ""
            
            # Find the site ID (S###) and reconstruct project name
            for i, part in enumerate(prefix_parts[1:], 1):
                if part.startswith('S') and part[1:].isdigit():
                    site_id = part
                    project_name = '-'.join(prefix_parts[1:i])
                    break
            
            return {
                "raw": plot_id_string,
                "project_id": project_id,
                "project_name": project_name,
                "site_id": site_id,
                "plot_name": plot_name,
                "formatted": f"{site_id} {plot_name}" if site_id else plot_name
            }
        
        # Filter projects to only include required fields and format plots
        required_fields = [
            "Id",
            "Project Name", 
            "Country",
            "P_PlotID",
            "Power Availability (Min)",
            "Power Availability (Max)",
            "Primary Project Partner",
            "Project Priority",  # Updated field name
            "Status",  # Updated field name
            "Agent"   # Updated field name
        ]
        
        filtered_projects = []
        for project in projects:
            filtered_project = {}
            for field in required_fields:
                if field == "P_PlotID":
                    # Format plot information
                    plot_ids = project.get(field, [])
                    if isinstance(plot_ids, list):
                        formatted_plots = []
                        for plot_id in plot_ids:
                            plot_info = parse_plot_info(plot_id)
                            if plot_info:
                                formatted_plots.append(plot_info)
                        filtered_project[field] = formatted_plots
                    else:
                        filtered_project[field] = []
                else:
                    filtered_project[field] = project.get(field)
            filtered_projects.append(filtered_project)
        
        return JSONResponse(content={
            "projects": filtered_projects,
            "count": len(filtered_projects),
            "total_available": len(data.get("list", [])),
            "applied_filter": partner_filter if partner_filter else None,
            "source": "NocoDB API v2",
            "fields": required_fields
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


from fastapi.responses import JSONResponse

# Add specific OPTIONS handler for projects/schema
@app.options("/projects/schema")
async def options_projects_schema():
    """Handle OPTIONS requests for /projects/schema CORS preflight"""
    print("? Specific OPTIONS handler for /projects/schema")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )

# Add universal OPTIONS handler for CORS preflight (catch-all)
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle all other OPTIONS requests for CORS preflight"""
    print(f"? Universal OPTIONS handler for path: /{full_path}")
    return JSONResponse(
        content={"message": "OK"},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )

@app.get("/projects/schema", tags=["Projects"])
def get_schema_data(current_user: dict = Depends(get_current_user)):
    """Get schema data from NocoDB schema table"""
    print("SCHEMA ENDPOINT CALLED - Starting to process schema data with dynamic ordering")
    try:
        # Get user-specific NocoDB token, fallback to environment token
        user_token = None
        user_email = current_user.get('email')
        print(f"?? Getting API token for user: {user_email}")
        
        if user_email:
            try:
                # Get user's NocoDB token from database
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                print(f"?? Database query result for {user_email}: {user_data}")
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                    print(f"? Using user-specific NocoDB token for {user_email}: {str(user_token)[:20]}...")
                else:
                    print(f"?? No user-specific token found for {user_email}, using admin token")
                    print(f"   User data: {user_data}")
                    print(f"   nocodb_api field: {user_data.get('nocodb_api') if user_data else 'No user found'}")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        # Get NocoDB configuration from environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        nocodb_base_id = os.getenv("NOCODB_BASE_ID")
        nocodb_schema_table_id = "m72851bbm1z0qul"  # Schema table ID
        
        # Validate required environment variables
        if not nocodb_api_url:
            return JSONResponse(
                content={"error": "NOCODB_API_URL environment variable not set"}, 
                status_code=500
            )
        if not api_token:
            return JSONResponse(
                content={"error": "No NocoDB API token available"}, 
                status_code=500
            )
        if not nocodb_base_id:
            return JSONResponse(
                content={"error": "NOCODB_BASE_ID environment variable not set"}, 
                status_code=500
            )
        
        # Construct NocoDB API v2 URL with pagination parameters to get all records
        api_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_schema_table_id}/records"
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }
        
        # Add query parameters to get all records (increase limit)
        params = {
            "limit": 1000,  # Increase limit to get more records
            "offset": 0
        }
        
        # Make request to NocoDB API with SSL verification disabled for now
        response = requests.get(api_url, headers=headers, params=params, verify=False)
        
        if response.status_code != 200:
            return JSONResponse(
                content={
                    "error": f"NocoDB API error: {response.status_code} - {response.text}",
                    "url": api_url,
                    "config": {
                        "nocodb_api_url": nocodb_api_url,
                        "nocodb_schema_table_id": nocodb_schema_table_id,
                        "has_token": bool(api_token),
                        "has_base_id": bool(nocodb_base_id),
                        "using_user_token": bool(user_token)
                    }
                }, 
                status_code=500
            )
        
        # Parse and return the data
        data = response.json()
        schema_records = data.get("list", [])
        
        print(f"?? Raw NocoDB data structure:")
        print(f"   - Total records: {len(schema_records)}")
        if schema_records:
            print(f"   - First record keys: {list(schema_records[0].keys())}")
            print(f"   - First record sample: {schema_records[0]}")
        
        # Process the data for frontend consumption
        # The data from NocoDB v2 already has properly formatted Category/Subcategory values
        # We need to transform it for the frontend table display
        
        def parse_select_options(options_string):
            """Parse NocoDB SingleSelect options string into frontend-friendly format"""
            if not options_string or options_string in ["", "Long Text field", "DateTime field", "Decimal field", "URL field"]:
                return []
            
            options = []
            # Split by " | " to get individual options
            option_parts = options_string.split(" | ")
            for option_part in option_parts:
                try:
                    # Format: "OptionName (Color: #color, Order: N, ID: ...)"
                    if "(" in option_part and "Order:" in option_part:
                        name = option_part.split(" (")[0].strip()
                        # Extract order number
                        order_part = option_part.split("Order: ")[1].split(",")[0].strip()
                        order = int(order_part)
                        
                        # Extract color if available
                        color = "#cfdffe"  # default color
                        if "Color: " in option_part:
                            color_part = option_part.split("Color: ")[1].split(",")[0].strip()
                            color = color_part
                        
                        options.append({
                            "value": name,
                            "label": name,
                            "order": order,
                            "color": color
                        })
                    else:
                        # Fallback for simple options
                        name = option_part.strip()
                        if name:
                            options.append({
                                "value": name,
                                "label": name,
                                "order": 999,
                                "color": "#cfdffe"
                            })
                except (IndexError, ValueError):
                    # Skip malformed options
                    continue
            
            # Sort by order
            options.sort(key=lambda x: x["order"])
            return options
        
        # First pass: collect dropdown options for Category and Subcategory fields
        category_options = []
        subcategory_options = []
        
        for record in schema_records:
            field_name = record.get("Field Name", "")
            field_type = record.get("Type", "")
            options_raw = record.get("Options", "")
            
            if field_name == "Category" and field_type == "SingleSelect":
                category_options = parse_select_options(options_raw)
                print(f"??? Found Category options: {category_options}")
            elif field_name == "Subcategory" and field_type == "SingleSelect":
                subcategory_options = parse_select_options(options_raw)
                print(f"??? Found Subcategory options: {subcategory_options}")
        
        # Helper function to get order from options
        def get_option_order(value, options_list):
            """Get the order number for a given value from the options list"""
            if not value or not options_list:
                return 999
            for option in options_list:
                option_value = option.get("value", "")
                if option_value.lower() == value.lower():
                    order = option.get("order", 999)
                    return order
            return 999
        
        # Second pass: process records with proper category and subcategory ordering
        processed_records = []
        for record in schema_records:
            # Get category and subcategory values
            category_value = record.get("Category", "")
            subcategory_value = record.get("Subcategory", "")
            
            # Look up the order from the options
            category_order = get_option_order(category_value, category_options)
            subcategory_order = get_option_order(subcategory_value, subcategory_options)
            
            print(f"?? Processing field '{record.get('Field Name')}': Category='{category_value}' (order: {category_order}), Subcategory='{subcategory_value}' (order: {subcategory_order})")
            
            # Map the NocoDB fields to frontend expected format - with dynamic category_order and subcategory_order
            processed_record = {
                "id": record.get("id"),
                "Field Name": record.get("Field Name", ""),
                "Description": record.get("Description", ""),
                "Field Order": record.get("Field Order", 999),
                "Category": category_value,
                "Subcategory": subcategory_value,
                "category_order": category_order,
                "subcategory_order": subcategory_order,
                "Type": record.get("Type", ""),
                "Field ID": record.get("Field ID", ""),
                "Table": record.get("Table", ""),
                "meta": record.get("meta", ""),
                "Options": record.get("Options", ""),
                "created_at": record.get("created_at"),
                "updated_at": record.get("updated_at")
            }
            processed_records.append(processed_record)
        
        # Sort the records by category_order, subcategory_order, then Field Order (all numeric, lower numbers first)
        # This will organize the data properly for the frontend
        def get_sort_key(record):
            # Helper function for safe integer conversion
            def safe_int(value, default=999):
                try:
                    return int(value) if value is not None else default
                except (ValueError, TypeError):
                    return default
            
            # Use numeric ordering fields for proper sorting
            category_order = safe_int(record.get("category_order", 999))
            subcategory_order = safe_int(record.get("subcategory_order", 999))
            field_order = safe_int(record.get("Field Order", 999))
            
            return (category_order, subcategory_order, field_order)
        
        # Sort the processed records
        sorted_records = sorted(processed_records, key=get_sort_key)
        
        print(f"? Processed {len(sorted_records)} schema records for frontend")
        print(f"?? Found {len(category_options)} category options and {len(subcategory_options)} subcategory options")
        
        return JSONResponse(
            content={
                "list": sorted_records,
                "count": len(sorted_records),
                "pageInfo": data.get("pageInfo", {}),
                "totalRecords": len(sorted_records),
                "fieldOptions": {
                    "Category": category_options,
                    "Subcategory": subcategory_options
                },
                "debug": {
                    "table_id": nocodb_schema_table_id,
                    "requested_limit": params.get("limit"),
                    "response_keys": list(data.keys()),
                    "sorting_applied": True,
                    "sort_order": "category_order -> subcategory_order -> Field Order (Numeric, lower numbers first)",
                    "processing": "NocoDB v2 format with direct field mapping and parsed dropdown options",
                    "categories_found": list(set(r.get("Category", "") for r in processed_records)),
                    "subcategories_found": list(set(r.get("Subcategory", "") for r in processed_records))
                }
            },
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
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

@app.get("/projects/plots", tags=["Projects"])
def get_plots_data(
    current_user: dict = Depends(get_current_user), 
    plot_ids: Optional[str] = Query(None, description="Comma-separated list of numeric plot IDs to filter by"),
    preserve_order: bool = Query(True, description="Preserve the order of plot_ids in the response")
):
    """Get detailed plots and projects data in export script format with schema and nested projects/plots structure"""
    from collections import OrderedDict
    
    try:
        # Parse numeric plot IDs from query parameter, preserving order
        selected_plot_ids = []
        requested_order = []  # Track original request order
        if plot_ids:
            for pid in plot_ids.split(','):
                pid_clean = pid.strip()
                if pid_clean.isdigit():
                    plot_id = int(pid_clean)
                    selected_plot_ids.append(plot_id)
                    requested_order.append(plot_id)
        
        # If no plot_ids provided, return empty structure
        if not selected_plot_ids:
            return JSONResponse(content={
                "schema": [],
                "data": {"projects": []},
                "exported_at": datetime.now().isoformat(),
                "message": "No plot IDs provided. Use ?plot_ids=1,42,3 to specify plots to export."
            })
        
        # -------------------------
        # 1) FETCH & PREP SCHEMA (reuse existing schema endpoint logic)
        # -------------------------
        
        # Get user-specific NocoDB token, fallback to environment token
        user_token = None
        user_email = current_user.get('email')
        
        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                cursor.close()
                conn.close()
            except Exception:
                pass
        
        # Use the helper function to get properly processed and sorted schema
        schema_all_processed = process_schema_data(user_token if isinstance(user_token, str) else None)
        
        # Filter for our two tables
        SCHEMA_TABLES = {"Projects", "Land Plots, Sites"}
        schema_sorted = [r for r in schema_all_processed if r.get("Table") in SCHEMA_TABLES]
        
        # Split schema by table for quick iteration
        schema_by_table = {
            "Projects": [r for r in schema_sorted if r["Table"] == "Projects"],
            "Land Plots, Sites": [r for r in schema_sorted if r["Table"] == "Land Plots, Sites"],
        }
        
        # -------------------------
        # 2) FETCH DATA FROM NOCODB (no direct SQL)
        # -------------------------
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        headers = {"xc-token": api_token, "Content-Type": "application/json"}

        # Known table IDs (used elsewhere for updates)
        PROJECTS_TABLE_ID = "mftsk8hkw23m8q1"
        LANDPLOTS_TABLE_ID = "mmqclkrvx9lbtpc"

        plots: list[dict] = []
        projects_fk_set: set[int] = set()

        # Helper to map a NocoDB record to FieldID->value dict using schema
        def _normalize_key(name: str) -> str:
            return (
                (name or "")
                .replace(" ", "_")
                .replace("-", "_")
                .replace("/", "_")
                .replace("(", "")
                .replace(")", "")
                .replace("%", "pct")
                .replace("&", "and")
                .replace("__", "_")
                .strip("_")
                .lower()
            )

        def map_values_by_field_id(record: dict, schema_fields: list[dict]) -> dict:
            vals = OrderedDict()
            # Build a case-insensitive lookup for record keys as fallback
            rec_lower = {str(k).lower(): k for k in (record.keys() if isinstance(record, dict) else [])}
            rec_norm = {_normalize_key(str(k)): k for k in (record.keys() if isinstance(record, dict) else [])}
            for f in schema_fields:
                field_id = f.get("Field ID")
                field_name = f.get("Field Name") or ""
                val = None
                if isinstance(record, dict):
                    if field_id in record:
                        val = record.get(field_id)
                    elif field_name in record:
                        val = record.get(field_name)
                    else:
                        # try lower and normalized keys
                        k1 = rec_lower.get(str(field_name).lower())
                        if k1 is not None:
                            val = record.get(k1)
                        else:
                            k2 = rec_norm.get(_normalize_key(field_name))
                            if k2 is not None:
                                val = record.get(k2)
                vals[field_id] = val
            return dict(vals)

        # 2a) Load selected land plot rows directly from NocoDB
        debug_print(f"?? Backend: Fetching {len(selected_plot_ids)} plots: {selected_plot_ids}")
        for pid in selected_plot_ids:
            try:
                url = f"{nocodb_api_url}/api/v2/tables/{LANDPLOTS_TABLE_ID}/records/{pid}"
                r = requests.get(url, headers=headers, verify=False)
                if r.status_code != 200:
                    debug_print(f"? Backend: Failed to fetch plot {pid}: status {r.status_code}")
                    # Skip missing plots instead of failing entire request
                    continue
                row = r.json() or {}
                debug_print(f"?? Backend: Plot {pid} row keys: {list(row.keys())[:10]}")  # First 10 keys

                # Determine FK to project from common patterns and relation payloads
                fk_project_id = None
                for key in [
                    # explicit NocoDB Field ID for Projects_id (provided)
                    "chap8h7mt25wqlp",
                    # common column name variants
                    "projects_id", "Projects_id", "project_id", "ProjectID",
                    # relation payload variants
                    "project", "Project", "Projects"
                ]:
                    if key in row:
                        val = row.get(key)
                        debug_print(f"?? Backend: Plot {pid} found key '{key}' with value type: {type(val).__name__}, value: {val if not isinstance(val, dict) else 'dict'}")
                        # If relation is an array/dict, extract id
                        if isinstance(val, dict) and "id" in val:
                            val = val.get("id")
                        elif isinstance(val, list) and val and isinstance(val[0], dict) and "id" in val[0]:
                            val = val[0].get("id")
                        # Normalize to int if numeric
                        if isinstance(val, (int, str)) and str(val).isdigit():
                            fk_project_id = int(val)
                            debug_print(f"? Backend: Plot {pid} FK resolved to project {fk_project_id} from key '{key}'")
                            break

                # Fallback A: try via schema-mapped values using the field ID
                if fk_project_id is None:
                    try:
                        tmp_values = map_values_by_field_id(row, schema_by_table["Land Plots, Sites"])
                        v = tmp_values.get("chap8h7mt25wqlp")
                        if isinstance(v, (int, str)) and str(v).isdigit():
                            fk_project_id = int(v)
                    except Exception:
                        pass

                # Fallback B: case-insensitive and normalized key lookup for Projects_id
                if fk_project_id is None and isinstance(row, dict):
                    row_lower = {str(k).lower(): k for k in row.keys()}
                    row_norm = {_normalize_key(str(k)): k for k in row.keys()}
                    for probe in ["projects_id", "project_id", "project", "projects"]:
                        k = row_lower.get(probe) or row_norm.get(_normalize_key(probe))
                        if k is not None:
                            val = row.get(k)
                            if isinstance(val, dict) and "id" in val:
                                val = val.get("id")
                            elif isinstance(val, list) and val and isinstance(val[0], dict) and "id" in val[0]:
                                val = val[0].get("id")
                            if isinstance(val, (int, str)) and str(val).isdigit():
                                fk_project_id = int(val)
                                break

                # Fallback C: query NocoDB for just the FK field if still missing
                if fk_project_id is None:
                    try:
                        url2 = (
                            f"{nocodb_api_url}/api/v2/tables/{LANDPLOTS_TABLE_ID}/records"
                            f"?where=(id,eq,{pid})&fields=id,chap8h7mt25wqlp&limit=1"
                        )
                        r2 = requests.get(url2, headers=headers, verify=False)
                        if r2.status_code == 200:
                            data2 = r2.json() or {}
                            lst = data2.get("list") if isinstance(data2, dict) else None
                            if isinstance(lst, list) and lst:
                                v = lst[0].get("chap8h7mt25wqlp")
                                if isinstance(v, (int, str)) and str(v).isdigit():
                                    fk_project_id = int(v)
                    except Exception:
                        pass

                plot_obj = {
                    "_db_id": row.get("id", pid),
                    "_fk_projects_id": fk_project_id,
                    "values": map_values_by_field_id(row, schema_by_table["Land Plots, Sites"]) 
                }
                plots.append(plot_obj)
                if fk_project_id is not None:
                    projects_fk_set.add(fk_project_id)
            except Exception:
                # Continue with other plots; errors on one shouldn't break the batch
                continue

        # 2b) Load projects for the collected FK ids and attach their plots
        projects: list[dict] = []
        if projects_fk_set:
            plots_by_pid: dict[int, list[dict]] = {}
            for p in plots:
                pid = p.get("_fk_projects_id")
                if pid is not None:
                    plots_by_pid.setdefault(pid, []).append(p)
            
            # Debug logging
            debug_print(f"?? Backend: plots_by_pid keys: {list(plots_by_pid.keys())}")
            debug_print(f"?? Backend: projects_fk_set: {sorted(list(projects_fk_set))}")
            for pid, plist in plots_by_pid.items():
                debug_print(f"?? Backend: Project {pid} has {len(plist)} plots")

            for proj_id in sorted(projects_fk_set):
                try:
                    url = f"{nocodb_api_url}/api/v2/tables/{PROJECTS_TABLE_ID}/records/{proj_id}"
                    r = requests.get(url, headers=headers, verify=False)
                    if r.status_code != 200:
                        continue
                    prow = r.json() or {}
                    project_plots = plots_by_pid.get(proj_id, [])
                    debug_print(f"?? Backend: Project {proj_id} getting {len(project_plots)} plots")
                    project_obj = {
                        "_db_id": prow.get("id", proj_id),
                        "values": map_values_by_field_id(prow, schema_by_table["Projects"]),
                        "plots": project_plots
                    }
                    projects.append(project_obj)
                except Exception as e:
                    print(f"? Backend: Error loading project {proj_id}: {str(e)}")
                    continue
        
        # -------------------------
        # 4b) PRESERVE ORDER IF REQUESTED
        # -------------------------
        if preserve_order and requested_order:
            # Create lookup dict for plots by ID
            plots_by_id = {p["_db_id"]: p for p in plots}
            # Reorder plots to match requested order
            ordered_plots = []
            for req_id in requested_order:
                if req_id in plots_by_id:
                    ordered_plots.append(plots_by_id[req_id])
            # Use ordered list
            plots = ordered_plots
            
            # Also need to rebuild projects with ordered plots
            plots_by_pid = {}
            for p in plots:
                # First check the _fk_projects_id that was already resolved
                pid = p.get("_fk_projects_id")
                
                # If not found, try extracting from raw plot data
                if pid is None:
                    for key in ["chap8h7mt25wqlp", "projects_id", "Projects_id", "project_id", "ProjectID", "project", "Project", "Projects"]:
                        if key in p:
                            val = p.get(key)
                            if isinstance(val, dict) and "id" in val:
                                val = val.get("id")
                            elif isinstance(val, list) and val and isinstance(val[0], dict) and "id" in val[0]:
                                val = val[0].get("id")
                            if isinstance(val, (int, str)) and str(val).isdigit():
                                pid = int(val)
                                break
                
                if pid is not None:
                    plots_by_pid.setdefault(pid, []).append(p)
            
            # Rebuild projects list with correctly ordered plots
            projects = []
            for proj_id in sorted(projects_fk_set):
                try:
                    url = f"{nocodb_api_url}/api/v2/tables/{PROJECTS_TABLE_ID}/records/{proj_id}"
                    r = requests.get(url, headers=headers, verify=False)
                    if r.status_code != 200:
                        continue
                    prow = r.json() or {}
                    project_obj = {
                        "_db_id": prow.get("id", proj_id),
                        "values": map_values_by_field_id(prow, schema_by_table["Projects"]),
                        "plots": plots_by_pid.get(proj_id, [])
                    }
                    projects.append(project_obj)
                except Exception:
                    continue
        
        # -------------------------
        # 5) OUTPUT (schema first, then data)
        # -------------------------
        output = {
            "schema": schema_sorted,                    # full, untouched rows, sorted
            "data": {"projects": projects},             # only relevant projects, each with its own plots
            "exported_at": datetime.now().isoformat(),
            "summary": {
                "total_projects": len(projects),
                "total_plots": len(plots),
                "requested_plot_ids": selected_plot_ids,
                "found_plot_ids": [p["_db_id"] for p in plots],
                "projects_found": sorted(list(projects_fk_set))
            }
        }
        
        # Build response manually and use json_serial to handle Decimal types
        response_data = {
            "schema": schema_sorted,
            "data": {"projects": projects},
            "exported_at": datetime.now().isoformat(),
            "summary": {
                "total_projects": len(projects),
                "total_plots": len(plots),
                "requested_plot_ids": selected_plot_ids,
                "found_plot_ids": [p["_db_id"] for p in plots],
                "projects_found": sorted(list(projects_fk_set))
            }
        }
        
        # Use json_serial to handle Decimal and other non-serializable types
        import json
        serialized_data = json.loads(json.dumps(response_data, default=json_serial))
        return JSONResponse(content=serialized_data)
        
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
@app.get('/projects/map-data', tags=["Projects"])
def get_map_data_endpoint(current_user: dict = Depends(get_current_user)):
    """Get map visualization data with site locations and coordinates from NocoDB"""
    try:
        # Get NocoDB configuration from environment
        nocodb_api_url = os.getenv("NOCODB_API_URL", "https://nocodb.edbmotte.com")
        nocodb_api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_base_id = os.getenv("NOCODB_BASE_ID")
        nocodb_landplots_table_id = "mmqclkrvx9lbtpc"  # Land Plots table ID
        
        if not nocodb_api_token or not nocodb_base_id:
            return JSONResponse(
                content={"error": "NocoDB configuration missing"}, 
                status_code=500
            )
        
        # Construct NocoDB API v2 URL to get all land plots
        api_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_landplots_table_id}/records"
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": nocodb_api_token,
            "Content-Type": "application/json"
        }
        
        # Get all records with pagination
        all_plots = []
        offset = 0
        limit = 1000  # Large limit to get all records
        
        while True:
            params = {
                "limit": limit,
                "offset": offset
            }
            
            # Make request to NocoDB API with SSL verification disabled for now
            response = requests.get(api_url, headers=headers, params=params, verify=False)
            
            if response.status_code != 200:
                return JSONResponse(
                    content={
                        "error": f"NocoDB API error: {response.status_code} - {response.text}",
                        "url": api_url
                    }, 
                    status_code=500
                )
            
            # Parse the data
            data = response.json()
            batch_plots = data.get("list", [])
            all_plots.extend(batch_plots)
            
            # Check if we got fewer records than the limit (last page)
            if len(batch_plots) < limit:
                break
                
            offset += limit
        
        # Parse the data
        plots = all_plots
        
        # Process plots to extract map data
        sites_data = []
        for plot in plots:
            # Parse coordinates from 'Coordinates' field (lat;lng format)
            coord_str = str(plot.get('Coordinates', '')).strip()
            lat = None
            lng = None
            
            if coord_str and ';' in coord_str:
                try:
                    parts = coord_str.split(';')
                    if len(parts) == 2:
                        lat = float(parts[0].strip())
                        lng = float(parts[1].strip())
                except (ValueError, TypeError):
                    pass
            
            # Only include plots with valid coordinates
            if lat is not None and lng is not None and lat != 0 and lng != 0:
                # Extract plot information
                plot_id = plot.get('Id', 'Unknown')
                plot_name = plot.get('Plot Name', '') or f"Plot {plot_id}"  # Plot_Name field
                
                site_data = {
                    'id': plot_id,
                    'name': plot_name,
                    'lat': lat,
                    'lng': lng,
                    'address': plot.get('Plot Address', ''),  # Site_Address field
                    'country': plot.get('Country', ''),  # Country field
                    'plot_id': plot.get('Id', ''),
                    'project_name': plot.get('Projects', ''),  # Will be populated if we fetch project data
                    'project_code': '',
                    'project_partner': '',
                    'geojson': plot.get('geojson', ''),
                }
                sites_data.append(site_data)
        
        return JSONResponse(content={
            "sites": sites_data,
            "count": len(sites_data),
            "total_plots": len(plots),
            "plots_with_coords": len(sites_data),
            "source": "NocoDB API v2 direct fetch"
        })
        
    except Exception as e:
        return JSONResponse(
            content={"error": f"Failed to load map data: {str(e)}"}, 
            status_code=500
        )

@app.get('/projects/map-stats', tags=["Projects"])  
def get_map_stats_endpoint():
    """Get map statistics and analytics"""
    return {"status": "Map stats endpoint works"}


######################################################################
# Hoyanger Power Data endpoint
######################################################################
@app.get("/hoyanger/hoyanger-power-data", tags=["Hoyanger Power Data"])
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


@app.post("/nocodb-sync", tags=["Projects"])
def nocodb_sync_endpoint(current_user: dict = Depends(get_current_user)):
    """Sync data with NocoDB using the full sync implementation"""
    try:
        # Call the actual sync function from nocodb_sync module
        result = nocodb_sync.run_nocodb_sync()
        
        # Return the result from the sync operation
        return JSONResponse(content={
            "status": result.get("status", "success"),
            "message": result.get("message", "NocoDB sync completed"),
            "rows_updated": result.get("rows_updated", 0),
            "rows_inserted": result.get("rows_inserted", 0),
            "rows_deleted": result.get("rows_deleted", 0),
            "descriptions_updated": result.get("descriptions_updated", 0),
            "total_existing": result.get("total_existing", 0),
            "total_processed": result.get("total_processed", 0),
            "existing_records": result.get("existing_records", 0),
            "api_versions": result.get("api_versions", []),
            "bases": result.get("bases", []),
            "tables": result.get("tables", []),
            "sync_timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return JSONResponse(
            content={
                "status": "error",
                "message": f"NocoDB sync failed: {str(e)}"
            }, 
            status_code=500
        )


@app.on_event("startup")
async def startup_event():
    print("FastAPI STARTUP - execute_nocodb_query function loaded", flush=True)

class NocoDBQuery(BaseModel):
    query: str

print("DEFINING NOCODB QUERY FUNCTION", flush=True)

# TEST ROUTE TO VERIFY MY MODIFICATIONS ARE WORKING
@app.post("/test-debug-route", tags=["DEBUG"])
async def test_debug_route():
    return {"test": "MY_MODIFICATIONS_ARE_WORKING", "message": "This confirms the file is being loaded"}

@app.post("/nocodb/query", tags=["NocoDB"])
async def execute_nocodb_query(query_request: NocoDBQuery, current_user: dict = Depends(get_current_user)):
    """Execute a query against NocoDB and return results"""
    
    # ALWAYS RETURN DEBUG - TEST THE QUERY CONTENT
    return JSONResponse(content={
        "success": True,
        "rows": [],
        "debug": "ALWAYS_RETURN_DEBUG",
        "query": query_request.query,
        "query_length": len(query_request.query) if query_request.query else 0,
        "contains_view": "v_HoyangerEnergyReport" in query_request.query if query_request.query else False,
        "query_repr": repr(query_request.query) if query_request.query else "None"
    })
    
    print(f"?? NOCODB QUERY ENDPOINT CALLED", flush=True)
    print(f"?? Received query request: '{query_request.query}'", flush=True)
    print(f"?? Current user: {current_user}", flush=True)
    
    # Debug the query detection  
    if "v_HoyangerEnergyReport" in query_request.query:
        print(f"? DETECTED VIEW QUERY - EXECUTING SQL DIRECTLY", flush=True)
    else:
        print(f"?? REGULAR QUERY - USING NOCODB API", flush=True)
    
    try:
        
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')

        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and isinstance(user_data, dict) and user_data.get('nocodb_api'):
                    user_token = user_data['nocodb_api']
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")

        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            return JSONResponse(
                content={"error": "NocoDB API token missing"},
                status_code=500
            )

        # Check if this is a direct SQL query (contains v_HoyangerEnergyReport view)
        if "v_HoyangerEnergyReport" in query_request.query:
            print(f"?? Executing SQL query: {query_request.query}")
            # Execute direct SQL query against the database
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                
                # Execute the query directly
                cursor.execute(query_request.query)
                rows = cursor.fetchall()
                
                print(f"? SQL query executed successfully, got {len(rows)} rows")
                if rows:
                    print(f"?? First row keys: {list(rows[0].keys())}")
                
                # Convert decimal and datetime objects to JSON serializable format
                result_rows = []
                for row in rows:
                    converted_row = {}
                    for key, value in row.items():
                        if isinstance(value, Decimal):
                            converted_row[key] = float(value)
                        elif isinstance(value, (datetime, date)):
                            converted_row[key] = value.isoformat()
                        else:
                            converted_row[key] = value
                    result_rows.append(converted_row)
                
                cursor.close()
                conn.close()
                
                print(f"?? Returning {len(result_rows)} converted rows")
                return JSONResponse(content={
                    "success": True,
                    "rows": result_rows,
                    "total_records": len(result_rows),
                    "source": "direct_sql_query"
                })
                
            except Exception as e:
                print(f"? SQL query error: {str(e)}")
                return JSONResponse(
                    content={"error": f"SQL query error: {str(e)}"},
                    status_code=500
                )

        # Fall back to original table-based logic for other queries
        nocodb_api_url = os.getenv("NOCODB_API_URL", "https://nocodb.edbmotte.com")
        base_id = os.getenv("NOCODB_BASE_ID")

        if not base_id:
            return JSONResponse(
                content={"error": "NocoDB configuration missing"},
                status_code=500
            )

        # For now, we'll implement a simple aggregation for Hoyanger Power Data
        # Get the table ID for Hoyanger Power Data - we'll need to find this
        # For now, let's assume we can get all records and aggregate them

        # First, let's try to get the table info to find the Hoyanger Power Data table
        table_api_url = f"{nocodb_api_url}/api/v2/meta/bases/{base_id}/tables"

        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }

        response = requests.get(table_api_url, headers=headers, verify=False)

        if response.status_code != 200:
            return JSONResponse(
                content={"error": f"Failed to get table info: {response.status_code}"},
                status_code=500
            )

        tables = response.json().get("list", [])
        hoyanger_table = None

        for table in tables:
            if table.get("title") == "Hoyanger Power Data":
                hoyanger_table = table
                break

        if not hoyanger_table:
            return JSONResponse(
                content={"error": "Hoyanger Power Data table not found"},
                status_code=404
            )

        table_id = hoyanger_table["id"]

        # Get all records from the table
        records_api_url = f"{nocodb_api_url}/api/v2/tables/{table_id}/records?limit=10000"

        response = requests.get(records_api_url, headers=headers, verify=False)

        if response.status_code != 200:
            return JSONResponse(
                content={"error": f"Failed to get records: {response.status_code}"},
                status_code=500
            )

        data = response.json()
        records = data.get("list", [])

        # Get first record per day instead of aggregating
        from collections import defaultdict
        from datetime import datetime

        daily_first_records = {}

        for record in records:
            timestamp = record.get('timestamp') or record.get('Timestamp') or record.get('Date')
            if not timestamp:
                continue

            try:
                # Parse date
                if isinstance(timestamp, str):
                    date_obj = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).date()
                else:
                    date_obj = timestamp.date() if hasattr(timestamp, 'date') else timestamp

                date_key = date_obj.isoformat()

                # Only keep the first record for each day
                if date_key not in daily_first_records:
                    daily_first_records[date_key] = record

            except Exception as e:
                print(f"Error processing record: {e}")
                continue

        # Format result with first records
        result_rows = []
        for date_key, record in sorted(daily_first_records.items(), reverse=True):
            row = {
                'date': date_key,
                'hourly_records': 1,  # Since we're showing first record per day
                'first_reading': record.get('timestamp') or record.get('Timestamp') or record.get('Date'),
                'last_reading': record.get('timestamp') or record.get('Timestamp') or record.get('Date')
            }

            # Extract field values directly from the first record
            for field in ['1A', '1B', '2A', '2B', '3A', '3B', '4M3', '5M2', 'ph']:
                value = record.get(field)
                if value is not None and value != '':
                    try:
                        num_value = float(value)
                        if field == '4M3':
                            field_key = '4m3'
                        else:
                            field_key = field.lower()
                        row[field_key] = round(num_value, 2)
                    except (ValueError, TypeError):
                        row[field.lower()] = None
                else:
                    row[field.lower()] = None

            result_rows.append(row)

        return JSONResponse(content={
            "success": True,
            "rows": result_rows,
            "total_days": len(result_rows),
            "source": "nocodb_aggregated",
            "debug": "MODIFIED_FUNCTION_VERSION_1.0",
            "query_request_type": str(type(query_request)),
            "query_request_dict": str(query_request.__dict__) if hasattr(query_request, '__dict__') else "NO_DICT",
            "has_query_attr": hasattr(query_request, 'query'),
            "query_value": getattr(query_request, 'query', 'NO_QUERY_ATTR') if hasattr(query_request, 'query') else 'NO_QUERY_ATTR'
        })

    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"},
            status_code=500
        )


######################################################################
# Software User Management endpoints
######################################################################
@app.get("/users", tags=["User Management"])
def get_users(current_user: dict = Depends(get_current_user)):
    """Get all registered users with their groups"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # First, ensure tables exist
        create_users_table(cursor)
        create_groups_table(cursor)
        create_user_groups_table(cursor)
        
        # Get users with their groups
        cursor.execute("""
            SELECT u.*, 
                   GROUP_CONCAT(
                       CONCAT(g.name, ':', ug.role) 
                       ORDER BY g.name SEPARATOR '; '
                   ) as groups
            FROM users u
            LEFT JOIN user_groups ug ON u.id = ug.user_id AND ug.is_active = TRUE
            LEFT JOIN groups g ON ug.group_id = g.id AND g.is_active = TRUE
            WHERE u.is_active = TRUE
            GROUP BY u.id
            ORDER BY u.created_at DESC
        """)
        
        users = cursor.fetchall()
        
        # Convert groups string to list of objects for better frontend handling
        for user in users:
            if user['groups']:
                group_list = []
                for group_str in user['groups'].split('; '):
                    if ':' in group_str:
                        name, role = group_str.split(':', 1)
                        group_list.append({"name": name, "role": role})
                user['groups'] = group_list
            else:
                user['groups'] = []
        
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
        create_user_groups_table(cursor)
        
        cursor.execute("SELECT * FROM groups WHERE is_active = TRUE ORDER BY name")
        groups = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(groups, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/auth/user-groups/{email}", tags=["Authentication"])
def get_user_groups_for_auth(email: str):
    """
    Public endpoint to fetch user groups during authentication flow.
    Does NOT require authentication - used by NextAuth callbacks.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get user
        cursor.execute("SELECT * FROM users WHERE email = %s AND is_active = TRUE", (email,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            return {"user": None, "groups": []}
        
        # Get user's groups
        query = """
        SELECT g.id, g.name, g.description, g.domain
        FROM groups g
        INNER JOIN user_groups ug ON g.id = ug.group_id
        WHERE ug.user_id = %s 
          AND g.is_active = TRUE 
          AND ug.is_active = TRUE
        ORDER BY g.name
        """
        cursor.execute(query, (user['id'],))
        groups = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return {
            "user": user,
            "groups": groups
        }
            
    except Exception as e:
        print(f"Error fetching user groups for auth: {str(e)}")
        return {"user": None, "groups": [], "error": str(e)}

# Pydantic models for user/group management
class UserGroupAssignment(BaseModel):
    user_id: int
    group_id: int
    role: str = "member"

class CreateGroup(BaseModel):
    name: str
    domain: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[dict] = None

class UpdateUser(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    nocodbapi: Optional[str] = None

class UpdateGroup(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[dict] = None
    is_active: Optional[bool] = None

@app.get("/users/{user_id}/groups", tags=["User Management"])
def get_user_groups(user_id: int, current_user: dict = Depends(get_current_user)):
    """Get all groups for a specific user"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT g.*, ug.role, ug.assigned_at, ug.is_active as membership_active
            FROM groups g
            JOIN user_groups ug ON g.id = ug.group_id
            WHERE ug.user_id = %s AND ug.is_active = TRUE AND g.is_active = TRUE
            ORDER BY g.name
        """, (user_id,))
        
        groups = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return JSONResponse(content=json.loads(json.dumps(groups, default=json_serial)))
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/groups/{group_id}/users", tags=["User Management"])
def get_group_users(group_id: int, current_user: dict = Depends(get_current_user)):
    """Get all users in a specific group"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT u.*, ug.role, ug.assigned_at, ug.is_active as membership_active
            FROM users u
            JOIN user_groups ug ON u.id = ug.user_id
            WHERE ug.group_id = %s AND ug.is_active = TRUE AND u.is_active = TRUE
            ORDER BY u.name, u.email
        """, (group_id,))
        
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return JSONResponse(content=json.loads(json.dumps(users, default=json_serial)))
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/users/{user_id}/groups", tags=["User Management"])
def assign_user_to_group_endpoint(user_id: int, assignment: UserGroupAssignment, current_user: dict = Depends(get_current_user)):
    """Assign a user to a group"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Ensure tables exist
        create_users_table(cursor)
        create_groups_table(cursor)
        create_user_groups_table(cursor)
        
        # Check if user and group exist
        cursor.execute("SELECT id FROM users WHERE id = %s AND is_active = TRUE", (user_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return JSONResponse(content={"error": "User not found"}, status_code=404)
        
        cursor.execute("SELECT id FROM groups WHERE id = %s AND is_active = TRUE", (assignment.group_id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return JSONResponse(content={"error": "Group not found"}, status_code=404)
        
        # Get current user ID for assignment tracking
        assigner_id = None
        if current_user and 'email' in current_user:
            cursor.execute("SELECT id FROM users WHERE email = %s", (current_user['email'],))
            assigner = cursor.fetchone()
            if assigner:
                assigner_id = assigner['id']
        
        # Insert or update the user-group relationship
        try:
            cursor.execute("""
                INSERT INTO user_groups (user_id, group_id, role, assigned_by, is_active)
                VALUES (%s, %s, %s, %s, TRUE)
                ON DUPLICATE KEY UPDATE
                role = VALUES(role),
                assigned_by = VALUES(assigned_by),
                assigned_at = CURRENT_TIMESTAMP,
                is_active = TRUE
            """, (user_id, assignment.group_id, assignment.role, assigner_id))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            return JSONResponse(content={"message": "User assigned to group successfully"})
        except Exception as e:
            conn.rollback()
            cursor.close()
            conn.close()
            return JSONResponse(content={"error": f"Failed to assign user to group: {str(e)}"}, status_code=500)
            
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.delete("/users/{user_id}/groups/{group_id}", tags=["User Management"])
def remove_user_from_group(user_id: int, group_id: int, current_user: dict = Depends(get_current_user)):
    """Remove a user from a group"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Set membership as inactive instead of deleting
        cursor.execute("""
            UPDATE user_groups 
            SET is_active = FALSE, assigned_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND group_id = %s
        """, (user_id, group_id))
        
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return JSONResponse(content={"error": "User-group relationship not found"}, status_code=404)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return JSONResponse(content={"message": "User removed from group successfully"})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.post("/groups", tags=["User Management"])
def create_group(group: CreateGroup, current_user: dict = Depends(get_current_user)):
    """Create a new group"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        create_groups_table(cursor)
        
        permissions_json = json.dumps(group.permissions) if group.permissions else None
        
        cursor.execute("""
            INSERT INTO groups (name, domain, description, permissions, is_active)
            VALUES (%s, %s, %s, %s, TRUE)
        """, (group.name, group.domain, group.description, permissions_json))
        
        group_id = cursor.lastrowid
        conn.commit()
        cursor.close()
        conn.close()
        
        return JSONResponse(content={
            "message": "Group created successfully", 
            "group_id": group_id, 
            "id": group_id
        })
    except Exception as e:
        print(f"❌ Error creating group: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            content={
                "detail": f"Failed to create group: {str(e)}",
                "error": str(e)  # Also include error for backward compatibility
            }, 
            status_code=500
        )

@app.put("/groups/{group_id}", tags=["User Management"])
def update_group(group_id: int, group: UpdateGroup, current_user: dict = Depends(get_current_user)):
    """Update a group"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Build update query dynamically
        updates = []
        params = []
        
        if group.name is not None:
            updates.append("name = %s")
            params.append(group.name)
        if group.domain is not None:
            updates.append("domain = %s")
            params.append(group.domain)
        if group.description is not None:
            updates.append("description = %s")
            params.append(group.description)
        if group.permissions is not None:
            updates.append("permissions = %s")
            params.append(json.dumps(group.permissions))
        if group.is_active is not None:
            updates.append("is_active = %s")
            params.append(group.is_active)
        
        if not updates:
            return JSONResponse(content={"error": "No fields to update"}, status_code=400)
        
        params.append(group_id)
        query = f"UPDATE groups SET {', '.join(updates)} WHERE id = %s"
        
        cursor.execute(query, params)
        
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return JSONResponse(content={"error": "Group not found"}, status_code=404)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return JSONResponse(content={"message": "Group updated successfully"})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.put("/users/{user_id}", tags=["User Management"])
def update_user(user_id: int, user: UpdateUser, current_user: dict = Depends(get_current_user)):
    """Update a user"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Build update query dynamically
        updates = []
        params = []
        
        if user.name is not None:
            updates.append("name = %s")
            params.append(user.name)
        if user.is_active is not None:
            updates.append("is_active = %s")
            params.append(user.is_active)
        if user.nocodbapi is not None:
            updates.append("nocodbapi = %s")
            params.append(user.nocodbapi)
        
        if not updates:
            return JSONResponse(content={"error": "No fields to update"}, status_code=400)
        
        params.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
        
        cursor.execute(query, params)
        
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            return JSONResponse(content={"error": "User not found"}, status_code=404)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return JSONResponse(content={"message": "User updated successfully"})
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
        create_user_groups_table(cursor)
        
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
            is_active BOOLEAN DEFAULT TRUE,
            nocodbapi VARCHAR(255),
            INDEX idx_email (email),
            INDEX idx_active (is_active)
        )
    """)
    
    # Remove the old group_id column if it exists (migration)
    try:
        cursor.execute("ALTER TABLE users DROP COLUMN group_id")
    except Exception:
        # Column doesn't exist or other error, ignore
        pass
    
    # Add new columns if they don't exist
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE")
    except Exception:
        pass
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN nocodbapi VARCHAR(255)")
    except Exception:
        pass

def create_groups_table(cursor):
    """Create groups table if it doesn't exist"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL,
            domain VARCHAR(255),
            description TEXT,
            permissions JSON,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_domain (domain),
            INDEX idx_active (is_active)
        )
    """)
    
    # Add new columns if they don't exist
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN description TEXT")
    except Exception:
        pass
    
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN permissions JSON")
    except Exception:
        pass
    
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN is_active BOOLEAN DEFAULT TRUE")
    except Exception:
        pass
    
    # Create default groups with permissions
    default_groups = [
        ("Guests", None, "Guest users with limited access", '{"pages": ["dashboard", "tools"], "actions": ["read"]}'),
        ("Scale42", "scale-42.com", "Scale42 domain users with full access", '{"pages": ["dashboard", "projects", "map", "schema", "accounts", "hoyanger", "users", "tools"], "actions": ["read", "write", "delete", "admin"]}'),
        ("Scale42", "edbmotte.com", "EDB Motte domain users with full access", '{"pages": ["dashboard", "projects", "map", "schema", "accounts", "hoyanger", "users", "tools"], "actions": ["read", "write", "delete", "admin"]}'),
        ("Developers", None, "Developer group with technical access", '{"pages": ["dashboard", "projects", "map", "schema", "tools"], "actions": ["read", "write"]}'),
        ("Viewers", None, "Read-only access to most content", '{"pages": ["dashboard", "projects", "map"], "actions": ["read"]}'),
    ]
    
    for group_name, domain, description, permissions in default_groups:
        cursor.execute(
            "INSERT IGNORE INTO groups (name, domain, description, permissions) VALUES (%s, %s, %s, %s)",
            (group_name, domain, description, permissions)
        )

def create_user_groups_table(cursor):
    """Create user_groups junction table for many-to-many relationship"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_groups (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            group_id INT NOT NULL,
            role VARCHAR(50) DEFAULT 'member',
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            assigned_by INT,
            is_active BOOLEAN DEFAULT TRUE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
            UNIQUE KEY unique_user_group (user_id, group_id),
            INDEX idx_user_id (user_id),
            INDEX idx_group_id (group_id),
            INDEX idx_active (is_active)
        )
    """)

def assign_user_to_group(cursor, user_id, email, assigned_by=None):
    """Assign user to appropriate group based on email domain"""
    domain = email.split('@')[1] if '@' in email else None
    
    if domain:
        # Try to find a group for this domain
        cursor.execute("SELECT id FROM groups WHERE domain = %s AND is_active = TRUE", (domain,))
        group = cursor.fetchone()
        
        if group:
            group_id = group['id']
        else:
            # No specific group found, assign to Guests
            cursor.execute("SELECT id FROM groups WHERE name = 'Guests' AND domain IS NULL AND is_active = TRUE")
            guest_group = cursor.fetchone()
            group_id = guest_group['id'] if guest_group else None
    else:
        # No domain, assign to Guests
        cursor.execute("SELECT id FROM groups WHERE name = 'Guests' AND domain IS NULL AND is_active = TRUE")
        guest_group = cursor.fetchone()
        group_id = guest_group['id'] if guest_group else None
    
    if group_id:
        # Use the new many-to-many relationship
        try:
            cursor.execute(
                "INSERT INTO user_groups (user_id, group_id, role, assigned_by) VALUES (%s, %s, %s, %s)",
                (user_id, group_id, 'member', assigned_by)
            )
        except Exception as e:
            # Relationship might already exist, update it instead
            cursor.execute(
                "UPDATE user_groups SET is_active = TRUE, assigned_at = CURRENT_TIMESTAMP, assigned_by = %s WHERE user_id = %s AND group_id = %s",
                (assigned_by, user_id, group_id)
            )




######################################################################
# Software Debug endpoints
######################################################################
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

@app.post("/nocodb/create-row", tags=["nocodb"])
async def create_nocodb_row(
    table_id: str = Query(...),
    row_data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Create a new row in NocoDB table using v1 API"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        print(f"?? CREATE ENDPOINT - Getting API token for user: {user_email}")
        
        if user_email:
            try:
                # Get user's NocoDB token from database
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                    print(f"? CREATE ENDPOINT - Using user-specific NocoDB token for {user_email}")
                else:
                    print(f"?? CREATE ENDPOINT - No user-specific token found for {user_email}, using admin token")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            raise HTTPException(status_code=500, detail="No API token available")
        
        # NocoDB v3 API endpoint for creating records
        base_id = os.getenv("NOCODB_BASE_ID")
        
        nocodb_url = f"{os.getenv('NOCODB_API_URL')}/api/v3/data/{base_id}/{table_id}/records"
        
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token
        }
        
        # NocoDB v3 API requires fields wrapper
        v3_payload = {
            "fields": row_data
        }
        
        # Make the create request
        print(f"🔄 Making NocoDB v3 create request:")
        print(f"   URL: {nocodb_url}")
        print(f"   Payload: {v3_payload}")
        print(f"   Token type: {'user' if user_token else 'admin'}")
        
        response = requests.post(nocodb_url, json=v3_payload, headers=headers, verify=False)
        
        print(f"?? NocoDB Response: {response.status_code}")
        if response.status_code not in [200, 201]:
            print(f"? Error response: {response.text}")
        
        if response.status_code in [200, 201]:
            return {"success": True, "data": response.json()}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"NocoDB API error: {response.text}")
            
    except Exception as e:
        print(f"? Error in create_nocodb_row: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/nocodb/update-row", tags=["nocodb"])
async def update_nocodb_row(
    table_id: str = Query(...),
    record_id: str = Query(...),
    row_data: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """Update a row in NocoDB table using v1 API"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        print(f"?? UPDATE ENDPOINT - Getting API token for user: {user_email}")
        
        if user_email:
            try:
                # Get user's NocoDB token from database
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                print(f"?? UPDATE ENDPOINT - Database query result for {user_email}: {user_data}")
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                    print(f"? UPDATE ENDPOINT - Using user-specific NocoDB token for {user_email}")
                else:
                    print(f"?? UPDATE ENDPOINT - No user-specific token found for {user_email}, using admin token")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            raise HTTPException(status_code=500, detail="No API token available")
        
        # NocoDB v3 API endpoint format: /api/v3/data/{base_id}/{table_id}/records
        base_id = os.getenv("NOCODB_BASE_ID")
        
        nocodb_url = f"{os.getenv('NOCODB_API_URL')}/api/v3/data/{base_id}/{table_id}/records"
        
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token
        }
        
        # NocoDB v3 API requires id and fields in the payload
        v3_payload = {
            "id": record_id,
            "fields": row_data
        }
        
        # Make the update request (PATCH for v3 API)
        print(f"?? Making NocoDB v3 update request:")
        print(f"   URL: {nocodb_url}")
        print(f"   Payload: {v3_payload}")
        print(f"   Token type: {'user' if user_token else 'admin'}")
        print(f"   Using token: {str(api_token)[:20]}...")
        
        response = requests.patch(nocodb_url, json=v3_payload, headers=headers, verify=False)
        
        print(f"?? NocoDB Response: {response.status_code}")
        if response.status_code != 200:
            print(f"? Error response: {response.text}")
        
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"NocoDB API error: {response.text}")
            
    except Exception as e:
        print(f"? Error in update_nocodb_row: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/nocodb/delete-row", tags=["nocodb"])
async def delete_nocodb_row(
    table_id: str = Query(...),
    row_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Delete a row from NocoDB table using v3 API"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        print(f"🗑️ DELETE ENDPOINT - Getting API token for user: {user_email}")
        
        if user_email:
            try:
                # Get user's NocoDB token from database
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                print(f"📊 DELETE ENDPOINT - Database query result for {user_email}: {user_data}")
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                    print(f"✅ DELETE ENDPOINT - Using user-specific NocoDB token for {user_email}")
                else:
                    print(f"⚠️ DELETE ENDPOINT - No user-specific token found for {user_email}, using admin token")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            raise HTTPException(status_code=500, detail="No API token available")
        
        # NocoDB v3 API endpoint format: /api/v3/data/{base_id}/{table_id}/records
        base_id = os.getenv("NOCODB_BASE_ID")
        
        nocodb_url = f"{os.getenv('NOCODB_API_URL')}/api/v3/data/{base_id}/{table_id}/records"
        
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token
        }
        
        # NocoDB v3 API requires id in the payload for delete
        v3_payload = {
            "id": row_id
        }
        
        # Make the delete request
        print(f"🗑️ Making NocoDB v3 delete request:")
        print(f"   URL: {nocodb_url}")
        print(f"   Payload: {v3_payload}")
        print(f"   Token type: {'user' if user_token else 'admin'}")
        print(f"   Using token: {str(api_token)[:20]}...")
        
        response = requests.delete(nocodb_url, json=v3_payload, headers=headers, verify=False)
        
        print(f"📡 NocoDB Response: {response.status_code}")
        if response.status_code != 200:
            print(f"❌ Error response: {response.text}")
        
        if response.status_code == 200:
            return {"success": True, "message": "Row deleted successfully"}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"NocoDB API error: {response.text}")
            
    except Exception as e:
        print(f"❌ Error in delete_nocodb_row: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/nocodb/verify-update", tags=["nocodb"])
async def verify_nocodb_update(
    table_id: str = Query(...),
    row_id: str = Query(...),
    field_id: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Verify that a field was actually updated by fetching the current value"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        
        if user_email:
            try:
                # Get user's NocoDB token from database
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token for verification: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            raise HTTPException(status_code=500, detail="No API token available")
        
        # Get the specific record to check the field value
        nocodb_url = f"{os.getenv('NOCODB_API_URL')}/api/v2/tables/{table_id}/records/{row_id}"
        
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token
        }
        
        response = requests.get(nocodb_url, headers=headers, verify=False)
        
        if response.status_code == 200:
            record_data = response.json()
            field_value = record_data.get(field_id)
            return {"success": True, "value": field_value}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"NocoDB API error: {response.text}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/nocodb/table/{table_id}", tags=["nocodb"])
async def get_nocodb_table_info(table_id: str, current_user: dict = Depends(get_current_user)):
    """Get table information from NocoDB"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        if current_user and current_user.get("authenticated"):
            user_email = current_user.get("email")
            if user_email:
                try:
                    conn = mysql.connector.connect(
                        host=os.getenv("DB_HOST"),
                        user=os.getenv("DB_USER"),
                        password=os.getenv("DB_PASSWORD"),
                        database=os.getenv("DB_NAME"),
                        port=int(os.getenv("DB_PORT", 3306))
                    )
                    cursor = conn.cursor(dictionary=True)
                    cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                    user_data = cursor.fetchone()
                    if user_data and user_data.get('nocodb_api'):
                        user_token = user_data['nocodb_api']
                        print(f"? Using user-specific NocoDB token for {user_email}")
                    else:
                        print(f"?? No user-specific token found for {user_email}, using admin token")
                    cursor.close()
                    conn.close()
                except Exception as e:
                    print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            raise HTTPException(status_code=500, detail="No API token available")
        
        # NocoDB API endpoint for table info
        nocodb_url = f"{os.getenv('NOCODB_API_URL')}/api/v2/tables/{table_id}"
        
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token
        }
        
        # Make the request
        response = requests.get(nocodb_url, headers=headers, verify=False)
        
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"NocoDB API error: {response.text}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/nocodb/table/{table_id}/records", tags=["nocodb"])
async def get_nocodb_table_records(table_id: str, current_user: dict = Depends(get_current_user)):
    """Get table records from NocoDB"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        if current_user and current_user.get("authenticated"):
            user_email = current_user.get("email")
            if user_email:
                try:
                    conn = mysql.connector.connect(
                        host=os.getenv("DB_HOST"),
                        user=os.getenv("DB_USER"),
                        password=os.getenv("DB_PASSWORD"),
                        database=os.getenv("DB_NAME"),
                        port=int(os.getenv("DB_PORT", 3306))
                    )
                    cursor = conn.cursor(dictionary=True)
                    cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                    user_data = cursor.fetchone()
                    if user_data and user_data.get('nocodb_api'):
                        user_token = user_data['nocodb_api']
                        print(f"? Using user-specific NocoDB token for {user_email}")
                    else:
                        print(f"?? No user-specific token found for {user_email}, using admin token")
                    cursor.close()
                    conn.close()
                except Exception as e:
                    print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            raise HTTPException(status_code=500, detail="No API token available")
        
        # NocoDB API endpoint for table records
        nocodb_url = f"{os.getenv('NOCODB_API_URL')}/api/v2/tables/{table_id}/records"
        
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token
        }
        
        # Add query parameters to get all records
        params = {
            "limit": 1000,  # Increase limit to get more records
            "offset": 0
        }
        
        # Make the request
        response = requests.get(nocodb_url, headers=headers, params=params, verify=False)
        
        if response.status_code == 200:
            data = response.json()
            return {"success": True, "records": data.get("list", [])}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"NocoDB API error: {response.text}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/api/map-data', tags=["Map"])
def get_api_map_data(current_user: dict = Depends(get_current_user), partner: str = Query("all", description="Filter by Primary Project Partner")):
    """Get map visualization data with site locations and coordinates"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Query to get plot/site data with coordinates and project information
        # Join LandPlots with Projects to get partner information
        if partner == "all":
            query = """
            SELECT 
                l.id,
                l.Plot_Name,
                l.Site_Address,
                l.Latitude,
                l.Longitude,
                l.Country,
                l.LandPlotID,
                l.geojson,
                p.Project_Name,
                p.Project_Code,
                p.`Primary Project Partner`
            FROM LandPlots l
            LEFT JOIN Projects p ON l.Project_ID = p.Id
            WHERE l.Latitude IS NOT NULL 
            AND l.Longitude IS NOT NULL
            AND l.Latitude != 0
            AND l.Longitude != 0
            """
            cursor.execute(query)
        else:
            query = """
            SELECT 
                l.id,
                l.Plot_Name,
                l.Site_Address,
                l.Latitude,
                l.Longitude,
                l.Country,
                l.LandPlotID,
                l.geojson,
                p.Project_Name,
                p.Project_Code,
                p.`Primary Project Partner`
            FROM LandPlots l
            LEFT JOIN Projects p ON l.Project_ID = p.Id
            WHERE l.Latitude IS NOT NULL 
            AND l.Longitude IS NOT NULL
            AND l.Latitude != 0
            AND l.Longitude != 0
            AND p.`Primary Project Partner` = %s
            """
            cursor.execute(query, (partner,))
        
        sites_data = cursor.fetchall() or []
        cursor.close()
        conn.close()
        
        # Convert to JSON with datetime serialization to handle Decimal and other types
        json_data = json.loads(json.dumps(sites_data, default=json_serial))
        
        return JSONResponse(content={
            "sites": json_data,
            "count": len(json_data),
            "partner_filter": partner if partner != "all" else None
        })
        
    except Exception as e:
        return JSONResponse(
            content={"error": f"Failed to load map data: {str(e)}"}, 
            status_code=500
        )

@app.get('/api/map-stats', tags=["Map"])
def get_api_map_stats(current_user: dict = Depends(get_current_user)):
    """Get map statistics and analytics"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Count total projects
        cursor.execute("SELECT COUNT(*) as count FROM Projects")
        total_projects_result = cursor.fetchone()
        total_projects = total_projects_result["count"] if total_projects_result else 0
        
        # Count total plots/sites
        cursor.execute("SELECT COUNT(*) as count FROM LandPlots")
        total_plots_result = cursor.fetchone()
        total_plots = total_plots_result["count"] if total_plots_result else 0
        
        # Count sites with coordinates
        cursor.execute("""
            SELECT COUNT(*) as count FROM LandPlots 
            WHERE Latitude IS NOT NULL 
            AND Longitude IS NOT NULL
            AND Latitude != 0
            AND Longitude != 0
        """)
        coords_result = cursor.fetchone()
        sites_with_coords = coords_result["count"] if coords_result else 0
        
        # Count sites with geojson
        cursor.execute("""
            SELECT COUNT(*) as count FROM LandPlots 
            WHERE geojson IS NOT NULL 
            AND geojson != ''
        """)
        geojson_result = cursor.fetchone()
        sites_with_geojson = geojson_result["count"] if geojson_result else 0
        
        cursor.close()
        conn.close()
        
        return JSONResponse(content={
            "total_projects": int(total_projects) if total_projects else 0,
            "total_plots": int(total_plots) if total_plots else 0,
            "sites_with_coords": int(sites_with_coords) if sites_with_coords else 0,
            "sites_with_geojson": int(sites_with_geojson) if sites_with_geojson else 0
        })
        
    except Exception as e:
        return JSONResponse(
            content={"error": f"Failed to load map stats: {str(e)}"}, 
            status_code=500
        )

@app.get('/api/projects-partners', tags=["Map"])  
def get_api_projects_partners(current_user: dict = Depends(get_current_user)):
    """Get unique project partners for map filtering - matches frontend API path"""
    try:
        # Get NocoDB configuration from environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        nocodb_api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_base_id = os.getenv("NOCODB_BASE_ID")
        nocodb_projects_table_id = os.getenv("NOCODB_PROJECTS_TABLE_ID")
        
        # First try NocoDB API
        if all([nocodb_api_url, nocodb_api_token, nocodb_base_id, nocodb_projects_table_id]):
            try:
                headers = {
                    "Content-Type": "application/json",
                    "xc-auth": nocodb_api_token
                }
                
                # Fetch all projects from NocoDB
                response = requests.get(
                    f"{nocodb_api_url}/api/v1/db/data/{nocodb_base_id}/{nocodb_projects_table_id}",
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 200:
                    projects_data = response.json()
                    projects = projects_data.get("list", [])
                    
                    # Extract unique partners from Primary Project Partner field (c3jk8g4qwvqsrpj)
                    partners = set()
                    for project in projects:
                        partner = project.get("c3jk8g4qwvqsrpj")  # Primary Project Partner field ID
                        if partner and partner.strip() and partner != "N/A":
                            partners.add(partner.strip())
                    
                    # Convert to sorted list
                    unique_partners = sorted(list(partners))
                    
                    return JSONResponse(content={
                        "partners": unique_partners,
                        "count": len(unique_partners),
                        "source": "NocoDB API"
                    })
                    
            except requests.exceptions.RequestException as e:
                # Fall through to MySQL fallback
                pass
        
        # Fallback to MySQL if NocoDB fails
        try:
            conn = get_db()
            cursor = conn.cursor(dictionary=True)
            
            # Get unique Primary Project Partner values from MySQL (if it exists)
            cursor.execute("""
                SELECT DISTINCT `Primary Project Partner` as partner
                FROM Projects 
                WHERE `Primary Project Partner` IS NOT NULL 
                AND `Primary Project Partner` != ''
                ORDER BY `Primary Project Partner`
            """)
            
            results = cursor.fetchall() or []
            cursor.close()
            conn.close()
            
            # Extract just the partner names
            partners = [row["partner"] for row in results if row["partner"]]
            
            return JSONResponse(content={
                "partners": partners,
                "count": len(partners),
                "source": "MySQL fallback"
            })
            
        except Exception as mysql_error:
            # If both fail, return fallback data
            fallback_partners = ["N/A", "Biforst Prioritised 8", "GIGA-42", "APL", "GIG", "Bifrost", "Bifrost - Lost"]
            return JSONResponse(content={
                "partners": fallback_partners,
                "count": len(fallback_partners),
                "source": "fallback data",
                "note": f"Both NocoDB and MySQL failed: {str(mysql_error)}"
            })
        
    except Exception as e:
        return JSONResponse(
            content={"error": f"Failed to load project partners: {str(e)}"}, 
            status_code=500
        )

@app.get("/user-info/{email}", tags=["User Management"])
def get_user_info(email: str, current_user: dict = Depends(get_current_user)):
    """Get user information with group details"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Create tables if they don't exist
        create_users_table(cursor)
        create_groups_table(cursor)
        create_user_groups_table(cursor)
        
        # Get user with group information using many-to-many relationship
        query = """
        SELECT u.*, 
               GROUP_CONCAT(g.name ORDER BY g.name SEPARATOR ', ') as group_names,
               GROUP_CONCAT(g.domain ORDER BY g.name SEPARATOR ', ') as group_domains
        FROM users u
        LEFT JOIN user_groups ug ON u.id = ug.user_id AND ug.is_active = TRUE
        LEFT JOIN groups g ON ug.group_id = g.id AND g.is_active = TRUE
        WHERE u.email = %s
        GROUP BY u.id
        """
        cursor.execute(query, (email,))
        user_info = cursor.fetchone()
        
        # For backward compatibility, set group_name to first group if available
        if user_info and user_info.get('group_names'):
            first_group = user_info['group_names'].split(', ')[0]
            user_info['group_name'] = first_group
        elif user_info:
            user_info['group_name'] = 'No Group'
        
        cursor.close()
        conn.close()
        
        if user_info:
            return user_info
        else:
            return None
            
    except Exception as e:
        return {"error": str(e)}

@app.post("/create-user", tags=["User Management"])
def create_user(user_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new user and assign to group based on email domain"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Create tables if they don't exist
        create_users_table(cursor)
        create_groups_table(cursor)
        create_user_groups_table(cursor)
        
        email = user_data.get('email')
        name = user_data.get('name', '')
        
        if not email:
            return {"error": "Email is required"}
        
        # Check if user already exists
        cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        existing_user = cursor.fetchone()
        
        if existing_user:
            return {"error": "User already exists"}
        
        # Create user without group_id
        cursor.execute(
            """INSERT INTO users (email, name, created_at, last_login, is_active) 
               VALUES (%s, %s, NOW(), NOW(), TRUE)""",
            (email, name)
        )
        user_id = cursor.lastrowid
        
        # Assign user to group using the new many-to-many relationship
        assign_user_to_group(cursor, user_id, email)
        
        # Get the created user with group info using new many-to-many relationship
        cursor.execute("""
            SELECT u.*, 
                   GROUP_CONCAT(g.name ORDER BY g.name SEPARATOR ', ') as group_names,
                   GROUP_CONCAT(g.domain ORDER BY g.name SEPARATOR ', ') as group_domains
            FROM users u
            LEFT JOIN user_groups ug ON u.id = ug.user_id AND ug.is_active = TRUE
            LEFT JOIN groups g ON ug.group_id = g.id AND g.is_active = TRUE
            WHERE u.id = %s
            GROUP BY u.id
        """, (user_id,))
        
        new_user = cursor.fetchone()
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return new_user
        
    except Exception as e:
        return {"error": str(e)}

@app.post("/update-user-login", tags=["User Management"])
def update_user_login(user_data: dict, current_user: dict = Depends(get_current_user)):
    """Update user's last login timestamp"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        create_users_table(cursor)
        
        email = user_data.get('email')
        if not email:
            return {"error": "Email is required"}
        
        cursor.execute(
            "UPDATE users SET last_login = NOW() WHERE email = %s",
            (email,)
        )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"success": True}
        
    except Exception as e:
        return {"error": str(e)}

@app.get('/api/nocodb/map-data', tags=["Map"])
def get_nocodb_map_data(partner: str = Query("all", description="Filter by Primary Project Partner")):
    """Get map visualization data from NocoDB with site locations, coordinates, and statistics"""
    print(f"?? Function called with partner: {partner}")
    try:
        print("?? Starting combined map data and stats fetch from NocoDB")
        # NocoDB configuration
        nocodb_api_url = os.getenv("NOCODB_API_URL", "https://nocodb.edbmotte.com")
        api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_projects_table_id = os.getenv("NOCODB_PROJECTS_TABLE_ID", "mftsk8hkw23m8q1")
        land_plots_table_id = os.getenv("NOCODB_PLOTS_TABLE_ID", "mmqclkrvx9lbtpc")  # Use environment variable
        
        print(f"?? API URL: {nocodb_api_url}")
        print(f"?? Token present: {bool(api_token)}")
        print(f"?? Projects table ID: {nocodb_projects_table_id}")
        print(f"?? Plots table ID: {land_plots_table_id}")
        
        if not api_token:
            return JSONResponse(
                content={"error": "NOCODB_API_TOKEN not set"}, 
                status_code=500
            )
        
        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }
        
        # First, fetch projects to build partner mapping
        projects_api_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_projects_table_id}/records"
        print(f"?? Projects API URL: {projects_api_url}")
        projects_response = requests.get(projects_api_url, headers=headers, params={"limit": 1000}, verify=False)
        projects_response.raise_for_status()
        projects_data = projects_response.json()
        print(f"?? Projects data keys: {list(projects_data.keys()) if projects_data else 'None'}")
        print(f"?? Projects list length: {len(projects_data.get('list', [])) if projects_data else 0}")
        
        # Build mapping of project ID to partner
        project_partner_map = {}
        unique_projects = set()
        for project in projects_data.get('list', []):
            project_id = project.get('Id')
            partner_name = project.get('Primary Project Partner', '').strip()
            if project_id:
                project_partner_map[project_id] = partner_name
                unique_projects.add(project_id)  # Track unique projects
        
        print(f"?? Built partner mapping for {len(project_partner_map)} projects")
        print(f"?? Total unique projects: {len(unique_projects)}")
        
        # Fetch land plots data from NocoDB
        api_url = f"{nocodb_api_url}/api/v2/tables/{land_plots_table_id}/records"
        print(f"?? Making request to: {api_url}")
        response = requests.get(api_url, headers=headers, params={"limit": 1000}, verify=False)
        print(f"? Response status: {response.status_code}")
        response.raise_for_status()
        data = response.json()
        print(f"?? Got {len(data.get('list', []))} records from NocoDB")
        
        plots = []
        countries = set()
        secured_sites = 0
        sites_with_coords = 0
        
        for record in data.get('list', []):
            # Look for coordinates in GeoData field (Field ID: cm98xmz0s2px4iu)
            coordinates = record.get('Coordinates')  # Display name
            if not coordinates:
                # Try the field ID directly if display name doesn't work
                coordinates = record.get('cm98xmz0s2px4iu')
            
            has_valid_coords = False
            if coordinates:
                try:
                    # Verify coordinates can be parsed
                    if ';' not in coordinates:
                        has_valid_coords = False
                    else:
                        lat_str, lon_str = coordinates.split(';')
                        if lat_str and lon_str:
                            float(lat_str.strip())
                            float(lon_str.strip())
                            has_valid_coords = True
                            sites_with_coords += 1
                    
                    if record.get('Country'):
                        countries.add(record['Country'])
                    
                    secure_status = record.get('Secure Status', '')
                    if secure_status and 'secured' in secure_status.lower():
                        secured_sites += 1
                        
                except (ValueError, AttributeError):
                    has_valid_coords = False
            
            if not has_valid_coords:
                continue
                
            plot = {
                'id': record.get('Id'),
                'project_id': record.get('Projects'),  # This might be a foreign key ID
                'Primary_Project_Partner': project_partner_map.get(record.get('Projects'), 'N/A'),  # Use mapping
                'Project_Name': record.get('Project Name', ''),
                'Plot_Name': record.get('Plot Name', f"Plot {record.get('Id')}"),
                'Description': record.get('Description', ''),
                'Coordinates': coordinates,  # Keep as string in "lat;lon" format
                'Plot_Address': record.get('Plot Address', ''),
                'landsize': record.get('Size (ha) - Primary Plot'),
                'Site_Elevation_m': record.get('Site Elevation (m)', '0'),
                'Size__ha____Primary_Plot': record.get('Size (ha) - Primary Plot', '0')
            }
            plots.append(plot)
        
        # Filter by partner if specified (case-insensitive)
        if partner and partner != 'all' and partner != '':
            print(f"?? Filtering by partner: '{partner}'")
            filtered_plots = []
            for plot in plots:
                plot_partner = plot.get('Primary_Project_Partner', '').strip()
                if plot_partner and plot_partner.lower() == partner.lower():
                    filtered_plots.append(plot)
            plots = filtered_plots
            print(f"?? After filtering: {len(plots)} plots")
        
        # Calculate statistics
        stats = {
            "total_projects": len(unique_projects),  # Unique projects count
            "total_plots": sites_with_coords,
            "sites_with_coords": sites_with_coords,
            "sites_with_geojson": 0,  # Not implemented yet
            "countries": len(countries),
            "secured_sites": secured_sites
        }
            
        return JSONResponse(content={
            "sites": plots,
            "stats": stats,  # Stats at the bottom as requested
            "count": len(plots),
            "partner_filter": partner if partner != "all" else None
        })
        
    except Exception as e:
        import traceback
        print(f"? NocoDB error: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        return JSONResponse(
            content={"error": f"Failed to load map data: {str(e)}"}, 
            status_code=500
        )

@app.get('/api/nocodb/map-stats', tags=["Map"])
def get_nocodb_map_stats():
    """Get map statistics from NocoDB"""
    try:
        # NocoDB configuration
        nocodb_api_url = os.getenv("NOCODB_API_URL", "https://nocodb.edbmotte.com")
        api_token = os.getenv("NOCODB_API_TOKEN")
        land_plots_table_id = os.getenv("NOCODB_PLOTS_TABLE_ID", "mmqclkrvx9lbtpc")  # Use environment variable
        
        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }
        
        # Fetch land plots data from NocoDB
        api_url = f"{nocodb_api_url}/api/v2/tables/{land_plots_table_id}/records"
        response = requests.get(api_url, headers=headers, params={"limit": 1000}, verify=False)
        response.raise_for_status()
        data = response.json()
        
        total_sites = 0
        countries = set()
        secured_sites = 0
        
        for record in data.get('list', []):
            # Look for coordinates in GeoData field
            coordinates = record.get('Coordinates')
            if not coordinates:
                coordinates = record.get('cm98xmz0s2px4iu')
            
            if coordinates:
                try:
                    # Verify coordinates can be parsed
                    lat_str, lon_str = coordinates.split(';')
                    float(lat_str.strip())
                    float(lon_str.strip())
                    
                    total_sites += 1
                    if record.get('Country'):
                        countries.add(record['Country'])
                    
                    secure_status = record.get('Secure Status', '')
                    if secure_status and 'secured' in secure_status.lower():
                        secured_sites += 1
                        
                except (ValueError, AttributeError):
                    continue
        
        return JSONResponse(content={
            "total_projects": total_sites,  # For compatibility with existing frontend
            "total_plots": total_sites,
            "sites_with_coords": total_sites,
            "sites_with_geojson": 0,  # Not implemented yet
            "totalSites": total_sites,
            "countries": len(countries),
            "securedSites": secured_sites
        })
        
    except Exception as e:
        return JSONResponse(
            content={"error": f"Failed to load map stats: {str(e)}"}, 
            status_code=500
        )

@app.get("/companies", tags=["Companies"])
def get_companies_data(current_user: dict = Depends(get_current_user)):
    """Get all companies data from companies table with summary statistics"""
    try:
        # Connect to MySQL database directly
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "10.1.8.51"),
            user=os.getenv("DB_USER", "s42project"),
            password=os.getenv("DB_PASSWORD", "s42project"),
            database=os.getenv("DB_NAME", "nocodb"),
            port=int(os.getenv("DB_PORT", "3306")),
        )
        cursor = conn.cursor(dictionary=True)

        # Get all companies (not just BUSINESS type)
        cursor.execute('SELECT * FROM companies ORDER BY full_name')
        companies_data = cursor.fetchall()

        # Get summary statistics
        cursor.execute('SELECT type, COUNT(*) as count FROM companies GROUP BY type')
        type_stats = cursor.fetchall()

        cursor.execute('SELECT company_status, COUNT(*) as count FROM companies WHERE company_status IS NOT NULL GROUP BY company_status ORDER BY count DESC')
        status_stats = cursor.fetchall()

        cursor.close()
        conn.close()

        # Return all raw company data (like SELECT *)
        formatted_companies = []
        for company in companies_data:
            # Convert date objects to strings for JSON serialization
            company_dict = {}
            for key, value in company.items():
                if hasattr(value, 'isoformat'):  # Handle date/datetime objects
                    company_dict[key] = value.isoformat()
                else:
                    company_dict[key] = value
            formatted_companies.append(company_dict)

        # Calculate summary statistics
        total_companies = len(formatted_companies)
        active_companies = len([c for c in formatted_companies if c.get("company_status") == "Active"])
        dissolved_companies = len([c for c in formatted_companies if c.get("company_status") == "Dissolved"])

        return JSONResponse(content={
            "companies": formatted_companies,
            "summary": {
                "total_companies": total_companies,
                "active_companies": active_companies,
                "dissolved_companies": dissolved_companies,
                "type_breakdown": {stat["type"]: stat["count"] for stat in type_stats},
                "status_breakdown": {stat["company_status"]: stat["count"] for stat in status_stats}
            },
            "source": "MySQL companies table"
        })

    except mysql.connector.Error as e:
        return JSONResponse(
            content={"error": f"Database error: {str(e)}"},
            status_code=500
        )
    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"},
            status_code=500
        )


@app.get("/wise-accounts/hoyanger", tags=["Wise Accounts"])
def get_hoyanger_wise_accounts(current_user: dict = Depends(get_current_user)):
    """Get Hoyanger wise accounts data with live BTC conversions"""
    try:
        # Connect to MySQL database directly
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "10.1.8.51"),
            user=os.getenv("DB_USER", "s42project"),
            password=os.getenv("DB_PASSWORD", "s42project"),
            database=os.getenv("DB_NAME", "nocodb"),
            port=int(os.getenv("DB_PORT", "3306")),
        )
        cursor = conn.cursor(dictionary=True)

        # Get Hoyanger wise accounts ordered by currency
        cursor.execute("SELECT * FROM `wise_accounts` WHERE `name` LIKE '%hoyanger%' ORDER BY `currency` ASC")
        accounts_data = cursor.fetchall()

        cursor.close()
        conn.close()

        # Fetch live BTC exchange rates
        try:
            # Using CoinGecko API for live rates
            response = requests.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp,nok,usd', timeout=5)
            if response.status_code == 200:
                rates_data = response.json()
                btc_rates = {
                    'GBP': rates_data['bitcoin']['gbp'],
                    'NOK': rates_data['bitcoin']['nok'],
                    'USD': rates_data['bitcoin']['usd']
                }
            else:
                # Fallback to cached rates if API fails
                btc_rates = {
                    'GBP': 55000,
                    'NOK': 650000,
                    'USD': 60000
                }
        except Exception as e:
            print(f"Error fetching live rates: {e}")
            # Fallback to cached rates
            btc_rates = {
                'GBP': 55000,
                'NOK': 650000,
                'USD': 60000
            }

        # Process accounts and calculate conversions
        processed_accounts = []
        total_btc = 0

        for account in accounts_data:
            account_dict = {}
            for key, value in account.items():
                if hasattr(value, 'isoformat'):  # Handle date/datetime objects
                    account_dict[key] = value.isoformat()
                elif isinstance(value, Decimal):  # Handle Decimal objects
                    account_dict[key] = float(value)
                else:
                    account_dict[key] = value

            # Track BTC amounts for conversion
            if account_dict.get('currency') == 'BTC':
                amount_value = account_dict.get('amount_value', 0)
                if amount_value:
                    total_btc += float(amount_value)

            processed_accounts.append(account_dict)

        # Calculate conversions using live rates
        conversions = {
            'total_btc': total_btc,
            'btc_to_gbp': total_btc * btc_rates['GBP'],
            'btc_to_nok': total_btc * btc_rates['NOK'],
            'btc_to_usd': total_btc * btc_rates['USD'],
            'rates_source': 'live' if 'rates_data' in locals() else 'cached',
            'rates_timestamp': datetime.now().isoformat()
        }

        return JSONResponse(content={
            "accounts": processed_accounts,
            "conversions": conversions,
            "summary": {
                "total_accounts": len(processed_accounts),
                "total_btc_amount": total_btc,
                "currencies": list(set(account.get('currency') for account in processed_accounts if account.get('currency')))
            }
        })

    except mysql.connector.Error as e:
        return JSONResponse(
            content={"error": f"Database error: {str(e)}"},
            status_code=500
        )
    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"},
            status_code=500
        )

@app.get("/nocodb/{table_name}/{record_id}/comments", tags=["nocodb"])
def get_nocodb_comments(table_name: str, record_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get comments for a specific record using NocoDB v1 API.
    """
    print(f"DEBUG: get_nocodb_comments called with table_name={table_name}, record_id={record_id}")
    try:
        # Get user-specific NocoDB token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')

        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and isinstance(user_data, dict) and user_data.get('nocodb_api'):
                    user_token = user_data['nocodb_api']
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")

        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")

        if not api_token:
            return JSONResponse(content={"error": "No API token available"}, status_code=500)

        # Get table ID based on table_name
        table_id_map = {
            "projects": os.getenv("NOCODB_PROJECTS_TABLE_ID", "mftsk8hkw23m8q1"),
            "plots": os.getenv("NOCODB_PLOTS_TABLE_ID", "mmqclkrvx9lbtpc")
        }
        table_id = table_id_map.get(table_name)
        if not table_id:
            return JSONResponse(content={"error": f"Unknown table name: {table_name}"}, status_code=400)

        # NocoDB v1 API endpoint for comments
        nocodb_url = os.getenv("NOCODB_API_URL")
        api_url = f"{nocodb_url}/api/v1/db/meta/comments"

        # Set up headers for NocoDB v1 API
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token,  # v1 API uses xc-token header
            "xc-gui": "true"
        }

        # Parameters for getting comments
        params = {
            "row_id": record_id,
            "fk_model_id": table_id
        }

        # Make request to NocoDB v1 API
        response = requests.get(api_url, headers=headers, params=params, verify=False)

        if response.status_code == 200:
            comments_data = response.json()
            
            # Map email addresses to user names from database (batch query for efficiency)
            formatted_comments = []
            if isinstance(comments_data, list):
                # Collect all unique emails first
                all_emails = []
                for comment in comments_data:
                    user_email = comment.get("created_by") or comment.get("user")
                    if user_email:
                        all_emails.append(user_email)
                
                # Batch query for all user names
                email_to_name = get_user_names_batch(all_emails)
                
                # Format comments with user names
                for comment in comments_data:
                    user_email = comment.get("created_by") or comment.get("user")
                    user_name = email_to_name.get(user_email, user_email) if user_email else "Unknown User"
                    
                    # Add user_name field to comment
                    formatted_comment = comment.copy()
                    formatted_comment["user_email"] = user_email
                    formatted_comment["user_name"] = user_name
                    formatted_comments.append(formatted_comment)
            else:
                formatted_comments = comments_data
            
            return JSONResponse(content={
                "success": True,
                "comments": formatted_comments,
                "table_name": table_name,
                "record_id": record_id,
                "source": "NocoDB v1 API"
            })
        else:
            return JSONResponse(content={
                "error": f"NocoDB v1 API error: {response.status_code}",
                "message": response.text,
                "url": api_url
            }, status_code=response.status_code)

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.get("/nocodb/{table_name}/{record_id}/audit", tags=["nocodb"])
def get_nocodb_audit_trail(table_name: str, record_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get audit trail for a specific record.
    Note: NocoDB v2 API does not support audit trail functionality.
    This endpoint returns an informative message about the limitation.
    """
    return JSONResponse(content={
        "error": "Audit trail feature not available",
        "message": "NocoDB v2 API does not support audit trail functionality. Consider using NocoDB webhooks or implementing audit logging in your application.",
        "table_name": table_name,
        "record_id": record_id,
        "suggestion": "Use NocoDB webhooks to capture changes, or create an audit table with fields: record_id, action, old_value, new_value, user_id, timestamp",
        "alternative_approach": "Set up NocoDB webhooks to POST change events to your application for audit logging"
    })


# Pydantic model for comment creation
class CommentCreate(BaseModel):
    comment: str

# Pydantic models for comments table
class CommentRecord(BaseModel):
    id: Optional[int] = None
    record_id: str
    table_name: str
    comment_text: str
    user_id: str
    user_email: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# Pydantic models for audit table
class AuditRecord(BaseModel):
    id: Optional[int] = None
    record_id: str
    table_name: str
    action: str  # CREATE, UPDATE, DELETE
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    user_id: str
    user_email: str
    timestamp: Optional[datetime] = None
    field_changed: Optional[str] = None

@app.post("/nocodb/{table_name}/{record_id}/comments", tags=["nocodb"])
def create_nocodb_comment(table_name: str, record_id: str, comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    """
    Create a comment for a specific record using NocoDB v1 API.
    """
    try:
        # Get user-specific NocoDB token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')

        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and isinstance(user_data, dict) and user_data.get('nocodb_api'):
                    user_token = user_data['nocodb_api']
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")

        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")

        if not api_token:
            return JSONResponse(content={"error": "No API token available"}, status_code=500)

        # Get table ID based on table_name
        table_id_map = {
            "projects": os.getenv("NOCODB_PROJECTS_TABLE_ID", "mftsk8hkw23m8q1"),
            "plots": os.getenv("NOCODB_PLOTS_TABLE_ID", "mmqclkrvx9lbtpc")
        }
        table_id = table_id_map.get(table_name)
        if not table_id:
            return JSONResponse(content={"error": f"Unknown table name: {table_name}"}, status_code=400)

        # NocoDB v1 API endpoint for comments
        nocodb_url = os.getenv("NOCODB_API_URL")
        api_url = f"{nocodb_url}/api/v1/db/meta/comments"

        # Set up headers for NocoDB v1 API
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token,  # v1 API uses xc-token header
            "xc-gui": "true"
        }

        # Data for creating comment
        comment_payload = {
            "fk_model_id": table_id,
            "row_id": record_id,
            "comment": comment_data.comment
        }

        # Make request to NocoDB v1 API
        response = requests.post(api_url, headers=headers, json=comment_payload, verify=False)

        if response.status_code == 200:
            comment_result = response.json()
            return JSONResponse(content={
                "success": True,
                "comment": comment_result,
                "table_name": table_name,
                "record_id": record_id,
                "source": "NocoDB v1 API"
            })
        else:
            return JSONResponse(content={
                "error": f"NocoDB v1 API error: {response.status_code}",
                "message": response.text,
                "url": api_url
            }, status_code=response.status_code)

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


# ===== COMMENTS MANAGEMENT ENDPOINTS =====

@app.get("/comments/{table_name}/{record_id}", tags=["comments"])
def get_comments(table_name: str, record_id: str, current_user: dict = Depends(get_current_user)):
    """Get all comments for a specific record from the comments table"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        print(f"?? Getting API token for user: {user_email}")

        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and isinstance(user_data, dict) and user_data.get('nocodb_api'):
                    user_token = user_data['nocodb_api']
                    print(f"? Using user-specific NocoDB token")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        # Get comments table ID from environment
        comments_table_id = os.getenv("NOCODB_COMMENTS_TABLE_ID")
        if not comments_table_id:
            return JSONResponse(
                content={"error": "NOCODB_COMMENTS_TABLE_ID environment variable not set. Please create a comments table in NocoDB first."},
                status_code=500
            )
        
        # Validate required environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        if not nocodb_api_url:
            return JSONResponse(
                content={"error": "NOCODB_API_URL environment variable not set"},
                status_code=500
            )
        if not api_token:
            return JSONResponse(
                content={"error": "No API token available"},
                status_code=500
            )
        
        # Construct NocoDB API v2 URL for comments table with filter
        api_url = f"{nocodb_api_url}/api/v2/tables/{comments_table_id}/records"
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }
        
        # Filter for comments on this specific record and table
        params = {
            "q": f"record_id={record_id} && table_name={table_name}",
            "sort": "-created_at"  # Most recent first
        }
        
        # Make request to NocoDB API
        response = requests.get(api_url, headers=headers, params=params, verify=False)

        if response.status_code != 200:
            return JSONResponse(
                content={
                    "error": f"NocoDB API error: {response.status_code} - {response.text}",
                    "url": api_url
                },
                status_code=response.status_code
            )

        # Parse and return the comments data
        data = response.json()
        comments = data.get("list", [])
        
        # Format the response
        formatted_comments = []
        for comment in comments:
            formatted_comments.append({
                "id": comment.get("Id"),  # NocoDB auto-generated ID
                "record_id": comment.get("record_id"),
                "table_name": comment.get("table_name"),
                "comment_text": comment.get("comment_text"),
                "user_id": comment.get("user_id"),
                "user_email": comment.get("user_email"),
                "created_at": comment.get("created_at"),
                "updated_at": comment.get("updated_at")
            })
        
        return JSONResponse(content={
            "table": table_name,
            "record_id": record_id,
            "comments": formatted_comments,
            "total_count": len(formatted_comments)
        })

    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"},
            status_code=500
        )


@app.post("/comments/{table_name}/{record_id}", tags=["comments"])
def create_comment(table_name: str, record_id: str, comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    """Create a new comment for a specific record in the comments table"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        user_id = current_user.get('id', 'unknown')
        print(f"?? Getting API token for user: {user_email}")

        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and isinstance(user_data, dict) and user_data.get('nocodb_api'):
                    user_token = user_data['nocodb_api']
                    print(f"? Using user-specific NocoDB token")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        # Get comments table ID from environment
        comments_table_id = os.getenv("NOCODB_COMMENTS_TABLE_ID")
        if not comments_table_id:
            return JSONResponse(
                content={"error": "NOCODB_COMMENTS_TABLE_ID environment variable not set. Please create a comments table in NocoDB first."},
                status_code=500
            )
        
        # Validate required environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        if not nocodb_api_url:
            return JSONResponse(
                content={"error": "NOCODB_API_URL environment variable not set"},
                status_code=500
            )
        if not api_token:
            return JSONResponse(
                content={"error": "No API token available"},
                status_code=500
            )
        
        # Construct NocoDB API v2 URL for creating comment
        api_url = f"{nocodb_api_url}/api/v2/tables/{comments_table_id}/records"
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }

        # Prepare comment payload
        payload = {
            "record_id": record_id,
            "table_name": table_name,
            "comment_text": comment_data.comment,
            "user_id": str(user_id),
            "user_email": user_email or "unknown",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        # Make POST request to NocoDB API
        response = requests.post(api_url, json=payload, headers=headers, verify=False)

        if response.status_code not in [200, 201]:
            return JSONResponse(
                content={
                    "error": f"NocoDB API error: {response.status_code} - {response.text}",
                    "url": api_url
                },
                status_code=response.status_code
            )

        # Parse and return the response
        data = response.json()
        return JSONResponse(content={
            "table": table_name,
            "record_id": record_id,
            "comment_created": {
                "id": data.get("Id"),
                "comment_text": comment_data.comment,
                "user_email": user_email,
                "created_at": payload["created_at"]
            },
            "success": True
        })

    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"},
            status_code=500
        )


# ===== AUDIT TRAIL ENDPOINTS =====

@app.get("/audit/{table_name}/{record_id}", tags=["audit"])
def get_audit_trail(table_name: str, record_id: str, current_user: dict = Depends(get_current_user)):
    """Get audit trail for a specific record using NocoDB's built-in audit functionality"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        print(f"?? Getting API token for user: {user_email}")

        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and isinstance(user_data, dict) and user_data.get('nocodb_api'):
                    user_token = user_data['nocodb_api']
                    print(f"? Using user-specific NocoDB token")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        # Validate required environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        base_id = os.getenv("NOCODB_BASE_ID")
        if not nocodb_api_url or not base_id:
            return JSONResponse(
                content={"error": "NOCODB_API_URL or NOCODB_BASE_ID environment variables not set"},
                status_code=500
            )
        if not api_token:
            return JSONResponse(
                content={"error": "No API token available"},
                status_code=500
            )
        
        # Map table names to NocoDB table IDs
        table_id_map = {
            "projects": os.getenv("NOCODB_PROJECTS_TABLE_ID"),
            "plots": os.getenv("NOCODB_PLOTS_TABLE_ID"),
            "sites": os.getenv("NOCODB_PLOTS_TABLE_ID"),  # plots and sites are the same table
        }
        
        table_id = table_id_map.get(table_name.lower())
        if not table_id:
            return JSONResponse(
                content={"error": f"Unknown table name: {table_name}. Supported: projects, plots, sites"},
                status_code=400
            )
        
        # Use NocoDB's internal audit API
        audit_url = f"{nocodb_api_url}/api/v2/internal/nc/{base_id}"
        params = {
            'operation': 'recordAuditList',
            'fk_model_id': table_id,
            'row_id': record_id,
            'cursor': ''
        }
        
        # Use admin token for internal audit API (requires elevated permissions)
        admin_api_token = os.getenv("NOCODB_API_TOKEN")  # Admin token from environment
        
        headers = {
            "xc-token": admin_api_token,
            "xc-auth": admin_api_token,
            "Content-Type": "application/json",
            "xc-gui": "true"
        }
        
        # Make request to NocoDB internal audit API
        response = requests.get(audit_url, params=params, headers=headers, verify=False)

        if response.status_code != 200:
            return JSONResponse(
                content={
                    "error": f"NocoDB audit API error: {response.status_code} - {response.text}",
                    "url": audit_url
                },
                status_code=response.status_code
            )

        # Parse and format the audit data
        data = response.json()
        audit_entries = data.get("list", [])
        
        # Collect all unique emails for batch lookup
        all_emails = []
        for entry in audit_entries:
            user_email = entry.get("user")
            if user_email:
                all_emails.append(user_email)
        
        # Batch query for all user names
        email_to_name = get_user_names_batch(all_emails)
        
        # Format the response with user names from database
        formatted_audit = []
        for entry in audit_entries:
            user_email = entry.get("user")
            user_name = email_to_name.get(user_email, user_email) if user_email else "Unknown User"
            
            # Parse the details field which contains old_data and new_data
            details = entry.get("details", {})
            old_data = None
            new_data = None
            
            if isinstance(details, str):
                try:
                    details = json.loads(details)
                except:
                    details = {}
            
            if isinstance(details, dict):
                old_data = details.get("old_data")
                new_data = details.get("new_data")
            
            formatted_audit.append({
                "id": entry.get("id"),
                "record_id": entry.get("row_id"),
                "table_name": table_name,
                "action": entry.get("op_type", "UPDATE"),
                "old_values": old_data,
                "new_values": new_data,
                "details": entry.get("details"),  # Keep original details field
                "user_id": None,  # Not provided in internal API
                "user_email": user_email,
                "user_name": user_name,
                "timestamp": entry.get("created_at") or entry.get("updated_at"),
                "ip_address": entry.get("ip"),
                "description": entry.get("description")
            })
        
        return JSONResponse(content={
            "table": table_name,
            "record_id": record_id,
            "audit_trail": formatted_audit,
            "total_count": len(formatted_audit),
            "source": "nocodb_internal_api"
        })

    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"},
            status_code=500
        )


@app.post("/audit/{table_name}/{record_id}", tags=["audit"])
def create_audit_entry(table_name: str, record_id: str, audit_data: dict, current_user: dict = Depends(get_current_user)):
    """Create a new audit entry for a specific record (typically called by webhooks or application logic)"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        user_id = current_user.get('id', 'unknown')
        print(f"?? Getting API token for user: {user_email}")

        if user_email:
            try:
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "s42project"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                if user_data and isinstance(user_data, dict) and user_data.get('nocodb_api'):
                    user_token = user_data['nocodb_api']
                    print(f"? Using user-specific NocoDB token")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        # Get audit table ID from environment
        audit_table_id = os.getenv("NOCODB_AUDIT_TABLE_ID")
        if not audit_table_id:
            return JSONResponse(
                content={"error": "NOCODB_AUDIT_TABLE_ID environment variable not set. Please create an audit table in NocoDB first."},
                status_code=500
            )
        
        # Validate required environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        if not nocodb_api_url:
            return JSONResponse(
                content={"error": "NOCODB_API_URL environment variable not set"},
                status_code=500
            )
        if not api_token:
            return JSONResponse(
                content={"error": "No API token available"},
                status_code=500
            )
        
        # Construct NocoDB API v2 URL for creating audit entry
        api_url = f"{nocodb_api_url}/api/v2/tables/{audit_table_id}/records"
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }

        # Prepare audit payload
        payload = {
            "record_id": record_id,
            "table_name": table_name,
            "action": audit_data.get("action", "UPDATE"),
            "old_values": audit_data.get("old_values"),
            "new_values": audit_data.get("new_values"),
            "user_id": str(user_id),
            "user_email": user_email or "unknown",
            "timestamp": datetime.now().isoformat(),
            "field_changed": audit_data.get("field_changed")
        }

        # Make POST request to NocoDB API
        response = requests.post(api_url, json=payload, headers=headers, verify=False)

        if response.status_code not in [200, 201]:
            return JSONResponse(
                content={
                    "error": f"NocoDB API error: {response.status_code} - {response.text}",
                    "url": api_url
                },
                status_code=response.status_code
            )

        # Parse and return the response
        data = response.json()
        return JSONResponse(content={
            "table": table_name,
            "record_id": record_id,
            "audit_entry_created": {
                "id": data.get("Id"),
                "action": payload["action"],
                "user_email": user_email,
                "timestamp": payload["timestamp"]
            },
            "success": True
        })

    except Exception as e:
        return JSONResponse(
            content={"error": f"Unexpected error: {str(e)}"},
            status_code=500
        )


# ===== WEBHOOK ENDPOINTS FOR AUDIT TRAILS =====

@app.post("/webhooks/nocodb/audit", tags=["webhooks"])
async def nocodb_audit_webhook(request: Request):
    """Webhook endpoint to receive NocoDB events and create audit entries"""
    try:
        # Get the webhook payload
        payload = await request.json()
        print(f"?? Received NocoDB webhook: {json.dumps(payload, indent=2)}")

        # Extract relevant data from webhook
        event_type = payload.get("type")  # AFTER_INSERT, AFTER_UPDATE, AFTER_DELETE
        table_name = payload.get("data", {}).get("table_name")
        record_data = payload.get("data", {}).get("row", {})

        if not table_name or not record_data:
            return JSONResponse(content={"status": "ignored", "reason": "Missing table_name or row data"})

        # Map webhook event types to audit actions
        action_map = {
            "AFTER_INSERT": "CREATE",
            "AFTER_UPDATE": "UPDATE",
            "AFTER_DELETE": "DELETE"
        }

        action = action_map.get(event_type, "UNKNOWN")
        if action == "UNKNOWN":
            return JSONResponse(content={"status": "ignored", "reason": f"Unknown event type: {event_type}"})

        # Get record ID (assuming 'Id' is the primary key)
        record_id = str(record_data.get("Id", "unknown"))

        # For updates, we need to compare old and new values
        # This is a simplified version - in practice, you'd need to fetch the previous state
        old_values = payload.get("data", {}).get("previous_row")
        new_values = record_data

        # Prepare audit data
        audit_data = {
            "action": action,
            "old_values": old_values,
            "new_values": new_values,
            "field_changed": payload.get("data", {}).get("changed_columns", [])
        }

        # Get audit table ID from environment
        audit_table_id = os.getenv("NOCODB_AUDIT_TABLE_ID")
        if not audit_table_id:
            print("??  NOCODB_AUDIT_TABLE_ID not set, skipping audit entry")
            return JSONResponse(content={"status": "skipped", "reason": "Audit table not configured"})

        # Get API token (use environment token for webhooks)
        api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_api_url = os.getenv("NOCODB_API_URL")

        if not api_token or not nocodb_api_url:
            print("??  NocoDB API credentials not set, skipping audit entry")
            return JSONResponse(content={"status": "skipped", "reason": "API credentials not configured"})

        # Create audit entry
        api_url = f"{nocodb_api_url}/api/v2/tables/{audit_table_id}/records"
        headers = {
            "xc-token": api_token,
            "Content-Type": "application/json"
        }

        audit_payload = {
            "record_id": record_id,
            "table_name": table_name,
            "action": action,
            "old_values": json.dumps(old_values) if old_values else None,
            "new_values": json.dumps(new_values) if new_values else None,
            "user_id": "webhook",  # Could be enhanced to track actual user
            "user_email": "system@nocodb-webhook.com",
            "timestamp": datetime.now().isoformat(),
            "field_changed": json.dumps(audit_data.get("field_changed", []))
        }

        response = requests.post(api_url, json=audit_payload, headers=headers, verify=False)

        if response.status_code in [200, 201]:
            print(f"? Audit entry created for {table_name}/{record_id} - {action}")
            return JSONResponse(content={"status": "success", "audit_entry_created": True})
        else:
            print(f"? Failed to create audit entry: {response.status_code} - {response.text}")
            return JSONResponse(content={"status": "error", "reason": "Failed to create audit entry"})

    except Exception as e:
        print(f"? Webhook error: {str(e)}")
        return JSONResponse(
            content={"status": "error", "reason": str(e)},
            status_code=500
        )

# Management Accounts API endpoints
@app.get("/management-accounts", tags=["management-accounts"])
async def get_management_accounts():
    """Get all management accounts data including companies, accounts, directors, and documents"""
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database='management_accounts',
            port=int(os.getenv('DB_PORT', '3306'))
        )
        cursor = connection.cursor(dictionary=True)

        # Fetch companies
        cursor.execute('SELECT * FROM companies ORDER BY full_name ASC, name ASC')
        companies = cursor.fetchall()

        # Fetch accounts with company information, sorted by balance descending
        cursor.execute("""
            SELECT a.*, c.full_name as company_name, c.name as company_short_name
            FROM accounts a 
            LEFT JOIN companies c ON a.company_id = c.id 
            ORDER BY a.balance DESC
        """)
        accounts = cursor.fetchall()

        # Fetch directors (if table exists)
        directors = []
        try:
            cursor.execute('SELECT * FROM directors ORDER BY name ASC')
            directors = cursor.fetchall()
        except mysql.connector.Error:
            print('Directors table not found, creating empty array')

        # Fetch documents (if table exists)
        documents = []
        try:
            cursor.execute('SELECT * FROM documents ORDER BY uploaded_at DESC')
            documents = cursor.fetchall()
        except mysql.connector.Error:
            print('Documents table not found, creating empty array')

        cursor.close()
        connection.close()

        return {
            "companies": companies,
            "accounts": accounts,
            "directors": directors,
            "documents": documents
        }

    except Exception as e:
        print(f"? Management accounts error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.post("/management-accounts/companies", tags=["management-accounts"])
async def create_company(request: Request):
    """Create a new company"""
    try:
        body = await request.json()
        
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database='management_accounts',
            port=int(os.getenv('DB_PORT', '3306'))
        )
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO companies (name, full_name, registration_number, address, country, website, email, phone)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            body.get('name', ''),
            body.get('full_name', ''),
            body.get('registration_number', ''),
            body.get('address', ''),
            body.get('country', ''),
            body.get('website', ''),
            body.get('email', ''),
            body.get('phone', '')
        ))

        connection.commit()
        new_id = cursor.lastrowid
        cursor.close()
        connection.close()

        return {"id": new_id, "message": "Company created successfully"}

    except Exception as e:
        print(f"? Create company error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

@app.post("/management-accounts/accounts", tags=["management-accounts"])
async def create_account(request: Request):
    """Create a new account"""
    try:
        body = await request.json()
        
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database='management_accounts',
            port=int(os.getenv('DB_PORT', '3306'))
        )
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO accounts (company_id, account_name, account_number, bank_name, currency, balance, account_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            body.get('company_id'),
            body.get('account_name', ''),
            body.get('account_number', ''),
            body.get('bank_name', ''),
            body.get('currency', 'GBP'),
            body.get('balance', 0),
            body.get('account_type', 'current')
        ))

        connection.commit()
        new_id = cursor.lastrowid
        cursor.close()
        connection.close()

        return {"id": new_id, "message": "Account created successfully"}

    except Exception as e:
        print(f"? Create account error: {str(e)}")
        return JSONResponse(
            content={"error": str(e)},
            status_code=500
        )

# ===================================================================
# ?? PAGE ACCESS CONTROL MANAGEMENT  
# ===================================================================

class PageCreate(BaseModel):
    name: str
    path: str
    icon: Optional[str] = None
    category: Optional[str] = "Tools"
    is_external: bool = False
    url: Optional[str] = None
    description: Optional[str] = None

class PageUpdate(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    is_external: Optional[bool] = None
    url: Optional[str] = None
    description: Optional[str] = None

class PagePermissionUpdate(BaseModel):
    page_id: int
    group_ids: list[int]

class PageOrderUpdate(BaseModel):
    page_id: int
    display_order: int

class BulkPageOrderUpdate(BaseModel):
    updates: list[PageOrderUpdate]

# Endpoint to persist page order
@app.put("/pages/reorder", tags=["pages"])
async def reorder_pages(order_update: BulkPageOrderUpdate):
    """Update the display order of multiple pages."""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Debug: Check if column exists
        cursor.execute("SHOW COLUMNS FROM pages LIKE 'display_order'")
        column_check = cursor.fetchone()
        print(f"?? display_order column check: {column_check}")
        
        if not column_check:
            print("? display_order column does NOT exist! Running migration...")
            try:
                cursor.execute("ALTER TABLE pages ADD COLUMN display_order INT DEFAULT 0 AFTER description")
                conn.commit()
                print("? Added display_order column")
            except Exception as e:
                print(f"? Failed to add column: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Column doesn't exist and migration failed: {str(e)}")
        
        for update in order_update.updates:
            sql = "UPDATE pages SET display_order = %s WHERE id = %s AND is_active = TRUE"
            params = (update.display_order, update.page_id)
            print(f"?? Executing: {sql} with params {params}")
            cursor.execute(sql, params)
            
        conn.commit()
        cursor.close()
        conn.close()
        print(f"? Reordered pages: {[u.page_id for u in order_update.updates]}")
        return {"message": "Page order updated successfully"}
    except Exception as e:
        print(f"? Error reordering pages: {str(e)}")
        if 'conn' in locals() and 'cursor' in locals():
            try:
                cursor.close()
                conn.close()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))

# NocoDB table IDs for page management
PAGES_TABLE_ID = "pages"  # Will be created if doesn't exist
PAGE_PERMISSIONS_TABLE_ID = "page_permissions"  # Will be created if doesn't exist
GROUPS_TABLE_ID = "groups"  # Should already exist
USERS_TABLE_ID = "users"  # Should already exist

def get_nocodb_connection():
    """Get NocoDB API configuration"""
    return {
        "api_token": os.getenv("NOCODB_API_TOKEN"),
        "base_url": os.getenv("NOCODB_API_URL"),
        "headers": {
            "xc-token": os.getenv("NOCODB_API_TOKEN"),
            "Content-Type": "application/json"
        }
    }

@app.post("/pages", tags=["pages"])
async def create_page(page: PageCreate):
    """Create a new page for access control"""
    try:
        config = get_nocodb_connection()
        
        # Create the page record in NocoDB
        page_data = {
            "name": page.name,
            "path": page.path,
            "icon": page.icon,
            "category": page.category,
            "is_external": page.is_external,
            "url": page.url,
            "description": page.description
        }
        
        response = requests.post(
            f"{config['base_url']}/api/v2/tables/{PAGES_TABLE_ID}/records",
            headers=config["headers"],
            json=page_data,
            verify=False
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to create page: {response.text}")
        
        result = response.json()
        page_id = result.get("Id") or result.get("id")
        
        print(f"? Created page: {page.name} (ID: {page_id})")
        
        return {"id": page_id, "message": "Page created successfully"}
        
    except requests.RequestException as e:
        print(f"? API error creating page: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error creating page: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pages", tags=["pages"])
async def get_pages():
    """Get all pages with their permissions"""
    try:
        config = get_nocodb_connection()
        
        # Get all pages
        response = requests.get(
            f"{config['base_url']}/api/v2/tables/{PAGES_TABLE_ID}/records",
            headers=config["headers"],
            params={"limit": 1000},
            verify=False
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to fetch pages: {response.text}")
        
        pages_data = response.json()
        pages = pages_data.get("list", [])
        
        # For each page, get its permissions (groups that can access it)
        for page in pages:
            page_id = page.get("Id") or page.get("id")
            
            # Get page permissions
            perm_response = requests.get(
                f"{config['base_url']}/api/v2/tables/{PAGE_PERMISSIONS_TABLE_ID}/records",
                headers=config["headers"],
                params={"where": f"(page_id,eq,{page_id})", "limit": 100},
                verify=False
            )
            
            if perm_response.status_code == 200:
                permissions = perm_response.json().get("list", [])
                page["group_ids"] = [p.get("group_id") for p in permissions if p.get("group_id")]
                page["allowed_groups"] = []  # Will be populated with group names in frontend
            else:
                page["group_ids"] = []
                page["allowed_groups"] = []
        
        return pages
        
    except requests.RequestException as e:
        print(f"? API error fetching pages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error fetching pages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/pages/user/{user_email}", tags=["pages"])
async def get_user_pages(user_email: str):
    """Get pages accessible by a specific user based on their groups"""
    try:
        config = get_nocodb_connection()
        
        # First, get the user's groups
        user_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{USERS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": f"(email,eq,{user_email})", "limit": 1},
            verify=False
        )
        
        if user_response.status_code != 200:
            raise HTTPException(status_code=404, detail="User not found")
        
        users = user_response.json().get("list", [])
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = users[0]
        user_groups = user.get("groups", [])
        
        if not user_groups:
            return []  # No groups, no accessible pages
        
        # Get all page permissions for these groups
        group_filter = " or ".join([f"(group_id,eq,{gid})" for gid in user_groups])
        perm_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{PAGE_PERMISSIONS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": f"({group_filter})", "limit": 1000},
            verify=False
        )
        
        if perm_response.status_code != 200:
            return []
        
        permissions = perm_response.json().get("list", [])
        accessible_page_ids = list(set([p.get("page_id") for p in permissions if p.get("page_id")]))
        
        if not accessible_page_ids:
            return []
        
        # Get the actual page details
        page_filter = " or ".join([f"(Id,eq,{pid})" for pid in accessible_page_ids])
        pages_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{PAGES_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": f"({page_filter})", "limit": 1000},
            verify=False
        )
        
        if pages_response.status_code != 200:
            return []
        
        pages = pages_response.json().get("list", [])
        
        # Sort by category and name
        pages.sort(key=lambda x: (x.get("category", ""), x.get("name", "")))
        
        return pages
        
    except requests.RequestException as e:
        print(f"? API error fetching user pages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error fetching user pages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/pages/{page_id}/permissions", tags=["pages"])
async def update_page_permissions(page_id: int, permission_update: PagePermissionUpdate):
    """Update which groups can access a specific page - MySQL version"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # First, deactivate existing permissions for this page
        cursor.execute(
            "UPDATE page_permissions SET is_active = FALSE WHERE page_id = %s",
            (page_id,)
        )
        
        # Add new permissions
        for group_id in permission_update.group_ids:
            # Check if permission already exists (was deactivated)
            cursor.execute(
                "SELECT id FROM page_permissions WHERE page_id = %s AND group_id = %s",
                (page_id, group_id)
            )
            existing = cursor.fetchone()
            
            if existing:
                # Reactivate existing permission
                cursor.execute(
                    "UPDATE page_permissions SET is_active = TRUE, permission_level = 'read' WHERE id = %s",
                    (existing['id'],)
                )
            else:
                # Create new permission
                cursor.execute(
                    """INSERT INTO page_permissions (page_id, group_id, permission_level, is_active) 
                       VALUES (%s, %s, 'read', TRUE)""",
                    (page_id, group_id)
                )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"? Updated permissions for page {page_id}: groups {permission_update.group_ids}")
        
        return {"message": "Page permissions updated successfully"}
        
    except Exception as e:
        print(f"? Error updating page permissions: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
            cursor.close()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/pages/{page_id}", tags=["pages"])
async def update_page(page_id: int, page_update: PageUpdate):
    """Update a page using MySQL directly"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Build the UPDATE query dynamically based on provided fields
        update_fields = []
        values = []
        
        if page_update.name is not None:
            update_fields.append("name = %s")
            values.append(page_update.name)
        if page_update.path is not None:
            update_fields.append("path = %s")
            values.append(page_update.path)
        if page_update.icon is not None:
            update_fields.append("icon = %s")
            values.append(page_update.icon)
        if page_update.category is not None:
            update_fields.append("category = %s")
            values.append(page_update.category)
        if page_update.is_external is not None:
            update_fields.append("is_external = %s")
            values.append(page_update.is_external)
        if page_update.url is not None:
            update_fields.append("url = %s")
            values.append(page_update.url)
        if page_update.description is not None:
            update_fields.append("description = %s")
            values.append(page_update.description)
        
        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Add page_id to values for WHERE clause
        values.append(page_id)
        
        # Execute the update
        update_query = f"UPDATE pages SET {', '.join(update_fields)} WHERE id = %s AND is_active = TRUE"
        print(f"?? UPDATE query: {update_query}")
        print(f"?? Values: {values}")
        cursor.execute(update_query, values)
        print(f"?? Rows affected: {cursor.rowcount}")
        
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Page not found")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"? Updated page {page_id}")
        return {"message": "Page updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"? Error updating page: {str(e)}")
        if 'conn' in locals() and 'cursor' in locals():
            try:
                conn.rollback()
                cursor.close()
                conn.close()
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/pages/{page_id}", tags=["pages"])
async def delete_page(page_id: int):
    """Delete a page and its permissions"""
    try:
        config = get_nocodb_connection()
        
        # Delete page permissions first
        perm_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{PAGE_PERMISSIONS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": f"(page_id,eq,{page_id})", "limit": 1000},
            verify=False
        )
        
        if perm_response.status_code == 200:
            permissions = perm_response.json().get("list", [])
            for perm in permissions:
                perm_id = perm.get("Id") or perm.get("id")
                requests.delete(
                    f"{config['base_url']}/api/v2/tables/{PAGE_PERMISSIONS_TABLE_ID}/records/{perm_id}",
                    headers=config["headers"],
                    verify=False
                )
        
        # Delete the page
        delete_response = requests.delete(
            f"{config['base_url']}/api/v2/tables/{PAGES_TABLE_ID}/records/{page_id}",
            headers=config["headers"],
            verify=False
        )
        
        if delete_response.status_code not in [200, 404]:
            raise HTTPException(status_code=500, detail=f"Failed to delete page: {delete_response.text}")
        
        print(f"? Deleted page {page_id}")
        
        return {"message": "Page deleted successfully"}
        
    except requests.RequestException as e:
        print(f"? API error deleting page: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error deleting page: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/pages/initialize", tags=["pages"])
async def initialize_default_pages():
    """Initialize default pages and assign them to public group"""
    try:
        config = get_nocodb_connection()
        
        # First, ensure public group exists
        public_group_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{GROUPS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": "(name,eq,public)", "limit": 1},
            verify=False
        )
        
        public_group_id = None
        if public_group_response.status_code == 200:
            groups = public_group_response.json().get("list", [])
            if groups:
                public_group_id = groups[0].get("Id") or groups[0].get("id")
        
        # Create public group if it doesn't exist
        if not public_group_id:
            group_data = {
                "name": "public",
                "description": "Default group for all users - access to basic pages",
                "permissions": '{"access_level": "basic"}'
            }
            
            group_response = requests.post(
                f"{config['base_url']}/api/v2/tables/{GROUPS_TABLE_ID}/records",
                headers=config["headers"],
                json=group_data,
                verify=False
            )
            
            if group_response.status_code == 200:
                result = group_response.json()
                public_group_id = result.get("Id") or result.get("id")
        
        if not public_group_id:
            raise HTTPException(status_code=500, detail="Failed to create or find public group")
        
        # Define default pages
        default_pages = [
            {"name": "Dashboard", "path": "/", "icon": "Home", "category": "Navigation", "is_external": False},
            {"name": "n8n", "path": "/tools/n8n", "icon": "Workflow", "category": "Tools", "is_external": True, 
             "url": "https://n8n.edbmotte.com/projects/A35bALSD6kzKLUi6/workflows"},
            {"name": "nocodb", "path": "/tools/nocodb", "icon": "Database", "category": "Tools", "is_external": True,
             "url": "https://nocodb.edbmotte.com/dashboard/#/nc/pjqgy4ri85jks06/mmqclkrvx9lbtpc"},
            {"name": "drive", "path": "/tools/drive", "icon": "HardDrive", "category": "Tools", "is_external": True,
             "url": "https://drive.google.com/drive/recent"},
            {"name": "notion", "path": "/tools/notion", "icon": "HardDrive", "category": "Tools", "is_external": True,
             "url": "https://www.notion.so"}
        ]
        
        created_pages = 0
        
        # Create default pages and assign to public group
        for page_def in default_pages:
            try:
                # Check if page already exists
                existing_response = requests.get(
                    f"{config['base_url']}/api/v2/tables/{PAGES_TABLE_ID}/records",
                    headers=config["headers"],
                    params={"where": f"(path,eq,{page_def['path']})", "limit": 1},
                    verify=False
                )
                
                page_id = None
                if existing_response.status_code == 200:
                    existing_pages = existing_response.json().get("list", [])
                    if existing_pages:
                        page_id = existing_pages[0].get("Id") or existing_pages[0].get("id")
                
                # Create page if it doesn't exist
                if not page_id:
                    page_data = {
                        "name": page_def["name"],
                        "path": page_def["path"],
                        "icon": page_def["icon"],
                        "category": page_def["category"],
                        "is_external": page_def["is_external"],
                        "url": page_def.get("url"),
                        "description": f"Default {page_def['name']} page"
                    }
                    
                    page_response = requests.post(
                        f"{config['base_url']}/api/v2/tables/{PAGES_TABLE_ID}/records",
                        headers=config["headers"],
                        json=page_data,
                        verify=False
                    )
                    
                    if page_response.status_code == 200:
                        result = page_response.json()
                        page_id = result.get("Id") or result.get("id")
                        created_pages += 1
                
                # Assign page to public group
                if page_id:
                    perm_data = {
                        "page_id": page_id,
                        "group_id": public_group_id
                    }
                    
                    requests.post(
                        f"{config['base_url']}/api/v2/tables/{PAGE_PERMISSIONS_TABLE_ID}/records",
                        headers=config["headers"],
                        json=perm_data,
                        verify=False
                    )
                
            except Exception as e:
                print(f"?? Error creating page {page_def['name']}: {str(e)}")
                continue
        
        print(f"? Initialized {created_pages} default pages and assigned to public group (ID: {public_group_id})")
        
        return {
            "message": "Default pages and public group initialized successfully",
            "public_group_id": public_group_id,
            "pages_created": created_pages
        }
        
    except requests.RequestException as e:
        print(f"? API error initializing pages: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error initializing pages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ?? USER MANAGEMENT WITH PUBLIC GROUP AUTO-ASSIGNMENT
# ===================================================================

USERS_TABLE_ID = "users"  # Should already exist
USER_GROUPS_TABLE_ID = "user_groups"  # Should already exist

@app.get("/api/users", tags=["users"])
async def get_all_users():
    """Get all users with their groups"""
    try:
        config = get_nocodb_connection()
        
        # Get all users
        response = requests.get(
            f"{config['base_url']}/api/v2/tables/{USERS_TABLE_ID}/records",
            headers=config["headers"],
            params={"limit": 1000},
            verify=False
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to fetch users: {response.text}")
        
        users_data = response.json()
        users = users_data.get("list", [])
        
        return users
        
    except requests.RequestException as e:
        print(f"? API error fetching users: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error fetching users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/groups", tags=["users"])
async def get_all_groups():
    """Get all groups"""
    try:
        config = get_nocodb_connection()
        
        response = requests.get(
            f"{config['base_url']}/api/v2/tables/{GROUPS_TABLE_ID}/records",
            headers=config["headers"],
            params={"limit": 1000},
            verify=False
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Failed to fetch groups: {response.text}")
        
        groups_data = response.json()
        groups = groups_data.get("list", [])
        
        return groups
        
    except requests.RequestException as e:
        print(f"? API error fetching groups: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error fetching groups: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/assign-to-public", tags=["users"])
async def assign_user_to_public_group(user_id: int):
    """Assign a user to the public group if not already assigned"""
    try:
        config = get_nocodb_connection()
        
        # Get public group
        public_group_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{GROUPS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": "(name,eq,public)", "limit": 1},
            verify=False
        )
        
        if public_group_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Could not find public group")
        
        groups = public_group_response.json().get("list", [])
        if not groups:
            raise HTTPException(status_code=500, detail="Public group does not exist")
        
        public_group_id = groups[0].get("Id") or groups[0].get("id")
        
        # Check if user is already in public group
        existing_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{USER_GROUPS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": f"(user_id,eq,{user_id}) and (group_id,eq,{public_group_id})", "limit": 1},
            verify=False
        )
        
        if existing_response.status_code == 200:
            existing = existing_response.json().get("list", [])
            if existing:
                return {"message": "User already in public group"}
        
        # Assign user to public group
        assignment_data = {
            "user_id": user_id,
            "group_id": public_group_id,
            "assigned_by": "system",
            "assigned_at": datetime.now().isoformat()
        }
        
        assign_response = requests.post(
            f"{config['base_url']}/api/v2/tables/{USER_GROUPS_TABLE_ID}/records",
            headers=config["headers"],
            json=assignment_data,
            verify=False
        )
        
        if assign_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to assign user to public group")
        
        print(f"? Assigned user {user_id} to public group")
        
        return {"message": "User assigned to public group successfully"}
        
    except requests.RequestException as e:
        print(f"? API error assigning user to public group: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error assigning user to public group: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/ensure-public-assignments", tags=["users"])
async def ensure_all_users_in_public_group():
    """Ensure all users are assigned to the public group"""
    try:
        config = get_nocodb_connection()
        
        # Get public group
        public_group_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{GROUPS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": "(name,eq,public)", "limit": 1},
            verify=False
        )
        
        if public_group_response.status_code != 200:
            return {"message": "Public group not found, skipping assignment"}
        
        groups = public_group_response.json().get("list", [])
        if not groups:
            return {"message": "Public group does not exist, skipping assignment"}
        
        public_group_id = groups[0].get("Id") or groups[0].get("id")
        
        # Get all users
        users_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{USERS_TABLE_ID}/records",
            headers=config["headers"],
            params={"limit": 1000},
            verify=False
        )
        
        if users_response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to fetch users")
        
        users = users_response.json().get("list", [])
        assigned_count = 0
        
        # Get existing assignments to public group
        assignments_response = requests.get(
            f"{config['base_url']}/api/v2/tables/{USER_GROUPS_TABLE_ID}/records",
            headers=config["headers"],
            params={"where": f"(group_id,eq,{public_group_id})", "limit": 1000},
            verify=False
        )
        
        existing_user_ids = set()
        if assignments_response.status_code == 200:
            assignments = assignments_response.json().get("list", [])
            existing_user_ids = set([a.get("user_id") for a in assignments if a.get("user_id")])
        
        # Assign users who aren't already in public group
        for user in users:
            user_id = user.get("Id") or user.get("id")
            if user_id and user_id not in existing_user_ids:
                assignment_data = {
                    "user_id": user_id,
                    "group_id": public_group_id,
                    "assigned_by": "system",
                    "assigned_at": datetime.now().isoformat()
                }
                
                assign_response = requests.post(
                    f"{config['base_url']}/api/v2/tables/{USER_GROUPS_TABLE_ID}/records",
                    headers=config["headers"],
                    json=assignment_data,
                    verify=False
                )
                
                if assign_response.status_code == 200:
                    assigned_count += 1
        
        print(f"? Assigned {assigned_count} users to public group")
        
        return {
            "message": f"Assigned {assigned_count} users to public group",
            "total_users": len(users),
            "newly_assigned": assigned_count
        }
        
    except requests.RequestException as e:
        print(f"? API error ensuring public assignments: {str(e)}")
        raise HTTPException(status_code=500, detail=f"API error: {str(e)}")
    except Exception as e:
        print(f"? Error ensuring public assignments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===================================================================
# ?? QUICK FIX: MANUAL USER GROUP ASSIGNMENT
# ===================================================================

@app.put("/users/{user_id}/group", tags=["User Management"])
def assign_user_to_group_manual(user_id: int, group_id: int, current_user: dict = Depends(get_current_user)):
    """Manually assign a user to a specific group"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Update user's group_id
        cursor.execute("UPDATE users SET group_id = %s WHERE id = %s", (group_id, user_id))
        
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"? Assigned user {user_id} to group {group_id}")
        
        return {"message": f"User {user_id} assigned to group {group_id} successfully"}
        
    except Exception as e:
        print(f"? Error assigning user to group: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/assign-scale42-users", tags=["User Management"])
def assign_scale42_users(current_user: dict = Depends(get_current_user)):
    """Assign all scale-42.com domain users to Scale42 group using the groups array field"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get all scale-42.com users
        cursor.execute("SELECT id, email, groups FROM users WHERE email LIKE '%@scale-42.com'")
        scale42_users = cursor.fetchall()
        
        updated_count = 0
        
        for user in scale42_users:
            user_id = user['id']
            current_groups = user.get('groups', [])
            
            # Convert to list if it's a string (JSON stored as string)
            if isinstance(current_groups, str):
                try:
                    import json
                    current_groups = json.loads(current_groups) if current_groups else []
                except:
                    current_groups = []
            elif current_groups is None:
                current_groups = []
            
            # Add Scale42 to groups if not already present
            if 'Scale42' not in current_groups:
                current_groups.append('Scale42')
                
                # Update the user's groups field
                import json
                groups_json = json.dumps(current_groups)
                cursor.execute("UPDATE users SET groups = %s WHERE id = %s", (groups_json, user_id))
                updated_count += 1
                print(f"? Assigned user {user['email']} (ID: {user_id}) to Scale42 group")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "message": f"Assigned {updated_count} Scale-42 users to Scale42 group",
            "updated_users": updated_count,
            "total_scale42_users": len(scale42_users)
        }
        
    except Exception as e:
        print(f"? Error assigning Scale-42 users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/assign-user-to-scale42/{user_email}", tags=["User Management"])
def assign_specific_user_to_scale42(user_email: str, current_user: dict = Depends(get_current_user)):
    """Assign a specific user to Scale42 group"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get the user
        cursor.execute("SELECT id, email, groups FROM users WHERE email = %s", (user_email,))
        user = cursor.fetchone()
        
        if not user:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = user['id']
        current_groups = user.get('groups', [])
        
        # Convert to list if it's a string (JSON stored as string)
        if isinstance(current_groups, str):
            try:
                import json
                current_groups = json.loads(current_groups) if current_groups else []
            except:
                current_groups = []
        elif current_groups is None:
            current_groups = []
        
        # Add Scale42 to groups if not already present
        if 'Scale42' not in current_groups:
            current_groups.append('Scale42')
            
            # Update the user's groups field
            import json
            groups_json = json.dumps(current_groups)
            cursor.execute("UPDATE users SET groups = %s WHERE id = %s", (groups_json, user_id))
            
            conn.commit()
            cursor.close()
            conn.close()
            
            print(f"? Assigned user {user_email} (ID: {user_id}) to Scale42 group")
            
            return {
                "message": f"User {user_email} assigned to Scale42 group successfully",
                "user_id": user_id,
                "new_groups": current_groups
            }
        else:
            cursor.close()
            conn.close()
            return {
                "message": f"User {user_email} already in Scale42 group",
                "user_id": user_id,
                "current_groups": current_groups
            }
        
    except Exception as e:
        print(f"? Error assigning user {user_email} to Scale42: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fix-scale42-users", tags=["User Management"])
def fix_scale42_users(current_user: dict = Depends(get_current_user)):
    """Fix all scale-42.com users to be assigned to Scale42 group"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get Scale42 group ID
        cursor.execute("SELECT id FROM groups WHERE name = 'Scale42'")
        scale42_group = cursor.fetchone()
        
        if not scale42_group:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Scale42 group not found")
        
        scale42_group_id = scale42_group[0]  # Access by index for MySQL cursor
        
        # Update all scale-42.com users to Scale42 group
        cursor.execute("""
            UPDATE users 
            SET group_id = %s 
            WHERE email LIKE %s 
            AND (group_id IS NULL OR group_id != %s)
        """, (scale42_group_id, '%@scale-42.com', scale42_group_id))
        
        updated_count = cursor.rowcount
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"? Fixed {updated_count} Scale-42 users")
        
        return {
            "message": f"Fixed {updated_count} Scale-42 users",
            "scale42_group_id": scale42_group_id,
            "updated_users": updated_count
        }
        
    except Exception as e:
        print(f"? Error fixing Scale-42 users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api-assign-user-to-scale42/{email}")
def api_assign_user_to_scale42(email: str):
    """Assign a user to Scale42 group using user_groups table - quick fix endpoint"""
    try:
        # Verify user has scale-42.com domain
        if not email.endswith('@scale-42.com'):
            return {"error": f"User {email} must have scale-42.com domain"}
            
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get the user
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        user_result = cursor.fetchone()
        
        if not user_result:
            cursor.close()
            conn.close()
            return {"error": f"User {email} not found"}
        
        user_id = user_result['id']
        
        # Get Scale42 group ID
        cursor.execute("SELECT id FROM groups WHERE name = 'Scale42' AND is_active = TRUE")
        group_result = cursor.fetchone()
        
        if not group_result:
            cursor.close()
            conn.close()
            return {"error": "Scale42 group not found"}
        
        scale42_group_id = group_result['id']
        
        # Check if user is already in Scale42 group
        cursor.execute("""
            SELECT id FROM user_groups 
            WHERE user_id = %s AND group_id = %s AND is_active = TRUE
        """, (user_id, scale42_group_id))
        existing_assignment = cursor.fetchone()
        
        if existing_assignment:
            cursor.close()
            conn.close()
            return {
                "status": "already_assigned",
                "message": f"{email} already in Scale42 group",
                "user_id": user_id,
                "group_id": scale42_group_id
            }
        
        # Insert new user-group assignment
        cursor.execute("""
            INSERT INTO user_groups (user_id, group_id, role, is_active) 
            VALUES (%s, %s, 'member', TRUE)
        """, (user_id, scale42_group_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "status": "success",
            "message": f"Added {email} to Scale42 group",
            "user_id": user_id,
            "scale42_group_id": scale42_group_id
        }
            
    except Exception as e:
        return {"error": f"Failed to assign user to Scale42 group: {str(e)}"}

@app.post("/migrate-display-order", tags=["pages"])
def migrate_display_order():
    """Add display_order column to pages table if it doesn't exist"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Add display_order column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE pages ADD COLUMN display_order INT DEFAULT 0 AFTER description")
            conn.commit()
            message = "? Added display_order column to pages table"
        except Exception as e:
            if "Duplicate column name" in str(e):
                message = "? display_order column already exists"
            else:
                raise e
        
        # Add index for display_order if it doesn't exist
        try:
            cursor.execute("ALTER TABLE pages ADD INDEX idx_display_order (display_order)")
            conn.commit()
            message += " and index"
        except Exception as e:
            if "Duplicate key name" not in str(e):
                message += f" (index warning: {str(e)})"
        
        cursor.close()
        conn.close()
        
        print(message)
        return {"status": "success", "message": message}
        
    except Exception as e:
        print(f"? Error migrating display_order: {str(e)}")
        if 'conn' in locals() and 'cursor' in locals():
            try:
                cursor.close()
                conn.close()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/setup-original-pages", tags=["pages"])
def setup_original_pages():
    """Set up the original pages using MySQL directly"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Create pages table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                path VARCHAR(255) NOT NULL UNIQUE,
                icon VARCHAR(100) DEFAULT 'Globe',
                category VARCHAR(100) DEFAULT 'Other',
                is_external BOOLEAN DEFAULT FALSE,
                url TEXT,
                description TEXT,
                display_order INT DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_path (path),
                INDEX idx_category (category),
                INDEX idx_active (is_active),
                INDEX idx_display_order (display_order)
            )
        """)
        
        # Add display_order column if it doesn't exist (migration)
        try:
            cursor.execute("ALTER TABLE pages ADD COLUMN display_order INT DEFAULT 0")
        except Exception:
            pass  # Column already exists
        
        # Add index for display_order if it doesn't exist
        try:
            cursor.execute("ALTER TABLE pages ADD INDEX idx_display_order (display_order)")
        except Exception:
            pass  # Index already exists
        
        # Create page_permissions table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS page_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                page_id INT NOT NULL,
                group_id INT NOT NULL,
                permission_level VARCHAR(50) DEFAULT 'read',
                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                granted_by INT,
                is_active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE KEY unique_page_group (page_id, group_id),
                INDEX idx_page_id (page_id),
                INDEX idx_group_id (group_id),
                INDEX idx_active (is_active)
            )
        """)
        
        # Define original pages
        original_pages = [
            ("Dashboard", "/dashboard", "Home", "Navigation", False, None, "Main dashboard"),
            ("Projects", "/projects", "FolderOpen", "Projects", False, None, "Project management"),
            ("Schema", "/schema", "Database", "Projects", False, None, "Database schema"),
            ("Map", "/map", "Map", "Projects", False, None, "Project map view"),
            ("Hoyanger", "/hoyanger", "Building", "Projects", False, None, "Hoyanger specific page"),
            ("Accounts", "/accounts", "CreditCard", "Financial", False, None, "Account management"),
            ("NocoDb", "/tools/nocodb", "Database", "Tools", False, None, "NocoDb admin"),
            ("N8N", "/tools/n8n", "Workflow", "Tools", False, None, "N8N automation"),
            ("Drive", "/tools/drive", "HardDrive", "Tools", False, None, "File storage"),
            ("Debug", "/debug", "Zap", "Development", False, None, "Debug tools"),
        ]
        
        # Get Public group ID (we created this earlier)
        cursor.execute("SELECT id FROM groups WHERE name = 'Public' AND is_active = TRUE")
        public_group = cursor.fetchone()
        if not public_group:
            conn.rollback()
            cursor.close()
            conn.close()
            return {"error": "Public group not found"}
        
        public_group_id = public_group['id']
        
        # Get Scale42 group ID
        cursor.execute("SELECT id FROM groups WHERE name = 'Scale42' AND is_active = TRUE")
        scale42_group = cursor.fetchone()
        scale42_group_id = scale42_group['id'] if scale42_group else None
        
        # Insert pages
        added_pages = []
        for page_data in original_pages:
            name, path, icon, category, is_external, url, description = page_data
            
            # Check if page already exists
            cursor.execute("SELECT id FROM pages WHERE path = %s", (path,))
            existing = cursor.fetchone()
            
            if not existing:
                cursor.execute("""
                    INSERT INTO pages (name, path, icon, category, is_external, url, description)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (name, path, icon, category, is_external, url, description))
                
                page_id = cursor.lastrowid
                
                # Give Public group access to basic pages
                if category in ['Navigation', 'Projects', 'Tools']:
                    cursor.execute("""
                        INSERT INTO page_permissions (page_id, group_id, permission_level)
                        VALUES (%s, %s, 'read')
                    """, (page_id, public_group_id))
                
                # Give Scale42 group access to all pages
                if scale42_group_id:
                    cursor.execute("""
                        INSERT INTO page_permissions (page_id, group_id, permission_level)
                        VALUES (%s, %s, 'admin')
                    """, (page_id, scale42_group_id))
                
                added_pages.append(name)
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "status": "success",
            "message": f"Set up {len(added_pages)} original pages",
            "pages_added": added_pages,
            "public_group_id": public_group_id,
            "scale42_group_id": scale42_group_id
        }
        
    except Exception as e:
        return {"error": f"Failed to set up original pages: {str(e)}"}

@app.get("/pages-mysql", tags=["pages"])
def get_pages_mysql():
    """Get all pages using MySQL directly"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT p.*, 
                   GROUP_CONCAT(
                       CONCAT(g.name, ':', pp.permission_level) 
                       ORDER BY g.name SEPARATOR '; '
                   ) as permissions
            FROM pages p
            LEFT JOIN page_permissions pp ON p.id = pp.page_id AND pp.is_active = TRUE
            LEFT JOIN groups g ON pp.group_id = g.id AND g.is_active = TRUE
            WHERE p.is_active = TRUE
            GROUP BY p.id
            ORDER BY p.display_order, p.category, p.name
        """)
        
        pages = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return pages
        
    except Exception as e:
        return {"error": f"Failed to fetch pages: {str(e)}"}

@app.get("/pages/user-mysql/{email}")
def get_user_pages_mysql(email: str):
    """Get pages accessible to a user using MySQL directly"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Get user's assigned groups (if user exists)
        cursor.execute("""
            SELECT DISTINCT g.id, g.name
            FROM users u
            JOIN user_groups ug ON u.id = ug.user_id AND ug.is_active = TRUE
            JOIN groups g ON ug.group_id = g.id AND g.is_active = TRUE
            WHERE u.email = %s AND u.is_active = TRUE
        """, (email,))
        
        user_groups = cursor.fetchall()
        
        # Always include Public group for all authenticated users (whether they exist in DB or not)
        cursor.execute("SELECT id, name FROM groups WHERE name = 'Public' AND is_active = TRUE")
        public_group = cursor.fetchone()
        
        # Collect all group IDs (user's assigned groups + Public group)
        group_ids = [str(group['id']) for group in user_groups]
        if public_group and str(public_group['id']) not in group_ids:  # type: ignore
            group_ids.append(str(public_group['id']))  # type: ignore
        
        if not group_ids:
            cursor.close()
            conn.close()
            return []
        
        placeholders = ','.join(['%s'] * len(group_ids))
        
        # Get pages accessible to user's groups (including Public)
        cursor.execute(f"""
            SELECT DISTINCT p.*
            FROM pages p
            JOIN page_permissions pp ON p.id = pp.page_id AND pp.is_active = TRUE
            WHERE pp.group_id IN ({placeholders}) AND p.is_active = TRUE
            ORDER BY p.display_order, p.category, p.name
        """, group_ids)
        
        pages = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return pages
        
    except Exception as e:
        return {"error": f"Failed to fetch user pages: {str(e)}"}

@app.post("/add-single-page", tags=["pages"])
def add_single_page(page_data: dict):
    """Add a single page with permissions"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Extract page data
        name = page_data.get('name')
        path = page_data.get('path')
        icon = page_data.get('icon', 'Globe')
        category = page_data.get('category', 'Other')
        is_external = page_data.get('is_external', False)
        url = page_data.get('url')
        description = page_data.get('description')
        
        if not name or not path:
            return {"error": "Name and path are required"}
        
        # Check if page already exists
        cursor.execute("SELECT id FROM pages WHERE path = %s", (path,))
        existing = cursor.fetchone()
        
        if existing:
            cursor.close()
            conn.close()
            return {"error": f"Page with path {path} already exists"}
        
        # Insert the page
        cursor.execute("""
            INSERT INTO pages (name, path, icon, category, is_external, url, description)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (name, path, icon, category, is_external, url, description))
        
        page_id = cursor.lastrowid
        
        # Get Scale42 group ID for permissions
        cursor.execute("SELECT id FROM groups WHERE name = 'Scale42' AND is_active = TRUE")
        scale42_result = cursor.fetchone()
        
        if scale42_result:
            # Access the id field directly (MySQL cursor returns dict-like objects)
            scale42_group_id = scale42_result['id'] if 'id' in scale42_result else None
            
            if scale42_group_id:
                cursor.execute("""
                    INSERT INTO page_permissions (page_id, group_id, permission_level)
                    VALUES (%s, %s, 'admin')
                """, (page_id, scale42_group_id))
        
        # For Management category, only give access to Scale42 group
        # For other categories, also give Public group read access
        if category not in ['Management']:
            cursor.execute("SELECT id FROM groups WHERE name = 'Public' AND is_active = TRUE")
            public_result = cursor.fetchone()
            
            if public_result:
                public_group_id = public_result['id'] if 'id' in public_result else None
                
                if public_group_id:
                    cursor.execute("""
                        INSERT INTO page_permissions (page_id, group_id, permission_level)
                        VALUES (%s, %s, 'read')
                    """, (page_id, public_group_id))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "status": "success",
            "message": f"Page '{name}' added successfully",
            "page_id": page_id,
            "path": path
        }
        
    except Exception as e:
        return {"error": f"Failed to add page: {str(e)}"}
