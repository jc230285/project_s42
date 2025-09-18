import requests
import csv
import warnings
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

# Fill in your NocoDB API details
API_URL = "https://nocodb.edbmotte.com"
API_TOKEN = "K7_vnucrg7hRtRQT4fYkkOacFAd8jnIpAtSf8bgG"
BASE_ID = "pjqgy4ri85jks06" #Scale-42
#BASE_ID = "ptip60dq93r55b0" #Wedding

headers = {
    "xc-token": API_TOKEN
}

# Function to list all bases
def list_bases():
    url = f"{API_URL}/api/v2/meta/bases"
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()
    return response.json()

# Function to list all tables for a base
def list_tables_for_base(base_id):
    url = f"{API_URL}/api/v2/meta/bases/{base_id}/tables"
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()
    return response.json()

# Print base IDs and names at the start
bases_info = []
try:
    bases = list_bases()
    for base in bases.get("list", []):
        bases_info.append(f"Base ID: {base.get('id')}, Name: {base.get('title')}")
except requests.exceptions.HTTPError as e:
    print(f"Error listing bases: {e}")

# Print tables for the selected base
tables_info = []
try:
    tables = list_tables_for_base(BASE_ID)
    for table in tables.get("list", []):
        tables_info.append(f"Table ID: {table.get('id')}, Name: {table.get('title')}")
except requests.exceptions.HTTPError as e:
    print(f"Error listing tables: {e}")

# Function to list all tables (Note: Not available in provided v2 docs, may need baseId)
def list_tables():
    # For v2, this might be /api/v2/meta/bases/{baseId}/tables, but baseId unknown
    print("List tables not available in v2 API without baseId")
    return []

# Function to check API versions
def check_api_versions():
    versions = []
    endpoints = {
        1: "/api/v1/db/meta/projects/",
        2: "/api/v2/meta/bases",
        3: "/api/v3/meta/bases"
    }
    for version, endpoint in endpoints.items():
        try:
            url = f"{API_URL}{endpoint}"
            response = requests.get(url, headers=headers, timeout=5, verify=False)
            if response.status_code == 200:
                versions.append(version)
        except:
            pass
    return versions

# Print available API versions
api_versions_info = []
try:
    available_versions = check_api_versions()
    api_versions_info = available_versions
except:
    print("Error checking API versions")

# Function to get table metadata including fields with more details
def get_table_metadata(table_id):
    url = f"{API_URL}/api/v2/meta/tables/{table_id}"
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()
    data = response.json()
    columns = data.get("columns", [])
    detailed_columns = []
    for col in columns:
        meta = col.get("meta", {})
        options = ""
        field_type = col.get("uidt", "")
        # Note: NocoDB v2 API doesn't include select options in table metadata
        # Options would need to be fetched from a different endpoint if available
        detailed_columns.append({
            "id": col.get("id", ""),
            "title": col.get("title", ""),
            "type": field_type,
            "description": col.get("description", ""),
            "meta": str(meta),
            "options": options
        })
    return {"columns": detailed_columns}

# Function to list table records
def list_table_records(table_id, params=None):
    url = f"{API_URL}/api/v2/tables/{table_id}/records"
    response = requests.get(url, headers=headers, params=params, verify=False)
    response.raise_for_status()
    return response.json()

# Function to create table records
def create_table_records(table_id, data):
    url = f"{API_URL}/api/v2/tables/{table_id}/records"
    response = requests.post(url, headers=headers, json=data, verify=False)
    response.raise_for_status()
    return response.json()

# Function to update table records
def update_table_records(table_id, data):
    url = f"{API_URL}/api/v2/tables/{table_id}/records"
    response = requests.patch(url, headers=headers, json=data, verify=False)
    response.raise_for_status()
    return response.json()

# Function to delete table records
def delete_table_records(table_id, data):
    url = f"{API_URL}/api/v2/tables/{table_id}/records"
    response = requests.delete(url, headers=headers, json=data, verify=False)
    response.raise_for_status()
    return response.json()

# Function to read a single table record
def read_table_record(table_id, record_id, params=None):
    url = f"{API_URL}/api/v2/tables/{table_id}/records/{record_id}"
    response = requests.get(url, headers=headers, params=params, verify=False)
    response.raise_for_status()
    return response.json()

