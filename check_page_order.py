import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

try:
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "scale42_db")
    )
    
    cursor = conn.cursor(dictionary=True)
    
    print("\n=== CURRENT PAGE ORDER IN DATABASE ===")
    cursor.execute("""
        SELECT id, name, path, category, display_order, is_active
        FROM pages
        WHERE is_active = TRUE
        ORDER BY display_order, category, name
    """)
    
    pages = cursor.fetchall()
    for page in pages:
        print(f"{page['display_order']:3d} | {page['category']:15s} | {page['name']:20s} | {page['path']}")
    
    print("\n=== WHAT USER SEES (user-mysql endpoint) ===")
    cursor.execute("""
        SELECT DISTINCT p.id, p.name, p.path, p.category, p.display_order
        FROM pages p
        JOIN page_permissions pp ON p.id = pp.page_id AND pp.is_active = TRUE
        WHERE p.is_active = TRUE
        ORDER BY p.display_order, p.category, p.name
    """)
    
    pages = cursor.fetchall()
    for page in pages:
        print(f"{page['display_order']:3d} | {page['category']:15s} | {page['name']:20s} | {page['path']}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {str(e)}")
    import traceback
    traceback.print_exc()
