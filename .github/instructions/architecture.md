---
applyTo: '**'
---

# Project S42 Architecture Instructions for AI

This file provides comprehensive architectural context for AI assistants working on the Project S42 codebase.

## Current Working State (Updated Oct 4, 2025)

### **Application Status:**
- **Frontend**: Next.js running on port 3000 with dashboard as homepage (`/`)
- **Backend**: Flask backend running on port 8000 with CORS support (temporary development solution)
- **Primary Backend**: FastAPI application (`backend/app/main.py`) - production solution
- **Development Backend**: Flask backup (`tests/flask_backend.py`) - current working solution
- **Database**: MySQL at 10.1.8.51:3306 with 12 active pages configured
- **Page Management**: Category dropdown and category reordering now working with drag-and-drop functionality

### **Recent Updates:**
- **Dashboard as Homepage**: Root route (`/`) now serves dashboard content instead of separate `/dashboard` route
- **Unauthorized Redirects**: All unauthorized users redirect to `/` (dashboard homepage) instead of `/unauthorized`
- **Page Management**: **FULLY WORKING** - Can create/edit pages and save permissions via Flask backend
- **Page Table Ordering**: **FIXED** - Comprehensive data cleaning and normalization ensures consistent ordering everywhere
- **Category Management**: **WORKING** - Category dropdown populated with options, drag-and-drop category reordering implemented, enhanced input field allows custom categories
- **Navigation Menu Duplicates**: **FIXED** - Eliminated duplicate page entries through robust deduplication and data normalization
- **Category Normalization**: **AUTOMATED** - Legacy categories automatically normalized: "Debug" → "Management", "Hoyanger" → "Projects" 
- **Data Consistency**: **ENHANCED** - Both navigation menu and page management table now use unified data cleaning pipeline
- **Test File Organization**: All test scripts moved to `tests/` folder and excluded from git
- **CORS Resolution**: **FIXED** - Resolved duplicate CORS headers causing "multiple values '*, *'" error
- **API Endpoints**: **ALL WORKING** - Added missing /user-info, /create-user, /add-single-page endpoints
- **Authentication**: **FIXED** - NextAuth now properly fetches user groups from correct backend (port 8000)
- **User Groups**: James Collins properly assigned to Scale42 and Public groups
- **Database Schema**: Fixed page creation by including required 'path' field

### **Navigation & Access Control:**
- **Public Routes**: `/` (Dashboard), `/tools/*` (NocoDb, N8N, Drive)
- **Scale42 Protected**: `/projects/*`, `/map/*`, `/schema/*`, `/hoyanger/*`, `/accounts/*`, `/users/*`, `/pages` (management)
- **Dynamic Menu**: Shows pages based on user group membership from backend API
- **Group Access**: Public group provides default access, Scale42 group provides admin access

### **Backend API Status:**
- **Working Endpoints**: 
  - `GET /pages-mysql` - List all pages with permissions ✅
  - `GET /pages/user-mysql/{email}` - Get user accessible pages ✅
  - `PUT /pages/{id}/permissions` - Update page permissions ✅
  - `GET /groups` - List all available groups ✅
  - `GET /user-info/{email}` - Get user information and groups ✅
  - `POST /create-user` - Create new user with Public group assignment ✅
  - `POST /add-single-page` - Create new page with permissions ✅
  - `GET /users` - List all users with their groups ✅
  - `PUT /users/{id}` - Update user details ✅
  - `DELETE /users/{id}` - Soft delete user ✅
  - `POST /users/{id}/groups` - Assign user to group ✅
  - `DELETE /users/{id}/groups/{group_id}` - Remove user from group ✅
  - `POST /groups` - Create new group ✅
  - `PUT /groups/{id}` - Update group details ✅
  - `DELETE /groups/{id}` - Soft delete group ✅