# Function to count table records
def count_table_records(table_id, params=None):
    url = f"{API_URL}/api/v2/tables/{table_id}/records/count"
    response = requests.get(url, headers=headers, params=params, verify=False)
    response.raise_for_status()
    return response.json()

# Function to list linked records
def list_linked_records(table_id, link_field_id, record_id, params=None):
    url = f"{API_URL}/api/v2/tables/{table_id}/links/{link_field_id}/records/{record_id}"
    response = requests.get(url, headers=headers, params=params, verify=False)
    response.raise_for_status()
    return response.json()

# Function to link records
def link_records(table_id, link_field_id, record_id, data):
    url = f"{API_URL}/api/v2/tables/{table_id}/links/{link_field_id}/records/{record_id}"
    response = requests.post(url, headers=headers, json=data, verify=False)
    response.raise_for_status()
    return response

# Function to unlink records
def unlink_records(table_id, link_field_id, record_id, data):
    url = f"{API_URL}/api/v2/tables/{table_id}/links/{link_field_id}/records/{record_id}"
    response = requests.delete(url, headers=headers, json=data, verify=False)
    response.raise_for_status()
    return response

# Function to get raw column metadata from v1 API
def get_raw_column_metadata(column_id):
    """
    Get complete raw column metadata from v1 API
    Useful for inspecting structure of different field types
    """
    try:
        url = f"{API_URL}/api/v1/db/meta/columns/{column_id}"
        response = requests.get(url, headers=headers, timeout=10, verify=False)

        if response.status_code == 200:
            return response.json()
        else:
            print(f"Failed to get column metadata: {response.status_code}")
            return None

    except Exception as e:
        print(f"Error getting raw column metadata: {e}")
        return None

