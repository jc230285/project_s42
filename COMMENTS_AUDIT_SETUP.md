# NocoDB Comments and Audit Trail Setup Guide

Since NocoDB v2 API doesn't support comments and audit trails natively, this guide shows you how to implement these features using separate tables and webhooks.

## 🚀 Quick Setup

### 1. Create the Required Tables

Run the setup script to create the comments and audit tables in NocoDB:

```bash
python setup_nocodb_tables.py
```

This will create:
- **Comments table**: For storing user comments on records
- **Audit Trail table**: For tracking changes to records

The script will output the table IDs you need to add to your environment variables.

### 2. Update Environment Variables

Add these to your `.env` file (replace with actual table IDs from step 1):

```env
# Existing variables
NOCODB_API_URL=https://nocodb.edbmotte.com
NOCODB_API_TOKEN=your_api_token_here
NOCODB_PROJECTS_TABLE_ID=mftsk8hkw23m8q1
NOCODB_PLOTS_TABLE_ID=mmqclkrvx9lbtpc

# New variables for comments and audit
NOCODB_COMMENTS_TABLE_ID=your_comments_table_id
NOCODB_AUDIT_TABLE_ID=your_audit_table_id
```

### 3. Restart Your Backend

```bash
docker-compose down && docker-compose up --build -d
```

## 📋 API Endpoints

### Comments Endpoints

#### Get Comments for a Record
```http
GET /comments/{table_name}/{record_id}
Authorization: Bearer <your_token>
```

**Example:**
```bash
curl -X GET "http://localhost:8150/comments/projects/1" \
  -H "Authorization: Bearer eyJ..."
```

**Response:**
```json
{
  "table": "projects",
  "record_id": "1",
  "comments": [
    {
      "id": "rec123",
      "record_id": "1",
      "table_name": "projects",
      "comment_text": "This project looks good",
      "user_id": "123",
      "user_email": "user@example.com",
      "created_at": "2025-09-27T10:00:00Z",
      "updated_at": "2025-09-27T10:00:00Z"
    }
  ],
  "total_count": 1
}
```

#### Add a Comment to a Record
```http
POST /comments/{table_name}/{record_id}
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "comment": "Your comment text here"
}
```

**Example:**
```bash
curl -X POST "http://localhost:8150/comments/projects/1" \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"comment": "This is a test comment"}'
```

### Audit Trail Endpoints

#### Get Audit Trail for a Record
```http
GET /audit/{table_name}/{record_id}
Authorization: Bearer <your_token>
```

**Example:**
```bash
curl -X GET "http://localhost:8150/audit/projects/1" \
  -H "Authorization: Bearer eyJ..."
```

**Response:**
```json
{
  "table": "projects",
  "record_id": "1",
  "audit_trail": [
    {
      "id": "aud123",
      "record_id": "1",
      "table_name": "projects",
      "action": "UPDATE",
      "old_values": "{\"status\": \"draft\"}",
      "new_values": "{\"status\": \"approved\"}",
      "user_id": "123",
      "user_email": "user@example.com",
      "timestamp": "2025-09-27T10:00:00Z",
      "field_changed": "status"
    }
  ],
  "total_count": 1
}
```

#### Manually Create Audit Entry
```http
POST /audit/{table_name}/{record_id}
Authorization: Bearer <your_token>
Content-Type: application/json

{
  "action": "UPDATE",
  "old_values": {"status": "draft"},
  "new_values": {"status": "approved"},
  "field_changed": "status"
}
```

## 🔗 Webhook Setup for Automatic Audit

To automatically track changes, set up NocoDB webhooks:

### 1. In NocoDB UI:
1. Go to your base → Tables → [Your Table] → Webhooks
2. Create a new webhook:
   - **URL**: `https://your-domain.com/webhooks/nocodb/audit`
   - **Events**: AFTER INSERT, AFTER UPDATE, AFTER DELETE
   - **Method**: POST
   - **Headers**: Add any authentication headers if needed

### 2. Webhook Payload Structure
NocoDB sends payloads like this:
```json
{
  "type": "AFTER_UPDATE",
  "data": {
    "table_name": "projects",
    "row": {
      "Id": 1,
      "name": "Updated Project",
      "status": "approved"
    },
    "previous_row": {
      "Id": 1,
      "name": "Updated Project",
      "status": "draft"
    },
    "changed_columns": ["status"]
  }
}
```

## 🧪 Testing

### Test Comments
```bash
# Add a comment
curl -X POST "http://localhost:8150/comments/projects/1" \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{"comment": "Test comment"}'

# Get comments
curl -X GET "http://localhost:8150/comments/projects/1" \
  -H "Authorization: Bearer eyJ..."
```

### Test Audit
```bash
# Get audit trail
curl -X GET "http://localhost:8150/audit/projects/1" \
  -H "Authorization: Bearer eyJ..."

# Add manual audit entry
curl -X POST "http://localhost:8150/audit/projects/1" \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "action": "UPDATE",
    "old_values": {"status": "draft"},
    "new_values": {"status": "approved"}
  }'
```

## 📊 Table Schemas

### Comments Table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| record_id | SingleLineText | Yes | ID of the record being commented on |
| table_name | SingleLineText | Yes | Name of the table (projects/plots) |
| comment_text | LongText | Yes | The comment content |
| user_id | SingleLineText | Yes | ID of the user who made the comment |
| user_email | Email | Yes | Email of the user who made the comment |
| created_at | DateTime | Yes | When the comment was created |
| updated_at | DateTime | No | When the comment was last updated |

### Audit Trail Table
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| record_id | SingleLineText | Yes | ID of the record that was changed |
| table_name | SingleLineText | Yes | Name of the table (projects/plots) |
| action | SingleSelect | Yes | CREATE/UPDATE/DELETE |
| old_values | LongText | No | JSON of old field values |
| new_values | LongText | No | JSON of new field values |
| user_id | SingleLineText | Yes | ID of the user who made the change |
| user_email | Email | Yes | Email of the user who made the change |
| timestamp | DateTime | Yes | When the change occurred |
| field_changed | SingleLineText | No | Which field was changed |

## 🔧 Frontend Integration

Update your frontend to use the new endpoints:

```typescript
// Get comments
const comments = await fetch(`/comments/projects/${recordId}`, {
  headers: { Authorization: `Bearer ${token}` }
});

// Add comment
await fetch(`/comments/projects/${recordId}`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ comment: 'New comment' })
});

// Get audit trail
const audit = await fetch(`/audit/projects/${recordId}`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

## 🚨 Important Notes

1. **Table IDs**: Make sure to set the correct table IDs in your environment variables
2. **Authentication**: All endpoints require valid JWT tokens
3. **Webhooks**: For automatic audit, ensure your webhook endpoint is publicly accessible
4. **Performance**: Consider adding indexes on frequently queried fields (record_id, table_name)
5. **Cleanup**: Implement periodic cleanup of old audit entries if needed

This implementation provides full comments and audit trail functionality while working within NocoDB's API limitations!