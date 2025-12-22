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

**Using `@hubspot/api-client` only.** MCP was evaluated and rejected (see Epic 1 in plan.md).

**Why not MCP:** MCP is for LLM tool exposure. We're a CLI that uses AI for analysis, not an AI agent. No code savings, unnecessary complexity.

**API Notes:**
- Use Private App access tokens, NOT API keys (deprecated)
- Rate limit: 100 requests per 10 seconds (varies by endpoint/tier)
- Use CRM Search API for filtered queries (more efficient than fetching all)
- Batch APIs available for contacts/companies - use for efficiency
- Always mask PII in logs

**NOT using:**
- HubSpot MCP Server - wrong tool for our use case
- HubSpot CLI (`@hubspot/cli`) - for building custom HubSpot apps, not CRM data

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

## Key Files

- `plan.md` - Detailed implementation plan with epics
- `IDEATION.md` - Feature concepts and user flows
- `.credentials/.env` - Local credentials (gitignored)
- `.env.example` - Template for environment variables
