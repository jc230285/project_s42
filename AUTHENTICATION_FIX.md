# Authentication Protection Fix

## Problem
The Page Management page (`/pages`) was accessible even when logged out, violating security requirements.

## Root Causes Identified

### 1. Missing Authentication Protection
- The `/pages` route was not wrapped with authentication protection
- Anyone could access the page management interface without logging in

### 2. CORS Configuration Error
- FastAPI backend (`backend/app/main.py`) only allowed Docker ports (3150, 8150)
- Development ports (3000, 8000) were not in the CORS allowed origins
- This caused `ERR_FAILED` errors when frontend tried to fetch data

### 3. Backend Confusion
- Two backends exist:
  - `tests/flask_backend.py` - Flask development backend with recent features
  - `backend/app/main.py` - FastAPI production backend (used by start-servers.bat)
- The start-servers.bat script runs the FastAPI backend, NOT the Flask one
- Recent changes made to Flask backend were not reflected in FastAPI

## Fixes Applied

### Fix 1: Added Authentication Protection
**File:** `frontend/app/pages/page.tsx`

Wrapped the entire Page Management component with `WithScale42Access`:

```tsx
import { WithScale42Access } from '@/components/WithScale42Access';

export default function PageManagement() {
  // ... component logic ...
  
  return (
    <WithScale42Access>
      <DashboardLayout>
        {/* Page content */}
      </DashboardLayout>
    </WithScale42Access>
  );
}
```

**Result:** 
- Now redirects unauthenticated users to homepage
- Only Scale42 group members can access page management

### Fix 2: Updated CORS Configuration
**File:** `backend/app/main.py`

Added development ports to CORS allowed origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Dev frontend
        "http://localhost:3150",  # Docker frontend
        "http://localhost:8000",  # Dev backend
        "http://localhost:8150",  # Docker backend
        os.getenv('FRONTEND_BASE_URL', 'http://localhost:3150'),
        os.getenv('BACKEND_BASE_URL', 'http://localhost:8150')
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Result:**
- Frontend can now fetch data from backend without CORS errors
- Both dev and docker modes work correctly

## How Authentication Works Now

### Component Flow
1. **User visits `/pages`**
2. **WithScale42Access checks:**
   - Is user authenticated? (session exists)
   - Does user have Scale42 group membership?
3. **If NOT authenticated or NOT in Scale42:**
   - Redirects to `/` (homepage)
   - Shows unauthorized message if needed
4. **If authenticated AND in Scale42:**
   - Shows Page Management interface
   - Allows full CRUD operations

### Protected Routes Requiring Authentication
- `/pages` - Page Management (Scale42 only)
- `/users` - User Management (Scale42 only)
- `/debug` - Debug Tools (Scale42 only)
- Other management pages...

### Public Routes (No Auth Required)
- `/` - Homepage/Dashboard
- `/projects` - Project listing
- `/map` - Map view
- Other Public group pages...

## Testing the Fix

### 1. Test While Logged Out
```
1. Sign out if logged in
2. Navigate to http://localhost:3000/pages
3. Should redirect to / (homepage)
4. Should show "No accessible pages found" message
```

### 2. Test While Logged In (Non-Scale42 User)
```
1. Log in with account NOT in Scale42 group
2. Navigate to http://localhost:3000/pages
3. Should redirect to / (homepage)
4. Should show "Contact admin to assign groups" message
```

### 3. Test While Logged In (Scale42 User)
```
1. Log in with james@scale-42.com (in Scale42 group)
2. Navigate to http://localhost:3000/pages
3. Should show Page Management interface
4. Should be able to view/edit/delete pages
5. No CORS errors in console
```

## Backend Architecture Clarification

### Production Backend (Currently Running)
- **Location:** `backend/app/main.py`
- **Framework:** FastAPI with Uvicorn
- **Port:** 8000 (dev), 8150 (docker)
- **Started by:** `start-servers.bat`
- **Features:** Full API, CORS middleware, MySQL integration

### Development Backend (Not Running)
- **Location:** `tests/flask_backend.py`
- **Framework:** Flask
- **Port:** 8000 (when manually started)
- **Use:** Quick testing, prototyping new endpoints
- **Note:** Recent features added here need to be ported to main.py

## Important Notes

1. **Backend Reload:** The uvicorn server runs with `--reload` flag, so CORS changes apply automatically
2. **Session Check:** WithScale42Access uses `useSession()` from NextAuth
3. **Group Check:** Checks `session.user.groups` array for "Scale42" membership
4. **Fallback:** Redirects to `/` by default, customizable with `redirectTo` prop

## Next Steps

If you need to add authentication protection to other pages:

```tsx
import { WithScale42Access } from '@/components/WithScale42Access';

export default function YourPage() {
  return (
    <WithScale42Access redirectTo="/unauthorized">
      <YourPageContent />
    </WithScale42Access>
  );
}
```

## Verification Commands

Check if backend is running:
```powershell
netstat -ano | findstr ":8000"
```

Check CORS in browser console:
```javascript
// Should NOT see these errors anymore:
// ❌ Access to fetch at 'http://localhost:8000/...' blocked by CORS policy
// ❌ net::ERR_FAILED

// Should see successful requests:
// ✅ GET http://localhost:8000/pages-mysql 200
// ✅ GET http://localhost:8000/groups 200
```

## Summary

✅ **Fixed:** Page Management now requires authentication
✅ **Fixed:** CORS errors resolved for dev mode
✅ **Protected:** Only Scale42 group members can manage pages
✅ **Secure:** Unauthenticated users redirected to homepage
