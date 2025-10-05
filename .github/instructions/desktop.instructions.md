---
applyTo: '**'
---
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

# Project S42 - Coding Standards

## 🚨 CRITICAL RULES - ALWAYS FOLLOW

### 1. Toast Notifications - MANDATORY
- ✅ **ALWAYS use `toast` from `react-hot-toast`**
- ❌ **NEVER use `alert()`** - unprofessional and blocks UI
- ✅ **ALWAYS extract detailed errors** from backend responses

```typescript
// Import at top of file
import toast from 'react-hot-toast';

// Success
toast.success('Operation completed successfully');

// Error - ALWAYS extract details
if (!response.ok) {
  const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
  toast.error(errorData.detail || `Operation failed (${response.status})`);
  console.error('Error details:', response.status, errorData);
}

// Catch block
catch (error) {
  console.error('Error:', error);
  toast.error('Operation failed. Check console for details.');
}
```

### 2. Environment Variables
- ✅ **Client-side vars MUST have `NEXT_PUBLIC_` prefix**
- ✅ Use `process.env.NEXT_PUBLIC_BACKEND_BASE_URL` in client components
- ❌ Never use `process.env.BACKEND_BASE_URL` in client code

### 3. Page Authentication
- ✅ **ALWAYS wrap pages with `WithPageAccess`**
- ✅ Specify correct `pagePath` prop
- See `creating-new-pages.md` for full guide

---