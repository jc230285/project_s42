# Authentication Testing Guide

## ✅ Fixed Issues

### 1. **Missing Authentication Wrapper on Users Page**
- **Problem**: Users page (`/users`) was missing the `WithScale42Access` wrapper
- **Fix**: Added `WithScale42Access` wrapper to ensure only Scale42 group members can access the Users page
- **File**: `frontend/app/users/page.tsx`

### 2. **Case Sensitivity Issue in Group Matching**
- **Problem**: Auth utilities were looking for 'scale42' but database had 'Scale42' (case mismatch)
- **Fix**: Made group matching case-insensitive in `hasUserGroup()` function
- **File**: `frontend/lib/auth-utils.ts`

### 3. **Domain Mapping Inconsistency**
- **Problem**: Auth logic handled `scale42.no` but database had `scale-42.com` domain
- **Fix**: Updated domain mapping to handle both `scale42.no` and `scale-42.com` domains for Scale42 group
- **File**: `frontend/lib/auth.ts`

## 🧪 Test Scenarios

### Authentication Flow Testing

#### Test 1: Google Login Process
1. **Navigate to**: http://localhost:3150
2. **Expected**: See sign-in page with Google OAuth button
3. **Action**: Click "Sign in with Google"
4. **Expected**: Redirect to Google OAuth
5. **Expected**: After successful login, user should be created in database and assigned to appropriate group based on email domain

#### Test 2: Page Access Control
Test each page according to the access matrix:

| Page | URL | Expected for Non-Scale42 | Expected for Scale42 |
|------|-----|--------------------------|---------------------|
| Home | `/` | ✅ Accessible | ✅ Accessible |
| Projects | `/projects` | 🚫 Redirect to unauthorized | ✅ Accessible |
| Map | `/map` | 🚫 Redirect to unauthorized | ✅ Accessible |
| Schema | `/schema` | 🚫 Redirect to unauthorized | ✅ Accessible |
| Hoyanger | `/hoyanger` | 🚫 Redirect to unauthorized | ✅ Accessible |
| Accounts | `/accounts` | 🚫 Redirect to unauthorized | ✅ Accessible |
| Users | `/users` | 🚫 Redirect to unauthorized | ✅ Accessible |
| Tools (n8n, nocodb, drive, notion) | Various | ✅ Accessible | ✅ Accessible |

#### Test 3: Navigation Menu Visibility
1. **For non-Scale42 users**: Should only see Home, Tools, and Logout in sidebar
2. **For Scale42 users**: Should see all menu items including Projects, Hoyanger Power, Account Management, and Users

#### Test 4: Backend API Authentication
```bash
# Test without auth (should fail)
curl http://localhost:8150/users

# Test with auth (should succeed)
Invoke-WebRequest -Uri "http://localhost:8150/users" -Headers @{"Authorization"="Bearer dGVzdEB0ZXN0LmNvbQ=="}
```

### Domain Group Assignment Testing

#### Test 5: Scale42 Domain Mapping
Test users with these email domains should be assigned to Scale42 group:
- `user@scale42.no` → Scale42 group
- `user@scale-42.com` → Scale42 group

#### Test 6: Other Domain Mapping
Test users with other domains should get their own groups:
- `user@example.com` → example group
- `user@company.org` → company group

## 🔧 Backend API Endpoints

### Users Endpoint
- **URL**: `http://localhost:8150/users`
- **Auth Required**: Yes
- **Returns**: List of all users with group assignments

### Groups Endpoint
- **URL**: `http://localhost:8150/groups`
- **Auth Required**: Yes
- **Returns**: List of all groups with domains

## 🗄️ Database Structure

### Users Table
- `id`: User ID
- `email`: User email address
- `name`: User display name
- `created_at`: Account creation timestamp
- `group assignments`: Via UserGroup junction table

### Groups Table
- `id`: Group ID  
- `name`: Group name (e.g., "Scale42")
- `domain`: Associated domain (e.g., "scale-42.com")
- `created_at`: Group creation timestamp

## 🎯 Manual Testing Steps

1. **Start the application**:
   ```bash
   cd c:\scripts\project_S42v3
   docker-compose up --build -d
   ```

2. **Open frontend**: http://localhost:3150

3. **Test authentication flow**:
   - Try accessing protected pages without login
   - Sign in with Google
   - Verify group assignment in database
   - Test page access based on group membership

4. **Test different user types**:
   - Scale42 domain users (should have full access)
   - Other domain users (should have limited access)

## ✅ Authentication Components Verified

- ✅ Google OAuth configuration
- ✅ User creation and group assignment on sign-in
- ✅ JWT token handling in callbacks
- ✅ Page-level authentication wrappers
- ✅ Navigation menu filtering based on permissions
- ✅ Backend API authentication
- ✅ Case-insensitive group matching
- ✅ Domain-to-group mapping logic
- ✅ Unauthorized page for access denial

## 🔍 Current Status

**Authentication system is fully configured and ready for testing.**

All critical authentication components have been reviewed and fixed. The system now properly:
- Handles Google OAuth login
- Creates users and assigns them to groups based on email domain
- Protects pages based on Scale42 group membership
- Shows/hides navigation items appropriately
- Validates API requests with proper authentication

**Next step**: Manual testing with actual Google accounts to verify the complete flow.