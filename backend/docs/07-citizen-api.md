# Citizen Management API Documentation

## Base URL
```
/api/v1/citizen
```

## Overview
The Citizen Management API handles citizen registration, profile management, and opt-in/opt-out preferences for alert notifications.

**Access Control**:
- **Public**: Registration endpoint
- **Read**: All authenticated users
- **Write**: Admin, Coordinator, Operator roles

---

## Citizen Data Model

```typescript
interface Citizen {
  id: string;
  phoneNumber: string;           // Normalized Nigerian format
  firstName: string;
  lastName: string;
  stateId: string;
  state: { id: string; name: string };
  lgaId: string;
  lga: { id: string; name: string };
  wardId?: string;
  ward?: { id: string; name: string };
  location?: {                   // GPS coordinates
    latitude: number;
    longitude: number;
  };
  preferredLanguage: Language;   // For future multi-language support
  isOptedIn: boolean;            // Alert subscription status
  registeredAt: Date;
  updatedAt: Date;
}
```

---

## Phone Number Formats

### Accepted Formats
```
+2348012345678   (International format - preferred)
2348012345678    (Without +)
08012345678      (Local format)
```

### Validation Pattern
```regex
^(\+234|234|0)[789]\d{9}$
```

### Valid Prefixes
- **070X, 071X**: Airtel
- **080X, 081X, 090X**: MTN, Glo, 9Mobile
- **070X**: Airtel

---

## Endpoints

### 1. Register Citizen (Public)
Allows citizens to self-register for alerts.

**Endpoint:** `POST /citizen/register`
**Authentication:** None (Public)
**Rate Limit:** 10 registrations per IP per hour

#### Request Body
```json
{
  "phoneNumber": "+2348012345678",
  "firstName": "Chioma",
  "lastName": "Okafor",
  "stateId": "clstate123456",
  "lgaId": "cllga789012",
  "wardId": "clward345678",
  "preferredLanguage": "ENGLISH",
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  }
}
```

#### Validation Rules

**phoneNumber** (required)
- Format: Nigerian phone number
- Unique: Yes
- Normalized automatically

**firstName**, **lastName** (required)
- Length: 2-50 characters
- Trimmed automatically

**stateId** (required)
- Format: Valid CUID
- Must exist in database

**lgaId** (required)
- Format: Valid CUID
- Must belong to specified state

**wardId** (optional)
- Format: Valid CUID
- Must belong to specified LGA

**preferredLanguage** (optional)
- Default: ENGLISH
- Values: ENGLISH, HAUSA, IGBO, YORUBA, PIDGIN

**location** (optional)
- If not provided: Calculated from address (ward > LGA centroid)
- If provided: Used directly
- Latitude: -90 to 90
- Longitude: -180 to 180

#### Success Response
```json
{
  "success": true,
  "message": "Citizen registered successfully",
  "data": {
    "id": "clcitizen111222",
    "phoneNumber": "+2348012345678",
    "firstName": "Chioma",
    "lastName": "Okafor",
    "state": {
      "id": "clstate123456",
      "name": "Lagos State"
    },
    "lga": {
      "id": "cllga789012",
      "name": "Ikeja"
    },
    "ward": {
      "id": "clward345678",
      "name": "Ward A"
    },
    "location": {
      "latitude": 6.5244,
      "longitude": 3.3792
    },
    "preferredLanguage": "ENGLISH",
    "isOptedIn": true,
    "registeredAt": "2024-01-05T10:00:00.000Z",
    "updatedAt": "2024-01-05T10:00:00.000Z"
  }
}
```

#### Post-Registration
1. Welcome SMS sent automatically
2. Citizen opted in by default
3. Location stored for geo-targeting
4. Audit log created

#### Error Responses

**Duplicate Phone Number**
```json
{
  "success": false,
  "error": "Phone number already registered",
  "statusCode": 409
}
```

**Invalid Phone Format**
```json
{
  "success": false,
  "error": "Invalid Nigerian phone number",
  "statusCode": 400
}
```

**Invalid Address**
```json
{
  "success": false,
  "error": "LGA not found or invalid",
  "statusCode": 404
}
```

---

### 2. Get Citizens (Admin)
Retrieves paginated list of citizens with filters.

