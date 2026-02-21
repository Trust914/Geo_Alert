# Agency Management API Documentation

## Base URL
```
/api/v1/agency
```

## Overview
The Agency Management API handles creation, management, and monitoring of government agencies in the GEOALERT system. Only Super Admins can access these endpoints.

**Access Control**: All endpoints require Super Admin role

---

## Agency Types & Jurisdiction Levels

### Valid Combinations

| Agency Type | Allowed Jurisdiction Levels |
|-------------|----------------------------|
| FEDERAL | NATIONAL |
| STATE | STATE |
| LOCAL | LGA, WARD |
| SECURITY | NATIONAL, STATE, LGA, WARD |
| HEALTH | NATIONAL, STATE, LGA, WARD |
| EMERGENCY | NATIONAL, STATE, LGA, WARD |

### Agency Types
```typescript
enum AgencyType {
  FEDERAL = "FEDERAL",        // Federal government agencies
  STATE = "STATE",            // State-level agencies
  LOCAL = "LOCAL",            // Local government units
  SECURITY = "SECURITY",      // Police, military, etc.
  HEALTH = "HEALTH",          // Health departments
  EMERGENCY = "EMERGENCY"     // Emergency response teams
}
```

### Jurisdiction Levels
```typescript
enum JurisdictionLevel {
  NATIONAL = "NATIONAL",      // Nationwide coverage
  STATE = "STATE",            // State-level
  LGA = "LGA",               // Local Government Area
  WARD = "WARD"              // Ward-level (smallest unit)
}
```

### Agency Status
```typescript
enum AgencyStatus {
  ACTIVE = "ACTIVE",          // Operational
  SUSPENDED = "SUSPENDED",    // Temporarily disabled
  INACTIVE = "INACTIVE"       // Soft-deleted
}
```

---

## Endpoints

### 1. Create Agency
Creates a new agency with an admin user.

**Endpoint:** `POST /agency`
**Authentication:** Required (Super Admin only)
**2FA Required:** No

#### Request Body
```json
{
  "name": "Federal Emergency Management Agency",
  "type": "EMERGENCY",
  "jurisdiction": "Nigeria",
  "jurisdictionLevel": "NATIONAL",
  "contactEmail": "contact@fema.gov.ng",
  "contactPhone": "+2348012345678",
  "adminFirstName": "John",
  "adminLastName": "Doe",
  "adminEmail": "admin@fema.gov.ng"
}
```

#### Validation Rules

**name**
- Type: String
- Length: 3-200 characters
- Unique: Yes
- Example: "Lagos State Emergency Management Agency"

**type**
- Type: Enum (AgencyType)
- Required: Yes
- Values: FEDERAL, STATE, LOCAL, SECURITY, HEALTH, EMERGENCY

**jurisdiction**
- Type: String
- Length: 3-200 characters
- Example: "Lagos State", "Ikeja LGA", "Nigeria"

**jurisdictionLevel**
- Type: Enum (JurisdictionLevel)
- Must match agency type (see combinations table above)

**contactEmail**
- Type: Email
- Format: Valid email address
- Lowercase: Yes

**contactPhone**
- Type: String
- Format: International format (+234...)
- Regex: `^\+?[1-9]\d{1,14}$`

**adminFirstName**, **adminLastName**
- Type: String
- Length: Minimum 2 characters

**adminEmail**
- Type: Email
- Unique: Yes (across all users)
- Lowercase: Yes

#### Success Response
```json
{
  "success": true,
  "message": "Agency created successfully",
  "data": {
    "id": "clagency123456",
    "name": "Federal Emergency Management Agency",
    "type": "EMERGENCY",
    "jurisdiction": "Nigeria",
    "jurisdictionLevel": "NATIONAL",
    "contactEmail": "contact@fema.gov.ng",
    "contactPhone": "+2348012345678",
    "status": "ACTIVE",
    "createdAt": "2024-01-05T10:00:00.000Z",
    "updatedAt": "2024-01-05T10:00:00.000Z",
    "admin": {
      "id": "cluser789012",
      "firstName": "John",
      "lastName": "Doe",
      "email": "admin@fema.gov.ng",
      "mustChangePassword": false,
      "requiresActivation": true,
      "isActive": false
    },
    "_count": {
      "users": 1,
      "alerts": 0
    }
  }
}
```

