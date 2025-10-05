# Backend Endpoint for Page Reordering

Add this endpoint to `backend/app/main.py` after the `update_page_permissions` endpoint (around line 4410):

```python
@app.put("/pages/reorder", tags=["pages"])
async def reorder_pages(order_update: BulkPageOrderUpdate):
    """Update display order for multiple pages - MySQL version"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Update each page's display_order
        for update in order_update.updates:
            cursor.execute(
                "UPDATE pages SET display_order = %s WHERE id = %s",
                (update.display_order, update.page_id)
            )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"✅ Updated display order for {len(order_update.updates)} pages")
        
        return {"message": f"Updated order for {len(order_update.updates)} pages"}
        
    except Exception as e:
        print(f"❌ Error updating page order: {str(e)}")
        if 'conn' in locals():
            conn.rollback()
            cursor.close()
            conn.close()
        raise HTTPException(status_code=500, detail=str(e))
```

The models (`PageOrderUpdate` and `BulkPageOrderUpdate`) are already added to the file around line 4173.

## Testing the endpoint

After adding, restart uvicorn and test with:

```bash
curl -X PUT http://localhost:8000/pages/reorder \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"page_id": 1, "display_order": 0},
      {"page_id": 2, "display_order": 1}
    ]
  }'
```