- **Authentication**: All endpoints include Public group access for authenticated users
- **CORS**: Properly configured for localhost:3000 frontend integration
- **Group System**: 6 groups available (Developers, gmail, Guests, Public, Scale42, Viewers)
- **User System**: 9 active users with group assignments

## System Architecture Overview

### **Tech Stack:**
- **Frontend:** Next.js 13.4+ with TypeScript, Tailwind CSS, NextAuth.js authentication
- **Backend:** FastAPI (Python) with automatic OpenAPI documentation
- **Database:** MySQL with two main schemas via Tailscale VPN
- **Deployment:** Docker containers, Coolify for production, GitHub auto-deploy
- **Network:** Tailscale mesh VPN for secure internal resource access

### **Port Configuration:**
- **Development Mode**: 
  - Frontend: `http://localhost:3000` (npm dev server)
  - Backend: `http://localhost:8000` (FastAPI with --reload)
- **Docker Mode**: 
  - Frontend: `http://localhost:3150` (containerized Next.js)
  - Backend: `http://localhost:8150` (containerized FastAPI)
- **Production**: 
  - Frontend: `https://s42.edbmotte.com`
  - Backend: `https://s42api.edbmotte.com`
- **Database**: `10.1.8.51:3306` (via Tailscale VPN for all modes)

### **Environment Variables:**
- `FRONTEND_BASE_URL`: Frontend server URL 
  - Dev: `http://localhost:3000`
  - Docker: `http://localhost:3150` 
  - Production: `https://s42.edbmotte.com`
- `BACKEND_BASE_URL`: Backend server URL
  - Dev: `http://localhost:8000`
  - Docker: `http://localhost:8150`
  - Production: `https://s42api.edbmotte.com`
- `NEXT_PUBLIC_BACKEND_BASE_URL`: Public backend URL for frontend API calls
- `DATABASE_URL`: MySQL connection string for backend (same for all modes)

## Development Workflow

### **Directory Structure:**
```
project_s42/
├── backend/           # FastAPI Python backend (primary)
│   ├── app/
│   │   ├── main.py   # Main FastAPI application
│   │   └── ...
│   └── Dockerfile
├── frontend/          # Next.js TypeScript frontend
│   ├── app/          # Next.js 13+ app directory
│   │   ├── page.tsx  # Dashboard homepage (root route)
│   │   ├── pages/    # Page management interface
│   │   └── ...
│   ├── components/   # Reusable React components
│   ├── lib/          # Utilities and configuration
│   └── prisma/       # Database schema definitions
├── tests/            # Development test scripts (gitignored)
│   ├── flask_backend.py  # Working Flask backend (temporary)
│   ├── start_backend.py  # Backend test scripts
│   └── ...
└── .github/
    └── instructions/ # AI context files (this directory)
```

### **Key Files to Understand:**
- `backend/app/main.py`: Main FastAPI application with all API endpoints
- `frontend/app/layout.tsx`: Root layout with authentication providers
- `frontend/middleware.ts`: Route protection and authentication middleware
- `frontend/lib/auth.ts`: NextAuth.js configuration
- `docker-compose.yml`: Container orchestration for development

## Database Architecture

### **Connection Details:**
- **Host:** 10.1.8.51:3306 (accessible only via Tailscale VPN)
- **Schemas:** 
  - `nocodb`: Project and plot data (main business logic)
  - `management_accounts`: Financial data (companies, accounts)
- **Access Pattern:** Backend connects directly, frontend never connects directly
- **Authentication:** MySQL credentials in backend environment variables

### **Important Tables:**

#### Page Management System Tables:
```sql
-- Users table for authentication and user management
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    nocodb_api VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE
);

-- Groups table for permission-based access control
CREATE TABLE groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    domain VARCHAR(255),
    permissions JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for many-to-many user-group relationships
CREATE TABLE user_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    group_id INT NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_group (user_id, group_id)
);

-- Pages table for navigation and access control
CREATE TABLE pages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL UNIQUE,
    icon VARCHAR(100) DEFAULT 'Globe',
    category VARCHAR(100) DEFAULT 'Other',
    is_external BOOLEAN DEFAULT FALSE,
    url TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Page permissions table for granular access control
CREATE TABLE page_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    page_id INT NOT NULL,
    group_id INT NOT NULL,
    permission_level VARCHAR(50) DEFAULT 'read',
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE KEY unique_page_group (page_id, group_id)
);
```