#### Post-Creation Flow
1. Agency created with ACTIVE status
2. Admin user created with `isActive: false`
3. Activation email sent to admin
4. Admin must activate account before login
5. Audit logs created for both agency and user

#### Error Responses

**Duplicate Agency Name**
```json
{
  "success": false,
  "error": "Agency with name \"Federal Emergency Management Agency\" already exists",
  "statusCode": 409
}
```

**Duplicate Admin Email**
```json
{
  "success": false,
  "error": "User with email \"admin@fema.gov.ng\" already exists",
  "statusCode": 409
}
```

**Invalid Jurisdiction Combination**
```json
{
  "success": false,
  "error": "Validation failed",
  "statusCode": 400,
  "details": [
    {
      "field": "jurisdictionLevel",
      "message": "Invalid combination: jurisdiction level does not match agency type"
    }
  ]
}
```

---

### 2. Get All Agencies
Retrieves paginated list of agencies with filters.

**Endpoint:** `GET /agency`
**Authentication:** Required (Super Admin only)

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| type | AgencyType | No | - | Filter by agency type |
| jurisdictionLevel | JurisdictionLevel | No | - | Filter by jurisdiction |
| status | AgencyStatus | No | - | Filter by status |
| search | string | No | - | Search in name, email, phone, jurisdiction |
| currentPage | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page (max: 100) |

#### Example Request
```
GET /agency?type=EMERGENCY&status=ACTIVE&currentPage=1&limit=20
```

