# Frontend Drag-and-Drop Implementation

## Installation Complete ✅
`@hello-pangea/dnd` has been installed.

## Step 1: Import Added ✅
The following imports have been added to `frontend/app/pages/page.tsx`:
```typescript
import { GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
```

## Step 2: Add Drag Handler Function

Add this function after `handleDeletePage` (around line 335):

```typescript
const handleDragEnd = async (result: any) => {
  if (!result.destination) return;
  
  const items = Array.from(pages);
  const [reorderedItem] = items.splice(result.source.index, 1);
  items.splice(result.destination.index, 0, reorderedItem);
  
  // Update local state immediately for smooth UX
  setPages(items);
  
  // Save to backend
  const updates = items.map((page, index) => ({
    page_id: page.id || page.Id || 0,
    display_order: index
  }));
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/pages/reorder`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${btoa(JSON.stringify({ email: session?.user?.email, authenticated: true }))}`
      },
      body: JSON.stringify({ updates })
    });
    
    if (!response.ok) {
      console.error('Failed to save order:', response.status);
      // Revert on error
      await fetchPages();
    }
  } catch (error) {
    console.error('Error saving page order:', error);
    // Revert on error
    await fetchPages();
  }
};
```

## Step 3: Wrap the Table with Drag-and-Drop

Find the table (around line 840-920) and replace it with:

```typescript
<DragDropContext onDragEnd={handleDragEnd}>
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead className="bg-muted/50">
        <tr>
          <th className="text-left p-4 font-medium w-8"></th>
          <th className="text-left p-4 font-medium">Name</th>
          <th className="text-left p-4 font-medium">Path</th>
          <th className="text-left p-4 font-medium">Category</th>
          <th className="text-left p-4 font-medium">Type</th>
          <th className="text-left p-4 font-medium">Access Groups</th>
          <th className="text-left p-4 font-medium">Actions</th>
        </tr>
      </thead>
      <Droppable droppableId="pages">
        {(provided) => (
          <tbody {...provided.droppableProps} ref={provided.innerRef}>
            {pages.map((page, index) => (
              <Draggable 
                key={String(page.Id || page.id)} 
                draggableId={String(page.Id || page.id)} 
                index={index}
              >
                {(provided, snapshot) => (
                  <tr
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`border-b border-border ${snapshot.isDragging ? 'bg-accent' : ''}`}
                  >
                    <td className="p-4">
                      <div {...provided.dragHandleProps}>
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span>{page.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <code className="text-sm bg-muted px-2 py-1 rounded">{page.path}</code>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {page.category}
                      </span>
                    </td>
                    <td className="p-4">
                      {page.is_external ? (
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <ExternalLink className="h-4 w-4" />
                          External
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Internal</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {page.allowed_groups && page.allowed_groups.length > 0 ? (
                          page.allowed_groups.map((group, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-accent text-accent-foreground"
                            >
                              {group}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No groups assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPage(page);
                          }}
                          title="Edit Page"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPermissionsModal(page)}
                          title="Manage Permissions"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePage(page.Id || page.id || 0)}
                          title="Delete Page"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </tbody>
        )}
      </Droppable>
    </table>
  </div>
</DragDropContext>
```

## What's Done:

1. ✅ Library installed (`@hello-pangea/dnd`)
2. ✅ Imports added to pages component
3. ✅ Backend models added (`PageOrderUpdate`, `BulkPageOrderUpdate`)
4. ✅ Backend endpoint structure provided (see ADD_REORDER_ENDPOINT.md)
5. ✅ SQL migration created (migrations/add_display_order_column.sql)
6. ✅ Frontend drag handler code provided above
7. ✅ Permissions update function improved with feedback

## What You Need to Do:

1. **Run SQL migration** to add `display_order` column:
   ```sql
   -- Run in MySQL
   ALTER TABLE pages ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0;
   UPDATE pages SET display_order = id WHERE display_order = 0;
   ```

2. **Add backend endpoint** to `backend/app/main.py` (see ADD_REORDER_ENDPOINT.md)

3. **Add drag handler** to frontend (see Step 2 above)

4. **Replace table** with drag-drop version (see Step 3 above)

5. **Restart uvicorn** to load the new endpoint

Then you'll be able to drag and drop pages to reorder them!
