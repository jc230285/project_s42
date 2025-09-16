from fastapi import FastAPI
from fastapi.responses import JSONResponse
import mysql.connector
import os
import json
from datetime import datetime, date

# Custom JSON encoder for datetime objects
def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

app = FastAPI()

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
        host=os.getenv("DB_HOST", "mariadb"),  # Use mariadb as hostname like Zabbix
        user=os.getenv("DB_USER", "s42project"),
        password=os.getenv("DB_PASSWORD", "JF/2M5dLtq@HYZl0"),
        database=os.getenv("DB_NAME", "nocodb"),
        port=int(os.getenv("DB_PORT", "3306")),
    )
    return conn

@app.get("/land-plots-sites")
def get_land_plots_sites():
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
def get_hoyanger_power_data():
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
def get_users():
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users")
        users = cursor.fetchall()
        cursor.close()
        conn.close()
        # Convert to JSON with datetime serialization
        json_data = json.loads(json.dumps(users, default=json_serial))
        return JSONResponse(content=json_data)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/projects")
def get_projects():
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