# Function to get column options as a simple string
def get_column_options(table_id, column_id, field_title=""):
    """
    Get column options as a detailed string including colors, order, and other metadata
    Uses v1 API to get accurate options data for all field types
    """
    try:
        # Use v1 API to get actual column options
        url = f"{API_URL}/api/v1/db/meta/columns/{column_id}"
        response = requests.get(url, headers=headers, timeout=10, verify=False)

        if response.status_code == 200:
            data = response.json()
            field_type = data.get("uidt", "")
            col_options = data.get("colOptions", {})

            # Handle different field types
            if field_type in ["SingleSelect", "MultiSelect"]:
                options = col_options.get("options", [])
                if options:
                    # Create detailed option strings with all metadata
                    option_details = []
                    for opt in options:
                        title = opt.get("title", "")
                        color = opt.get("color", "")
                        order = opt.get("order", "")
                        value = opt.get("value", "")
                        option_id = opt.get("id", "")

                        # Format: Title (Color: #hex, Order: N, ID: xxx)
                        detail = f"{title}"
                        if color:
                            detail += f" (Color: {color}"
                        if order:
                            detail += f", Order: {order}"
                        if option_id:
                            detail += f", ID: {option_id[:8]}...)"
                        else:
                            detail += ")"

                        option_details.append(detail)

                    # Sort by order and join
                    option_details.sort(key=lambda x: int(x.split("Order: ")[1].split(",")[0]) if "Order: " in x else 999)
                    return " | ".join(option_details)

            elif field_type == "Checkbox":
                # For checkbox fields, get the default value and other settings
                default_value = col_options.get("default", "")
                if default_value is not None:
                    return f"Default: {default_value}"
                return "Boolean field"

            elif field_type == "Currency":
                # Currency fields have symbol and locale
                symbol = col_options.get("symbol", "")
                locale = col_options.get("locale", "")
                details = []
                if symbol:
                    details.append(f"Symbol: {symbol}")
                if locale:
                    details.append(f"Locale: {locale}")
                return " | ".join(details) if details else "Currency field"

            elif field_type in ["Decimal", "Float", "Integer"]:
                # Numeric fields have precision and scale
                precision = col_options.get("precision", "")
                scale = col_options.get("scale", "")
                details = []
                if precision:
                    details.append(f"Precision: {precision}")
                if scale:
                    details.append(f"Scale: {scale}")
                return " | ".join(details) if details else f"{field_type} field"

            elif field_type == "DateTime":
                # DateTime fields have format settings
                date_format = col_options.get("date_format", "")
                time_format = col_options.get("time_format", "")
                details = []
                if date_format:
                    details.append(f"Date Format: {date_format}")
                if time_format:
                    details.append(f"Time Format: {time_format}")
                return " | ".join(details) if details else "DateTime field"

            elif field_type == "Date":
                # Date fields have format settings
                date_format = col_options.get("date_format", "")
                if date_format:
                    return f"Date Format: {date_format}"
                return "Date field"

            elif field_type == "Time":
                # Time fields have format settings
                time_format = col_options.get("time_format", "")
                if time_format:
                    return f"Time Format: {time_format}"
                return "Time field"

            elif field_type == "Text":
                # Text fields have length limits
                length = col_options.get("length", "")
                if length:
                    return f"Max Length: {length}"
                return "Text field"

            elif field_type == "LongText":
                # LongText fields might have different settings
                return "Long Text field"

            elif field_type == "Email":
                # Email fields might have validation settings
                return "Email field"

            elif field_type == "URL":
                # URL fields might have validation settings
                return "URL field"

            elif field_type == "PhoneNumber":
                # Phone fields might have format settings
                return "Phone Number field"

            elif field_type == "JSON":
                # JSON fields
                return "JSON field"

            elif field_type == "Formula":
                # Formula fields have the formula expression
                formula = col_options.get("formula", "")
                if formula:
                    return f"Formula: {formula[:50]}..." if len(formula) > 50 else f"Formula: {formula}"
                return "Formula field"

            elif field_type == "Lookup":
                # Lookup fields reference other fields
                relation_column_id = col_options.get("relation_column_id", "")
                if relation_column_id:
                    return f"Lookup from column: {relation_column_id[:8]}..."
                return "Lookup field"

            elif field_type == "Rollup":
                # Rollup fields have rollup expressions
                rollup_function = col_options.get("rollup_function", "")
                if rollup_function:
                    return f"Rollup: {rollup_function}"
                return "Rollup field"

            elif field_type == "LinkToAnotherRecord":
                # Link fields have relation settings
                relation_type = col_options.get("type", "")
                target_table_id = col_options.get("target_table_id", "")
                details = []
                if relation_type:
                    details.append(f"Relation: {relation_type}")
                if target_table_id:
                    details.append(f"Target Table: {target_table_id[:8]}...")
                return " | ".join(details) if details else "Link field"

            elif field_type == "Attachment":
                # Attachment fields might have size limits
                return "Attachment field"

            elif field_type == "Rating":
                # Rating fields have max value
                max_value = col_options.get("max", "")
                if max_value:
                    return f"Max Rating: {max_value}"
                return "Rating field"

            elif field_type == "Barcode":
                # Barcode fields have barcode type
                barcode_type = col_options.get("barcode_type", "")
                if barcode_type:
                    return f"Barcode Type: {barcode_type}"
                return "Barcode field"

            elif field_type == "QRCode":
                # QR Code fields
                return "QR Code field"

            elif field_type == "Geometry":
                # Geometry fields for maps
                return "Geometry field"

            # For any other field types not specifically handled
            else:
                # Return basic field type info
                return f"{field_type} field"

        return ""

    except Exception as e:
        print(f"Error getting options for column {column_id}: {e}")
        return ""

