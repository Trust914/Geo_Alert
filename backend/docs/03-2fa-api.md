# Two-Factor Authentication (2FA) API Documentation

## Base URL
```
/api/v1/2fa
```

## Overview
The 2FA API provides secure two-factor authentication setup and management. Supports two methods:
- **Email OTP**: 6-digit code sent via email
- **Google Authenticator (TOTP)**: Time-based one-time passwords

All endpoints require authentication except where noted.

---

## Authentication Methods Comparison

| Feature | Email OTP | Google Authenticator |
|---------|-----------|---------------------|
| Setup Difficulty | Easy | Moderate |
| Requires Phone | No | Yes (for QR scan) |
| Works Offline | No | Yes |
| Security Level | Medium | High |
| Recovery | Backup codes | Backup codes |

---

## Endpoints

### 1. Get 2FA Status
Retrieves current 2FA configuration for the authenticated user.

**Endpoint:** `GET /2fa/status`
**Authentication:** Required

#### Response
```json
{
  "success": true,
  "message": "2FA status retrieved",
  "data": {
    "enabled": true,
    "method": "EMAIL",
    "backupCodesCount": 8
  }
}
```

#### Response Fields
- **enabled** (boolean): Whether 2FA is active
- **method** (string): "NONE", "EMAIL", or "GOOGLE_AUTHENTICATOR"
- **backupCodesCount** (number): Remaining backup codes

---

## Email 2FA Setup

### 2. Initiate Email 2FA Setup (Step 1)
Sends a verification code to the user's email to confirm ownership.

**Endpoint:** `POST /2fa/email/initiate-setup`
**Authentication:** Required
**Rate Limit:** 3 attempts per hour, 60s cooldown between requests

#### Request Body
No body required

#### Response
```json
{
  "success": true,
  "message": "Verification code sent to your email",
  "data": {
    "email": "user@example.com",
    "expiresInSeconds": 300
  }
}
```

#### Error Responses

**Too Many Requests**
```json
{
  "success": false,
  "error": "Please wait before requesting a new code",
  "statusCode": 429
}
```

**Rate Limit Exceeded**
```json
{
  "success": false,
  "error": "Too many setup attempts. Account locked for 15 minutes.",
  "statusCode": 429
}
```

---

### 3. Verify Email and Enable 2FA (Step 2)
Completes email 2FA setup by verifying the code.

**Endpoint:** `POST /2fa/email/verify-and-enable`
**Authentication:** Required

#### Request Body
```json
{
  "code": "123456"
}
```

#### Validation Rules
- **code**: 6-digit string, required

#### Response
```json
{
  "success": true,
  "message": "Email-based 2FA enabled successfully",
  "data": {
    "backupCodes": [
      "A1B2C3D4",
      "E5F6G7H8",
      "I9J0K1L2",
      "M3N4O5P6",
      "Q7R8S9T0",
      "U1V2W3X4",
      "Y5Z6A7B8",
      "C9D0E1F2",
      "G3H4I5J6",
      "K7L8M9N0"
    ]
  }
}
```

#### Important Notes
- **Save backup codes immediately**: They are only shown once!
- **Backup codes format**: 8 uppercase alphanumeric characters
- **10 codes generated**: Each can be used once

#### Error Responses

**Invalid Code**
```json
{
  "success": false,
  "error": "Invalid verification code",
  "statusCode": 401
}
```

**Setup Expired**
```json
{
  "success": false,
  "error": "Setup session expired. Please start again.",
  "statusCode": 400
}
```

---

## Google Authenticator (TOTP) Setup

### 4. Setup TOTP (Step 1)
Generates QR code and secret for Google Authenticator app.

**Endpoint:** `POST /2fa/totp/setup`
**Authentication:** Required

#### Request Body
No body required

#### Response
```json
{
  "success": true,
  "message": "Scan QR code with Google Authenticator app",
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUh...",
    "otpAuthUrl": "otpauth://totp/GEOALERT:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GEOALERT",
    "backupCodes": [
      "A1B2C3D4",
      "E5F6G7H8",
      // ... 8 more codes
    ]
  }
}
```

#### Response Fields
- **secret**: Manual entry code if QR scan fails
- **qrCodeUrl**: Base64 encoded QR code image
- **otpAuthUrl**: URL for manual app configuration
- **backupCodes**: One-time use recovery codes

---

### 5. Verify and Enable TOTP (Step 2)
Confirms TOTP setup by verifying a code from the authenticator app.

**Endpoint:** `POST /2fa/totp/verify`
**Authentication:** Required

#### Request Body
```json
{
  "token": "123456"
}
```