**Endpoint:** `GET /citizen`
**Authentication:** Required (All roles)

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| stateId | CUID | No | - | Filter by state |
| lgaId | CUID | No | - | Filter by LGA |
| wardId | CUID | No | - | Filter by ward |
| isOptedIn | boolean | No | - | Filter by opt-in status |
| search | string | No | - | Search name/phone |
| currentPage | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page (max: 100) |

#### Example Request
```
GET /citizen?stateId=clstate123&isOptedIn=true&currentPage=1&limit=20
```

#### Response
```json
{
  "success": true,
  "message": "Citizens retrieved successfully",
  "data": [
    {
      "id": "clcitizen111222",
      "phoneNumber": "+2348012345678",
      "firstName": "Chioma",
      "lastName": "Okafor",
      "state": {
        "id": "clstate123456",
        "name": "Lagos State"
      },
      "lga": {
        "id": "cllga789012",
        "name": "Ikeja"
      },
      "ward": {
        "id": "clward345678",
        "name": "Ward A"
      },
      "preferredLanguage": "ENGLISH",
      "isOptedIn": true,
      "registeredAt": "2024-01-05T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 50000,
    "currentPage": 1,
    "limit": 20,
    "totalPages": 2500,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

### 3. Get Citizen by Phone Number
Retrieves a specific citizen by phone number.

**Endpoint:** `GET /citizen/phone/:phoneNumber`
**Authentication:** Required (All roles)

#### URL Parameters
- **phoneNumber**: Nigerian phone number (any accepted format)

#### Example Request
```
GET /citizen/phone/08012345678
```

#### Response
```json
{
  "success": true,
  "message": "Citizen retrieved",
  "data": {
    "id": "clcitizen111222",
    "phoneNumber": "+2348012345678",
    "firstName": "Chioma",
    "lastName": "Okafor",
    "state": {
      "id": "clstate123456",
      "name": "Lagos State"
    },
    "lga": {
      "id": "cllga789012",
      "name": "Ikeja"
    },
    "ward": {
      "id": "clward345678",
      "name": "Ward A"
    },
    "location": {
      "latitude": 6.5244,
      "longitude": 3.3792
    },
    "preferredLanguage": "ENGLISH",
    "isOptedIn": true,
    "registeredAt": "2024-01-05T10:00:00.000Z",
    "updatedAt": "2024-01-05T10:00:00.000Z"
  }
}
```

---

### 4. Get Citizen by ID
Retrieves a specific citizen by ID.

**Endpoint:** `GET /citizen/:id`
**Authentication:** Required (All roles)

#### Response
Same structure as Get Citizen by Phone Number

---

### 5. Update Citizen
Updates citizen information.

**Endpoint:** `PUT /citizen/:phoneNumber`
**Authentication:** Required (Admin/Coordinator/Operator)

#### URL Parameters
- **phoneNumber**: Nigerian phone number

#### Request Body
```json
{
  "firstName": "Chioma",
  "lastName": "Updated",
  "stateId": "clstate123456",
  "lgaId": "cllga789012",
  "wardId": "clward345678",
  "preferredLanguage": "YORUBA",
  "isOptedIn": true,
  "location": {
    "latitude": 6.5244,
    "longitude": 3.3792
  }
}
```

#### Updatable Fields
- firstName
- lastName
- stateId
- lgaId
- wardId (can be null to remove)
- preferredLanguage
- isOptedIn
- location

#### Non-Updatable Fields
- phoneNumber (identifier)
- registeredAt

#### Location Update Logic
1. **If location provided**: Use it directly
2. **If address changed, no location**: Recalculate from new address
3. **If no changes**: Keep existing location

#### Response
```json
{
  "success": true,
  "message": "Citizen updated successfully",
  "data": {
    /* updated citizen object */
  }
}
```

---

### 6. Opt In Citizen
Opts a citizen into alert notifications.

**Endpoint:** `POST /citizen/:phoneNumber/opt-in`
**Authentication:** Required (Admin/Coordinator/Operator)

#### URL Parameters
- **phoneNumber**: Nigerian phone number

#### Response
```json
{
  "success": true,
  "message": "Citizen opted in successfully"
}
```

#### Use Cases
- Manual opt-in after phone call
- Restoring opt-in after complaint resolution
- Mass opt-in campaigns

---

### 7. Opt Out Citizen
Opts a citizen out of alert notifications.

**Endpoint:** `POST /citizen/:phoneNumber/opt-out`
**Authentication:** Required (Admin/Coordinator/Operator)

#### URL Parameters
- **phoneNumber**: Nigerian phone number

#### Response
```json
{
  "success": true,
  "message": "Citizen opted out successfully"
}
```

#### Use Cases
- Manual opt-out request via phone/email
- Compliance with opt-out SMS keywords
- Privacy requests

---

### 8. Get Citizens Nearby
Finds citizens within a radius of a location.

**Endpoint:** `GET /citizen/nearby`
**Authentication:** Required (All roles)

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| latitude | number | Yes | - | Center latitude |
| longitude | number | Yes | - | Center longitude |
| radiusKm | number | No | 10 | Search radius in kilometers |

#### Example Request
```
GET /citizen/nearby?latitude=6.5244&longitude=3.3792&radiusKm=5
```

#### Response
```json
{
  "success": true,
  "message": "Nearby citizens retrieved",
  "data": [
    {
      "id": "clcitizen111222",
      "phoneNumber": "+2348012345678",
      "firstName": "Chioma",
      "lastName": "Okafor",
      "preferredLanguage": "ENGLISH",
      "isOptedIn": true,
      "distance": 2.34
    },
    {
      "id": "clcitizen333444",
      "phoneNumber": "+2348098765432",
      "firstName": "Ibrahim",
      "lastName": "Yusuf",
      "preferredLanguage": "HAUSA",
      "isOptedIn": true,
      "distance": 3.87
    }
  ]
}
```

#### Notes
- **distance**: In kilometers from center point
- **Sorted**: By distance (nearest first)
- **Only opted-in**: Only returns citizens with `isOptedIn: true`
- **Requires location**: Citizens without GPS coordinates excluded

---

### 9. Get Citizen Statistics
Retrieves system-wide citizen statistics.

**Endpoint:** `GET /citizen/statistics`
**Authentication:** Required (All roles)

#### Response
```json
{
  "success": true,
  "message": "Statistics retrieved",
  "data": {
    "total": 250000,
    "optedIn": 235000,
    "optedOut": 15000,
    "byState": {
      "clstate123": 150000,
      "clstate456": 100000
    },
    "byLanguage": {
      "ENGLISH": 200000,
      "YORUBA": 30000,
      "HAUSA": 15000,
      "IGBO": 5000
    }
  }
}
```

---

## Frontend Integration

### Public Registration Form

```javascript
async function registerCitizen(formData) {
  try {
    // Get GPS coordinates if available
    let location = null;
    if (navigator.geolocation) {
      location = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          }),
          () => resolve(null)
        );
      });
    }

    const response = await fetch('/api/v1/citizen/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phoneNumber: formData.phoneNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        stateId: formData.stateId,
        lgaId: formData.lgaId,
        wardId: formData.wardId,
        preferredLanguage: formData.language,
        location: location
      })
    });

    const data = await response.json();

    if (!data.success) {
      if (response.status === 409) {
        alert('This phone number is already registered!');
      } else if (data.details) {
        data.details.forEach(err => {
          showFieldError(err.field, err.message);
        });
      } else {
        alert(data.error);
      }
      return null;
    }

    alert('Registration successful! You will now receive emergency alerts.');
    return data.data;

  } catch (error) {
    alert('Network error. Please try again.');
    return null;
  }
}
```

### Admin: Search Citizens

```javascript
async function searchCitizens(phoneOrName) {
  const response = await fetch(
    `/api/v1/citizen?search=${encodeURIComponent(phoneOrName)}&limit=10`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();
  return data.success ? data.data : [];
}
```

### Admin: Manage Opt-In Status

```javascript
async function toggleOptIn(phoneNumber, optIn) {
  const endpoint = optIn ? 'opt-in' : 'opt-out';

  const response = await fetch(
    `/api/v1/citizen/${phoneNumber}/${endpoint}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  const data = await response.json();

  if (data.success) {
    alert(`Citizen ${optIn ? 'opted in' : 'opted out'} successfully`);
  } else {
    alert(data.error);
  }
}
```

### React: Citizen Registration Form

```javascript
import React, { useState, useEffect } from 'react';

export default function CitizenRegistration() {
  const [formData, setFormData] = useState({
    phoneNumber: '',
    firstName: '',
    lastName: '',
    stateId: '',
    lgaId: '',
    wardId: '',
    language: 'ENGLISH'
  });

  const [states, setStates] = useState([]);
  const [lgas, setLgas] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    loadStates();
  }, []);

  useEffect(() => {
    if (formData.stateId) {
      loadLGAs(formData.stateId);
    }
  }, [formData.stateId]);

  useEffect(() => {
    if (formData.lgaId) {
      loadWards(formData.lgaId);
    }
  }, [formData.lgaId]);

  async function loadStates() {
    // Load from your location API
    const response = await fetch('/api/v1/location/states');
    const data = await response.json();
    setStates(data.data);
  }

  async function loadLGAs(stateId) {
    const response = await fetch(`/api/v1/location/states/${stateId}/lgas`);
    const data = await response.json();
    setLgas(data.data);
  }

  async function loadWards(lgaId) {
    const response = await fetch(`/api/v1/location/lgas/${lgaId}/wards`);
    const data = await response.json();
    setWards(data.data);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await registerCitizen(formData);
    if (result) {
      alert('Registration successful!');
      // Reset form or redirect
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register for Emergency Alerts</h1>

      <input
        type="tel"
        placeholder="Phone Number (e.g., 08012345678)"
        value={formData.phoneNumber}
        onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
        required
      />

      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
        required
      />

      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
        required
      />

      <select
        value={formData.stateId}
        onChange={(e) => setFormData({...formData, stateId: e.target.value})}
        required
      >
        <option value="">Select State</option>
        {states.map(state => (
          <option key={state.id} value={state.id}>{state.name}</option>
        ))}
      </select>

      <select
        value={formData.lgaId}
        onChange={(e) => setFormData({...formData, lgaId: e.target.value})}
        required
        disabled={!formData.stateId}
      >
        <option value="">Select LGA</option>
        {lgas.map(lga => (
          <option key={lga.id} value={lga.id}>{lga.name}</option>
        ))}
      </select>

      <select
        value={formData.wardId}
        onChange={(e) => setFormData({...formData, wardId: e.target.value})}
        disabled={!formData.lgaId}
      >
        <option value="">Select Ward (Optional)</option>
        {wards.map(ward => (
          <option key={ward.id} value={ward.id}>{ward.name}</option>
        ))}
      </select>

      <select
        value={formData.language}
        onChange={(e) => setFormData({...formData, language: e.target.value})}
      >
        <option value="ENGLISH">English</option>
        <option value="HAUSA">Hausa</option>
        <option value="IGBO">Igbo</option>
        <option value="YORUBA">Yoruba</option>
      </select>

      <button type="submit">Register</button>

      <p style={{ fontSize: '12px', color: '#666' }}>
        By registering, you agree to receive emergency alerts via SMS.
        You can opt out anytime by replying STOP to any alert.
      </p>
    </form>
  );
}
```

---

## Best Practices

### Registration
1. **Validate phone numbers** client-side before submission
2. **Request GPS permission** for better targeting
3. **Clear privacy policy** about SMS notifications
4. **Welcome message** confirming registration

### Data Management
1. **Regular cleanup** of invalid phone numbers
2. **Monitor opt-out rates** for quality issues
3. **Respect opt-out** decisions immediately
4. **Update locations** when citizens move

### Privacy & Compliance
1. **Secure phone numbers** (PII data)
2. **Honor opt-out requests** within 24 hours
3. **SMS keywords**: Support STOP, START, HELP
4. **Data retention**: Define policy for inactive citizens

### Performance
1. **Cache location data** for targeting
2. **Index phone numbers** for fast lookup
3. **Batch operations** for mass updates
4. **Paginate large lists** to prevent timeouts

---

## SMS Opt-Out Keywords

Citizens can text these keywords to opt out:
- **STOP**: Opt out of all alerts
- **UNSUBSCRIBE**: Opt out of all alerts
- **END**: Opt out of all alerts

To opt back in:
- **START**: Opt in to alerts
- **YES**: Opt in to alerts

For help:
- **HELP**: Information about the service
- **INFO**: Service information