# User Management API Documentation

## Base URL
```
/api/v1/user
```

## Overview
The User Management API handles creation and management of staff users within agencies. Admin users can manage users in their own agency.

**Access Control**: Admin role required for all endpoints

---

## User Roles & Permissions

### User Roles
```typescript
enum UserRole {
  ADMIN = "ADMIN",              // Full agency control
  COORDINATOR = "COORDINATOR",  // Alert management + view
  OPERATOR = "OPERATOR",        // Create/send alerts
  VIEWER = "VIEWER"             // Read-only access
}
```

### Permission Matrix

| Action | Admin | Coordinator | Operator | Viewer |
|--------|-------|-------------|----------|--------|
| Create users | ✅ | ❌ | ❌ | ❌ |
| View users | ✅ | ✅ | ✅ | ✅ |
| Update users | ✅ | ❌ | ❌ | ❌ |
| Deactivate users | ✅ | ❌ | ❌ | ❌ |
| Create alerts | ✅ | ✅ | ✅ | ❌ |
| Send alerts | ✅ | ✅ | ✅ | ❌ |
| View alerts | ✅ | ✅ | ✅ | ✅ |
| View citizens | ✅ | ✅ | ✅ | ✅ |
| Manage citizens | ✅ | ✅ | ✅ | ❌ |

---

## Endpoints

### 1. Create User
Creates a new staff user in the agency.

**Endpoint:** `POST /user/create-user`
**Authentication:** Required (Admin only)

#### Request Body
```json
{
  "email": "operator@agency.gov.ng",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "OPERATOR",
  "agencyId": "clagency123456"
}
```

#### Validation Rules

**email**
- Format: Valid email
- Unique: Yes (system-wide)
- Lowercase: Yes

**firstName**, **lastName**
- Length: 2-50 characters
- Trimmed: Yes

**role**
- Values: ADMIN, COORDINATOR, OPERATOR, VIEWER
- Note: Creating ADMIN users should be restricted

**agencyId**
- Format: Valid CUID
- Optional: Uses requesting user's agency if not provided
- Validation: Admin can only create users in their own agency

#### Success Response
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "cluser789012",
    "email": "operator@agency.gov.ng",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "OPERATOR",
    "agencyId": "clagency123456",
    "isActive": false,
    "mustChangePassword": false,
    "emailVerified": false,
    "isTwoFactorEnabled": false,
    "createdAt": "2024-01-05T10:00:00.000Z",
    "updatedAt": "2024-01-05T10:00:00.000Z"
  }
}
```

#### Post-Creation Flow
1. User created with `isActive: false`
2. Activation email sent automatically
3. User must activate account before login
4. Password set during activation

#### Error Responses

**Email Already Exists**
```json
{
  "success": false,
  "error": "User with email \"operator@agency.gov.ng\" already exists",
  "statusCode": 409
}
```

**Cross-Agency Creation Attempt**
```json
{
  "success": false,
  "error": "You can only create users within your agency",
  "statusCode": 403
}
```

---

### 2. Get Agency Users
Retrieves all users in an agency with filters.

**Endpoint:** `GET /user/agency/:agencyId`
**Authentication:** Required (Admin only)

#### URL Parameters
- **agencyId** (CUID): Agency identifier

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| role | UserRole | No | - | Filter by role |
| isActive | boolean | No | - | Filter by status |
| search | string | No | - | Search in name/email |
| currentPage | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page (max: 100) |

#### Example Request
```
GET /user/agency/clagency123456?role=OPERATOR&isActive=true&currentPage=1&limit=20
```

#### Response
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": "cluser789012",
      "email": "operator@agency.gov.ng",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "OPERATOR",
      "isActive": true,
      "lastLoginAt": "2024-01-05T14:30:00.000Z",
      "emailVerified": true,
      "isTwoFactorEnabled": true,
      "twoFactorMethod": "EMAIL",
      "createdAt": "2024-01-05T10:00:00.000Z",
      "updatedAt": "2024-01-05T14:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "currentPage": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

### 3. Get User by ID
Retrieves detailed information about a specific user.

**Endpoint:** `GET /user/:id/get-user`
**Authentication:** Required (Admin or self)

#### URL Parameters
- **id** (CUID): User identifier

#### Response
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": "cluser789012",
    "email": "operator@agency.gov.ng",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "OPERATOR",
    "agencyId": "clagency123456",
    "isActive": true,
    "mustChangePassword": false,
    "emailVerified": true,
    "emailVerifiedAt": "2024-01-05T10:30:00.000Z",
    "isTwoFactorEnabled": true,
    "twoFactorMethod": "EMAIL",
    "lastLoginAt": "2024-01-05T14:30:00.000Z",
    "createdAt": "2024-01-05T10:00:00.000Z",
    "updatedAt": "2024-01-05T14:30:00.000Z",
    "agency": {
      "id": "clagency123456",
      "name": "Federal Emergency Management Agency",
      "type": "EMERGENCY"
    }
  }
}
```

---

### 4. Update User
Updates user information.

**Endpoint:** `PUT /user/:id/update-user`
**Authentication:** Required (Admin only)

#### URL Parameters
- **id** (CUID): User identifier

#### Request Body
```json
{
  "firstName": "Jane",
  "lastName": "Updated",
  "role": "COORDINATOR",
  "isActive": true
}
```

