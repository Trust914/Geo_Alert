# Authentication API Documentation

## Base URL
```
/api/v1/auth
```

## Overview
The Authentication API handles user login, logout, password management, session management, and audit logs. All authenticated routes require a valid JWT token in the Authorization header.

---

## Endpoints

### 1. Login (Step 1)
Initiates user login. Returns pre-auth token if 2FA is enabled, otherwise returns full authentication.

**Endpoint:** `POST /auth/login`
**Authentication:** None
**Rate Limit:** 5 attempts per 15 minutes per email

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

#### Validation Rules
- **email**: Valid email format, lowercase, trimmed
- **password**: Required, minimum 1 character

#### Response (No 2FA)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "clxxx123456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "mustChangePassword": false,
      "agencyId": "clyyy789012",
      "agency": {
        "id": "clyyy789012",
        "name": "Federal Emergency Agency",
        "type": "FEDERAL",
        "jurisdictionLevel": "NATIONAL",
        "jurisdiction": "Nigeria",
        "status": "ACTIVE"
      },
      "isTwoFactorEnabled": false
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Response (2FA Required)
```json
{
  "success": true,
  "message": "Two-factor authentication required",
  "data": {
    "requiresTwoFactor": true,
    "twoFactorMethod": "EMAIL",
    "preAuthToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "clxxx123456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

#### Error Responses
```json
// Invalid credentials
{
  "success": false,
  "error": "Invalid email or password",
  "statusCode": 401
}

// Account not activated
{
  "success": false,
  "error": "Please activate your account using the link sent to your email",
  "statusCode": 403
}

// Account deactivated
{
  "success": false,
  "error": "Your account has been deactivated. Please contact your administrator.",
  "statusCode": 403
}

