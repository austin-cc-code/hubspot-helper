# Security Requirements & Design

**Last Updated:** 2025-12-21

## Table of Contents

1. [Credential Management](#credential-management)
2. [PII Protection](#pii-protection)
3. [Data Access Controls](#data-access-controls)
4. [Audit Logging](#audit-logging)
5. [Rollback Security](#rollback-security)
6. [Network Security](#network-security)
7. [Threat Model](#threat-model)

---

## Credential Management

### Storage Options

| Method | Security | Convenience | Recommended For |
|--------|----------|-------------|-----------------|
| Environment variables | Good | High | Development, CI/CD |
| Encrypted config file | Better | Medium | Shared teams |
| OS keychain | Best | Low | Personal use |

### Implementation: Environment Variables (Phase 1)

**Why:**
- Simple to implement
- Standard practice for CLI tools
- Works in all environments
- No additional dependencies

**Location:**
```bash
# Project root (gitignored)
.env

# Or credentials directory (gitignored)
.credentials/.env
```

**Format:**
```bash
# HubSpot Configuration
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
HUBSPOT_PORTAL_ID=12345678

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Loading:**
```typescript
import dotenv from 'dotenv';

// Load from .env
dotenv.config();

// Or load from custom location
dotenv.config({ path: '.credentials/.env' });

// Access
const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
```

### Security Rules

1. **NEVER commit credentials to git**
   - `.env` is gitignored
   - `.credentials/` is gitignored
   - `hubspot-audit.config.yaml` is gitignored if it contains tokens

2. **NEVER log credentials**
   ```typescript
   // BAD
   logger.info({ accessToken }, 'Connecting to HubSpot');

   // GOOD
   logger.info('Connecting to HubSpot');
   ```

3. **Validate before use**
   ```typescript
   if (!process.env.HUBSPOT_ACCESS_TOKEN) {
     throw new Error('HUBSPOT_ACCESS_TOKEN not found. Run: hubspot-audit config init');
   }
   ```

4. **Use least privilege**
   - Request only necessary scopes
   - Create separate Private Apps for different use cases if needed

### Future Enhancement: OS Keychain (Phase 3)

**macOS:**
```bash
security add-generic-password \
  -s hubspot-audit \
  -a HUBSPOT_ACCESS_TOKEN \
  -w 'pat-na1-xxxxx'
```

**Linux (Secret Service API):**
```bash
secret-tool store \
  --label='HubSpot Audit Token' \
  application hubspot-audit \
  token_type access_token
```

**Windows (Credential Manager):**
```powershell
cmdkey /generic:hubspot-audit /user:token /pass:pat-na1-xxxxx
```

**Libraries:** `keytar`, `node-keytar`

---

## PII Protection

### What is PII?

**Personally Identifiable Information** - Data that can identify an individual:
- Email addresses
- Phone numbers
- Names (first, last, full)
- Physical addresses
- IP addresses
- Social security numbers
- Financial data

### GDPR & Privacy Compliance

**Requirements:**
1. **Minimize data exposure** - Don't log PII unnecessarily
2. **Anonymize logs** - Mask PII in all log output
3. **Secure storage** - Encrypt at rest (rollback data)
4. **Right to deletion** - Support permanent deletion
5. **Data portability** - Support exports

### PII Masking Implementation

**Logger (already implemented):**
```typescript
// src/utils/logger.ts
const PII_FIELDS = ['email', 'phone', 'name', 'firstName', 'lastName', 'address'];

function redactPII<T>(obj: T): T {
  // Recursively mask PII fields
  // email@example.com → [REDACTED]
}
```

**Usage:**
```typescript
import { createLogger, safeLog } from '../utils/logger.js';
const logger = createLogger('audit');

// Automatic redaction
logger.info({ contact }, 'Processing contact');
// Logs: { contact: { email: '[REDACTED]', company: 'Acme Inc' } }

// Manual redaction
const sanitizedData = safeLog(contacts);
```

### Console Output

**Display rules:**
1. **Terminal output:** Show full data (user has access anyway)
2. **Log files:** Always mask PII
3. **Error messages:** Mask PII
4. **JSON export:** Include PII (user-requested export)

**Example:**
```typescript
// Terminal (OK to show)
console.log(`Processing contact: ${contact.email}`);

// Log file (mask PII)
logger.info({ contactId: contact.id }, 'Processing contact');

// Error (mask PII)
logger.error({ email: '[REDACTED]' }, 'Failed to update contact');
```

### Plan Files

**Action plans contain PII** (email addresses for identification):

**Security measures:**
1. Store in `./audit-reports/` (gitignored)
2. Set restrictive file permissions (0600)
3. Auto-cleanup old plans (30-day retention)
4. Warn user about sensitive data in exports

```typescript
// When writing plan files
import { chmod } from 'fs/promises';

await writeFile(planPath, JSON.stringify(plan));
await chmod(planPath, 0o600); // Owner read/write only
```

### Rollback Data

**Rollback records contain original values** (may include PII):

**Security measures:**
1. Encrypt rollback data at rest
2. Store in `./audit-reports/executions/` (gitignored)
3. Set restrictive file permissions (0600)
4. Auto-cleanup after 30 days
5. Require authentication for rollback operations

```typescript
// Encrypt rollback data
import { encrypt, decrypt } from '../utils/crypto.js';

const rollbackData = {
  contactId: '123',
  property: 'email',
  originalValue: 'test@example.com'
};

const encrypted = encrypt(JSON.stringify(rollbackData), encryptionKey);
await writeFile(executionPath, encrypted);
```

---

## Data Access Controls

### Scope Validation

**Verify scopes before operations:**

```typescript
class HubSpotService {
  async validateScopes(): Promise<void> {
    try {
      // Test each required scope
      await this.client.crm.contacts.getAll(1);
      // ... test other operations
    } catch (error) {
      if (error.code === 403) {
        throw new Error('Missing required scope: crm.objects.contacts.read');
      }
    }
  }
}
```

**Run on startup:**
```bash
hubspot-audit config validate
# Checks: credentials exist, scopes valid, API accessible
```

### Action Confirmation

**Require explicit confirmation for:**
1. All write operations (updates, deletes)
2. Non-reversible operations (merges)
3. Batch operations affecting >10 records

**Confirmation levels:**

| Operation | Confirmation Required | Example |
|-----------|----------------------|---------|
| Update 1-10 records | Yes | "Update 5 contacts? [y/N]" |
| Update 11+ records | Yes + count display | "Update 247 contacts? Type 'yes' to confirm:" |
| Delete any records | Yes + type name | "Delete 12 contacts? Type 'DELETE' to confirm:" |
| Merge contacts | Yes + type phrase | "Merge cannot be undone. Type 'MERGE AND DELETE' to confirm:" |

**Implementation:**
```typescript
import inquirer from 'inquirer';

async function confirmExecution(plan: ActionPlan): Promise<boolean> {
  const { actions, non_reversible } = plan.summary;

  if (non_reversible > 0) {
    // Extra warning for non-reversible
    console.log(chalk.red.bold(`⚠️  ${non_reversible} actions CANNOT be undone!`));
    const { confirmation } = await inquirer.prompt([{
      type: 'input',
      name: 'confirmation',
      message: 'Type "EXECUTE NON-REVERSIBLE" to confirm:',
    }]);
    return confirmation === 'EXECUTE NON-REVERSIBLE';
  }

  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: `Execute ${actions} actions?`,
    default: false,
  }]);

  return proceed;
}
```

### Dry Run Mode

**Always available:**
```bash
hubspot-audit execute plan.json --dry-run
```

**Shows:**
- Exactly what would change
- Before/after values
- API calls that would be made
- Estimated execution time

**No confirmation required** for dry runs.

---

## Audit Logging

### What to Log

| Event | Level | Data Logged | PII Masked |
|-------|-------|-------------|------------|
| App start | info | Version, config path | - |
| Config loaded | info | Portal ID | Yes |
| API connection | info | Rate limits | - |
| Audit start | info | Audit type, filters | - |
| Records fetched | info | Count, time taken | - |
| Issues found | info | Count by severity | - |
| Plan generated | info | Plan path, action count | - |
| Execution start | warn | Plan ID, action count | - |
| Action executed | info | Action ID, status | Yes |
| Execution complete | warn | Success/fail counts | - |
| Error | error | Error type, context | Yes |
| Rollback start | warn | Execution ID | - |
| Rollback complete | warn | Restored count | - |

### Log Format

**Structured JSON (pino):**
```json
{
  "level": 30,
  "time": 1703174400000,
  "module": "executor",
  "msg": "Executing action plan",
  "planId": "data-quality-2025-01-15",
  "actionCount": 247,
  "nonReversible": 3
}
```

**Pretty (development):**
```
[10:30:00] INFO  (executor): Executing action plan
  planId: data-quality-2025-01-15
  actionCount: 247
  nonReversible: 3
```

### Log Rotation

**Prevent logs from growing indefinitely:**

```typescript
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino/file',
    options: {
      destination: './logs/hubspot-audit.log',
      mkdir: true,
    }
  }
});
```

**External rotation (recommended):**
```bash
# logrotate config
/home/user/project/logs/*.log {
  daily
  rotate 7
  compress
  missingok
  notifempty
}
```

### Retention

- **Logs:** 7 days (development), 30 days (production)
- **Plan files:** 30 days
- **Execution records:** 30 days
- **Rollback data:** 30 days

**Cleanup:**
```bash
# Add to cron or run manually
hubspot-audit cleanup --older-than=30d
```

---

## Rollback Security

### Rollback Data Storage

**Location:** `./audit-reports/executions/{execution-id}.json`

**Contents:**
```typescript
{
  executionId: 'exec-2025-01-15T10-30-00',
  planId: 'data-quality-2025-01-15',
  executedAt: '2025-01-15T10:30:00Z',
  actions: [
    {
      actionId: 'action-001',
      status: 'success',
      rollbackData: {
        objectType: 'contact',
        objectId: '12345',
        property: 'email',
        originalValue: 'old@example.com' // PII!
      },
      isReversible: true
    },
    {
      actionId: 'action-002',
      status: 'success',
      rollbackData: null, // Merge operation - not reversible
      isReversible: false
    }
  ]
}
```

### Encryption (Phase 2)

**Why encrypt:**
- Rollback data contains PII
- Stored on disk
- May be backed up to cloud

**Implementation:**
```typescript
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Generate encryption key on first run, store in config
const ENCRYPTION_KEY = randomBytes(32);

function encrypt(data: string): Buffer {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decrypt(encrypted: Buffer): string {
  const iv = encrypted.subarray(0, 16);
  const authTag = encrypted.subarray(16, 32);
  const data = encrypted.subarray(32);
  const decipher = createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(data) + decipher.final('utf8');
}
```

### Access Control

**Rollback operations require:**
1. Valid execution ID
2. Execution not older than 30 days
3. User confirmation
4. Valid HubSpot credentials

**Implementation:**
```typescript
async function rollback(executionId: string): Promise<void> {
  // 1. Validate execution exists
  const execution = await loadExecution(executionId);
  if (!execution) {
    throw new Error('Execution not found');
  }

  // 2. Check age
  const age = Date.now() - execution.executedAt.getTime();
  if (age > 30 * 24 * 60 * 60 * 1000) {
    throw new Error('Execution too old (>30 days)');
  }

  // 3. Count reversible actions
  const reversible = execution.actions.filter(a => a.isReversible);
  const nonReversible = execution.actions.filter(a => !a.isReversible);

  // 4. Warn about non-reversible
  if (nonReversible.length > 0) {
    console.log(chalk.yellow(
      `⚠️  ${nonReversible.length} actions cannot be rolled back (merges)`
    ));
  }

  // 5. Confirm
  const { proceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceed',
    message: `Rollback ${reversible.length} actions?`,
  }]);

  if (!proceed) return;

  // 6. Execute rollback
  await executeRollback(execution);
}
```

---

## Network Security

### HTTPS Only

**The `@hubspot/api-client` SDK enforces HTTPS.**

No additional configuration needed.

### Request Signing

**Not currently implemented by HubSpot API.**

Authentication via `Authorization: Bearer <token>` header.

### SSL Certificate Validation

**Enabled by default in Node.js.**

**Never disable** unless in development with self-signed certs (not recommended).

### Proxy Support

**For corporate environments:**

```bash
# Environment variables
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=http://proxy.company.com:8080

# Node.js respects these automatically
```

**SDK configuration:**
```typescript
import { Client } from '@hubspot/api-client';
import HttpsProxyAgent from 'https-proxy-agent';

const client = new Client({
  accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
  // Proxy agent if needed
  baseOptions: {
    httpsAgent: new HttpsProxyAgent(process.env.HTTPS_PROXY)
  }
});
```

---

## Threat Model

### Threats & Mitigations

| Threat | Impact | Likelihood | Mitigation |
|--------|--------|-----------|------------|
| **Credential theft** | Critical | Medium | Store in .env (gitignored), never log |
| **Accidental data deletion** | High | Medium | Require confirmation, support rollback |
| **PII exposure in logs** | High | High | Automatic PII masking |
| **Unauthorized access** | High | Low | Require credentials for all operations |
| **Non-reversible merge** | High | Medium | Extra confirmation, clear warnings |
| **API key in git** | Critical | Low | .gitignore, pre-commit hooks |
| **Rate limit exhaustion** | Low | High | Rate limiter, queue requests |
| **Man-in-the-middle** | High | Low | HTTPS only (enforced by SDK) |
| **Local file access** | Medium | Low | File permissions (0600) |
| **Rollback data theft** | Medium | Low | Encrypt at rest (Phase 2) |

### Security Checklist

**Before initial release:**
- [ ] All credentials stored securely (.env, gitignored)
- [ ] PII masking implemented and tested
- [ ] Confirmation required for all write operations
- [ ] Non-reversible operations have extra warnings
- [ ] File permissions set correctly (0600)
- [ ] Rate limiting implemented
- [ ] Error messages don't leak credentials
- [ ] No credentials in logs
- [ ] HTTPS enforced
- [ ] Rollback data secured

**Phase 2 enhancements:**
- [ ] Rollback data encryption
- [ ] OS keychain integration
- [ ] Audit log encryption
- [ ] Two-factor confirmation for destructive ops
- [ ] Automated credential rotation

---

## Compliance Considerations

### GDPR

**Requirements:**
1. **Lawful basis** - User has legitimate interest (managing their own CRM)
2. **Data minimization** - Only access necessary data
3. **Purpose limitation** - Use data only for audit/cleanup
4. **Accuracy** - Improve data quality (our purpose!)
5. **Storage limitation** - 30-day retention for logs/rollback
6. **Security** - Encryption, access controls, PII masking
7. **Accountability** - Audit logs, documentation

**Our compliance:**
- ✅ User operates on their own data
- ✅ Minimal data access (only needed properties)
- ✅ Single purpose (data audit/cleanup)
- ✅ PII masking in logs
- ✅ 30-day retention
- ✅ Encryption (Phase 2)
- ✅ Audit logging

### CCPA (California Consumer Privacy Act)

**Requirements:**
1. **Disclosure** - User knows what data is accessed
2. **Right to delete** - Support permanent deletion
3. **Right to know** - Provide access to stored data
4. **Security** - Reasonable security measures

**Our compliance:**
- ✅ CLI shows what data is accessed
- ✅ Support for permanent deletion
- ✅ Plan files show all data used
- ✅ Security measures documented

### Industry-Specific

**HIPAA (Healthcare):**
- Not applicable unless processing health data
- If needed: Encrypt all data, audit all access, BAA required

**PCI-DSS (Payment Card):**
- Not applicable unless processing payment data
- Never process credit card data

---

## Security Testing

### Manual Tests

1. **Credential leak test**
   ```bash
   # Run audit and check logs for tokens
   hubspot-audit audit contacts --check=data-quality
   grep -r "pat-na1" logs/
   # Should return nothing
   ```

2. **PII masking test**
   ```bash
   # Check logs for email addresses
   grep -r "@example.com" logs/
   # Should return "[REDACTED]" only
   ```

3. **File permissions test**
   ```bash
   ls -la audit-reports/*.json
   # Should show -rw------- (0600)
   ```

4. **Git leak test**
   ```bash
   git log -p | grep "HUBSPOT_ACCESS_TOKEN"
   # Should return nothing
   ```

### Automated Tests

```typescript
// tests/unit/security.test.ts

describe('Security', () => {
  it('should mask PII in logs', () => {
    const data = { email: 'test@example.com', company: 'Acme' };
    const masked = safeLog(data);
    expect(masked.email).toBe('[REDACTED]');
    expect(masked.company).toBe('Acme');
  });

  it('should never log credentials', () => {
    const logs = captureLogOutput(() => {
      logger.info({ accessToken: 'secret' }, 'Test');
    });
    expect(logs).not.toContain('secret');
  });

  it('should set correct file permissions', async () => {
    const path = await writePlanFile(plan);
    const stats = await stat(path);
    expect(stats.mode & 0o777).toBe(0o600);
  });
});
```

---

## Incident Response

### If Credentials Are Leaked

1. **Immediately revoke** the Private App token in HubSpot
2. **Generate new token** with different scopes if possible
3. **Audit access logs** in HubSpot for unauthorized activity
4. **Notify user** if this is a shared tool
5. **Review git history** and remove leaked credentials
6. **Update documentation** with lessons learned

### If PII Is Leaked

1. **Identify scope** - What data? How many records?
2. **Contain** - Delete exposed files, rotate logs
3. **Assess risk** - Was it sensitive? Who had access?
4. **Notify** - Inform affected parties if required by law
5. **Document** - Record incident for compliance
6. **Prevent** - Update masking rules, add tests

### If Accidental Deletion Occurs

1. **Stop execution** - Ctrl+C to prevent more damage
2. **Check rollback availability** - Can this be undone?
3. **Execute rollback** - If within 30 days
4. **Contact HubSpot support** - For merge operations (if < 90 days)
5. **Document** - What happened, how to prevent
6. **Improve** - Add extra confirmations

---

## Security Roadmap

### Phase 1 (MVP) - Current
- [x] Environment variable storage
- [x] PII masking in logs
- [x] Confirmation prompts
- [x] File permissions (0600)
- [ ] Non-reversible warnings
- [ ] Rollback data storage

### Phase 2
- [ ] Rollback data encryption
- [ ] OS keychain integration
- [ ] Automated cleanup of old data
- [ ] Enhanced audit logging
- [ ] Security testing suite

### Phase 3
- [ ] Two-factor confirmation for destructive ops
- [ ] Automated credential rotation
- [ ] Role-based access control (if multi-user)
- [ ] Compliance reporting
- [ ] Third-party security audit

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GDPR Compliance Guide](https://gdpr.eu/)
- [HubSpot Security](https://www.hubspot.com/data-privacy/gdpr)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
