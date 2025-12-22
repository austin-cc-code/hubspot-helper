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

## HubSpot Integration Notes

**Potential Hybrid Architecture (under evaluation in Epic 1):**
- **Audit phase**: HubSpot Remote MCP Server (read-only, physically cannot modify data)
- **Execute phase**: `@hubspot/api-client` (full API access for writes)

This enforces safety at the infrastructure level - audit operations literally cannot modify data.

**API Notes:**
- Use Private App access tokens, NOT API keys (deprecated)
- Rate limit: 100 requests per 10 seconds (varies by endpoint/tier)
- Use CRM Search API for filtered queries (more efficient than fetching all)
- Batch APIs available for contacts/companies - use for efficiency
- Always mask PII in logs

**NOT using HubSpot CLI (`@hubspot/cli`)** - that's for building custom HubSpot apps, not CRM data management.

## Commands (planned)

```bash
npm run build          # Compile TypeScript
npm run dev            # Run with tsx
npm run test           # Run Jest tests
npm run lint           # ESLint check

# CLI usage
hubspot-audit config init                    # Setup wizard
hubspot-audit audit contacts --check=data-quality  # Generate plan (read-only)
hubspot-audit plan show <plan-file>          # Review plan
hubspot-audit execute <plan-file>            # Execute with confirmation
hubspot-audit rollback <execution-id>        # Undo changes
```

## Key Files

- `plan.md` - Detailed implementation plan with epics
- `IDEATION.md` - Feature concepts and user flows