#### Response
```json
{
  "success": true,
  "message": "Agencies retrieved successfully",
  "data": [
    {
      "id": "clagency123456",
      "name": "Federal Emergency Management Agency",
      "type": "EMERGENCY",
      "jurisdiction": "Nigeria",
      "jurisdictionLevel": "NATIONAL",
      "contactEmail": "contact@fema.gov.ng",
      "contactPhone": "+2348012345678",
      "status": "ACTIVE",
      "createdAt": "2024-01-05T10:00:00.000Z",
      "updatedAt": "2024-01-05T10:00:00.000Z",
      "admin": {
        "id": "cluser789012",
        "firstName": "John",
        "lastName": "Doe",
        "email": "admin@fema.gov.ng",
        "isActive": true
      },
      "_count": {
        "users": 15,
        "alerts": 42
      }
    }
  ],
  "pagination": {
    "total": 150,
    "currentPage": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 3. Get Agency by ID
Retrieves detailed information about a specific agency.

**Endpoint:** `GET /agency/:id`
**Authentication:** Required (Super Admin only)

#### URL Parameters
- **id** (CUID): Agency identifier

#### Example Request
```
GET /agency/clagency123456
```

#### Response
```json
{
  "success": true,
  "message": "Agency retrieved successfully",
  "data": {
    "id": "clagency123456",
    "name": "Federal Emergency Management Agency",
    "type": "EMERGENCY",
    "jurisdiction": "Nigeria",
    "jurisdictionLevel": "NATIONAL",
    "contactEmail": "contact@fema.gov.ng",
    "contactPhone": "+2348012345678",
    "status": "ACTIVE",
    "createdAt": "2024-01-05T10:00:00.000Z",
    "updatedAt": "2024-01-05T10:00:00.000Z",
    "users": [
      {
        "id": "cluser789012",
        "firstName": "John",
        "lastName": "Doe",
        "email": "admin@fema.gov.ng",
        "role": "ADMIN",
        "isActive": true,
        "lastLoginAt": "2024-01-05T15:30:00.000Z",
        "createdAt": "2024-01-05T10:00:00.000Z",
        "updatedAt": "2024-01-05T15:30:00.000Z",
        "emailVerified": true
      }
    ],
    "_count": {
      "users": 15,
      "alerts": 42
    }
  }
}
```

---

### 4. Update Agency
Updates agency information (core details require 2FA).

**Endpoint:** `PUT /agency/:id`
**Authentication:** Required (Super Admin only)
**2FA Required:** Yes

#### URL Parameters
- **id** (CUID): Agency identifier

#### Request Body
```json
{
  "name": "Updated Agency Name",
  "jurisdiction": "Updated Jurisdiction",
  "contactEmail": "newemail@agency.gov.ng",
  "contactPhone": "+2348098765432",
  "status": "SUSPENDED"
}
```

#### Updatable Fields
- **name** (string, 3-200 chars, unique)
- **jurisdiction** (string, 3-200 chars)
- **contactEmail** (valid email)
- **contactPhone** (international format)
- **status** (ACTIVE, SUSPENDED, INACTIVE)

#### Non-Updatable Fields
- type
- jurisdictionLevel
- createdById

#### Response
```json
{
  "success": true,
  "message": "Agency updated successfully",
  "data": {
    "id": "clagency123456",
    "name": "Updated Agency Name",
    "type": "EMERGENCY",
    "jurisdiction": "Updated Jurisdiction",
    "jurisdictionLevel": "NATIONAL",
    "contactEmail": "newemail@agency.gov.ng",
    "contactPhone": "+2348098765432",
    "status": "SUSPENDED",
    "createdAt": "2024-01-05T10:00:00.000Z",
    "updatedAt": "2024-01-06T14:20:00.000Z",
    "admin": { /* ... */ },
    "_count": {
      "users": 15,
      "alerts": 42
    }
  }
}
```

#### Error Responses

**Name Conflict**
```json
{
  "success": false,
  "error": "Agency with name \"Updated Agency Name\" already exists",
  "statusCode": 409
}
```

---

### 5. Delete Agency (Soft Delete)
Deactivates agency and all its users.

**Endpoint:** `DELETE /agency/:id`
**Authentication:** Required (Super Admin only)
**2FA Required:** Yes

#### URL Parameters
- **id** (CUID): Agency identifier

#### Response
```json
{
  "success": true,
  "message": "Agency deleted successfully",
  "data": {
    "id": "clagency123456",
    "name": "Federal Emergency Management Agency",
    "type": "EMERGENCY",
    "status": "INACTIVE",
    /* ... other fields ... */
  }
}
```

#### Effects
1. Agency status set to INACTIVE
2. All users in agency deactivated (`isActive: false`)
3. Users cannot login
4. Existing alerts preserved (read-only)
5. Cannot be restored via API (contact support)

#### Error Responses

**Agency Has Active Alerts**
```json
{
  "success": false,
  "error": "Cannot delete agency with 42 alerts.",
  "statusCode": 400
}
```

---

### 6. Reactivate Agency
Restores a deactivated agency (users remain deactivated).

**Endpoint:** `POST /agency/:id/reactivate`
**Authentication:** Required (Super Admin only)

#### URL Parameters
- **id** (CUID): Agency identifier

#### Response
```json
{
  "success": true,
  "message": "Agency reactivated successfully",
  "data": {
    "id": "clagency123456",
    "name": "Federal Emergency Management Agency",
    "status": "ACTIVE",
    /* ... */
  }
}
```

#### Note
Users must be individually reactivated via User Management API

---

### 7. Get Agency Statistics
Retrieves system-wide agency statistics.

**Endpoint:** `GET /agency/stats`
**Authentication:** Required (Super Admin only)

#### Response
```json
{
  "success": true,
  "message": "Agency statistics retrieved successfully",
  "data": {
    "total": 150,
    "active": 120,
    "suspended": 20,
    "inactive": 10,
    "byType": {
      "FEDERAL": 10,
      "STATE": 37,
      "LOCAL": 50,
      "SECURITY": 20,
      "HEALTH": 18,
      "EMERGENCY": 15
    },
    "byJurisdiction": {
      "NATIONAL": 10,
      "STATE": 57,
      "LGA": 68,
      "WARD": 15
    }
  }
}
```

---

## Frontend Integration Guide

### Create Agency Form

```javascript
async function createAgency(formData) {
  try {
    const response = await fetch('/api/v1/agency', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: formData.agencyName,
        type: formData.agencyType,
        jurisdiction: formData.jurisdiction,
        jurisdictionLevel: formData.jurisdictionLevel,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        adminFirstName: formData.adminFirstName,
        adminLastName: formData.adminLastName,
        adminEmail: formData.adminEmail
      })
    });

    const data = await response.json();

    if (!data.success) {
      if (response.status === 409) {
        alert('Agency name or admin email already exists');
      } else if (data.details) {
        // Validation errors
        data.details.forEach(err => {
          showFieldError(err.field, err.message);
        });
      } else {
        alert(data.error);
      }
      return null;
    }

    // Success
    alert(`Agency created! Activation email sent to ${data.data.admin.email}`);
    return data.data;

  } catch (error) {
    alert('Network error. Please try again.');
    return null;
  }
}
```

### List Agencies with Filters

```javascript
async function fetchAgencies(filters = {}) {
  const params = new URLSearchParams({
    currentPage: filters.page || 1,
    limit: filters.limit || 20,
    ...(filters.type && { type: filters.type }),
    ...(filters.status && { status: filters.status }),
    ...(filters.search && { search: filters.search })
  });

  try {
    const response = await fetch(`/api/v1/agency?${params}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error);
      return null;
    }

    return {
      agencies: data.data,
      pagination: data.pagination
    };

  } catch (error) {
    alert('Network error. Please try again.');
    return null;
  }
}
```

### Update Agency (with 2FA)

```javascript
async function updateAgency(agencyId, updates) {
  // Step 1: Request 2FA code (for email 2FA users)
  await fetch('/api/v1/2fa/request-otp', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  // Step 2: Get 2FA code from user
  const code = prompt('Enter your 2FA code:');

  // Step 3: Update with 2FA verification
  try {
    const response = await fetch(`/api/v1/agency/${agencyId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-2FA-Code': code  // Include 2FA code in header
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error);
      return null;
    }

    alert('Agency updated successfully!');
    return data.data;

  } catch (error) {
    alert('Network error. Please try again.');
    return null;
  }
}
```

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';

export default function AgencyManagement() {
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type: '',
    status: 'ACTIVE',
    page: 1
  });

  useEffect(() => {
    loadAgencies();
  }, [filters]);

  async function loadAgencies() {
    setLoading(true);
    const result = await fetchAgencies(filters);
    if (result) {
      setAgencies(result.agencies);
    }
    setLoading(false);
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Agency Management</h1>

      {/* Filters */}
      <div>
        <select
          value={filters.type}
          onChange={(e) => setFilters({...filters, type: e.target.value})}
        >
          <option value="">All Types</option>
          <option value="FEDERAL">Federal</option>
          <option value="STATE">State</option>
          <option value="LOCAL">Local</option>
          <option value="SECURITY">Security</option>
          <option value="HEALTH">Health</option>
          <option value="EMERGENCY">Emergency</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {/* Agency List */}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Jurisdiction</th>
            <th>Status</th>
            <th>Users</th>
            <th>Alerts</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {agencies.map(agency => (
            <tr key={agency.id}>
              <td>{agency.name}</td>
              <td>{agency.type}</td>
              <td>{agency.jurisdiction}</td>
              <td>{agency.status}</td>
              <td>{agency._count.users}</td>
              <td>{agency._count.alerts}</td>
              <td>
                <button onClick={() => viewAgency(agency.id)}>View</button>
                <button onClick={() => editAgency(agency.id)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Best Practices

### Agency Creation
1. **Validate jurisdiction combinations** before submission
2. **Inform users** that activation email will be sent
3. **Store agency ID** for subsequent user creation
4. **Audit all creations** for compliance

### Security
1. **Enforce 2FA** for update/delete operations
2. **Log all changes** for audit trail
3. **Verify Super Admin role** on every request
4. **Rate limit** creation endpoints

### Data Management
1. **Cache agency lists** with short TTL (5 minutes)
2. **Invalidate cache** on updates
3. **Use pagination** for large datasets
4. **Search efficiently** with indexed fields