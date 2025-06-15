# Session Validation and Re-Authentication System

## Overview

The Trade Republic Connector now includes a comprehensive session validation and re-authentication system that ensures users are properly prompted for login and 2FA when their session expires or the server is not connected.

## Key Features

### 1. Session Validation (`validateSessionAndConnectivity`)

The system performs multi-layered validation:

```typescript
{
  isValid: boolean;           // Session is valid and authenticated
  isServerReachable: boolean; // Trade Republic servers are accessible
  requiresReauth: boolean;    // User needs to re-authenticate
  error?: string;            // Detailed error message
}
```

**Validation Steps:**
1. ✅ Check if session exists
2. ✅ Validate session expiration and structure
3. ✅ Test server connectivity (`testConnection()`)
4. ✅ Validate session on server (`validateSession()`)
5. ✅ Handle auth errors (401/403) vs network errors

### 2. Automatic Re-Authentication (`ensureValidSession`)

Before any API operation, the system automatically:
- Validates the current session
- Prompts for re-authentication if needed
- Provides clear error messages based on failure type

**Error Types:**
- `SESSION_EXPIRED`: Session has expired, login required
- `SERVER_UNREACHABLE`: Network/connectivity issues
- `DEVICE_NOT_PAIRED`: Device pairing lost, re-pairing required

### 3. Force Re-Authentication (`forceReAuthentication`)

Comprehensive re-authentication flow:
- Clears invalid session data
- Checks device pairing status
- Handles 2FA challenges automatically
- Updates HTTP client authentication headers

### 4. Token Auto-Refresh (`autoRefreshIfNeeded`)

Smart token management:
- Monitors token expiration (refreshes 30 seconds before expiry)
- Attempts automatic refresh
- Falls back to re-authentication if refresh fails

## Implementation Details

### Authentication Manager Enhancements

**New Methods:**
```typescript
// Comprehensive session validation
validateSessionAndConnectivity(): Promise<ValidationResult>

// Ensure valid session or throw error
ensureValidSession(): Promise<AuthSession>

// Force complete re-authentication
forceReAuthentication(credentials): Promise<AuthResult>

// Check if token needs refresh
shouldRefreshToken(): boolean

// Auto-refresh with fallback
autoRefreshIfNeeded(): Promise<boolean>
```

### TradeRepublicAPI Enhancements

**New Methods:**
```typescript
// Test basic connectivity
testConnection(): Promise<boolean>

// Validate session token with authenticated request
validateSession(token: string): Promise<ValidationResult>
```

### Client Integration

The main `TradeRepublicClient` now includes:

```typescript
// Validate session and connectivity
validateSessionAndConnectivity(): Promise<ValidationResult>

// Ensure valid session (used by ensureValidToken)
ensureValidSession(): Promise<AuthSession>

// Force re-authentication with 2FA support
forceReAuthentication(credentials): Promise<AuthResult>
```

## Usage Examples

### 1. Session Status Check

```typescript
const client = new TradeRepublicClient();
await client.initialize();

const status = await client.validateSessionAndConnectivity();
console.log('Server reachable:', status.isServerReachable);
console.log('Session valid:', status.isValid);
console.log('Requires re-auth:', status.requiresReauth);
```

### 2. Robust API Operations

```typescript
async function performAPIOperation() {
  try {
    // This automatically validates session and prompts for re-auth if needed
    await client.ensureValidSession();
    
    // Proceed with API operation
    const portfolio = await client.portfolio.getSummary();
    return portfolio;
  } catch (error) {
    if (error.code === 'SESSION_EXPIRED') {
      console.log('Please log in again');
      // Handle re-authentication
    }
  }
}
```

### 3. Force Re-Authentication

```typescript
async function reAuthenticate() {
  const credentials = {
    username: '+49...',
    password: '1234'
  };
  
  const result = await client.forceReAuthentication(credentials);
  
  if (result.requiresMFA) {
    // Handle 2FA
    const code = await get2FACode();
    await client.submitMFA(result.challenge, { 
      challengeId: result.challenge.challengeId, 
      code 
    });
  }
}
```

## Error Handling

The system provides specific error codes for different scenarios:

- **`SESSION_EXPIRED`**: Session has expired, user must log in again
- **`SERVER_UNREACHABLE`**: Network connectivity issues
- **`DEVICE_NOT_PAIRED`**: Device pairing lost, must re-pair
- **`TOKEN_REFRESH_FAILED`**: Token refresh failed, re-authentication required
- **`VALIDATION_FAILED`**: General validation failure

## Scripts and Tools

### 1. Enhanced CLI (`scripts/enhanced-cli.ts`)

Interactive CLI with session management commands:
- `status` - Check session and connectivity status
- `reauth` - Force re-authentication with 2FA
- `test` - Test API operations with session validation
- `help` - Show available commands

### 2. Comprehensive Asset Collection (`examples/comprehensive-auth-collection.ts`)

Robust asset collection script with:
- Session validation before each API call
- Automatic re-authentication on session expiry
- 2FA handling
- Retry logic for authentication failures
- Rate limiting and error handling

## Testing the System

### Test Session Validation
```bash
npx tsx scripts/enhanced-cli.ts
# Use "status" command to check session state
```

### Test Asset Collection with Auth Handling
```bash
npx tsx examples/comprehensive-auth-collection.ts
# Will prompt for login and 2FA when needed
```

## Security Features

1. **Session Expiration**: Automatic detection and handling
2. **Server Validation**: Confirms session is valid on server
3. **Device Pairing**: Maintains device authentication state
4. **Token Refresh**: Automatic token renewal
5. **Secure Storage**: Session data stored with proper permissions
6. **2FA Support**: Integrated two-factor authentication
7. **Error Isolation**: Network errors vs authentication errors

## Session Persistence

Sessions are persisted securely in:
- `~/.tr-connector/session.json` (mode 0o600)
- `~/.tr-connector/device-keys.json` (mode 0o600)

The system automatically loads existing sessions on initialization and validates their integrity.

## Benefits

1. **User Experience**: Clear prompts when re-authentication is needed
2. **Reliability**: Robust handling of network and auth failures
3. **Security**: Proper session validation and secure token management
4. **Automation**: Automatic token refresh and session management
5. **Debugging**: Detailed status information and error messages
6. **Flexibility**: Multiple authentication flows and error recovery

This system ensures that users are always properly authenticated and provides clear guidance when session issues occur, whether due to expiration, server connectivity, or other authentication problems.
