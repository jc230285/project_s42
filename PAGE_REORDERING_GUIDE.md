# Page Reordering Guide

## Current Status

✅ **Permissions ARE Saving!**
The curl output shows: `{"message":"Page permissions updated successfully"}`

The backend MySQL permissions endpoint is working. The issue might be that the UI doesn't refresh to show the updated permissions after saving.

## To Add Drag-and-Drop Reordering

You need to install a React drag-and-drop library and update the pages table.

### Step 1: Install react-beautiful-dnd

```powershell
cd frontend
npm install react-beautiful-dnd @types/react-beautiful-dnd
```

### Step 2: Add display_order column to database

Run this SQL:
```sql
ALTER TABLE pages ADD COLUMN display_order INT DEFAULT 0;
UPDATE pages SET display_order = id WHERE display_order = 0;
```

### Step 3: Backend Endpoint (Already Added Models)

The models are ready in `main.py`:
- `PageOrderUpdate` - Single page order
- `BulkPageOrderUpdate` - Multiple pages

You need to add this endpoint after the permissions one:

```python
@app.put("/pages/reorder", tags=["pages"])
async def reorder_pages(order_update: BulkPageOrderUpdate):
    """Update display order for multiple pages"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        for update in order_update.updates:
            cursor.execute(
                "UPDATE pages SET display_order = %s WHERE id = %s",
                (update.display_order, update.page_id)
            )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {"message": f"Updated order for {len(order_update.updates)} pages"}
        
    except Exception as e:
        if 'conn' in locals():
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
```

### Step 4: Update Frontend (pages/page.tsx)

Add imports:
```typescript
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { GripVertical } from 'lucide-react';
```

Add drag handler:
```typescript
const handleDragEnd = async (result: any) => {
  if (!result.destination) return;
  
  const items = Array.from(pages);
  const [reorderedItem] = items.splice(result.source.index, 1);
  items.splice(result.destination.index, 0, reorderedItem);
  
  // Update local state
  setPages(items);
  
  // Save to backend
  const updates = items.map((page, index) => ({
    page_id: page.id || page.Id,
    display_order: index
  }));
  
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates })
    });
  } catch (error) {
    console.error('Failed to save order:', error);
  }
};
```

Wrap the table body:
```typescript
<DragDropContext onDragEnd={handleDragEnd}>
  <table className="w-full">
    <thead>
      {/* ... headers ... */}
    </thead>
    <Droppable droppableId="pages">
      {(provided) => (
        <tbody {...provided.droppableProps} ref={provided.innerRef}>
          {pages.map((page, index) => (
            <Draggable 
              key={page.Id || page.id} 
              draggableId={String(page.Id || page.id)} 
              index={index}
            >
              {(provided) => (
                <tr
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  className="border-b border-border"
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div {...provided.dragHandleProps}>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </div>
                      {page.name}
                    </div>
                  </td>
                  {/* ... rest of cells ... */}
                </tr>
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </tbody>
      )}
    </Droppable>
  </table>
</DragDropContext>
```

## Fixing "Permissions Don't Save" Display Issue

The permissions ARE saving, but the UI might not show it. After saving permissions, you should:

1. **Refresh the page data** to show updated groups
2. **Close the modal** to give visual feedback

Update the `handleUpdatePermissions` function in `pages/page.tsx`:

```typescript
const handleUpdatePermissions = async (pageId: number, groupIds: number[]) => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/${pageId}/permissions`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: pageId, group_ids: groupIds })
      }
    );
    
    if (response.ok) {
      // Close the modal
      setShowPermissionsModal(null);
      
      // Refresh pages to show updated groups
      await fetchPages();
      
      // Close the modal
      setShowPermissionsModal(null);
      
      // Refresh pages to show updated groups
      await fetchPages();
      
      // Show success toast
      toast.success('Permissions updated successfully!');
    } else {
      // Extract detailed error from backend
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      const errorMessage = errorData.detail || `Failed to update permissions (${response.status})`;
      toast.error(errorMessage);
      console.error('Failed to update permissions:', response.status, errorData);
    }
  } catch (error) {
    console.error('Error updating permissions:', error);
    toast.error('Failed to update permissions. Check console for details.');
  }
};
```

## Summary

✅ Permissions backend is working (MySQL endpoint active)
✅ Models for reordering are added
⏳ Need to add reorder endpoint to backend
⏳ Need to install react-beautiful-dnd
⏳ Need to add drag-and-drop UI
⏳ Need to refresh UI after permissions save

The main issue is the UI not reflecting the saved changes immediately!

---

## 🎯 IMPORTANT: Toast Notification Standards

**ALWAYS use the toast system** (`react-hot-toast`) for user feedback. **NEVER use `alert()`**.

### Import Toast
```typescript
import toast from 'react-hot-toast';
```

### Success Messages
```typescript
if (response.ok) {
  toast.success('Operation completed successfully');
}
```

### Error Messages - ALWAYS EXTRACT DETAILED ERRORS
```typescript
if (!response.ok) {
  // Extract detailed error from backend response
  const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
  const errorMessage = errorData.detail || `Operation failed (${response.status})`;
  toast.error(errorMessage);
  console.error('Detailed error:', response.status, errorData);
}
```

### Catch Block Errors
```typescript
catch (error) {
  console.error('Error details:', error);
  toast.error('Operation failed. Check console for details.');
}
```

### Why Detailed Errors Matter
- Users see **actual error messages** from the backend (e.g., "Duplicate group name")
- Developers can **debug faster** with specific error codes
- **Better UX** than generic "Failed" messages
- Errors appear at **bottom-left** (configured globally)

### Complete Example
```typescript
const createGroup = async () => {
  try {
    const response = await fetch('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Group' })
    });

    if (response.ok) {
      toast.success('Group created successfully');
      fetchData();
    } else {
      // Extract detailed error
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      toast.error(errorData.detail || 'Failed to create group');
      console.error('Create group error:', errorData);
    }
  } catch (error) {
    console.error('Network error:', error);
    toast.error('Failed to create group. Check console for details.');
  }
};
```

**Remember:** All toasts appear at **bottom-left** by default (configured in `Providers.tsx`).