#### Business Data Tables:
- `nocodb.projects`: Main project data
- `nocodb.plots`: Plot/land data associated with projects
- `management_accounts.companies`: Company information
- `management_accounts.accounts`: Financial account data

## Authentication & Authorization

### **Enhanced Security Model:**
1. **Many-to-Many User-Group Relationships**: Users can belong to multiple groups simultaneously
2. **Role-Based Access**: Each user-group assignment has a role (member, admin, etc.)
3. **Granular Permissions**: Groups have JSON-based permission configurations
4. **Active Status Management**: Both users and groups can be activated/deactivated
5. **Assignment Tracking**: Track who assigned users to groups and when

### **Authentication Flow:**
1. NextAuth.js handles Google OAuth
2. Users auto-assigned to groups based on email domain
3. JWT tokens contain user email for backend authorization
4. Middleware protects routes based on combined group permissions
5. Users inherit permissions from all their active groups

### **Database Schema:**
- **users**: Core user information (id, email, name, is_active)
- **groups**: Permission groups (id, name, domain, description, permissions JSON, is_active)
- **user_groups**: Junction table (user_id, group_id, role, assigned_at, assigned_by, is_active)

### **Default Groups:**
- **Scale42**: Full system access (scale-42.com, edbmotte.com domains)
- **Developers**: Technical access to projects and tools
- **Viewers**: Read-only access to most content
- **Guests**: Limited access to dashboard and basic tools

### **Permission Structure (JSON):**
```json
{
  "pages": ["dashboard", "projects", "map", "schema", "accounts", "users"],
  "actions": ["read", "write", "delete", "admin"]
}
```

### **User Management Features:**
- Add/remove users from multiple groups
- Assign different roles within groups
- Track assignment history and responsible parties
- Bulk permission management through group updates
- Domain-based automatic group assignment

### **Page Management System:**

#### Available Page Categories:
1. **Navigation**: Dashboard (main overview)
2. **Projects**: Projects, Schema, Map, Hoyanger (project-specific data)
3. **Financial**: Accounts (financial account management) 
4. **Tools**: NocoDb, N8N, Drive (external tool access)
5. **Management**: Users, Page Management (Scale42 group only)
6. **Development**: Debug (development and debugging tools)

#### Permission Levels:
- **read**: View access only
- **admin**: Full access including modification

#### User Groups:
- **Scale42**: Full system access (scale-42.com, edbmotte.com domains)
  - Admin access to all pages including Management category
  - 8 current members: daniel, jamie, william, tom, bendik, zeehan, ismael, james @scale-42.com
- **Public**: Default group for all users
  - Read access to Navigation, Projects, Tools, and Development pages
  - No access to Management or Financial pages
- **Developers**: Technical access to projects and tools
- **Viewers**: Read-only access to most content
- **Guests**: Limited access to dashboard and basic tools

### **Protected Routes:**
- Projects, Map, Schema pages: Scale42 group only
- Account Management: Scale42 group only
- Tools (n8n, nocodb, etc.): Any authenticated user
- Dashboard: Any authenticated user

## API Design Patterns

### **Backend API (FastAPI):**
- **Base URL:** `http://localhost:8150` (dev) or `https://s42api.edbmotte.com` (prod)
- **Documentation:** Available at `/docs` endpoint (Swagger UI)
- **CORS:** Configured for frontend domains using environment variables
- **Authentication:** Bearer token with user email
- **Response Format:** JSON with consistent error handling

