# GEOALERT API Documentation - Overview

## Introduction

Welcome to the GEOALERT API documentation. GEOALERT is a comprehensive emergency alert system for Nigeria, enabling government agencies to send location-based SMS alerts to citizens during emergencies.

---

## Base URL

```
Production: https://api.geoalert.gov.ng/api/v1
Development: http://localhost:5000/api/v1
```

---

## Documentation Structure

This documentation is organized into 7 main sections:

1. **[Authentication API](./01-auth-api.md)** - Login, logout, sessions, password management
2. **[Account Activation API](./02-activation-api.md)** - New user/agency activation flow
3. **[Two-Factor Authentication API](./03-2fa-api.md)** - Email OTP and Google Authenticator setup
4. **[Agency Management API](./04-agency-api.md)** - Create and manage government agencies
5. **[User Management API](./05-user-api.md)** - Staff user creation and management
6. **[Alert Management API](./06-alert-api.md)** - Create, send, and monitor emergency alerts
7. **[Citizen Management API](./07-citizen-api.md)** - Citizen registration and profile management

---

## Quick Start Guide

### 1. Authentication Flow

```javascript
// Step 1: Login
const loginResponse = await fetch("/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "admin@agency.gov.ng",
    password: "SecurePass123!",
  }),
});

const loginData = await loginResponse.json();

// Step 2: Handle 2FA if required
if (loginData.data.requiresTwoFactor) {
  const code = prompt("Enter 2FA code:");

  const verifyResponse = await fetch("/api/v1/auth/2fa/verify-login", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${loginData.data.preAuthToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  const verifyData = await verifyResponse.json();
  accessToken = verifyData.data.accessToken;
} else {
  accessToken = loginData.data.accessToken;
}

// Step 3: Use access token for authenticated requests
localStorage.setItem("accessToken", accessToken);
```

### 2. Create an Alert

```javascript
// Create alert in DRAFT status
const alertResponse = await fetch("/api/v1/alert", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    category: "WEATHER",
    severity: "EXTREME",
    urgency: "IMMEDIATE",
    headline: "Flash Flood Warning - Lagos",
    description: "Heavy rains expected. Seek higher ground immediately.",
    instruction: "Move to safety now. Avoid flooded areas.",
    targets: [
      {
        targetType: "STATE",
        stateId: "clstate123456",
      },
    ],
  }),
});

const alertData = await alertResponse.json();
const alertId = alertData.data.id;

// Preview before sending
const previewResponse = await fetch(`/api/v1/alert/${alertId}/preview`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

const previewData = await previewResponse.json();
console.log("Recipients:", previewData.data.estimatedRecipients);
console.log("Cost:", previewData.data.smsPreview.estimatedCost);

// Send alert (requires 2FA)
const sendResponse = await fetch(`/api/v1/alert/${alertId}/send`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "X-2FA-Code": "123456", // From authenticator or email
  },
});
```

---

## Common Patterns

### Error Handling

All API responses follow this structure:

```typescript
interface APIResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
  details?:
    | Array<{ field: string; message: string }> // For Zod/Validation errors
    | Record<string, any>; // For Logic flags (e.g., requires2FA, error codes)
}
```

**Example Error Handler:**

```javascript
async function apiRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!data.success) {
      if (data.details) {
        // Validation errors
        data.details.forEach((err) => {
          showFieldError(err.field, err.message);
        });
      } else {
        // General error
        showError(data.error || "An error occurred");
      }
      return null;
    }

    return data.data;
  } catch (error) {
    showError("Network error. Please try again.");
    return null;
  }
}
```

### Pagination

All list endpoints support pagination:

List endpoints accept standard pagination query parameters:

- `page`: Number (Default: 1)
- `limit`: Number (Default: 10, Max: 100)
- `hasNext`: Boolean (indicates if next page exists)
- `hasPrev`: Boolean (indicates if previous page exists)

