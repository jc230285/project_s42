# S42 Project - Docker Deployment Guide

## Prerequisites

1. **Docker Desktop** must be installed and running
   - Download from: https://www.docker.com/products/docker-desktop/
   - Ensure Docker daemon is running before proceeding

2. **Environment Variables**
   - The `.env` file has been configured for Docker ports:
     - Frontend: `http://localhost:3100`
     - Backend: `http://localhost:8100`

## Quick Start

### Option 1: Automated Setup (Recommended)
```bash
# Run the automated setup script
.\docker-setup.bat
```

### Option 2: Manual Setup
```bash
# Create network and build containers
docker-compose down --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Check status
docker-compose ps
```

## Access Your Application

Once containers are running:
- **Frontend**: http://localhost:3100
- **Backend API**: http://localhost:8100
- **Map Page**: http://localhost:3100/map

## Container Management

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Stop Containers
```bash
docker-compose down
```

### Rebuild After Changes
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Container Build Issues
- Ensure Docker Desktop is running
- Check for port conflicts (3100, 8100)
- Try rebuilding with `--no-cache` flag

### Environment Variables
- Frontend uses ports 3100 (instead of 3000)
- Backend uses port 8100 (instead of 8000)
- Google Maps API key is included in container

### Database Connection
- Uses external MySQL database at `10.1.8.51:3306`
- Ensure database is accessible from Docker containers

## Development vs Docker

| Environment | Frontend Port | Backend Port |
|-------------|---------------|--------------|
| Local Dev   | 3000         | 8000         |
| Docker      | 3100         | 8100         |

Switch between environments by:
1. Stopping current servers
2. Using appropriate startup method
3. Accessing correct URLs

## Container Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │
│   (Next.js)     │◄──►│   (FastAPI)     │
│   Port: 3100    │    │   Port: 8100    │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌─────────────────┐
              │  External MySQL │
              │  Database       │
              │  10.1.8.51:3306 │
              └─────────────────┘
```