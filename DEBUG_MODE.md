# Debug Mode Configuration

## Overview

The application supports a `DEBUG_MODE` environment variable to control verbose logging. This helps with development and troubleshooting while keeping production environments clean and performant.

## Environment Variables

### Backend (Python/FastAPI)
- `DEBUG_MODE=true` - Enables debug logging in backend
- `DEBUG_MODE=false` - Disables debug logging (production)

### Frontend (Next.js/React)
- `NEXT_PUBLIC_DEBUG_MODE=true` - Enables console logging in browser
- `NEXT_PUBLIC_DEBUG_MODE=false` - Disables console logging (production)

## Usage

### Development (Local & Docker)

In `.env` file:
```bash
DEBUG_MODE=true
NEXT_PUBLIC_DEBUG_MODE=true
```

You'll see detailed logs like:
- Backend: `📊 Backend: Fetching 2 plots: [23, 9]`
- Frontend: `📄 projects/page.tsx: File loaded`

### Production (Coolify/Cloud)

In Coolify environment variables or `.env.production`:
```bash
DEBUG_MODE=false
NEXT_PUBLIC_DEBUG_MODE=false
```

Logs will be suppressed for better performance.

## What Gets Logged

### Backend Debug Logs
- Plot fetching operations
- FK (foreign key) resolution steps
- Project-plot associations
- Row data structure inspection

### Frontend Debug Logs
- Component rendering lifecycle
- User groups fetching
- Plot data transformations
- Cookie operations
- API response structures

## Performance Impact

**Development**: Debug logging has minimal impact and is very helpful for troubleshooting.

**Production**: Disabling debug mode:
- Reduces console output by ~80%
- Slightly improves JavaScript execution time
- Reduces backend I/O operations
- Keeps production logs clean and focused

## Testing

To test debug mode changes:

```bash
# Enable debug mode
echo "DEBUG_MODE=true" >> .env
echo "NEXT_PUBLIC_DEBUG_MODE=true" >> .env

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker logs project_s42-backend-1 --tail 50
# Open http://localhost:3150 and check browser console

# Disable debug mode
sed -i 's/DEBUG_MODE=true/DEBUG_MODE=false/g' .env
sed -i 's/NEXT_PUBLIC_DEBUG_MODE=true/NEXT_PUBLIC_DEBUG_MODE=false/g' .env

# Rebuild and verify logs are suppressed
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Best Practices

1. **Always enable debug mode in development** - It's invaluable for troubleshooting
2. **Always disable debug mode in production** - Keeps logs clean and improves performance
3. **Use .env files per environment** - `.env` (dev), `.env.production` (prod)
4. **Check Coolify environment variables** - Ensure DEBUG_MODE is set correctly for each deployment

## Code Implementation

### Backend (Python)
```python
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"

def debug_print(*args, **kwargs):
    """Print debug messages only if DEBUG_MODE is enabled"""
    if DEBUG_MODE:
        print(*args, **kwargs)

# Usage
debug_print(f"📊 Backend: Fetching {len(plot_ids)} plots")
```

### Frontend (TypeScript/React)
```typescript
const DEBUG_MODE = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

const debugLog = (...args: any[]) => {
  if (DEBUG_MODE) {
    console.log(...args);
  }
};

// Usage
debugLog('📄 projects/page.tsx: File loaded');
```