#### Validation Rules
- **token**: 6-digit string, digits only

#### Response
```json
{
  "success": true,
  "message": "Two-factor authentication enabled successfully"
}
```

#### Error Responses

**Invalid Token**
```json
{
  "success": false,
  "error": "Invalid verification code",
  "statusCode": 401
}
```

**No Pending Setup**
```json
{
  "success": false,
  "error": "No pending 2FA setup found. Please start setup again.",
  "statusCode": 400
}
```

---

## Managing 2FA

### 6. Request OTP for Sensitive Actions
Requests a verification code for protected operations (e.g., password change).

**Endpoint:** `POST /2fa/request-otp`
**Authentication:** Required
**Applicable to:** Email 2FA users only

#### Request Body
No body required

#### Response
```json
{
  "success": true,
  "message": "OTP sent to email"
}
```

#### Notes
- **Email 2FA only**: TOTP users check their authenticator app
- **Cooldown**: 60 seconds between requests
- **Expiry**: Code valid for 5 minutes

---

### 7. Regenerate Backup Codes
Generates new backup codes, invalidating old ones.

**Endpoint:** `POST /2fa/backup-codes/regenerate`
**Authentication:** Required + 2FA Verification

#### Request Body
No body required (2FA code sent via header or verified in previous step)

#### Response
```json
{
  "success": true,
  "message": "Backup codes regenerated successfully",
  "data": {
    "backupCodes": [
      "X1Y2Z3A4",
      "B5C6D7E8",
      "F9G0H1I2",
      "J3K4L5M6",
      "N7O8P9Q0",
      "R1S2T3U4",
      "V5W6X7Y8",
      "Z9A0B1C2",
      "D3E4F5G6",
      "H7I8J9K0"
    ]
  }
}
```

#### Important Warnings
- ⚠️ **Old codes immediately invalidated**
- ⚠️ **Save new codes immediately**
- ⚠️ **Cannot recover old codes**

---

### 8. Disable 2FA
Turns off two-factor authentication.

**Endpoint:** `POST /2fa/disable`
**Authentication:** Required + 2FA Verification

#### Request Body
```json
{
  "password": "CurrentPassword123!"
}
```

#### Validation Rules
- **password**: Current account password, required

#### Response
```json
{
  "success": true,
  "message": "Two-factor authentication disabled successfully"
}
```

#### Security Notes
- **Password confirmation required**
- **2FA verification required** (if currently enabled)
- **All backup codes deleted**
- **All active sessions remain valid**

---

## Frontend Integration Guides

### Email 2FA Complete Flow

```javascript
// Step 1: Initiate setup
async function setupEmail2FA() {
  try {
    const response = await fetch('/api/v1/2fa/email/initiate-setup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error);
      return;
    }

    // Show OTP input form
    const { email, expiresInSeconds } = data.data;
    showOTPInput(email, expiresInSeconds);

  } catch (error) {
    alert('Network error. Please try again.');
  }
}

// Step 2: Verify and complete
async function verifyEmailCode(code) {
  try {
    const response = await fetch('/api/v1/2fa/email/verify-and-enable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error);
      return;
    }

    // CRITICAL: Display backup codes for user to save
    const { backupCodes } = data.data;
    showBackupCodes(backupCodes);

    // Force user to download or copy codes before proceeding
    enableContinueButton();

  } catch (error) {
    alert('Network error. Please try again.');
  }
}
```

### Google Authenticator Complete Flow

```javascript
// Step 1: Get QR code
async function setupTOTP() {
  try {
    const response = await fetch('/api/v1/2fa/totp/setup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error);
      return;
    }

    const { qrCodeUrl, secret, backupCodes } = data.data;

    // Display QR code and manual entry code
    displayQRCode(qrCodeUrl);
    displaySecret(secret); // For manual entry

    // Store backup codes temporarily (will be shown after verification)
    storeBackupCodes(backupCodes);

    // Show verification input
    showTOTPVerificationForm();

  } catch (error) {
    alert('Network error. Please try again.');
  }
}

// Step 2: Verify token from app
async function verifyTOTP(token) {
  try {
    const response = await fetch('/api/v1/2fa/totp/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    const data = await response.json();

    if (!data.success) {
      alert(data.error);
      return;
    }

    // Success! Now show backup codes
    const backupCodes = getStoredBackupCodes();
    showBackupCodesModal(backupCodes);

  } catch (error) {
    alert('Network error. Please try again.');
  }
}
```

### React Component Example

