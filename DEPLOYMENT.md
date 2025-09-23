# Auto-Deployment Setup

This repository includes several auto-deployment options for your Docker containers.

## Option 1: Local Auto-Deploy Script (Easiest)

### Windows
Run the included batch script:
```cmd
auto-deploy.bat
```

This script will:
1. Pull latest changes from GitHub
2. Stop existing containers
3. Rebuild containers without cache
4. Start new containers
5. Clean up old images

## Option 2: GitHub Actions with SSH (Remote Server)

### Setup Steps:

1. **Add GitHub Secrets** (Go to repository Settings > Secrets and variables > Actions):
   - `HOST` - Your server IP address
   - `USERNAME` - SSH username
   - `SSH_PRIVATE_KEY` - Your SSH private key
   - `PORT` - SSH port (default: 22)
   - `DOCKER_USERNAME` - Docker Hub username (optional)
   - `DOCKER_PASSWORD` - Docker Hub password/token (optional)

2. **Update the deploy.yml workflow**:
   - Edit `.github/workflows/deploy.yml`
   - Change `/path/to/your/project` to your actual project path on the server

3. **Server Requirements**:
   - Docker and Docker Compose installed
   - Git repository cloned
   - SSH access configured

## Option 3: Self-Hosted GitHub Runner

### Setup Steps:

1. **Install GitHub Runner on your server**:
   - Go to repository Settings > Actions > Runners
   - Click "New self-hosted runner"
   - Follow the installation instructions

2. **Configure the runner**:
   - Ensure Docker is available on the runner
   - Make sure the runner has access to your project directory

3. **Use the self-hosted workflow**:
   - The `self-hosted-deploy.yml` workflow will automatically deploy when you push

## Option 4: Webhook Deployment

### Setup Steps:

1. **Set up a webhook endpoint** on your server that:
   - Receives GitHub webhook calls
   - Pulls latest code
   - Restarts Docker containers

2. **Configure GitHub webhook**:
   - Go to repository Settings > Webhooks
   - Add your webhook URL
   - Set content type to `application/json`
   - Add secret for security

3. **Add GitHub Secrets**:
   - `WEBHOOK_URL` - Your webhook endpoint
   - `WEBHOOK_SECRET` - Webhook secret for verification

## Testing Auto-Deployment

1. Make a small change to your code
2. Commit and push to master/main branch:
   ```bash
   git add .
   git commit -m "Test auto-deployment"
   git push
   ```
3. Check that your deployment method triggers and updates the containers

## Services After Deployment

- **Frontend**: http://localhost:3150
- **Backend API**: http://localhost:8150/docs

## Troubleshooting

### Common Issues:
1. **Permission errors** - Ensure Docker daemon is accessible
2. **Port conflicts** - Make sure ports 3150 and 8150 are available
3. **Git pull fails** - Check SSH keys or HTTPS credentials
4. **Build failures** - Check Docker logs: `docker compose logs`

### Manual Deployment:
If auto-deployment fails, you can always deploy manually:
```bash
git pull origin master
docker compose down
docker compose build --no-cache
docker compose up -d
```