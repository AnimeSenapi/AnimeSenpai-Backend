# Admin Panel Security Documentation

## 🔐 Security Architecture

The AnimeSenpai admin panel implements multiple layers of security to protect sensitive operations.

---

## 🛡️ Security Layers

### 1. **Authentication Middleware**
- All admin endpoints require valid JWT token
- Session validation with `UserSession` table
- Automatic session expiry tracking
- Token verification on every request

### 2. **Role-Based Access Control (RBAC)**
- `requireAdmin()` middleware on all admin endpoints
- Role hierarchy: User (1) < Moderator (2) < Admin (3)
- Only users with `role === 'admin'` can access admin endpoints

### 3. **Rate Limiting**
- Admin-specific rate limiter: **50 actions per minute**
- Separate from general API rate limiting
- Prevents abuse and accidental bulk operations
- Automatic reset after 1 minute

### 4. **Self-Protection**
- Cannot change your own role
- Cannot ban yourself
- Cannot delete your own account
- Prevents accidental self-lockout

### 5. **Audit Logging**
- All admin actions logged via `logSecurityEvent()`
- Tracks: userId, action, target, IP address, user agent
- Stored in database for compliance
- Enables forensic analysis

### 6. **Suspicious Activity Detection**
- Monitors rapid user deletions (>10/min)
- Detects bulk role changes (>20/min)
- Logs warnings for investigation
- Future: Auto-suspend or require 2FA

---

## 📋 Protected Endpoints

### **User Management**
| Endpoint | Rate Limited | Logged | Self-Protected |
|----------|--------------|--------|----------------|
| `getAllUsers` | ❌ (read-only) | ✅ | N/A |
| `getUserDetails` | ❌ (read-only) | ✅ | N/A |
| `searchUsers` | ❌ (read-only) | ✅ | N/A |
| `updateUserRole` | ✅ | ✅ | ✅ |
| `deleteUser` | ✅ | ✅ | ✅ |
| `banUser` | ✅ | ✅ | ✅ |

### **Statistics**
| Endpoint | Rate Limited | Logged |
|----------|--------------|--------|
| `getStats` | ❌ (read-only) | ✅ |

### **Feature Flags**
| Endpoint | Rate Limited | Logged |
|----------|--------------|--------|
| `getFeatureFlags` | ❌ (read-only) | ✅ |
| `setFeatureFlag` | ✅ | ✅ |
| `toggleFeatureFlag` | ✅ | ✅ |
| `deleteFeatureFlag` | ✅ | ✅ |

---

## 🔒 Security Features

### **Rate Limiting Configuration**
```typescript
const RATE_LIMIT_WINDOW = 60 * 1000  // 1 minute
const MAX_ADMIN_ACTIONS = 50         // Max 50 actions/min
```

**Why 50 actions/min?**
- Allows batch operations while preventing abuse
- Reasonable limit for legitimate admin work
- Can be adjusted per deployment needs

### **Secure Operation Wrapper**
```typescript
secureAdminOperation(
  userId,        // Who is performing the action
  action,        // What action (update_role, delete_user, etc.)
  operation,     // The actual database operation
  details,       // Additional metadata
  ipAddress      // For IP tracking
)
```

**Benefits:**
- Consistent rate limiting
- Automatic audit logging
- Suspicious pattern detection
- Error handling and logging

---

## 📊 Audit Trail

Every admin action creates an audit log entry with:

| Field | Description |
|-------|-------------|
| `userId` | Admin who performed the action |
| `event` | Action type (user_role_changed, user_deleted, etc.) |
| `metadata` | Details (target user, new role, reason, etc.) |
| `ipAddress` | IP address of the request |
| `userAgent` | Browser/client information |
| `timestamp` | When the action occurred |

**Access Audit Logs:**
```typescript
// In database: SecurityEvent table
await db.securityEvent.findMany({
  where: { event: 'user_deleted' },
  orderBy: { createdAt: 'desc' }
})
```

---

## 🚨 Threat Prevention