### **Frontend API Calls:**
- **Pattern:** Direct calls to backend (no proxy routes)
- **Base URL:** Uses `NEXT_PUBLIC_BACKEND_BASE_URL` environment variable
- **Authentication:** Automatic token injection via NextAuth session
- **Error Handling:** Consistent error boundaries and user feedback

### **Key API Endpoints:**
- `/projects`: Project CRUD operations
- `/management-accounts/companies`: Company data
- `/management-accounts/accounts`: Financial account data
- `/users`: User management with group relationships
- `/groups`: Group management and permissions
- `/users/{id}/groups`: Get/manage user's group memberships
- `/groups/{id}/users`: Get users in a specific group
- `/auth/user-groups`: Legacy user group management
- `/pages-mysql`: Get all pages with permissions
- `/pages/user-mysql/{email}`: Get pages accessible to specific user
- `/setup-original-pages`: Initialize default page structure
- `/add-single-page`: Add individual page with automatic permissions

## Common Development Scenarios

### **For Frontend Changes:**
```
Frontend architecture:
- Next.js 13+ with app directory structure
- TypeScript for type safety
- Tailwind CSS for styling
- Components in /components directory
- Pages in /app directory with page.tsx files
- Authentication via NextAuth.js with middleware protection
- API calls use fetch with NEXT_PUBLIC_BACKEND_BASE_URL

[Describe your frontend request here]
```

### **For Backend Changes:**
```
Backend architecture:
- FastAPI with automatic OpenAPI documentation
- Python with async/await patterns
- MySQL database connection via environment variables
- CORS middleware for frontend communication
- JWT token validation for protected endpoints
- All business logic centralized in backend

[Describe your backend request here]
```

### **For Database Operations:**
```
Database architecture:
- MySQL server at 10.1.8.51:3306 (accessible via Tailscale VPN)
- Main schemas: 'nocodb' (projects/plots data) and 'management_accounts' (companies/financial)
- Tables include: projects, plots, companies, accounts, users, groups
- All API calls go through FastAPI backend, no direct DB connections from frontend
- Ensure Tailscale is connected for database access

[Describe your database request here]
```

### **For Authentication Issues:**
```
Authentication setup:
- NextAuth.js with Google OAuth
- Custom user groups based on email domain
- Scale42 group required for most pages
- JWT tokens with user email for backend authorization
- Middleware protection on protected routes

[Describe your auth issue here]
```

### **For API Development:**
```
API architecture:
- Frontend calls backend directly (no proxy routes)
- FastAPI backend with automatic OpenAPI docs at /docs
- CORS configured for frontend domain
- Authorization via Bearer tokens (user email)
- RESTful endpoints for projects, accounts, users

[Describe your API request here]
```

## Development Environment Setup

### **Deployment Modes:**

#### **1. Development Mode (Recommended for coding):**
- **Ports**: Frontend 3000, Backend 8000
- **Features**: Hot reload, debug mode, fastest iteration
- **Use Case**: Active development, debugging, testing features
- **Command**: Run `start-servers.bat` → Choose option 1

#### **2. Docker Mode (Production-like testing):**
- **Ports**: Frontend 3150, Backend 8150  
- **Features**: Containerized, production-like environment
- **Use Case**: Testing deployments, debugging container issues
- **Command**: Run `start-servers.bat` → Choose option 2

#### **3. Windows Services (Always-on local server):**
- **Ports**: Frontend 3000, Backend 8000
- **Features**: Runs as background services, auto-start with Windows
- **Use Case**: Local production server, team development server
- **Command**: Run `start-servers.bat` → Choose option 3

#### **4. Production (Live system):**
- **URLs**: s42.edbmotte.com, s42api.edbmotte.com
- **Features**: CDN, SSL, auto-scaling, monitoring
- **Use Case**: End-user access, production workloads
- **Deployment**: Automatic via GitHub pushes

### **Quick Start Commands:**

