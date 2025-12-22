# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HubSpot CLI Audit Tool - An AI-powered CLI that audits HubSpot data, identifies issues, generates actionable fix plans, and executes changes safely with rollback capability.

**Tech Stack:** TypeScript/Node.js, @hubspot/api-client, @anthropic-ai/sdk, Commander.js, Inquirer, Ora, Chalk, Jest, YAML config

## Core Safety Model

**The tool NEVER modifies HubSpot data automatically.** All changes follow this flow:

```
AUDIT (read-only) → PLAN (generate file) → REVIEW (user examines) → APPROVE (explicit consent) → EXECUTE (changes made)
```

- `audit` commands only read data and generate plan files
- `plan show` commands let users review before execution
- `execute` commands are the ONLY ones that modify data, and require confirmation
- Merge operations (merge_contacts) are NOT reversible - HubSpot permanently deletes the secondary record

## Architecture

```
src/
├── cli/           # Commands (audit, config, execute, rollback, plan)
├── config/        # YAML config management with Zod validation
├── services/      # HubSpotService (API wrapper), ClaudeService (AI analysis)
├── audits/        # Audit modules (DataQuality, Duplicates, Properties, etc.)
├── actions/       # ActionPlan, PlanBuilder, Executor, RollbackManager
├── reports/       # Terminal, JSON, HTML formatters
└── types/         # TypeScript interfaces
```

**Key Design Decisions:**
- Module-based audits with common interface, not agent-based
- HubSpot and Claude are shared services, not duplicated per module
- Each audit module can run standalone

## HubSpot Integration

**Using `@hubspot/api-client` only.** MCP was evaluated and rejected (see Epic 1 in plan.md and `docs/hubspot-api-research.md`).

**Why not MCP:** MCP is for LLM tool exposure. We're a CLI that uses AI for analysis, not an AI agent. No code savings, unnecessary complexity.

**NOT using:**
- HubSpot MCP Server - wrong tool for our use case
- HubSpot CLI (`@hubspot/cli`) - for building custom HubSpot apps, not CRM data

### API Key Patterns (Epic 1 Research)

**Authentication:**
- Private App tokens: `pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Required scopes: `crm.objects.{contacts,companies,deals}.{read,write}`, `crm.schemas.*.read`, `crm.lists.{read,write}`
- Initialize client: `new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN })`

**Rate Limiting (Critical!):**
- **100 requests per rolling 10-second window**
- Batch operations count as 1 request (up to 100 records)
- Use token bucket algorithm: start with 100, refill to 100 every 10s
- 429 responses include `Retry-After` header
- Rate limit headers: `x-hubspot-ratelimit-{daily,daily-remaining,max,remaining}`

**Search API (Prefer over getAll):**
```typescript
// GOOD: Efficient filtering
await client.crm.contacts.searchApi.doSearch({
  filterGroups: [{
    filters: [{ propertyName: 'email', operator: 'HAS_PROPERTY' }]
  }],
  properties: ['email', 'firstname'],
  limit: 100
});

// BAD: Fetches everything then filters
const all = await client.crm.contacts.getAll();
const filtered = all.filter(c => c.properties.email);
```

**Batch Operations (Always use for >1 record):**
```typescript
// Read up to 100 contacts in 1 API call
await client.crm.contacts.batchApi.read({
  properties: ['email'],
  inputs: ids.map(id => ({ id }))
});