# Function to display column options with order and colors
def display_column_options(column_id, field_title=""):
    """
    Display select field options with their order, colors, and other metadata
    """
    raw_data = get_raw_column_metadata(column_id)

    if not raw_data:
        print(f"No data available for column {column_id}")
        return

    print(f"\n{'='*60}")
    print(f"COLUMN METADATA: {field_title or column_id}")
    print(f"{'='*60}")

    # Basic column info
    print(f"Column ID: {raw_data.get('id', 'N/A')}")
    print(f"Title: {raw_data.get('title', 'N/A')}")
    print(f"Type: {raw_data.get('uidt', 'N/A')}")
    print(f"Description: {raw_data.get('description', 'N/A')}")

    # Column options (for select fields)
    col_options = raw_data.get('colOptions', {})
    options = col_options.get('options', [])

    if options:
        print(f"\nSELECT OPTIONS ({len(options)} total):")
        print(f"{'-'*50}")
        for i, opt in enumerate(options, 1):
            print(f"{i:2d}. Title: '{opt.get('title', 'N/A')}'")
            print(f"    Color: {opt.get('color', 'N/A')}")
            print(f"    Order: {opt.get('order', 'N/A')}")
            print(f"    Value: '{opt.get('value', 'N/A')}'")
            print(f"    ID: {opt.get('id', 'N/A')}")
            print()

    # Extra data
    extra = raw_data.get('extra', {})
    if extra:
        print(f"EXTRA DATA:")
        print(f"{'-'*30}")
        if 'options' in extra:
            print(f"Extra options count: {len(extra['options'])}")
        if 'optionsMap' in extra:
            print(f"Options map keys: {list(extra['optionsMap'].keys())}")

    # Raw structure for inspection
    print(f"\nRAW DATA STRUCTURE:")
    print(f"{'-'*30}")
    print(f"Top-level keys: {list(raw_data.keys())}")

    if 'colOptions' in raw_data:
        print(f"colOptions keys: {list(raw_data['colOptions'].keys())}")

    return raw_data

