# Creating New Pages - Complete Guide

# Creating New Pages - Complete Guide

> **⚠️ CRITICAL RULES:**
> - **ALWAYS use toast notifications** (`react-hot-toast`) - NEVER use `alert()`
> - **ALWAYS extract detailed error messages** from backend responses
> - **ALWAYS wrap pages with `WithPageAccess`** for authentication
> - See [Toast Standards](#toast-notification-standards) section below

This guide walks you through creating new authenticated pages in the Scale42 project, ensuring they work with the group-based permissions system.

## 🔐 Authentication System Overview

All pages in the application use **group-based authentication**. Pages are protected using the `WithPageAccess` component, which:
- Checks if the user is logged in
- Fetches the user's accessible pages from the database
- Verifies the user has permission to access the current page
- Shows loading state while checking permissions
- Redirects to `/unauthorized` if access is denied

## 📋 Steps to Create a New Page

### 1. Create the Page File

Create your page file in `frontend/app/{page-name}/page.tsx`

```tsx
"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardLayout from '@/components/DashboardLayout';
import { WithPageAccess } from '@/components/WithPageAccess';
import { useToast } from "@/components/ui/use-toast";

// Your page content component
function YourPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  
  // Your page logic here
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Your Page Title</h1>
        {/* Your page content */}
      </div>
    </DashboardLayout>
  );
}

// Default export with authentication wrapper
export default function YourPage() {
  return (
    <WithPageAccess pagePath="/your-page-path">
      <YourPageContent />
    </WithPageAccess>
  );
}
```

### 2. Add Page to Database

Add the page to the `pages` table in MySQL:

```sql
INSERT INTO pages (name, path, icon, category, is_external, is_active, display_order) 
VALUES (
  'Your Page Name',      -- Display name in menu
  '/your-page-path',     -- URL path (must match pagePath in WithPageAccess)
  'YourIconName',        -- Lucide icon name
  'Your Category',       -- Category for menu grouping
  0,                     -- 0 for internal, 1 for external
  1,                     -- 1 for active, 0 for inactive
  100                    -- Display order (lower = higher in menu)
);
```

### 3. Assign Page Permissions

Assign the page to groups in the `page_permissions` table:

```sql
-- Get the page ID
SET @page_id = (SELECT id FROM pages WHERE path = '/your-page-path');

-- Assign to Scale42 group
INSERT INTO page_permissions (page_id, group_id, permission_level, is_active)
SELECT @page_id, id, 'read', TRUE
FROM user_groups WHERE name = 'Scale42';

-- Assign to Public group (if needed)
INSERT INTO page_permissions (page_id, group_id, permission_level, is_active)
SELECT @page_id, id, 'read', TRUE
FROM user_groups WHERE name = 'Public';
```

**Or use the Page Management UI:**
1. Go to `/pages` (Page Management)
2. Click "Add Page"
3. Fill in the form
4. Select which groups can access the page
5. Click "Save"

### 4. Add Icon to Frontend

Make sure the icon is imported in the icon mapping:

**File**: `frontend/app/pages/page.tsx` or `frontend/components/DynamicMenu.tsx`

```tsx
import { 
  Home, 
  Settings, 
  Users,
  YourIconName // Add your icon here
} from 'lucide-react';

// Add to icon mapping
const iconMap = {
  Home,
  Settings,
  Users,
  YourIconName, // Map the icon
  // ... other icons
};
```

## 🎨 Toast Notifications

All pages use a **uniform toast system** positioned at **bottom-left**.

### Toast Configuration

**File**: `frontend/components/ui/toaster.tsx`

```tsx
import { Toaster } from "@/components/ui/toaster"

export function ToastProvider() {
  return <Toaster />
}
```

### Using Toasts in Your Page

```tsx
import toast from 'react-hot-toast';

function YourPageContent() {
  
  // Success toast
  const showSuccess = () => {
    toast.success('Operation completed successfully');
  };
  
  // Error toast
  const showError = () => {
    toast.error('Something went wrong');
  };
  
  // Info/custom toast
  const showInfo = () => {
    toast('Here is some information', {
      icon: 'ℹ️',
      duration: 3000,
    });
  };
  
  // Loading toast
  const showLoading = () => {
    const toastId = toast.loading('Processing...');
    
    // Later, update it to success
    setTimeout(() => {
      toast.success('Done!', { id: toastId });
    }, 2000);
  };
  
  // Promise toast (automatic loading/success/error)
  const handleAsyncOperation = async () => {
    await toast.promise(
      fetch('/api/some-endpoint'),
      {
        loading: 'Saving...',
        success: 'Saved successfully!',
        error: 'Failed to save',
      }
    );
  };
  
  return (
    // Your component
  );
}
```

### Toast Options

```tsx
toast('Message', {
  duration: 4000,        // Duration in milliseconds (default: 4000)
  icon: '🔥',           // Custom icon
  position: 'bottom-left', // Position (configured globally)
  style: {
    background: '#333',  // Custom background
    color: '#fff',       // Custom text color
  },
});
```

### Toast Variants

- `toast.success('Message')` - Green success toast with checkmark
- `toast.error('Message')` - Red error toast with X
- `toast.loading('Message')` - Loading toast with spinner
- `toast('Message')` - Neutral toast
- `toast.promise(promise, options)` - Automatic loading/success/error

---

## 🎯 Toast Notification Standards

> **⚠️ CRITICAL: ALWAYS use toast notifications. NEVER use `alert()`**

### Why Toast > Alert
- ✅ Better UX (bottom-left, non-blocking)
- ✅ Consistent styling across app
- ✅ Can show detailed error messages
- ✅ Auto-dismisses after timeout
- ❌ `alert()` blocks the UI and looks unprofessional

### Detailed Error Messages - REQUIRED

**ALWAYS extract detailed errors from backend responses:**

```tsx
// ❌ BAD - Generic error
if (!response.ok) {
  toast.error('Failed to save');
}

// ✅ GOOD - Detailed error from backend
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
  const errorMessage = errorData.detail || `Failed to save (${response.status})`;
  toast.error(errorMessage);
  console.error('Save error:', response.status, errorData);
}
```

### Complete Error Handling Pattern

```tsx
const saveData = async () => {
  try {
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      // Success - be specific
      toast.success('Data saved successfully');
      refreshData();
    } else {
      // Extract detailed error from backend
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      const errorMessage = errorData.detail || `Failed to save data (${response.status})`;
      toast.error(errorMessage);
      console.error('API error:', response.status, errorData);
    }
  } catch (error) {
    // Network or other errors
    console.error('Network error:', error);
    toast.error('Failed to save data. Check console for details.');
  }
};
```

### Benefits of Detailed Errors
1. **Users see the real problem** (e.g., "Duplicate name" instead of "Failed")
2. **Faster debugging** with HTTP status codes
3. **Better user experience** with actionable error messages
4. **Consistent logging** with `console.error()`

### Toast Position
All toasts appear at **bottom-left** (configured in `Providers.tsx`). No need to specify position in each toast call.

---

### Toast Position

All toasts appear at **bottom-left** of the screen (configured globally in Toaster component).

## 🚨 Access Denied Handling

When a user tries to access a page they don't have permission for:

1. `WithPageAccess` component checks permissions
2. If denied, redirects to `/unauthorized`
3. Toast notification shows: "Access denied. You don't have permission to view this page."
4. After 2 seconds, redirects to `/` (dashboard)
5. Dashboard shows another toast: "Redirected from unauthorized page"

### Custom Unauthorized Behavior

You can customize the redirect behavior:

```tsx
<WithPageAccess 
  pagePath="/your-page" 
  redirectTo="/custom-page"  // Default is '/unauthorized'
>
  <YourPageContent />
</WithPageAccess>
```

## 📁 File Structure

```
frontend/
├── app/
│   ├── your-page/
│   │   └── page.tsx              # Your page component
│   ├── api/
│   │   └── pages/
│   │       └── user/
│   │           └── route.ts      # API to fetch user pages
│   └── unauthorized/
│       └── page.tsx              # Unauthorized page
├── components/
│   ├── WithPageAccess.tsx        # Page authentication wrapper
│   ├── DashboardLayout.tsx       # Layout with sidebar
│   └── ui/
│       ├── toaster.tsx           # Toast container
│       ├── toast.tsx             # Toast component
│       └── use-toast.ts          # Toast hook
└── lib/
    └── auth-utils.ts             # Authentication utilities

backend/
└── app/
    └── main.py
        ├── GET /pages/user-mysql/{email}    # Fetch user's accessible pages
        ├── GET /pages-mysql                 # Fetch all pages
        ├── POST /pages                      # Create new page
        ├── PUT /pages/{page_id}            # Update page
        └── PUT /pages/reorder              # Reorder pages
```

## 🔍 Debugging

### Check User's Groups

```tsx
import { getUserGroups } from '@/lib/auth-utils';

const groups = getUserGroups(session);
console.log('User groups:', groups);
```

### Check User's Accessible Pages

```tsx
const response = await fetch(`/api/pages/user?email=${session.user.email}`);
const pages = await response.json();
console.log('Accessible pages:', pages);
```

### Browser Console Logs

The `WithPageAccess` component logs:
- "WithPageAccess: Checking access for path: {path}"
- "WithPageAccess: User groups: [...]"
- "WithPageAccess: User accessible pages: [...]"
- "WithPageAccess: User has access to page: {name}"
- "WithPageAccess: User does NOT have access to page: {path}"

## ⚠️ Common Issues

### Issue: Page shows "Access Denied"
**Solution**: Check that:
1. Page exists in `pages` table
2. Page has correct `path` value (must match `pagePath` prop)
3. User's group is assigned to page in `page_permissions` table
4. Permission is active (`is_active = TRUE`)

### Issue: Page not showing in menu
**Solution**: Check that:
1. User's group has permission to the page
2. Page is active (`is_active = TRUE` in pages table)
3. Icon name matches a Lucide icon
4. DynamicMenu component includes the icon in its mapping

### Issue: Toast appears in wrong position
**Solution**: Check that Toaster component is configured with bottom-left position

### Issue: Environment variable NEXT_PUBLIC_BACKEND_BASE_URL is undefined
**Solution**: 
1. Check `.env.local` file exists in `frontend/` folder
2. Verify it contains `NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000`
3. Restart Next.js dev server
4. Clear browser cache

## 📝 Checklist for New Pages

- [ ] Created page file in `frontend/app/{page-name}/page.tsx`
- [ ] Wrapped content with `<WithPageAccess pagePath="/page-path">`
- [ ] Added page to database `pages` table
- [ ] Assigned permissions in `page_permissions` table
- [ ] Added icon import if using custom icon
- [ ] Tested page loads with authorized user
- [ ] Tested page redirects with unauthorized user
- [ ] Verified toast notifications work
- [ ] Added any page-specific documentation
- [ ] Committed changes to git

## 🎯 Best Practices

1. **Always use WithPageAccess** - Never skip authentication
2. **Match paths exactly** - `pagePath` prop must match database `path` column
3. **Use DashboardLayout** - Provides consistent UI with sidebar
4. **Use toast for feedback** - Show success/error messages to users
5. **Handle loading states** - Show spinners during data fetching
6. **Log debug info** - Use console.log during development
7. **Clean up on unmount** - Clear intervals, subscriptions, etc.
8. **Follow naming conventions** - Use kebab-case for paths, PascalCase for components

## 🔗 Related Documentation

- [Authentication System](./authentication.md)
- [Architecture Overview](./architecture.md)
- [Desktop Instructions](./desktop.instructions.md)
- [API Documentation](./api-documentation.md)