// Too many attempts
{
  "success": false,
  "error": "Too many login attempts. Please try again later.",
  "statusCode": 429
}
```

---

### 2. Verify Two-Factor Authentication (Step 2)
Completes login after 2FA verification.

**Endpoint:** `POST /auth/2fa/verify-login`
**Authentication:** Requires `preAuthToken` from login
**Headers:**
```
Authorization: Bearer <preAuthToken>
```

#### Request Body
```json
{
  "code": "123456"
}
```

#### Validation Rules
- **code**: 6 digits (TOTP/Email OTP) OR 8 characters (backup code)
- Automatically detects code type based on length

#### Response
```json
{
  "success": true,
  "message": "Two-factor authentication successful",
  "data": {
    "user": {
      "id": "clxxx123456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "mustChangePassword": false,
      "agencyId": "clyyy789012",
      "agency": { /* ... */ },
      "isTwoFactorEnabled": true,
      "twoFactorMethod": "EMAIL"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Responses
```json
// Invalid code
{
  "success": false,
  "error": "Invalid verification code",
  "statusCode": 401
}

// Too many failed attempts
{
  "success": false,
  "error": "Too many failed verification attempts. Please try again later.",
  "statusCode": 429
}
```

---

### 3. Resend 2FA Code
Resends verification code during login or password reset.

**Endpoint:** `POST /auth/2fa/resend`
**Authentication:** Requires `preAuthToken`
**Rate Limit:** 60 seconds cooldown between requests

#### Request Body
No body required

#### Response
```json
{
  "success": true,
  "message": "Verification code resent successfully"
}
```

#### Error Responses
```json
// Cooldown active
{
  "success": false,
  "error": "Please wait before requesting a new code",
  "statusCode": 429
}

// 2FA not enabled (for login context)
{
  "success": false,
  "error": "Two factor authentication not enabled for this account",
  "statusCode": 400
}
```

---

### 4. Refresh Access Token
Generates new access token using refresh token.

**Endpoint:** `POST /auth/refresh`
**Authentication:** Requires refresh token (cookie or body)

#### Request
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Optional if sent as cookie
}
```

#### Response
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Responses
```json
// Invalid/expired token
{
  "success": false,
  "error": "Invalid or expired refresh token",
  "statusCode": 401
}

// Account deactivated
{
  "success": false,
  "error": "Account is deactivated",
  "statusCode": 403
}
```

---

### 5. Logout
Invalidates current session tokens.

**Endpoint:** `POST /auth/logout`
**Authentication:** Optional (accepts both access and refresh tokens)

#### Request Body
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Optional if sent as cookie
}
```

#### Response
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 6. Get Current User
Retrieves authenticated user's information.

**Endpoint:** `GET /auth/me`
**Authentication:** Required
**Headers:**
```
Authorization: Bearer <accessToken>
```

#### Response
```json
{
  "success": true,
  "message": "User retrieved",
  "data": {
    "user": {
      "id": "clxxx123456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true,
      "mustChangePassword": false,
      "emailVerified": true,
      "isTwoFactorEnabled": true,
      "twoFactorMethod": "EMAIL",
      "agencyId": "clyyy789012",
      "agency": {
        "id": "clyyy789012",
        "name": "Federal Emergency Agency",
        "type": "FEDERAL",
        "jurisdictionLevel": "NATIONAL"
      },
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLoginAt": "2024-01-05T12:00:00.000Z"
    }
  }
}
```

---

### 7. Change Password
Allows user to change their own password.

**Endpoint:** `POST /auth/change-password`
**Authentication:** Required + 2FA verification
**2FA Required:** Yes

#### Request Body
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!"
}
```

#### Validation Rules
- **currentPassword**: Required, minimum 1 character
- **newPassword**: Must meet password requirements:
  - Minimum 8 characters
  - At least 3 of: uppercase, lowercase, numbers, special characters
- **confirmPassword**: Must match newPassword
- **newPassword** must be different from currentPassword

#### Response
```json
{
  "success": true,
  "message": "Password changed successfully. Please login with your new password."
}
```

#### Error Responses
```json
// Current password incorrect
{
  "success": false,
  "error": "Current password is incorrect",
  "statusCode": 400
}

// Passwords don't match
{
  "success": false,
  "error": "Passwords do not match",
  "statusCode": 400
}

// Weak password
{
  "success": false,
  "error": "Password must contain at least 3 of: uppercase, lowercase, numbers, special characters",
  "statusCode": 400
}
```

---

### 8. Get User Sessions
Lists all active sessions for the authenticated user.

**Endpoint:** `GET /auth/sessions`
**Authentication:** Required

#### Response
```json
{
  "success": true,
  "message": "Sessions retrieved",
  "data": {
    "sessions": [
      {
        "id": "clsss111222",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
        "createdAt": "2024-01-05T10:00:00.000Z",
        "expiresAt": "2024-01-12T10:00:00.000Z",
        "isRevoked": false
      },
      {
        "id": "clsss333444",
        "ipAddress": "192.168.1.2",
        "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0...)...",
        "createdAt": "2024-01-04T15:30:00.000Z",
        "expiresAt": "2024-01-11T15:30:00.000Z",
        "isRevoked": false
      }
    ]
  }
}
```

---

### 9. Revoke Session
Terminates a specific session.

**Endpoint:** `DELETE /auth/sessions/:sessionId`
**Authentication:** Required + 2FA verification
**2FA Required:** Yes

#### URL Parameters
- **sessionId** (string, CUID): Session ID to revoke

#### Response
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

### 10. Logout All Devices
Terminates all sessions for the user.

**Endpoint:** `POST /auth/logout-all`
**Authentication:** Required + 2FA verification
**2FA Required:** Yes

#### Response
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

---

### 11. Get User Audit Logs
Retrieves activity logs for the authenticated user.

**Endpoint:** `GET /auth/audit-logs`
**Authentication:** Required

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | enum | No | Filter by action type (see ActionType enum) |
| startDate | ISO datetime | No | Filter logs from this date |
| endDate | ISO datetime | No | Filter logs until this date |
| currentPage | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |

#### Example Request
```
GET /auth/audit-logs?action=LOGIN_SUCCESS&currentPage=1&limit=20
```

#### Response
```json
{
  "success": true,
  "message": "Audit logs retrieved successfully",
  "data": [
    {
      "id": "cllog111222",
      "action": "LOGIN_SUCCESS",
      "entityType": "USER",
      "entityId": "clxxx123456",
      "description": "User logged in successfully",
      "changes": {
        "agencyId": "clyyy789012",
        "agencyName": "Federal Emergency Agency",
        "role": "ADMIN",
        "twoFactorMethod": "EMAIL",
        "isTwoFactor": true
      },
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2024-01-05T12:00:00.000Z"
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

### 12. Get Agency Audit Logs
Retrieves activity logs for all users in the agency (Admin/Coordinator access).

**Endpoint:** `GET /auth/agency/audit-logs`
**Authentication:** Required
**Permissions:** Admin, Coordinator

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| action | enum | No | Filter by action type |
| entityType | enum | No | Filter by entity type |
| userId | CUID | No | Filter by specific user |
| startDate | ISO datetime | No | Filter logs from this date |
| endDate | ISO datetime | No | Filter logs until this date |
| currentPage | number | No | Page number (default: 1) |
| limit | number | No | Items per page (default: 20, max: 100) |

#### Response
```json
{
  "success": true,
  "message": "Agency audit logs retrieved successfully",
  "data": [
    {
      "id": "cllog333444",
      "action": "ALERT_SENT",
      "entityType": "ALERT",
      "entityId": "clalert555666",
      "description": "Alert sent successfully",
      "changes": {
        "status": "QUEUED"
      },
      "ipAddress": "192.168.1.5",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2024-01-05T14:30:00.000Z",
      "userId": "clxxx123456",
      "user": {
        "id": "clxxx123456",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "ADMIN"
      }
    }
  ],
  "pagination": {
    "total": 500,
    "currentPage": 1,
    "limit": 20,
    "totalPages": 25,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Password Reset Flow (Admin-Initiated)

### 13. Verify Reset Token
Validates password reset link from email.

**Endpoint:** `GET /auth/reset-password/verify`
**Authentication:** None

#### Query Parameters
- **token** (string): Reset token from email
- **userId** (CUID): User ID

#### Example Request
```
GET /auth/reset-password/verify?token=abc123...&userId=clxxx123456
```

#### Response
```json
{
  "success": true,
  "message": "Token valid",
  "data": {
    "valid": true,
    "requiresTwoFactor": true,
    "twoFactorMethod": "EMAIL"
  }
}
```

#### Error Responses
```json
// Invalid/expired token
{
  "success": false,
  "error": "Invalid or expired reset link",
  "statusCode": 400
}
```

---

### 14. Complete Password Reset
Completes password reset with new password.

**Endpoint:** `POST /auth/reset-password/complete`
**Authentication:** None (token-based)
**2FA Verification:** Required for all users

#### Request Body
```json
{
  "userId": "clxxx123456",
  "token": "abc123...",
  "newPassword": "NewSecurePass456!",
  "confirmPassword": "NewSecurePass456!",
  "totpCode": "123456"
}
```

#### Validation Rules
- **userId**: Valid CUID format
- **token**: Required, max 256 characters
- **newPassword**: Must meet password strength requirements
- **confirmPassword**: Must match newPassword
- **totpCode**: Required (6-digit code)

#### Response
```json
{
  "success": true,
  "message": "Password reset successfully. You can now login."
}
```

#### Error Responses
```json
// Missing 2FA code
{
  "success": false,
  "error": "Verification code required to complete reset",
  "code": "2FA_REQUIRED",
  "statusCode": 400,
  "data": {
    "requires2FA": true,
    "method": "EMAIL"
  }
}

// Invalid 2FA code
{
  "success": false,
  "error": "Invalid verification code",
  "code": "2FA_INVALID",
  "statusCode": 401
}
```

---

## Common Error Responses

### Authentication Errors
```json
// Missing token
{
  "success": false,
  "error": "Authentication token required",
  "statusCode": 401
}

// Invalid token
{
  "success": false,
  "error": "Invalid or expired token",
  "statusCode": 401
}

// Insufficient permissions
{
  "success": false,
  "error": "Insufficient permissions",
  "statusCode": 403
}
```

### Validation Errors
```json
{
  "success": false,
  "error": "Validation failed",
  "statusCode": 400,
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters long"
    }
  ]
}
```

---

## Enums Reference

### ActionType
```typescript
enum ActionType {
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGIN_PENDING_2FA = "LOGIN_PENDING_2FA",
  LOGOUT = "LOGOUT",
  LOGOUT_ALL = "LOGOUT_ALL",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  PASSWORD_CHANGE_FAILED = "PASSWORD_CHANGE_FAILED",
  TOKEN_REFRESH = "TOKEN_REFRESH",
  SESSION_REVOKED = "SESSION_REVOKED",
  TWO_FA_VERIFICATION_SUCCESS = "TWO_FA_VERIFICATION_SUCCESS",
  TWO_FA_VERIFICATION_FAILED = "TWO_FA_VERIFICATION_FAILED",
  EMAIL_OTP_SENT = "EMAIL_OTP_SENT",
  // ... see full list in source
}
```

### EntityType
```typescript
enum EntityType {
  USER = "USER",
  AGENCY = "AGENCY",
  ALERT = "ALERT",
  CITIZEN = "CITIZEN",
  REFRESH_TOKEN = "REFRESH_TOKEN"
}
```

---

## Best Practices

### Token Management
1. **Access Token**: Short-lived (15 minutes), sent in Authorization header
2. **Refresh Token**: Long-lived (7 days), stored in HTTP-only cookie
3. **Pre-Auth Token**: Temporary (5 minutes), used only for 2FA flow

### Security Headers
```javascript
{
  "Authorization": "Bearer <accessToken>",
  "Content-Type": "application/json"
}
```

### Error Handling
Always check the `success` field before processing data:
```javascript
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();

if (!data.success) {
  // Handle error
  console.error(data.error);
  return;
}

// Process successful response
const { user, accessToken } = data.data;
```

### 2FA Flow
```javascript
// Step 1: Login
const loginResponse = await login(email, password);

if (loginResponse.data.requiresTwoFactor) {
  // Step 2: Store preAuthToken and show 2FA input
  const preAuthToken = loginResponse.data.preAuthToken;

  // Step 3: Verify 2FA
  const verifyResponse = await verify2FA(code, preAuthToken);

  // Step 4: Store accessToken
  const accessToken = verifyResponse.data.accessToken;
}
```