#### **Development Mode:**
```bash
# Option 1: Use start-servers.bat
start-servers.bat

# Option 2: Manual start
# Backend (port 8000)
cd backend/app
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (port 3000) 
cd frontend
npm run dev -- --port 3000
```

#### **Docker Mode:**
```bash
# Option 1: Use start-servers.bat  
start-servers.bat

# Option 2: Manual Docker
docker-compose build
docker-compose up -d
```

#### **Windows Services:**
```bash
# Setup services (one-time)
start-servers.bat → Choose option 3

# Manage services
net start S42Backend
net start S42Frontend
net stop S42Backend  
net stop S42Frontend
```

### **Environment Files:**
- **Development Mode:**
  - Frontend: `.env.local` (NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8000)
  - Backend: `.env` (development database settings)
- **Docker Mode:**
  - Frontend: `.env.local` (NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8150)  
  - Backend: `.env` (loaded into containers)
- **Production:** 
  - All settings from `remote.env` for production deployments

### **Port Management:**
- **Development**: 3000 (frontend), 8000 (backend)
- **Docker**: 3150 (frontend), 8150 (backend)
- **Services**: Same as development (3000, 8000) but as Windows services
- **Production**: 443/80 via domain names

### **Service Management:**
```bash
# Check all server status
start-servers.bat → Choose option 5

# Stop all servers  
start-servers.bat → Choose option 4

# Windows Services (if installed)
services.msc
net start/stop S42Backend
net start/stop S42Frontend
```

## Troubleshooting Guide

### **Port Conflicts:**
- **Development ports**: Check `netstat -an | findstr 3000` or `netstat -an | findstr 8000`
- **Docker ports**: Check `netstat -an | findstr 3150` or `netstat -an | findstr 8150`
- **Stop processes**: Use `start-servers.bat` → option 4 (stops all modes)
- **Manual cleanup**: `taskkill /F /IM node.exe` or `taskkill /F /IM python.exe`

### **Service Issues:**
- **Windows Services**: Check `services.msc` for S42Backend/S42Frontend status
- **Docker containers**: `docker ps` and `docker logs project_s42-backend-1`
- **Development servers**: Check command windows opened by start-servers.bat

### **Database Connection:**
- **All modes connect to**: 10.1.8.51:3306 via Tailscale VPN
- **Troubleshooting**: Ensure Tailscale is running and connected
- **Check connection**: `tailscale status` and `ping 10.1.8.51`

### **CORS Issues:**
- Backend CORS configured for localhost:3150 and production domains
- Uses environment variables for dynamic origins
- Check FastAPI logs for CORS errors

### **Database Connection:**
- Backend connects to MySQL at 10.1.8.51:3306 via Tailscale VPN
- Ensure Tailscale is running and connected
- Check connection: `tailscale status` and `ping 10.1.8.51`

### **Tailscale Issues:**
- Check Tailscale connection: `tailscale status`
- Verify database IP reachable: `ping 10.1.8.51`
- Look for Tailscale system tray icon
- Reconnect if needed: `tailscale up`

## Production Deployment

### **Deployment Process:**
- Automatic deployment via GitHub pushes
- Coolify manages Docker containers in production
- Environment variables loaded from `remote.env`
- Database remains at 10.1.8.51:3306 for all environments

### **Production URLs:**
- Frontend: https://s42.edbmotte.com
- Backend API: https://s42api.edbmotte.com
- Backend Documentation: https://s42api.edbmotte.com/docs

## Code Standards

### **TypeScript:**
- Strict type checking enabled
- Prefer interfaces over types for object shapes
- Use proper async/await patterns
- Components should have proper TypeScript definitions

### **Python:**
- Follow FastAPI best practices
- Use async/await for database operations
- Proper error handling with HTTP status codes
- Type hints for all function parameters and returns

### **General:**
- Environment variables for all configuration
- No hardcoded URLs or credentials
- Consistent error handling across layers
- Comprehensive logging for debugging