```javascript
async function fetchWithPagination(endpoint, params = {}) {
  const queryParams = new URLSearchParams({
    currentPage: params.page || 1,
    limit: params.limit || 20,
    ...params.filters,
  });

  const response = await apiRequest(`${endpoint}?${queryParams}`, { method: "GET" });

  return {
    data: response.data,
    pagination: response.pagination,
  };
}

// Usage
const result = await fetchWithPagination("/api/v1/alert", {
  page: 1,
  limit: 20,
  filters: {
    severity: "EXTREME",
    status: "SENT",
  },
});
```

### 2FA Protected Operations

Operations requiring 2FA:

- Sending alerts
- Cancelling alerts
- Updating agencies
- Deleting agencies
- Deactivating users
- Resetting user passwords
- Changing own password
- Logging out from all devices
- Revoking sessions
- Regenerating backup codes

**2FA Flow:**

```javascript
async function perform2FAOperation(operation) {
  // Step 1: Request OTP (for Email 2FA users)
  await fetch("/api/v1/2fa/request-otp", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Step 2: Get code from user
  const code = prompt("Enter your 2FA code:");

  // Step 3: Perform operation with code
  const response = await fetch(operation.url, {
    method: operation.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-2FA-Code": code,
      "Content-Type": "application/json",
    },
    body: operation.body ? JSON.stringify(operation.body) : undefined,
  });

  return await response.json();
}
```

---

## Authentication Headers

### Standard Request Headers

```javascript
{
  'Authorization': 'Bearer <accessToken>',
  'Content-Type': 'application/json'
}
```

### 2FA Request Headers

```javascript
{
  'Authorization': 'Bearer <accessToken>',
  'X-2FA-Code': '<code>',
  'Content-Type': 'application/json'
}
```

### Pre-Auth Request Headers

```javascript
{
  'Authorization': 'Bearer <preAuthToken>',
  'Content-Type': 'application/json'
}
```

---

## HTTP Status Codes

| Code | Meaning               | Common Causes                                 |
| ---- | --------------------- | --------------------------------------------- |
| 200  | OK                    | Successful request                            |
| 201  | Created               | Resource created successfully                 |
| 400  | Bad Request           | Validation error, missing required fields     |
| 401  | Unauthorized          | Invalid/missing token, invalid credentials    |
| 403  | Forbidden             | Insufficient permissions, account deactivated |
| 404  | Not Found             | Resource doesn't exist                        |
| 409  | Conflict              | Duplicate resource (email, phone, name)       |
| 428  | Precondition Required | Missing two factor authentication             |
| 429  | Too Many Requests     | Rate limit exceeded                           |
| 500  | Internal Server Error | Server error, contact support                 |

---

## Rate Limits

| Endpoint                | Limit            | Window              |
| ----------------------- | ---------------- | ------------------- |
| POST /auth/login        | 5 attempts       | 15 minutes          |
| POST /2fa/\*            | Variable         | 60 seconds cooldown |
| POST /citizen/register  | 10 registrations | 1 hour per IP       |
| POST /activation/resend | 1 request        | 5 minutes           |
| GET /\*                 | 100 requests     | 1 minute            |

---

## Enumerations

### Alert Categories

- `WEATHER`: Weather-related emergencies
- `SECURITY`: Security threats
- `HEALTH`: Public health emergencies
- `INFRASTRUCTURE`: Infrastructure failures
- `ENVIRONMENTAL`: Environmental hazards
- `OTHER`: Other emergencies

### Alert Severity

- `EXTREME`: Extraordinary threat to life/property
- `SEVERE`: Significant threat
- `MODERATE`: Possible threat
- `MINOR`: Minimal threat

### Alert Urgency

- `IMMEDIATE`: Response within seconds
- `EXPECTED`: Response within hours
- `FUTURE`: Response in future
- `PAST`: Past event

### Alert Status

