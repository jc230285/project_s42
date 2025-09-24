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
from typing import Optional, Any
from collections import OrderedDict
import base64
from . import nocodb_sync

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
        }
    ]
)

# Custom CORS middleware - handles all CORS requests
@app.middleware("http")
async def cors_handler(request, call_next):
    print(f"🌐 CORS Request: {request.method} {request.url}")
    print(f"🔍 Origin: {request.headers.get('origin', 'None')}")
    print(f"📋 Headers: {dict(request.headers)}")
    
    if request.method == "OPTIONS":
        print("✅ Handling OPTIONS preflight request")
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
            
            print(f"📋 Loaded {len(category_order_map)} category options and {len(subcategory_order_map)} subcategory options from table structure")
        else:
            print(f"⚠️  Failed to fetch table structure (status {table_response.status_code}), using fallback ordering")
    except Exception as e:
        print(f"⚠️  Exception fetching table structure: {e}, using fallback ordering")
    
    # If we couldn't get the dropdown orders, use fallback ordering
    if not category_order_map:
        print("📋 Using fallback category ordering")
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
    allow_origins=["https://s42.edbmotte.com", "http://localhost:3000", "http://localhost:3150"],
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
        response = requests.get(api_url, headers=headers, verify=False)
        
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
        
        # Apply partner filter if provided
        if partner_filter and partner_filter.strip():
            projects = [p for p in projects if p.get("Primary Project Partner") == partner_filter]
        
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
            "Primary Project Partner"
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
    print("✅ Specific OPTIONS handler for /projects/schema")
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
    print(f"✅ Universal OPTIONS handler for path: /{full_path}")
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
        print(f"🔑 Getting API token for user: {user_email}")
        
        if user_email:
            try:
                # Get user's NocoDB token from database
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "9JA_)j(WSqJUJ9Y]"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                print(f"🔍 Database query result for {user_email}: {user_data}")
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                    print(f"✅ Using user-specific NocoDB token for {user_email}: {str(user_token)[:20]}...")
                else:
                    print(f"⚠️ No user-specific token found for {user_email}, using admin token")
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
        
        print(f"📊 Raw NocoDB data structure:")
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
                print(f"🏷️ Found Category options: {category_options}")
            elif field_name == "Subcategory" and field_type == "SingleSelect":
                subcategory_options = parse_select_options(options_raw)
                print(f"🏷️ Found Subcategory options: {subcategory_options}")
        
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
            
            print(f"📋 Processing field '{record.get('Field Name')}': Category='{category_value}' (order: {category_order}), Subcategory='{subcategory_value}' (order: {subcategory_order})")
            
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
        
        print(f"✅ Processed {len(sorted_records)} schema records for frontend")
        print(f"📋 Found {len(category_options)} category options and {len(subcategory_options)} subcategory options")
        
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
def get_plots_data(current_user: dict = Depends(get_current_user), plot_ids: Optional[str] = Query(None, description="Comma-separated list of numeric plot IDs to filter by")):
    """Get detailed plots and projects data in export script format with schema and nested projects/plots structure"""
    from collections import OrderedDict
    
    try:
        # Parse numeric plot IDs from query parameter
        selected_plot_ids = []
        if plot_ids:
            selected_plot_ids = [int(pid.strip()) for pid in plot_ids.split(',') if pid.strip().isdigit()]
        
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
                    password=os.getenv("DB_PASSWORD", "9JA_)j(WSqJUJ9Y]"),
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
        # 2) DB CONNECT & HELPER FUNCTIONS
        # -------------------------
        DB_TABLES = {"Projects": "Projects", "Land Plots, Sites": "LandPlots"}
        
        def normalize_schema_name(name: str) -> str:
            """Normalize a schema 'Field Name' into a DB-like column key (lowercase)."""
            return (
                name.replace(" ", "_")
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
        
        def make_colmap(cursor, table_name: str):
            """Return mapping: normalized_lower_name -> actual DB column name."""
            cursor.execute(f"SHOW COLUMNS FROM `{table_name}`")
            m = {}
            for row in cursor.fetchall():
                col = row["Field"]
                m[col.lower()] = col                           # raw lowercase
                m[normalize_schema_name(col)] = col            # normalized lowercase
            return m
        
        def find_db_col(colmap: dict, schema_field_name: str):
            """Find actual DB column for a schema field name."""
            key1 = schema_field_name.lower()
            key2 = normalize_schema_name(schema_field_name)
            return colmap.get(key1) or colmap.get(key2)
        
        def ordered_values_for_row(row: dict, table_name: str, schema_fields_sorted: list, colmap: dict):
            """Build an OrderedDict of FieldID -> value for the given DB row."""
            result = OrderedDict()
            for f in schema_fields_sorted:
                if f["Table"] != table_name:
                    continue
                field_id = f["Field ID"]
                db_col = find_db_col(colmap, f["Field Name"])
                val = row.get(db_col) if db_col and db_col in row else None
                result[field_id] = val
            return result
        
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "10.1.8.51"),
            user=os.getenv("DB_USER", "s42project"),
            password=os.getenv("DB_PASSWORD", "9JA_)j(WSqJUJ9Y]"),
            database=os.getenv("DB_NAME", "nocodb"),
            port=int(os.getenv("DB_PORT", "3306")),
        )
        cursor = conn.cursor(dictionary=True)
        
        # Column maps
        colmap_projects = make_colmap(cursor, DB_TABLES["Projects"])
        colmap_landplots = make_colmap(cursor, DB_TABLES["Land Plots, Sites"])
        
        # -------------------------
        # 3) LOAD SELECTED LAND PLOTS
        # -------------------------
        if selected_plot_ids:
            placeholders = ",".join(["%s"] * len(selected_plot_ids))
            cursor.execute(f"SELECT * FROM `{DB_TABLES['Land Plots, Sites']}` WHERE id IN ({placeholders})", selected_plot_ids)
        else:
            cursor.execute(f"SELECT * FROM `{DB_TABLES['Land Plots, Sites']}`")
        
        plot_rows = cursor.fetchall() or []
        
        # Build plot objects with ordered values
        plots = []
        for r in plot_rows:
            values = ordered_values_for_row(
                r,
                "Land Plots, Sites",
                schema_by_table["Land Plots, Sites"],
                colmap_landplots,
            )
            
            # Find the project FK column
            fk_project_id = None
            for possible_col in ["projects_id", "Projects_id", "project_id", "ProjectID"]:
                if possible_col in r:
                    fk_project_id = r[possible_col]
                    break
            
            plots.append({
                "_db_id": r.get("id"),
                "_fk_projects_id": fk_project_id,
                "values": dict(values)  # Convert OrderedDict to regular dict for JSON serialization
            })
        
        # -------------------------
        # 4) FIGURE OUT PROJECT IDS FROM THOSE PLOTS
        # -------------------------
        project_ids = sorted({p["_fk_projects_id"] for p in plots if p["_fk_projects_id"] is not None})
        projects = []
        
        if project_ids:
            placeholders = ",".join(["%s"] * len(project_ids))
            cursor.execute(f"SELECT * FROM `{DB_TABLES['Projects']}` WHERE id IN ({placeholders})", project_ids)
            proj_rows = cursor.fetchall() or []
            
            # Group plots by FK
            plots_by_pid = {}
            for p in plots:
                pid = p["_fk_projects_id"]
                if pid is not None:
                    plots_by_pid.setdefault(pid, []).append(p)
            
            # Build project objects with only their own plots
            for r in proj_rows:
                values = ordered_values_for_row(
                    r,
                    "Projects",
                    schema_by_table["Projects"],
                    colmap_projects,
                )
                pid = r.get("id")
                projects.append({
                    "_db_id": pid,
                    "values": dict(values),  # Convert OrderedDict to regular dict for JSON serialization
                    "plots": plots_by_pid.get(pid, [])
                })
        
        cursor.close()
        conn.close()
        
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
                "projects_found": project_ids
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
                "projects_found": project_ids
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
def get_map_data_endpoint():
    """Get map visualization data"""
    return {"status": "Map data endpoint works"}

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


