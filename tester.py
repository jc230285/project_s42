import os
import json
import requests
import mysql.connector
from collections import OrderedDict
from datetime import datetime

# -------------------------
# CONFIG
# -------------------------
API_URL = "http://localhost:8150/projects/schema"
AUTH = {
    "Authorization": "Bearer eyJlbWFpbCI6ImphbWVzQHNjYWxlLTQyLmNvbSIsIm5hbWUiOiJKYW1lcyBDb2xsaW5zIiwiaW1hZ2UiOiIifQ=="
}
DB_CFG = {
    "host": os.getenv("DB_HOST", "10.1.8.51"),
    "user": os.getenv("DB_USER", "s42project"),
    "password": os.getenv("DB_PASSWORD", "9JA_)j(WSqJUJ9Y]"),
    "database": os.getenv("DB_NAME", "nocodb"),
    "port": int(os.getenv("DB_PORT", "3306")),
}
SCHEMA_TABLES = {"Projects", "Land Plots, Sites"}
DB_TABLES = {"Projects": "Projects", "Land Plots, Sites": "LandPlots"}
SELECT_PLOT_IDS = [1, 3, 42]
EXPORT_FILE = "export_full.json"

# -------------------------
# HELPERS
# -------------------------
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
    """
    Build an OrderedDict of FieldID -> value for the given DB row,
    iterating in the exact order of the schema for that table.
    """
    result = OrderedDict()
    for f in schema_fields_sorted:
        if f["Table"] != table_name:
            continue
        field_id = f["Field ID"]
        db_col = find_db_col(colmap, f["Field Name"])
        # fill with value or None; keep every field present in schema
        val = row.get(db_col) if db_col in row else None
        result[field_id] = val
    return result

# -------------------------
# 1) FETCH & PREP SCHEMA
# -------------------------
resp = requests.get(API_URL, headers=AUTH)
try:
    schema_all = resp.json()
except Exception:
    schema_all = json.loads(resp.text)

# Some APIs return {"list":[...]}
if isinstance(schema_all, dict) and "list" in schema_all:
    schema_all = schema_all["list"]

# Keep only our two tables; keep raw rows (untouched)
schema_raw = [r for r in schema_all if r.get("Table") in SCHEMA_TABLES]

# Sort by category_order, subcategory_order, Field Order (ascending)
def sort_key(row):
    return (
        row.get("category_order", 999999),
        row.get("subcategory_order", 999999),
        row.get("Field Order", 999999),
        row.get("id", 999999),
    )

schema_sorted = sorted(schema_raw, key=sort_key)

# Also split per table for quick iteration later
schema_by_table = {
    "Projects": [r for r in schema_sorted if r["Table"] == "Projects"],
    "Land Plots, Sites": [r for r in schema_sorted if r["Table"] == "Land Plots, Sites"],
}

# -------------------------
# 2) DB CONNECT
# -------------------------
conn = mysql.connector.connect(**DB_CFG)
cursor = conn.cursor(dictionary=True)

# Column maps
colmap_projects = make_colmap(cursor, DB_TABLES["Projects"])
colmap_landplots = make_colmap(cursor, DB_TABLES["Land Plots, Sites"])

# -------------------------
# 3) LOAD SELECTED LAND PLOTS (IDs 1,2,4)
# -------------------------
if SELECT_PLOT_IDS:
    placeholders = ",".join(["%s"] * len(SELECT_PLOT_IDS))
    cursor.execute(f"SELECT * FROM `{DB_TABLES['Land Plots, Sites']}` WHERE id IN ({placeholders})", SELECT_PLOT_IDS)
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
    plots.append({
        "_db_id": r.get("id"),
        "_fk_projects_id": r.get(colmap_landplots.get("projects_id", "Projects_id")) if colmap_landplots.get("projects_id", "Projects_id") in r else r.get("Projects_id"),
        "values": values
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
            "values": values,
            "plots": plots_by_pid.get(pid, [])
        })

# -------------------------
# 5) OUTPUT (schema first, then data)
# -------------------------
output = OrderedDict()
output["schema"] = schema_sorted                    # full, untouched rows, sorted
output["data"] = {"projects": projects}             # only relevant projects, each with its own plots
output["exported_at"] = datetime.now().isoformat()

with open(EXPORT_FILE, "w", encoding="utf-8") as f:
    json.dump(output, f, indent=2, ensure_ascii=False, default=str)

print(f"✅ Wrote {EXPORT_FILE}")
