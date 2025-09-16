
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import mysql.connector
import os

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}


def get_db():
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        port=int(os.getenv("DB_PORT", "3306")),
    )
    return conn

@app.get("/users")
def get_users():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return JSONResponse(content=users)

@app.get("/projects")
def get_projects():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM Projects")
    projects = cursor.fetchall()
    cursor.close()
    conn.close()
    return JSONResponse(content=projects)