######################################################################
# Software User Management endpoints
######################################################################
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

@app.put("/nocodb/update-row", tags=["nocodb"])
async def update_nocodb_row(update_data: NocoDBRowUpdate, current_user: dict = Depends(get_current_user)):
    """Update a row in NocoDB table"""
    try:
        # Get user's personal API token if available, otherwise use environment token
        user_token = None
        user_email = current_user.get('email')
        print(f"🔑 UPDATE ENDPOINT - Getting API token for user: {user_email}")
        
        if user_email:
            try:
                # Get user's NocoDB token from database
                conn = mysql.connector.connect(
                    host=os.getenv("DB_HOST", "10.1.8.51"),
                    user=os.getenv("DB_USER", "s42project"),
                    password=os.getenv("DB_PASSWORD", "9JA_)j(WSqJUJ9Y]"),
                    database=os.getenv("DB_NAME", "nocodb"),
                    port=int(os.getenv("DB_PORT", "3306")),
                )
                cursor = conn.cursor(dictionary=True)
                cursor.execute("SELECT nocodb_api FROM users WHERE email = %s", (user_email,))
                user_data = cursor.fetchone()
                print(f"🔍 UPDATE ENDPOINT - Database query result for {user_email}: {user_data}")
                if user_data and user_data['nocodb_api']:
                    user_token = user_data['nocodb_api']
                    print(f"✅ UPDATE ENDPOINT - Using user-specific NocoDB token for {user_email}: {str(user_token)[:20]}...")
                else:
                    print(f"⚠️ UPDATE ENDPOINT - No user-specific token found for {user_email}, using admin token")
                    print(f"   User data: {user_data}")
                    print(f"   nocodb_api field: {user_data.get('nocodb_api') if user_data else 'No user found'}")
                cursor.close()
                conn.close()
            except Exception as e:
                print(f"Error fetching user token: {e}")
        
        # Use user token if available, otherwise fall back to environment token
        api_token = user_token or os.getenv("NOCODB_API_TOKEN")
        
        if not api_token:
            raise HTTPException(status_code=500, detail="No API token available")
        
        # NocoDB v2 API endpoint - note: no record ID in URL for bulk updates
        base_id = os.getenv("NOCODB_BASE_ID")
        nocodb_url = f"{os.getenv('NOCODB_API_URL')}/api/v2/tables/{update_data.table_id}/records"
        
        headers = {
            "Content-Type": "application/json",
            "xc-token": api_token
        }
        
        # NocoDB v2 expects an array of records with the primary key field for updates
        update_payload = [{
            "id": int(update_data.row_id),  # Convert to integer as NocoDB expects numeric IDs
            **update_data.field_data
        }]
        
        # Make the update request
        print(f"🔄 Making NocoDB v2 update request:")
        print(f"   URL: {nocodb_url}")
        print(f"   Payload: {update_payload}")
        print(f"   Token type: {'user' if user_token else 'admin'}")
        print(f"   Using token: {str(api_token)[:20]}...{str(api_token)[-10:] if len(str(api_token)) > 30 else str(api_token)}")
        print(f"   Token length: {len(str(api_token))}")
        
        response = requests.patch(nocodb_url, json=update_payload, headers=headers, verify=False)
        
        print(f"📡 NocoDB Response: {response.status_code}")
        if response.status_code != 200:
            print(f"❌ Error response: {response.text}")
        
        if response.status_code == 200:
            return {"success": True, "data": response.json()}
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
                        print(f"✅ Using user-specific NocoDB token for {user_email}")
                    else:
                        print(f"⚠️ No user-specific token found for {user_email}, using admin token")
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

@app.get('/api/map-stats', tags=["Debug"])
def get_map_stats_placeholder():
    """Get map statistics - placeholder endpoint"""
    return {"placeholder": "to be implemented"}