// Update up to 100 in 1 call
await client.crm.contacts.batchApi.update({
  inputs: updates.map(u => ({ id: u.id, properties: u.properties }))
});
```

**Operators:** `HAS_PROPERTY`, `NOT_HAS_PROPERTY`, `EQ`, `NEQ`, `LT`, `LTE`, `GT`, `GTE`, `BETWEEN`, `IN`, `NOT_IN`, `CONTAINS_TOKEN`

**Pagination:** Use `after` cursor (not offset). Response includes `paging.next.after`.

**Merges (Irreversible!):**
- `client.crm.contacts.merge({ primaryObjectId, objectIdToMerge })`
- Secondary record permanently deleted
- Cannot be undone via API
- Require extra confirmation in UI

**Error Codes:**
- `401`: Invalid/expired token
- `403`: Missing scope
- `429`: Rate limited (check `Retry-After` header)
- `404`: Object not found

See `docs/hubspot-api-research.md` for comprehensive API documentation.

## Development Commands

```bash
npm run build          # Compile TypeScript to dist/
npm run start          # Run compiled CLI
npm run dev            # Run with tsx (no compile needed)
npm run lint           # ESLint check
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier format
npm run test           # Run Jest tests (ESM mode)
npm run test:watch     # Jest in watch mode
npm run test:coverage  # Jest with coverage report
```

## CLI Commands

```bash
# After build or via npx
npx hubspot-audit --help
npx hubspot-audit config init                    # Setup wizard
npx hubspot-audit audit contacts --check=data-quality  # Generate plan (read-only)
npx hubspot-audit plan show <plan-file>          # Review plan
npx hubspot-audit execute <plan-file>            # Execute with confirmation
npx hubspot-audit rollback <execution-id>        # Undo changes
```

## Project Configuration

- **Module System:** ESM (`"type": "module"` in package.json)
- **Node.js:** >=20.0.0 (uses native fetch)
- **TypeScript:** ES2022 target, NodeNext module resolution, strict mode
- **Testing:** Jest with ts-jest ESM preset, requires `--experimental-vm-modules`

## Environment Variables

```bash
HUBSPOT_ACCESS_TOKEN    # HubSpot Private App token (required)
HUBSPOT_PORTAL_ID       # HubSpot portal ID
ANTHROPIC_API_KEY       # Claude API key (required for AI features)
LOG_LEVEL               # debug, info, warn, error (default: info)
LOG_PRETTY              # true for pretty console output (default: false)
```

## Logging

Uses `pino` with PII redaction. Create child loggers per module:

```typescript
import { createLogger } from '../utils/logger.js';
const logger = createLogger('myModule');
logger.info({ data }, 'Message');
```

PII fields (email, phone, name, etc.) are automatically redacted in logs.

## Security Patterns (Epic 1 Research)

**PII Protection:**
- All logs automatically redact: email, phone, name, firstName, lastName, address
- Use `safeLog(data)` for manual redaction
- Plan files contain PII (stored in gitignored `./audit-reports/`)
- Rollback data contains PII (encrypt at rest in Phase 2)

**Confirmation Requirements:**
```typescript
// Standard operations: Simple yes/no
const { proceed } = await inquirer.prompt([{ type: 'confirm', name: 'proceed', message: 'Update 5 contacts?' }]);

// Non-reversible operations: Type phrase
const { confirmation } = await inquirer.prompt([{
  type: 'input',
  name: 'confirmation',
  message: 'Type "MERGE AND DELETE" to confirm:'
}]);
```

**File Permissions:**
```typescript
await writeFile(path, data);
await chmod(path, 0o600); // Owner read/write only
```

**Never Log:**
- Access tokens
- API keys
- Full contact records (use IDs only)

See `docs/security-requirements.md` for full security design.

## Testing Prototypes

Run API prototypes to verify functionality:

```bash
# Test HubSpot connection and scopes
npx tsx scripts/prototypes/test-connection.ts

# Test Search API
npx tsx scripts/prototypes/test-search.ts

# Test batch operations
npx tsx scripts/prototypes/test-batch.ts

# Test rate limiting behavior
npx tsx scripts/prototypes/test-rate-limits.ts
```

## Key Files

- `plan.md` - Detailed implementation plan with epics
- `IDEATION.md` - Feature concepts and user flows
- `docs/hubspot-api-research.md` - Comprehensive API documentation (Epic 1)
- `docs/security-requirements.md` - Security design (Epic 1)
- `docs/epic-1-summary.md` - Epic 1 completion summary
- `.credentials/.env` or `.env` - Local credentials (gitignored)
- `.env.example` - Template for environment variables