#### Updatable Fields
- **firstName** (string, 2-50 chars)
- **lastName** (string, 2-50 chars)
- **role** (UserRole enum)
- **isActive** (boolean)

#### Non-Updatable Fields
- email
- agencyId
- password (use reset endpoint)
- 2FA settings (user managed)

#### Response
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": "cluser789012",
    "email": "operator@agency.gov.ng",
    "firstName": "Jane",
    "lastName": "Updated",
    "role": "COORDINATOR",
    "isActive": true,
    /* ... */
  }
}
```

---

### 5. Deactivate User
Disables user account (prevents login).

**Endpoint:** `POST /user/:id/deactivate-user`
**Authentication:** Required (Admin only)
**2FA Required:** Yes

#### URL Parameters
- **id** (CUID): User identifier

#### Response
```json
{
  "success": true,
  "message": "User deactivated successfully"
}
```

#### Effects
1. User `isActive` set to `false`
2. All refresh tokens revoked
3. User cannot login
4. Existing sessions remain valid until token expiry
5. User data preserved

---

### 6. Reactivate User
Re-enables a deactivated user account.

**Endpoint:** `POST /user/:id/reactivate-user`
**Authentication:** Required (Admin only)

#### URL Parameters
- **id** (CUID): User identifier

#### Response
```json
{
  "success": true,
  "message": "User reactivated successfully"
}
```

---

### 7. Reset User Password
Forces password reset for a user.

**Endpoint:** `POST /user/:id/reset-password`
**Authentication:** Required (Admin only)
**2FA Required:** Yes

#### URL Parameters
- **id** (CUID): User identifier

#### Response
```json
{
  "success": true,
  "message": "Password reset successfully. User will be required to change password on next login."
}
```

#### Post-Reset Flow
1. Reset email sent to user
2. User clicks link in email
3. User provides 2FA code (if enabled)
4. User sets new password
5. All user sessions terminated

---

## Frontend Integration

### Create User Form

```javascript
async function createUser(formData) {
  try {
    const response = await fetch('/api/v1/user/create-user', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: formData.role
      })
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error);
      return null;
    }

    alert(`User created! Activation email sent to ${data.data.email}`);
    return data.data;

  } catch (error) {
    alert('Network error');
    return null;
  }
}
```

### List Users with Filters

```javascript
async function fetchAgencyUsers(agencyId, filters = {}) {
  const params = new URLSearchParams({
    currentPage: filters.page || 1,
    limit: filters.limit || 20,
    ...(filters.role && { role: filters.role }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.search && { search: filters.search })
  });

  const response = await fetch(
    `/api/v1/user/agency/${agencyId}?${params}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();
  return data.success ? data : null;
}
```

### Deactivate User (with 2FA)

```javascript
async function deactivateUser(userId) {
  // Confirm action
  if (!confirm('Are you sure you want to deactivate this user?')) {
    return;
  }

  // Request 2FA
  await fetch('/api/v1/2fa/request-otp', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const code = prompt('Enter your 2FA code:');

  // Deactivate with 2FA
  const response = await fetch(`/api/v1/user/${userId}/deactivate-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-2FA-Code': code
    }
  });

  const data = await response.json();

  if (data.success) {
    alert('User deactivated successfully');
    refreshUserList();
  } else {
    alert(data.error);
  }
}
```

### React Example: User Management Table

```javascript
import React, { useState, useEffect } from 'react';

export default function UserManagement({ agencyId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    role: '',
    isActive: true
  });

  useEffect(() => {
    loadUsers();
  }, [filters]);

  async function loadUsers() {
    setLoading(true);
    const result = await fetchAgencyUsers(agencyId, filters);
    if (result) {
      setUsers(result.data);
    }
    setLoading(false);
  }

  async function handleDeactivate(userId) {
    await deactivateUser(userId);
    loadUsers();
  }

  return (
    <div>
      <h1>User Management</h1>

      {/* Filters */}
      <div>
        <select
          value={filters.role}
          onChange={(e) => setFilters({...filters, role: e.target.value})}
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="COORDINATOR">Coordinator</option>
          <option value="OPERATOR">Operator</option>
          <option value="VIEWER">Viewer</option>
        </select>

        <label>
          <input
            type="checkbox"
            checked={filters.isActive}
            onChange={(e) => setFilters({...filters, isActive: e.target.checked})}
          />
          Active Only
        </label>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>2FA</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.firstName} {user.lastName}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.isActive ? '✅ Active' : '❌ Inactive'}</td>
                <td>{user.isTwoFactorEnabled ? '✅' : '❌'}</td>
                <td>{new Date(user.lastLoginAt).toLocaleString()}</td>
                <td>
                  <button onClick={() => handleDeactivate(user.id)}>
                    Deactivate
                  </button>
                  <button onClick={() => resetPassword(user.id)}>
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

---

## Best Practices

### User Creation
1. **Verify email format** before submission
2. **Inform about activation** email
3. **Assign appropriate roles** based on responsibilities
4. **Document role assignments** for audit

### Security
1. **Enforce 2FA** for deactivation and password reset
2. **Log all user changes** for compliance
3. **Regularly audit** user access levels
4. **Deactivate** rather than delete for audit trail

### Role Management
1. **Minimize admin users** (principle of least privilege)
2. **Review permissions** regularly
3. **Use VIEWER role** for read-only access
4. **COORDINATOR role** for alert managers without admin rights