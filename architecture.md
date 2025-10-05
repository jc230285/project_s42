# Project S42 - System Architecture

## Overview
Project S42 is a comprehensive web application for renewable energy project management with role-based access control, built on Next.js frontend with FastAPI backend and MySQL database.

## Core Components

### Frontend (Next.js 14)
- **Location**: `frontend/`
- **Port**: 3000 (development)
- **Key Features**:
  - Server-side rendering with App Router
  - NextAuth.js authentication
  - Role-based page access control
  - Dynamic navigation based on user permissions
  - Tailwind CSS styling with shadcn/ui components

### Backend (FastAPI/Flask)
- **Primary**: FastAPI application (`backend/app/main.py`)
- **Development**: Flask backup (`tests/flask_backend.py`)
- **Port**: 8000
- **Key Features**:
  - MySQL database integration
  - RESTful API endpoints
  - User authentication and authorization
  - Page and permission management
  - CORS support for frontend integration

### Database (MySQL)
- **Host**: 10.1.8.51:3306
- **Database**: nocodb
- **Key Tables**:
  - `users` - User account information
  - `groups` - Permission groups (Public, Scale42, Developers, etc.)
  - `user_groups` - User-to-group assignments
  - `pages` - Application pages/routes
  - `page_permissions` - Page access control per group

## Application Flow

### Authentication & Authorization
1. **Login**: NextAuth.js handles OAuth/credential authentication
2. **Session Management**: User groups loaded from database into session
3. **Route Protection**: Middleware checks group membership for protected routes
4. **Dynamic Navigation**: Menu items displayed based on user permissions

### Page Access Control
```
User Login → Group Assignment → Page Access Calculation → Dynamic Menu
```

### Protected Routes
- `/projects/*` - Scale42 group only
- `/map/*` - Scale42 group only  
- `/schema/*` - Scale42 group only
- `/hoyanger/*` - Scale42 group only
- `/accounts/*` - Scale42 group only
- `/users/*` - Scale42 group only

### Public Routes
- `/` (Dashboard) - All authenticated users (Public group)
- `/pages` - Page management (Scale42 admins)
- `/tools/*` - Public group access

## API Endpoints

### Pages Management
- `GET /pages-mysql` - List all pages with permissions
- `GET /pages/user-mysql/{email}` - Get pages accessible to user
- `PUT /pages/{id}/permissions` - Update page permissions
- `GET /groups` - List all available groups

### Authentication  
- `/api/auth/*` - NextAuth.js endpoints
- `/api/debug-session` - Session debugging

## Security Model

### Group Hierarchy
1. **Public** - Default group for all authenticated users
2. **Guests** - Limited access visitors
3. **Developers** - Technical team access
4. **Scale42** - Full administrative access
5. **Viewers** - Read-only access

### Permission Levels
- `read` - View access only
- `admin` - Full CRUD access
- `write` - Edit access (future implementation)

## Deployment Modes

### Development Mode
- Frontend: `npm run dev` on port 3000
- Backend: `uvicorn` or `flask` on port 8000
- Direct database connection

### Docker Mode  
- Frontend: Port 3150
- Backend: Port 8150
- Containerized services via docker-compose

### Production Mode
- Windows Services installation available
- Automated startup scripts
- Load balancing and SSL termination

## File Structure

```
project_s42/
├── frontend/               # Next.js application
│   ├── app/               # App router pages
│   ├── components/        # Reusable UI components
│   ├── lib/              # Utilities and auth helpers
│   └── prisma/           # Database schema
├── backend/              # FastAPI application
│   └── app/              # Main application code
├── tests/                # Development test scripts (gitignored)
├── docker-compose.yml    # Container orchestration
└── start-servers.bat     # Development startup script
```

## Key Configuration Files

- `frontend/.env.local` - Frontend environment variables
- `remote.env` - Backend database configuration  
- `docker-compose.yml` - Container definitions
- `frontend/middleware.ts` - Route protection logic
- `backend/app/main.py` - API endpoints and business logic

## Database Schema

### Users & Groups
```sql
users (id, email, name, is_active)
groups (id, name, domain, is_active) 
user_groups (user_id, group_id, is_active)
```

### Pages & Permissions  
```sql
pages (id, name, path, category, icon, is_external, url, is_active)
page_permissions (page_id, group_id, permission_level, is_active)
```

## Development Guidelines

### Adding New Pages
1. Create React component in `frontend/app/`
2. Add page entry to database `pages` table
3. Configure permissions in `page_permissions` table
4. Update navigation in `components/DynamicMenu.tsx`

### Adding New Routes Protection
1. Update `SCALE42_PROTECTED_ROUTES` in `middleware.ts`
2. Add route pattern to middleware config
3. Test with different user groups

### Environment Setup
1. Configure database connection in `remote.env`
2. Set `NEXT_PUBLIC_BACKEND_BASE_URL` for frontend
3. Configure NextAuth secret and providers
4. Run `start-servers.bat` for development

## Performance Considerations

- Database connection pooling for high load
- React component memoization for complex UIs
- API response caching for static group/page data
- Lazy loading for large data sets

## Security Best Practices

- All API endpoints validate user permissions
- Database queries use parameterized statements
- Session tokens include group membership
- Middleware blocks unauthorized route access
- CORS properly configured for cross-origin requests

## Monitoring & Debugging

- NextAuth debug mode for authentication issues
- Database query logging for performance
- Frontend console logs for user group debugging
- Backend exception handling with proper error responses