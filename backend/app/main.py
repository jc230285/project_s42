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
from . import nocodb_sync

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


@app.get("/projects/schema", tags=["Projects"])
def get_schema_data(current_user: dict = Depends(get_current_user)):
    """Get schema data from NocoDB schema table"""
    print("SCHEMA ENDPOINT CALLED - Starting to process schema data")
    try:
        # Get NocoDB configuration from environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        nocodb_api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_base_id = os.getenv("NOCODB_BASE_ID")
        nocodb_schema_table_id = "m72851bbm1z0qul"  # Schema table ID
        
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
        
        # Construct NocoDB API v2 URL with pagination parameters to get all records
        api_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_schema_table_id}/records"
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": nocodb_api_token,
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
                        "has_token": bool(nocodb_api_token),
                        "has_base_id": bool(nocodb_base_id)
                    }
                }, 
                status_code=500
            )
        
        # Parse and return the data
        data = response.json()
        schema_records = data.get("list", [])
        
        # Define sorting order for categories and subcategories
        def get_sort_key(record):
            # Helper function to get numeric value for ordering, defaulting to 999 if not found
            def safe_int(value, default=999):
                try:
                    return int(value) if value is not None else default
                except (ValueError, TypeError):
                    return default
            
            # Extract sorting values
            category = record.get("Category", "")
            subcategory = record.get("Subcategory", "")
            field_order = safe_int(record.get("Field Order", 999))
            
            # Parse live ordering from SingleSelect field options
            def parse_select_options(options_string):
                """Parse the options string to extract order mapping"""
                order_map = {}
                if not options_string:
                    return order_map
                
                # Split by " | " to get individual options
                options = options_string.split(" | ")
                for option in options:
                    try:
                        # Extract option name and order
                        # Format: "OptionName (Color: #color, Order: N, ID: ...)"
                        if "(" in option and "Order:" in option:
                            name = option.split(" (")[0].strip()
                            order_part = option.split("Order: ")[1].split(",")[0].strip()
                            order = safe_int(order_part, 999)
                            order_map[name] = order
                        else:
                            # Fallback: use the option name as-is with high order
                            name = option.strip()
                            order_map[name] = 999
                    except (IndexError, ValueError):
                        # Skip malformed options
                        continue
                
                return order_map
            
            # Find Category and Subcategory field definitions to get their options
            category_order_map = {}
            subcategory_order_map = {}
            
            for schema_record in schema_records:
                field_name = schema_record.get("Field Name", "")
                field_id = schema_record.get("Field ID", "")
                options = schema_record.get("Options", "")
                
                if field_name == "Category" or field_id == "c3xywkmub993x24":
                    category_order_map = parse_select_options(options)
                elif field_name == "Subcategory" or field_id == "ceznmyuazlgngiw":
                    subcategory_order_map = parse_select_options(options)
            
            # Get the order for this record's category and subcategory
            category_order = category_order_map.get(category, 999)
            subcategory_order = subcategory_order_map.get(subcategory, 999)
            
            # Log the ordering for debugging
            import logging
            logging.basicConfig(level=logging.INFO)
            logger = logging.getLogger(__name__)
            logger.info(f"SCHEMA_ORDER: Record '{record.get('Field Name', '')}' - Category: '{category}' (order: {category_order}), Subcategory: '{subcategory}' (order: {subcategory_order}), Field Order: {field_order}")
            
            return (category_order, subcategory_order, field_order)
        
        # Sort the records
        sorted_records = sorted(schema_records, key=get_sort_key)
        
        # Add debugging info about pagination
        page_info = data.get("pageInfo", {})
        
        # Return data with pagination info for debugging
        return JSONResponse(content={
            "records": sorted_records,
            "count": len(sorted_records),
            "pageInfo": page_info,
            "totalRecords": page_info.get("totalRows", len(schema_records)),
            "debug": {
                "table_id": nocodb_schema_table_id,
                "requested_limit": 1000,
                "response_keys": list(data.keys()),
                "sorting_applied": True,
                "sort_order": "Category -> Subcategory -> Field Order (Using LIVE order from SingleSelect options)",
                "dynamic_sorting": True,
                "live_ordering": "Reading Order values from Category and Subcategory field options",
                "category_field_id": "c3xywkmub993x24",
                "subcategory_field_id": "ceznmyuazlgngiw",
                "categories_found": list(set(r.get("Category", "") for r in schema_records if r.get("Category"))),
                "subcategories_found": list(set(r.get("Subcategory", "") for r in schema_records if r.get("Subcategory")))
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

@app.get("/projects/plots", tags=["Projects"])
def get_plots_data(current_user: dict = Depends(get_current_user), plot_ids: Optional[str] = Query(None, description="Comma-separated list of numeric plot IDs to filter by")):
    """Get detailed plots and projects data from NocoDB based on selected numeric plot IDs"""
    try:
        # Get NocoDB configuration from environment variables
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        nocodb_api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_base_id = os.getenv("NOCODB_BASE_ID")
        
        # Table IDs
        nocodb_projects_table_id = os.getenv("NOCODB_PROJECTS_TABLE_ID", "mftsk8hkw23m8q1")
        nocodb_plots_table_id = os.getenv("NOCODB_PLOTS_TABLE_ID", "mmqclkrvx9lbtpc")  # Land Plots, Sites
        
        # Validate required environment variables
        if not nocodb_api_url or not nocodb_api_token or not nocodb_base_id:
            return JSONResponse(
                content={"error": "NocoDB configuration missing"}, 
                status_code=500
            )
        
        # Set up headers for NocoDB API
        headers = {
            "xc-token": nocodb_api_token,
            "Content-Type": "application/json"
        }
        
        # Parse numeric plot IDs from query parameter
        selected_plot_ids = []
        if plot_ids:
            selected_plot_ids = [pid.strip() for pid in plot_ids.split(',') if pid.strip()]
        
        print(f"DEBUG: Received plot_ids parameter: {plot_ids}")
        print(f"DEBUG: Parsed selected_numeric_plot_ids: {selected_plot_ids}")
        
        # Get plots data
        plots_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_plots_table_id}/records"
        plots_params = {"limit": 1000, "offset": 0}
        plots_response = requests.get(plots_url, headers=headers, params=plots_params, verify=False)
        
        if plots_response.status_code != 200:
            return JSONResponse(
                content={"error": f"Failed to fetch plots: {plots_response.status_code}"}, 
                status_code=500
            )
        
        plots_data = plots_response.json()
        all_plots = plots_data.get("list", [])
        
        print(f"DEBUG: Total plots in database: {len(all_plots)}")
        
        # Get projects data
        projects_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_projects_table_id}/records"
        projects_params = {"limit": 1000, "offset": 0}
        projects_response = requests.get(projects_url, headers=headers, params=projects_params, verify=False)
        
        if projects_response.status_code != 200:
            return JSONResponse(
                content={"error": f"Failed to fetch projects: {projects_response.status_code}"}, 
                status_code=500
            )
        
        projects_data = projects_response.json()
        all_projects = projects_data.get("list", [])
        
        # Filter plots by the numeric IDs directly
        filtered_plots = []
        linked_projects = []
        
        if selected_plot_ids:
            print(f"DEBUG: Looking for plots with numeric IDs: {selected_plot_ids}")
            
            # Find plots by their database ID
            for plot in all_plots:
                plot_id = str(plot.get("Id", ""))
                if plot_id in selected_plot_ids:
                    filtered_plots.append(plot)
                    print(f"DEBUG: Found plot with ID {plot_id}, ProjectID: {plot.get('ProjectID')}")
            
            print(f"DEBUG: Found {len(filtered_plots)} matching plots")
            
            # Now find the linked projects based on ProjectID relationship
            project_ids_to_find = []
            for plot in filtered_plots:
                project_id = plot.get("ProjectID")
                if project_id:
                    # ProjectID might be a list or single value
                    if isinstance(project_id, list):
                        project_ids_to_find.extend([str(pid) for pid in project_id])
                    else:
                        project_ids_to_find.append(str(project_id))
            
            print(f"DEBUG: Looking for projects with IDs: {project_ids_to_find}")
            
            # Find matching projects by their ID
            for project in all_projects:
                project_id = str(project.get("Id", ""))
                if project_id in project_ids_to_find:
                    linked_projects.append(project)
                    print(f"DEBUG: Found linked project with ID {project_id}: {project.get('Project Name')}")
            
            print(f"DEBUG: Found {len(linked_projects)} linked projects")
            
        else:
            # If no filter, get all plots and all projects
            filtered_plots = all_plots
            linked_projects = all_projects
        
        # Process plots with proper title from LandplotD field
        processed_plots = []
        for plot in filtered_plots:
            # Use the LandplotD field (cf11jae1lts4tb1) as the plot title
            plot_title = plot.get("cf11jae1lts4tb1", "") or plot.get("LandplotD", "") or plot.get("Plot ID", "")
            print(f"DEBUG: Plot ID {plot.get('Id')}: Using title '{plot_title}' from field cf11jae1lts4tb1")
            
            processed_plots.append({
                "id": plot.get("Id"),
                "plot_id": plot.get("Plot ID", ""),
                "plot_title": plot_title,  # Use LandplotD as the main title
                "landplot_d": plot.get("cf11jae1lts4tb1", ""),  # Explicit field reference
                "basic_data": plot  # Include all raw data
            })
        
        # Process a sample of projects 
        processed_projects = []
        for project in linked_projects[:5]:  # Limit to first 5 projects for now
            processed_projects.append({
                "id": project.get("Id"),
                "project_name": project.get("Project Name", ""),
                "basic_data": project  # Include all raw data
            })
        
        return JSONResponse(content={
            "plots": processed_plots,
            "projects": processed_projects,
            "selected_plot_ids": selected_plot_ids,
            "plots_count": len(processed_plots),
            "projects_count": len(processed_projects),
            "total_plots_available": len(all_plots),
            "total_projects_available": len(all_projects),
            "schema_fields_mapped": 0,  # Temporarily disabled
            "debug": {
                "data_source_priority": "Land Plots -> Projects via ProjectID relationship",
                "filtering_method": "Plot ID -> ProjectID -> Project ID matching",
                "total_plots_in_db": len(all_plots),
                "filtered_plots_count": len(filtered_plots),
                "linked_projects_count": len(linked_projects),
                "selected_plot_ids": selected_plot_ids,
                "relationship_mapping": "Land Plots.ProjectID -> Projects.Id",
                "schema_processing": "TEMPORARILY_DISABLED"
            },
            "source": "NocoDB API v2 - Proper ProjectID Relationship Mapping"
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

@app.get('/api/map-stats', tags=["Debug"])
def get_map_stats_placeholder():
    """Get map statistics - placeholder endpoint"""
    return {"placeholder": "to be implemented"}
