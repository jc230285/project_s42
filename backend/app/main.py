from fastapi import FastAPI
import mysql.connector
import os

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}

# Example DB connection (not used yet)
def get_db():
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "10.1.8.51"),
        user=os.getenv("DB_USER", "s42project"),
        password=os.getenv("DB_PASSWORD", "JF/2M5dLtq@HYZl0"),
        database=os.getenv("DB_NAME", "s42project"),
    )
    return conn