# Function to update column options for select fields using v1 API
def update_column_options(column_id, new_options_list, preserve_existing=True):
    """
    Update select field options using v1 API
    new_options_list should be a list of option titles (strings)
    preserve_existing: if True, keeps existing options not in new list; if False, replaces all
    """
    try:
        # First get current column metadata
        url = f"{API_URL}/api/v1/db/meta/columns/{column_id}"
        response = requests.get(url, headers=headers, timeout=10, verify=False)

        if response.status_code != 200:
            print(f"Failed to get current column metadata for {column_id}")
            return False

        current_data = response.json()
        current_options = current_data.get('colOptions', {}).get('options', [])

        # Create options map for easy lookup
        current_options_map = {opt['title']: opt for opt in current_options}

        # Build new options list
        options = []
        order_counter = 1

        if preserve_existing:
            # Keep existing options and add new ones
            for title in new_options_list:
                if title in current_options_map:
                    # Update existing option with new order
                    opt = current_options_map[title].copy()
                    opt['order'] = order_counter
                    opt['index'] = order_counter - 1
                    options.append(opt)
                else:
                    # Add new option
                    option_id = f"opt_{order_counter}_{column_id[:8]}"
                    options.append({
                        "id": option_id,
                        "fk_column_id": column_id,
                        "title": title,
                        "color": "#cfdffe",  # Default color
                        "order": order_counter,
                        "base_id": BASE_ID,
                        "value": title,
                        "index": order_counter - 1
                    })
                order_counter += 1

            # Add remaining existing options not in new list
            for title, opt in current_options_map.items():
                if title not in new_options_list:
                    opt_copy = opt.copy()
                    opt_copy['order'] = order_counter
                    opt_copy['index'] = order_counter - 1
                    options.append(opt_copy)
                    order_counter += 1
        else:
            # Replace all options
            for i, title in enumerate(new_options_list):
                if title in current_options_map:
                    # Keep existing option but update order
                    opt = current_options_map[title].copy()
                    opt['order'] = i + 1
                    opt['index'] = i
                    options.append(opt)
                else:
                    # Create new option
                    option_id = f"opt_{i+1}_{column_id[:8]}"
                    options.append({
                        "id": option_id,
                        "fk_column_id": column_id,
                        "title": title,
                        "color": "#cfdffe",
                        "order": i + 1,
                        "base_id": BASE_ID,
                        "value": title,
                        "index": i
                    })

        # Update the column data with new options
        update_data = current_data.copy()
        update_data["colOptions"] = {"options": options}
        update_data["extra"] = {
            "options": options,
            "optionsMap": {opt["title"]: opt for opt in options}
        }

        # Send PATCH request to update
        response = requests.patch(url, headers=headers, json=update_data, timeout=10, verify=False)

        if response.status_code == 200:
            print(f"Successfully updated options for column {column_id}")
            print(f"New options: {[opt['title'] for opt in options]}")
            return True
        else:
            print(f"Failed to update column {column_id}: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"Error updating options for column {column_id}: {e}")
        return False

# Function to add specific options to existing select field
def add_select_options(column_id, options_to_add):
    """
    Add new options to an existing select field
    options_to_add: list of strings (option titles)
    """
    raw_data = get_raw_column_metadata(column_id)
    if not raw_data:
        return False

    current_options = raw_data.get('colOptions', {}).get('options', [])
    current_titles = [opt['title'] for opt in current_options]

    # Add only new options
    new_titles = [title for title in options_to_add if title not in current_titles]

    if not new_titles:
        print(f"All options already exist in column {column_id}")
        return True

    all_titles = current_titles + new_titles
    return update_column_options(column_id, all_titles, preserve_existing=False)

# Function to remove specific options from select field
def remove_select_options(column_id, options_to_remove):
    """
    Remove specific options from a select field
    options_to_remove: list of strings (option titles to remove)
    """
    raw_data = get_raw_column_metadata(column_id)
    if not raw_data:
        return False

    current_options = raw_data.get('colOptions', {}).get('options', [])
    current_titles = [opt['title'] for opt in current_options]

    # Remove specified options
    remaining_titles = [title for title in current_titles if title not in options_to_remove]

    if len(remaining_titles) == len(current_titles):
        print(f"None of the specified options found in column {column_id}")
        return True

    return update_column_options(column_id, remaining_titles, preserve_existing=False)

# Function to reorder select options
def reorder_select_options(column_id, ordered_titles):
    """
    Reorder select field options
    ordered_titles: list of all option titles in desired order
    """
    return update_column_options(column_id, ordered_titles, preserve_existing=False)

# Function to update column metadata
def update_column_metadata(table_id, column_id, updates):
    try:
        # Get current table metadata
        table_meta = get_table_metadata(table_id)
        columns = table_meta.get("columns", [])
        column = next((col for col in columns if col.get("id") == column_id), None)
        if not column:
            print(f"Column {column_id} not found in table {table_id}")
            return
        # Update the column with provided updates
        column.update(updates)
        # PATCH the updated column
        url = f"{API_URL}/api/v2/meta/tables/{table_id}/columns/{column_id}"
        response = requests.patch(url, headers=headers, json=column, verify=False)
        response.raise_for_status()
        print(f"Updated description for column {column_id} in table {table_id}")
    except Exception as e:
        print(f"Error updating column {column_id}: {e}")

# Main sync function that can be called from the API
def run_nocodb_sync():
    """
    Main function to sync NocoDB schema and metadata
    Returns a dictionary with execution results
    """
    result = {
        "api_versions": [],
        "bases": [],
        "tables": [],
        "existing_records": 0,
        "rows_updated": 0,
        "rows_inserted": 0,
        "rows_deleted": 0,
        "descriptions_updated": 0,
        "total_existing": 0,
        "total_processed": 0,
        "status": "success",
        "message": ""
    }

    try:
        # Get API versions
        result["api_versions"] = check_api_versions()

        # Get bases info
        try:
            bases = list_bases()
            result["bases"] = [f"Base ID: {base.get('id')}, Name: {base.get('title')}" for base in bases.get("list", [])]
        except Exception as e:
            result["bases"] = [f"Error: {str(e)}"]

        # Get tables info
        try:
            tables = list_tables_for_base(BASE_ID)
            result["tables"] = [f"Table ID: {table.get('id')}, Name: {table.get('title')}" for table in tables.get("list", [])]
        except Exception as e:
            result["tables"] = [f"Error: {str(e)}"]

        # Define table IDs to process
        table_ids = [
            ("mftsk8hkw23m8q1", "Projects"),
            ("mmqclkrvx9lbtpc", "Land Plots, Sites"),
            ("m72851bbm1z0qul", "schema")
        ]

        schema_table_id = "m72851bbm1z0qul"

        # Get existing records from schema table
        existing_count = 0
        existing_list = []
        try:
            existing_records = get_all_table_records(schema_table_id)
            existing_list = existing_records.get("list", [])
            existing_count = len(existing_list)
            result["existing_records"] = existing_count
        except Exception as e:
            result["message"] += f"Error fetching existing records: {str(e)}\n"
            result["status"] = "partial_error"

        # Group by (Field ID, Table) and clean duplicates
        from collections import defaultdict
        grouped = defaultdict(list)
        for rec in existing_list:
            table_normalized = rec.get("Table", "").replace(",", "").strip().lower()
            field_id_normalized = rec.get("Field ID", "").strip().lower()
            key = (field_id_normalized, table_normalized)
            grouped[key].append(rec)

        result["message"] += f"Total unique keys: {len(grouped)}\n"
        result["message"] += f"Groups with duplicates: {sum(1 for recs in grouped.values() if len(recs) > 1)}\n"

        to_delete = []
        existing_by_key = {}
        for key, recs in grouped.items():
            if len(recs) > 1:
                # Sort by whether Category is not "General" (prefer True first)
                recs.sort(key=lambda r: r.get("Category", "") != "General", reverse=True)
                # Keep the first (preferred), delete the rest
                existing_by_key[key] = recs[0]["id"]
                for rec in recs[1:]:
                    to_delete.append({"id": rec["id"]})
            else:
                existing_by_key[key] = recs[0]["id"]

        # Delete duplicates
        if to_delete:
            try:
                delete_table_records(schema_table_id, to_delete)
                result["message"] += f"Deleted {len(to_delete)} duplicate records\n"
            except Exception as e:
                result["message"] += f"Error deleting duplicates: {str(e)}\n"
                result["status"] = "partial_error"
                # If bulk delete fails, try single deletes
                deleted_count = 0
                for rec in to_delete:
                    try:
                        delete_table_records(schema_table_id, [rec])
                        deleted_count += 1
                    except:
                        pass
                result["message"] += f"Deleted {deleted_count} duplicate records individually\n"

        new_records = []
        updates = []
        processed_keys = set()

        for table_id, table_name in table_ids:
            table_name_normalized = table_name.replace(",", "").strip().lower()
            try:
                metadata = get_table_metadata(table_id)
                columns = metadata.get("columns", [])
                for col in columns:
                    field_name = col.get("title", "").strip().lower()
                    field_id = col.get("id", "")
                    field_id_normalized = field_id.strip().lower()
                    field_type = col.get("type", "")
                    desc = col.get("description", "")
                    meta = str(col.get("meta", {}))
                    # Get options for all field types
                    options = ""
                    field_title = col.get("title", "")
                    if field_type in ["SingleSelect", "MultiSelect", "Checkbox", "Currency", "Decimal", "Float", "Integer", "DateTime", "Date", "Time", "Text", "LongText", "Email", "URL", "PhoneNumber", "JSON", "Formula", "Lookup", "Rollup", "LinkToAnotherRecord", "Attachment", "Rating", "Barcode", "QRCode", "Geometry"]:
                        options = get_column_options(table_id, field_id, field_title)

                    record_data = {
                        "Table": table_name,
                        "Field Name": col.get("title", ""),  # Keep original case for display
                        "Field ID": field_id,
                        "Type": field_type,
                        "meta": meta,
                        "Options": options,
                        "Category": "General",
                        "Subcategory": "General",
                        "Description": "",
                        "Description copy": "",
                        "Field Order": 0
                    }

                    key = (field_id_normalized, table_name_normalized)
                    processed_keys.add(key)
                    if key in existing_by_key:
                        # Check if update is needed by comparing existing record
                        record_id = existing_by_key[key]
                        existing_rec = next((rec for rec in existing_list if rec["id"] == record_id), None)
                        if existing_rec:
                            # Compare relevant fields
                            needs_update = (
                                existing_rec.get("Field Name", "") != record_data["Field Name"] or
                                existing_rec.get("Type", "") != record_data["Type"] or
                                existing_rec.get("meta", "") != record_data["meta"] or
                                existing_rec.get("Options", "") != record_data["Options"]
                            )
                            if needs_update:
                                # Preserve existing Description, Category, Subcategory
                                record_data["Description"] = existing_rec.get("Description", "")
                                record_data["Category"] = existing_rec.get("Category", "General")
                                record_data["Subcategory"] = existing_rec.get("Subcategory", "General")
                                record_data["Description copy"] = existing_rec.get("Description copy", "")
                                updates.append((record_id, record_data))
                        else:
                            # Fallback: update anyway if record not found
                            updates.append((record_id, record_data))
                    else:
                        # New record
                        new_records.append(record_data)
            except requests.exceptions.HTTPError as e:
                result["message"] += f"Error for {table_name}: {str(e)}\n"
                if table_name in ["Projects", "Land Plots, Sites"]:
                    result["message"] += "Critical error: Could not fetch metadata for required table. Exiting.\n"
                    result["status"] = "error"
                    return result

        # Perform updates
        updated_count = 0
        for record_id, data in updates:
            try:
                update_table_records(schema_table_id, [{"id": record_id, **data}])
                updated_count += 1
            except Exception as e:
                result["message"] += f"Error updating {data['Field Name']}: {str(e)}\n"

        result["rows_updated"] = updated_count

        # Perform bulk insert for new records
        inserted_count = 0
        if new_records:
            try:
                create_table_records(schema_table_id, new_records)
                inserted_count = len(new_records)
            except Exception as e:
                result["message"] += f"Error inserting new records: {str(e)}\n"
                result["message"] += f"Sample new record: {new_records[0] if new_records else 'None'}\n"
                result["status"] = "partial_error"

        result["rows_inserted"] = inserted_count

        # Delete obsolete records (fields no longer in source tables)
        obsolete_keys = set(existing_by_key.keys()) - processed_keys
        deleted_count = 0
        if obsolete_keys:
            to_delete_obsolete = []
            for key in obsolete_keys:
                if key in existing_by_key:
                    to_delete_obsolete.append({"id": existing_by_key[key]})
            if to_delete_obsolete:
                try:
                    delete_table_records(schema_table_id, to_delete_obsolete)
                    deleted_count = len(to_delete_obsolete)
                except Exception as e:
                    result["message"] += f"Error deleting obsolete records: {str(e)}\n"
                    result["status"] = "partial_error"
                    # Try single deletes
                    for rec in to_delete_obsolete:
                        try:
                            delete_table_records(schema_table_id, [rec])
                            deleted_count += 1
                        except:
                            pass

        result["rows_deleted"] = deleted_count

        # Update descriptions from schema table back to source tables only if schema was updated
        descriptions_updated_count = 0
        if len(updates) > 0 or inserted_count > 0:
            for rec in existing_list:
                table_name = rec.get("Table", "")
                field_id = rec.get("Field ID", "")
                description = rec.get("Description", "").strip()
                if description and table_name in [name for _, name in table_ids]:
                    # Find the table_id for this table_name
                    table_id = next((tid for tid, tname in table_ids if tname == table_name), None)
                    if table_id:
                        try:
                            update_column_metadata(table_id, field_id, {"description": description})
                            descriptions_updated_count += 1
                        except:
                            pass

        result["descriptions_updated"] = descriptions_updated_count
        result["total_existing"] = len(existing_list)
        result["total_processed"] = len(processed_keys)

        result["message"] += "="*50 + "\n"
        result["message"] += "EXECUTION REPORT\n"
        result["message"] += "="*50 + "\n"
        result["message"] += f"Available API versions: {result['api_versions']}\n"
        result["message"] += "Available Bases:\n"
        for base in result["bases"]:
            result["message"] += f"{base}\n"
        result["message"] += f"Tables in base {BASE_ID}:\n"
        for table in result["tables"]:
            result["message"] += f"{table}\n"
        result["message"] += f"Existing records in schema: {result['existing_records']}\n"
        result["message"] += f"Rows updated in schema table: {result['rows_updated']}\n"
        result["message"] += f"Rows inserted into schema table: {result['rows_inserted']}\n"
        result["message"] += f"Rows deleted from schema table: {result['rows_deleted']}\n"
        result["message"] += f"Descriptions pushed back to source tables: {result['descriptions_updated']}\n"
        result["message"] += f"Total existing records in schema: {result['total_existing']}\n"
        result["message"] += f"Total processed fields from source: {result['total_processed']}\n"
        result["message"] += "="*50 + "\n"

    except Exception as e:
        result["status"] = "error"
        result["message"] = f"Critical error during sync: {str(e)}"

    return result

# Function to get all table records with pagination
def get_all_table_records(table_id):
    all_records = []
    offset = 0
    limit = 1000
    while True:
        params = {"offset": offset, "limit": limit}
        response = list_table_records(table_id, params)
        records = response.get("list", [])
        all_records.extend(records)
        if len(records) < limit:
            break
        offset += limit
    return {"list": all_records}