```javascript
import React, { useState } from 'react';

export default function Setup2FA() {
  const [method, setMethod] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Email 2FA
  async function handleEmailSetup() {
    setMethod('email');
    const response = await fetch('/api/v1/2fa/email/initiate-setup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    if (data.success) {
      alert(`Verification code sent to ${data.data.email}`);
    }
  }

  async function handleEmailVerify() {
    const response = await fetch('/api/v1/2fa/email/verify-and-enable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();
    if (data.success) {
      setBackupCodes(data.data.backupCodes);
      setShowBackupCodes(true);
    }
  }

  // TOTP setup
  async function handleTOTPSetup() {
    setMethod('totp');
    const response = await fetch('/api/v1/2fa/totp/setup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const data = await response.json();
    if (data.success) {
      setQrCode(data.data.qrCodeUrl);
      setSecret(data.data.secret);
      setBackupCodes(data.data.backupCodes);
    }
  }

  async function handleTOTPVerify() {
    const response = await fetch('/api/v1/2fa/totp/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: code })
    });

    const data = await response.json();
    if (data.success) {
      setShowBackupCodes(true);
    }
  }

  if (showBackupCodes) {
    return (
      <div>
        <h2>Save Your Backup Codes</h2>
        <p style={{ color: 'red' }}>
          These codes will only be shown once. Save them securely!
        </p>
        <ul>
          {backupCodes.map((code, i) => (
            <li key={i}><code>{code}</code></li>
          ))}
        </ul>
        <button onClick={() => {
          const text = backupCodes.join('\n');
          navigator.clipboard.writeText(text);
          alert('Copied to clipboard!');
        }}>
          Copy All Codes
        </button>
        <button onClick={() => window.location.href = '/dashboard'}>
          I've Saved My Codes
        </button>
      </div>
    );
  }

  if (!method) {
    return (
      <div>
        <h2>Choose 2FA Method</h2>
        <button onClick={handleEmailSetup}>Email (Easier)</button>
        <button onClick={handleTOTPSetup}>Google Authenticator (More Secure)</button>
      </div>
    );
  }

  if (method === 'email') {
    return (
      <div>
        <h2>Verify Email Code</h2>
        <p>Check your email for a 6-digit code</p>
        <input
          type="text"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
        />
        <button onClick={handleEmailVerify}>Verify</button>
      </div>
    );
  }

  if (method === 'totp') {
    return (
      <div>
        <h2>Scan QR Code</h2>
        <img src={qrCode} alt="QR Code" />
        <p>Or enter manually: <code>{secret}</code></p>
        <h3>Verify Setup</h3>
        <input
          type="text"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
        />
        <button onClick={handleTOTPVerify}>Verify</button>
      </div>
    );
  }
}
```

---

## Security Best Practices

### For Users
1. **Save backup codes immediately** - They're only shown once
2. **Store codes securely** - Password manager or safe location
3. **Don't share codes** - Each code is single-use
4. **Keep authenticator app secure** - Use device lock
5. **Regenerate codes if compromised** - Use the regenerate endpoint

### For Developers
1. **Never log codes** - Even in debug mode
2. **Enforce 2FA for admins** - High-privilege accounts
3. **Rate limit aggressively** - Prevent brute force
4. **Clear sensitive data** - Remove codes from memory
5. **Audit 2FA changes** - Log enable/disable events

---

## Troubleshooting

### Email OTP Issues

**Problem**: "Please wait before requesting a new code"
**Solution**: Wait 60 seconds between requests

**Problem**: Code never received
**Solution**:
1. Check spam folder
2. Wait 5 minutes for delivery
3. Use resend endpoint

**Problem**: "Invalid verification code"
**Solutions**:
1. Check for typos (O vs 0, I vs 1)
2. Ensure code hasn't expired (5 minutes)
3. Request new code

### TOTP Issues

**Problem**: "Invalid verification code"
**Solutions**:
1. Check device time is correct (TOTP is time-based)
2. Try previous/next code (30-second window)
3. Use backup code instead

**Problem**: Lost phone with authenticator
**Solution**: Use backup codes to login, then disable and re-enable 2FA

**Problem**: Can't scan QR code
**Solution**: Use manual entry with the `secret` field

---

## Error Responses Reference

### Rate Limiting
```json
{
  "success": false,
  "error": "Too many OTP requests. Account locked for 15 minutes.",
  "statusCode": 429
}
```

### Invalid Codes
```json
{
  "success": false,
  "error": "Invalid verification code",
  "statusCode": 401
}
```

### Expired Sessions
```json
{
  "success": false,
  "error": "Setup session expired. Please start again.",
  "statusCode": 400
}
```

### Already Enabled
```json
{
  "success": false,
  "error": "Two-factor authentication is already enabled",
  "statusCode": 400
}
```