- `DRAFT`: Not yet sent
- `PENDING`: Queued for delivery
- `SENT`: Currently sending
- `DELIVERED`: Successfully delivered
- `FAILED`: Delivery failed
- `CANCELLED`: Cancelled by user

### Target Types

- `STATE`: Target entire state
- `LGA`: Target Local Government Area
- `WARD`: Target specific ward
- `RADIUS`: Target radius around point
- `POLYGON`: Target custom polygon area
- `PATH`: Target along path with buffer

### Delivery Status

- `QUEUED`: Waiting to send
- `SENT`: Sent to SMS gateway
- `DELIVERED`: Confirmed delivered
- `FAILED`: Delivery failed

### Two-Factor Methods

- `NONE`: 2FA disabled
- `GOOGLE_AUTHENTICATOR`: TOTP-based
- `EMAIL`: Email-based OTP

### Agency Types

- `FEDERAL`: Federal agency
- `STATE`: State agency
- `LOCAL`: Local government agency
- `SECURITY`: Security agency
- `HEALTH`: Health agency
- `EMERGENCY`: Emergency services

### Jurisdiction Levels

- `NATIONAL`: National coverage
- `STATE`: State-level coverage
- `LGA`: LGA-level coverage
- `WARD`: Ward-level coverage

---

## Security Best Practices

### 1. Token Management

```javascript
// Store tokens securely
localStorage.setItem("accessToken", token);

// Clear tokens on logout
localStorage.removeItem("accessToken");
localStorage.removeItem("refreshToken");

// Refresh tokens before expiry
setInterval(async () => {
  const newToken = await refreshAccessToken();
  localStorage.setItem("accessToken", newToken);
}, 14 * 60 * 1000); // 14 minutes (access token expires in 15)
```

### 2. Password Strength

- Minimum 8 characters
- At least 3 of: uppercase, lowercase, numbers, special characters
- Examples:
  - ✅ `SecurePass123!`
  - ✅ `MyStr0ng#Pwd`
  - ❌ `password` (too weak)
  - ❌ `12345678` (no letters)

### 3. Phone Number Validation

```javascript
function validateNigerianPhone(phone) {
  const pattern = /^(\+234|234|0)[789]\d{9}$/;
  return pattern.test(phone);
}

function normalizePhone(phone) {
  // Remove spaces and dashes
  phone = phone.replace(/[\s-]/g, "");

  // Convert to international format
  if (phone.startsWith("0")) {
    phone = "+234" + phone.substring(1);
  } else if (phone.startsWith("234")) {
    phone = "+" + phone;
  }

  return phone;
}
```

---

## Testing

### Postman Collection

Import our [Postman collection](./postman-collection.json) for easy testing.

### cURL Examples

**Login:**

```bash
curl -X POST https://api.geoalert.gov.ng/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@agency.gov.ng",
    "password": "SecurePass123!"
  }'
```

**Create Alert:**

```bash
curl -X POST https://api.geoalert.gov.ng/api/v1/alert \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "WEATHER",
    "severity": "EXTREME",
    "urgency": "IMMEDIATE",
    "headline": "Flash Flood Warning",
    "description": "Heavy rains expected. Seek higher ground.",
    "targets": [{
      "targetType": "STATE",
      "stateId": "clstate123456"
    }]
  }'
```

---



## Next Steps

1. **Read the Authentication docs** to understand login flow
2. **Set up 2FA** for your account
3. **Explore Alert Management** to understand core functionality
4. **Review Citizen Management** for public-facing endpoints
5. **Test in sandbox environment** before production

---


## API Changelog

### Version 1.0.0 (Current)

- Initial release
- Full CRUD operations for agencies, users, alerts, citizens
- Email and TOTP 2FA support
- Geo-targeting capabilities
- SMS delivery tracking
- Audit logging

### Roadmap

- [ ] Multi-language support for SMS
- [ ] Alert templates
- [ ] Scheduled alerts
- [ ] Alert analytics dashboard
- [ ] Webhook notifications