### **1. Brute Force Protection**
- Rate limiting prevents rapid-fire requests
- 50 actions/min limit
- Automatic cooldown period

### **2. Privilege Escalation Prevention**
- Cannot elevate own role
- Role changes require separate admin
- All changes logged

### **3. Account Lockout Prevention**
- Cannot ban yourself
- Cannot delete yourself
- Cannot demote yourself

### **4. Data Integrity**
- Transactions for critical operations
- Cascade deletes properly configured
- Foreign key constraints enforced

---

## 🔍 Monitoring & Detection

### **Suspicious Patterns Monitored:**
1. **Rapid Deletions:** >10 user deletions per minute
2. **Bulk Role Changes:** >20 role updates per minute
3. **Failed Auth Attempts:** Multiple failed admin logins
4. **Off-Hours Access:** Admin actions during unusual times (future)

### **Response Actions:**
- Log warning with details
- Alert other admins (future)
- Require 2FA confirmation (future)
- Temporary rate limit reduction (future)

---

## ⚙️ Configuration

### **Environment Variables**
```env
# Optional: IP whitelist for admin access (comma-separated)
ADMIN_IP_WHITELIST=

# Optional: Enable stricter rate limits
ADMIN_STRICT_MODE=false

# Optional: Require 2FA for destructive actions
ADMIN_REQUIRE_2FA=false
```

### **Rate Limit Adjustment**
To change the rate limit, edit `src/lib/admin-security.ts`:
```typescript
const MAX_ADMIN_ACTIONS = 50  // Adjust this value
```

---

## 🧪 Testing

### **Test Admin Security:**
```bash
# 1. Start backend
cd AnimeSenpai-Backend
bun run dev

# 2. Test authentication (should fail without token)
curl http://localhost:3001/api/trpc/admin.getStats

# 3. Test with invalid role (should fail)
# Login as regular user, try to access admin endpoint

# 4. Test rate limiting
# Make >50 requests in 1 minute (should be blocked)
```

### **Security Checklist:**
- [ ] Admin endpoints require authentication ✅
- [ ] Admin endpoints require admin role ✅
- [ ] Cannot modify own permissions ✅
- [ ] Rate limiting active ✅
- [ ] All actions logged ✅
- [ ] Suspicious activity detected ✅
- [ ] CORS properly configured ✅
- [ ] Security headers set ✅

---

## 📝 Best Practices

### **For Admins:**
1. ✅ Use strong passwords
2. ✅ Enable 2FA when available
3. ✅ Log out when finished
4. ✅ Review audit logs regularly
5. ✅ Don't share admin credentials
6. ✅ Use separate accounts for testing

### **For Developers:**
1. ✅ Never disable security checks
2. ✅ Always use `requireAdmin()` middleware
3. ✅ Log sensitive operations
4. ✅ Test with non-admin users
5. ✅ Review audit logs for anomalies
6. ✅ Keep dependencies updated

---

## 🔄 Future Enhancements

### **Planned Security Features:**
- [ ] Two-Factor Authentication (2FA) for admin actions
- [ ] IP whitelisting for admin access
- [ ] Session recording for compliance
- [ ] Real-time admin activity dashboard
- [ ] Automated anomaly detection
- [ ] Email alerts for critical actions
- [ ] Backup admin approval for destructive actions
- [ ] Time-based access controls
- [ ] Geo-location restrictions
- [ ] Hardware token support

---

## 📞 Security Contacts

**Security Issues:** security@animesenpai.app  
**Admin Support:** admin@animesenpai.app  
**Emergency:** Contact via GitHub Issues

---

## ⚖️ Compliance

### **GDPR Compliance:**
- ✅ User data deletion logs maintained
- ✅ Admin actions tracked for accountability
- ✅ Data access logged
- ✅ Right to erasure properly implemented

### **Audit Requirements:**
- All admin actions logged
- Logs retained for 90 days minimum
- Exportable for compliance reviews
- User privacy respected in logs

---

**Last Updated:** October 2025  
**Version:** 1.0.0

