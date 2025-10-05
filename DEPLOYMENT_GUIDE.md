# Project S42 Deployment Guide

## 🚀 **Multiple Deployment Options**

Project S42 now supports **4 different deployment modes** to suit various development and production needs:

### **1. 🔧 Development Mode** 
**Best for: Active coding, debugging, feature development**
- **Ports**: Frontend `http://localhost:3000`, Backend `http://localhost:8000`
- **Features**: Hot reload, debug mode, fastest iteration, direct npm/uvicorn execution
- **Startup**: `start-servers.bat` → Choice 1
- **Environment**: Uses `.env.dev` configuration

### **2. 🐳 Docker Mode**
**Best for: Testing deployments, container debugging, production-like testing**  
- **Ports**: Frontend `http://localhost:3150`, Backend `http://localhost:8150`
- **Features**: Containerized environment, production-like setup, isolated dependencies
- **Startup**: `start-servers.bat` → Choice 2
- **Environment**: Uses `.env.docker` configuration

### **3. 🔧 Windows Services Mode**
**Best for: Always-on local server, team development server, background operation**
- **Ports**: Frontend `http://localhost:3000`, Backend `http://localhost:8000` 
- **Features**: Auto-start with Windows, runs in background, service management
- **Startup**: `start-servers.bat` → Choice 3 (requires NSSM setup)
- **Management**: `services.msc` or `net start/stop S42Backend/S42Frontend`

### **4. ☁️ Production Mode**
**Best for: End-user access, live system, production workloads**
- **URLs**: Frontend `https://s42.edbmotte.com`, Backend `https://s42api.edbmotte.com`
- **Features**: CDN, SSL, auto-scaling, monitoring, automatic deployment
- **Deployment**: Automatic via GitHub pushes to master branch

---

## 📋 **Quick Start Guide**

### **For Development Work:**
```bash
# 1. Run the server manager
start-servers.bat

# 2. Choose option 1 (Development Mode)
# 3. Access at http://localhost:3000
```

### **For Testing Deployments:**
```bash
# 1. Run the server manager  
start-servers.bat

# 2. Choose option 2 (Docker Mode)
# 3. Access at http://localhost:3150
```

### **For Always-On Local Server:**
```bash
# 1. Download NSSM from https://nssm.cc/download
# 2. Extract nssm.exe to C:\git\project_s42\tools\nssm.exe
# 3. Run start-servers.bat → Choice 3
# 4. Services will auto-start with Windows
```

---

## 🔧 **Environment Configuration**

### **Development Mode:**
- Copy `frontend\.env.dev` to `frontend\.env.local` 
- Ports: 3000 (frontend), 8000 (backend)
- Hot reload enabled for both frontend and backend

### **Docker Mode:**
- Copy `frontend\.env.docker` to `frontend\.env.local`
- Ports: 3150 (frontend), 8150 (backend)  
- Production-like containerized environment

### **Environment Files:**
- `.env.dev` - Development mode configuration
- `.env.docker` - Docker mode configuration  
- `.env.local` - Active configuration (copy from above)
- `remote.env` - Production configuration

---

## 🔍 **Management Commands**

### **Server Status Check:**
```bash
start-servers.bat → Choice 5
# Shows status of all deployment modes
```

### **Stop All Servers:**
```bash
start-servers.bat → Choice 4  
# Stops development, docker, and service modes
```

### **Manual Commands:**
```bash
# Development
cd backend/app && uvicorn main:app --host 0.0.0.0 --port 8000 --reload
cd frontend && npm run dev -- --port 3000

# Docker
docker-compose build && docker-compose up -d

# Services
net start S42Backend && net start S42Frontend
net stop S42Backend && net stop S42Frontend
```

---

## 🎯 **Recommended Usage**

| **Use Case** | **Recommended Mode** | **Reason** |
|--------------|---------------------|------------|
| **Daily Development** | Development Mode | Fastest iteration, hot reload |
| **Testing Features** | Development Mode | Easy debugging, quick restart |
| **Pre-deployment Testing** | Docker Mode | Production-like environment |
| **Team Demo Server** | Windows Services | Always available, auto-start |
| **Container Debugging** | Docker Mode | Isolated environment testing |
| **End-User Access** | Production | Live system with full features |

---

## 🚨 **Troubleshooting**

### **Port Conflicts:**
- Run `start-servers.bat` → Choice 4 to stop all servers
- Check specific ports: `netstat -an | findstr 3000`

### **Service Issues:**
- Open `services.msc` to check Windows Services
- Restart: `net stop S42Backend && net start S42Backend`

### **Docker Problems:**
- Check containers: `docker ps`
- View logs: `docker logs project_s42-backend-1`
- Rebuild: `docker-compose build --no-cache`

### **Development Issues:**
- Check command windows opened by `start-servers.bat`
- Restart individual servers manually if needed

---

## 📁 **File Structure**

```
project_s42/
├── start-servers.bat          # Multi-mode server manager
├── frontend/
│   ├── .env.dev              # Development configuration
│   ├── .env.docker           # Docker configuration  
│   └── .env.local            # Active configuration
├── backend/
│   └── .env                  # Backend configuration
├── tools/                    # Windows service tools
│   └── nssm.exe             # Service manager (download required)
└── .github/instructions/
    └── architecture.md       # Updated architecture docs
```

This flexible deployment system allows you to choose the right mode for your current needs while maintaining consistency across all environments! 🎉