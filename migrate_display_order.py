import mysql.connector
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

try:
    # Connect to database
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "scale42_db")
    )
    
    cursor = conn.cursor()
    
    print("🔧 Adding display_order column to pages table...")
    
    # Add display_order column if it doesn't exist
    try:
        cursor.execute("ALTER TABLE pages ADD COLUMN display_order INT DEFAULT 0 AFTER description")
        conn.commit()
        print("✅ Added display_order column to pages table")
    except Exception as e:
        if "Duplicate column name" in str(e):
            print("✅ display_order column already exists")
        else:
            print(f"❌ Error adding column: {str(e)}")
            raise e
    
    # Add index for display_order if it doesn't exist
    try:
        cursor.execute("ALTER TABLE pages ADD INDEX idx_display_order (display_order)")
        conn.commit()
        print("✅ Added index for display_order")
    except Exception as e:
        if "Duplicate key name" in str(e):
            print("✅ Index for display_order already exists")
        else:
            print(f"⚠️ Warning adding index: {str(e)}")
    
    # Verify the column exists
    cursor.execute("SHOW COLUMNS FROM pages LIKE 'display_order'")
    result = cursor.fetchone()
    if result:
        print(f"✅ VERIFIED: display_order column exists: {result}")
    else:
        print("❌ ERROR: display_order column NOT found!")
    
    cursor.close()
    conn.close()
    
    print("\n✅ Migration complete!")
    
except Exception as e:
    print(f"\n❌ Migration failed: {str(e)}")
    import traceback
    traceback.print_exc()
