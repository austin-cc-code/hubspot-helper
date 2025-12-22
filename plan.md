# HubSpot CLI Audit Tool - Implementation Plan

## Project Overview

**Goal**: Build an AI-powered CLI tool that audits HubSpot data, identifies issues, generates actionable fix plans, and executes changes safely with rollback capability.

**Tech Stack:**
- Language: TypeScript/Node.js
- HubSpot Integration: `@hubspot/api-client`
- AI Integration: `@anthropic-ai/sdk` (Claude API)
- CLI Framework: Commander.js + Inquirer + Ora + Chalk
- Testing: Jest
- Config: YAML (js-yaml) + dotenv

**Design Principles:**
- **Simple over clever**: Module-based architecture, not over-engineered "agents"
- **Incremental delivery**: Each epic produces testable, usable functionality
- **Quality-first**: Comprehensive testing, no shortcuts
- **Plan-first, always**: Audits ONLY generate plans. No changes happen without explicit user review and approval.
- **Safe by default**: Preview everything, require confirmation, support rollback

**Core Safety Model: Audit → Plan → Review → Approve → Execute**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  The tool NEVER modifies HubSpot data automatically.                        │
│                                                                             │
│  1. AUDIT:   Analyze data, identify issues (read-only)                      │
│  2. PLAN:    Generate action plan file (no changes yet)                     │
│  3. REVIEW:  User reviews plan, can filter/modify                           │
│  4. APPROVE: User explicitly confirms execution                             │
│  5. EXECUTE: Only now are changes made (with rollback data captured)        │
│                                                                             │
│  At any point, the user can stop. Nothing happens without consent.          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI Layer                            │
│  Commands, Interactive Prompts, Progress Display, Output    │
└─────────────────────────────────┬───────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────┐
│                    Audit Orchestrator                        │
│  Coordinates audits, aggregates results, handles errors      │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
┌───────────▼───────────┐       ┌─────────────▼─────────────┐
│   HubSpot Service     │       │     Claude Service        │
│  - API Client         │       │  - Analysis prompts       │
│  - Rate limiting      │       │  - Response parsing       │
│  - Caching            │       │  - Structured output      │
│  - Pagination         │       │                           │
└───────────────────────┘       └───────────────────────────┘
            │                                 │
            └─────────────┬───────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                     Audit Modules                            │
│  Each module: same interface, independent, testable          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ DataQuality  │ │  Duplicates  │ │  Properties  │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ ListHygiene  │ │  Marketing   │ │  Features    │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Action System                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│  │ Plan Builder │ │   Executor   │ │   Rollback   │         │
│  └──────────────┘ └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   Report Generator                           │
│  Terminal output, JSON export, HTML reports                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **Module-based, not agent-based**: Each audit is a module with a common interface. No complex orchestration framework needed.

2. **Shared services**: HubSpot and Claude clients are shared services, not duplicated per module.

3. **Independent audits**: Each audit module can run standalone. No dependencies between audit types.

4. **Progressive enhancement**: Start with one audit working end-to-end, then add more.

---

## Project Structure

```
src/
├── cli/                      # CLI commands and interface
│   ├── index.ts              # Entry point
│   ├── commands/             # Command implementations
│   │   ├── audit.ts          # Main audit command
│   │   ├── config.ts         # Config management
│   │   ├── execute.ts        # Execute action plans
│   │   └── rollback.ts       # Rollback changes
│   ├── prompts/              # Interactive prompts
│   └── output/               # Output formatting (trees, tables, colors)
│
├── config/                   # Configuration management
│   ├── ConfigManager.ts      # Load, validate, save config
│   ├── schema.ts             # Config validation schema
│   └── defaults.ts           # Default configuration values
│
├── services/                 # Shared services
│   ├── HubSpotService.ts     # HubSpot API client wrapper
│   ├── ClaudeService.ts      # Claude API client wrapper
│   └── CacheService.ts       # Data caching layer
│
├── audits/                   # Audit modules
│   ├── AuditModule.ts        # Base interface/abstract class
│   ├── DataQualityAudit.ts   # Missing fields, invalid formats
│   ├── DuplicateAudit.ts     # Duplicate detection
│   ├── PropertyAudit.ts      # Property consistency
│   ├── ListAudit.ts          # List hygiene
│   ├── MarketingAudit.ts     # Marketing contact optimization
│   └── FeatureAudit.ts       # Feature utilization
│
├── actions/                  # Action plan system
│   ├── ActionPlan.ts         # Plan data structure
│   ├── PlanBuilder.ts        # Build plans from audit results
│   ├── Executor.ts           # Execute plans against HubSpot
│   └── RollbackManager.ts    # Track and reverse changes
│
├── reports/                  # Report generation
│   ├── ReportBuilder.ts      # Build reports from results
│   ├── formatters/           # Output formatters
│   │   ├── terminal.ts       # CLI output with colors/trees
│   │   ├── json.ts           # JSON export
│   │   └── html.ts           # HTML report generation
│   └── templates/            # HTML templates
│
├── types/                    # TypeScript types
│   ├── config.ts             # Configuration types
│   ├── hubspot.ts            # HubSpot data types
│   ├── audit.ts              # Audit result types
│   └── actions.ts            # Action plan types
│
└── utils/                    # Utilities
    ├── logger.ts             # Logging utility
    ├── validation.ts         # Data validation helpers
    └── formatting.ts         # String/data formatting

tests/
├── unit/                     # Unit tests (mocked dependencies)
├── integration/              # Integration tests (real APIs)
└── fixtures/                 # Test data fixtures
```

---

## Phase 1: Core MVP

**Goal**: Run one audit end-to-end with action plan and execution.

### Epic 0: Project Foundation

**Objective**: Set up development environment and project structure.

**Tasks:**
1. Initialize Node.js project with TypeScript
2. Configure tsconfig.json for strict mode
3. Set up Jest with ts-jest
4. Configure ESLint + Prettier
5. Set up directory structure
6. Create initial README with setup instructions
7. Add .env.example for required environment variables
8. Configure package.json `bin` entry for CLI executable
9. Create .gitignore (node_modules, dist, .env, *.log, etc.)
10. Add `engines` field specifying Node.js >=18 (for native fetch)
11. Define npm scripts (build, start, dev, lint, test, test:watch)
12. Set up basic logging infrastructure (pino or winston)

**Dependencies:**
```bash
# Runtime
npm install commander inquirer ora chalk js-yaml dotenv zod
npm install @hubspot/api-client @anthropic-ai/sdk
npm install pino pino-pretty  # Structured logging

# Development
npm install -D typescript @types/node ts-node tsx
npm install -D jest ts-jest @types/jest
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier
npm install -D @types/inquirer @types/js-yaml  # Missing type definitions
```

**package.json Configuration:**
```json
{
  "name": "hubspot-audit",
  "version": "0.1.0",
  "bin": {
    "hubspot-audit": "./dist/cli/index.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli/index.js",
    "dev": "tsx src/cli/index.ts",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

**Acceptance Criteria:**
- [ ] `npm run build` compiles without errors
- [ ] `npm test` runs (even with no tests yet)
- [ ] `npm run lint` passes
- [ ] Project structure matches plan
- [ ] README documents setup process
- [ ] `npx hubspot-audit --help` works after build
- [ ] .gitignore excludes sensitive files
- [ ] Logging outputs to console and optionally to file

**Estimated Effort**: Small

---

### Epic 1: HubSpot API & MCP Research

**Objective**: Deep research into HubSpot's API capabilities, the existing MCP's limitations, and security requirements before building our integration layer.

**Why This Epic Exists:**
- HubSpot's official MCP may not cover all our needs (workflow creation, batch operations, etc.)
- We need to understand rate limits, authentication, and available endpoints
- Security is critical when handling CRM data and API credentials
- This research informs how we build the HubSpot Service in Epic 3

**Research Areas:**

#### 1. HubSpot API Capabilities
Document available endpoints and their capabilities:

| Category | Endpoints to Research | Why We Need It |
|----------|----------------------|----------------|
| CRM Objects | Contacts, Companies, Deals | Core audit targets |
| Properties | Property definitions, options | Property audit, validation |
| Associations | Object relationships | Data quality checks |
| Search | CRM Search API | Efficient querying vs fetching all |
| Lists | Static & dynamic lists | List hygiene audit |
| Timeline | Activity/engagement events | Stale contact detection |
| Email | Send events, bounces, unsubscribes | Marketing contact optimization |
| Workflows | Create, update, list workflows | Prevention automation |
| Account | Portal info, feature access | Feature utilization audit |

#### 2. Rate Limits & Quotas
Understand limits to design proper throttling:

```
Research Questions:
- What are the rate limits per endpoint?
- How do limits vary by subscription tier (Free/Starter/Pro/Enterprise)?
- What are daily/monthly API call quotas?
- How should we handle 429 responses?
- Are there burst limits vs sustained limits?
```

#### 3. Authentication & Security
```
Research Questions:
- Private App tokens vs OAuth: which is appropriate for CLI tool?
- What scopes/permissions do we need for each operation?
- How to securely store credentials (keychain, encrypted file, env vars)?
- What data sensitivity considerations exist (PII, GDPR)?
- Should we support multiple authentication methods?
```

#### 4. HubSpot MCP Evaluation

**Decision: Use `@hubspot/api-client` only. Do not use MCP.**

**Evaluation Summary (Dec 2024):**

| Option | Verdict |
|--------|---------|
| HubSpot Remote MCP Server | ❌ Not suitable |
| HubSpot Developer MCP Server | ❌ For app scaffolding, not CRM data |
| `@hubspot/api-client` | ✅ Use this |

**Why Not MCP:**
1. **MCP is for LLM tool exposure** - Designed for AI assistants to call tools. We're building a CLI that uses AI for analysis, not an AI agent.
2. **No code savings** - MCP wraps the same API. We'd still write a service layer.
3. **Unnecessary complexity** - Two interfaces to maintain for no benefit.
4. **MCP can read AND write** - So it doesn't provide "safe by design" read-only access.

**Why `@hubspot/api-client`:**
1. Official, mature, well-documented SDK
2. Direct control over pagination, rate limiting, batching
3. Full API coverage (workflows, marketing status, etc.)
4. Simpler architecture - one way to talk to HubSpot

**Safety comes from our code logic** (only call write methods after user confirmation), not from infrastructure limitations.

#### 5. Batch Operations
```
Research Questions:
- Which endpoints support batch operations?
- What are batch size limits?
- How do batch operations affect rate limits?
- Are there transactional guarantees?
```

#### 6. HubSpot CLI Note

**The HubSpot CLI (`@hubspot/cli`) is NOT for CRM data management.** It's for building custom HubSpot apps, themes, and UI extensions. We don't need it.

**Tasks:**
1. Set up a HubSpot developer test portal
2. Create a Private App with necessary scopes
3. Document all relevant API endpoints with examples
4. Test rate limits empirically
5. Design credential storage strategy
6. Create API capability matrix (what we need vs what's available)
7. Document security requirements and best practices
8. Prototype critical operations (search, batch update, workflow creation)
9. Write research findings document

**Deliverables:**
- `docs/hubspot-api-research.md` - Comprehensive API documentation
- `docs/security-requirements.md` - Security design decisions
- Working prototype scripts demonstrating key operations

**Acceptance Criteria:**
- [ ] All required API endpoints documented with rate limits
- [ ] Security model designed and documented
- [ ] Prototype demonstrates: batch contact update, search, workflow creation
- [ ] Credential storage strategy decided
- [ ] Rate limiting strategy designed

**Estimated Effort**: Medium (but critical - don't skip this)

---

### Epic 2: Configuration System

**Objective**: YAML-based configuration with company context for AI-aware recommendations.

**Config File Location**: `~/.hubspot-audit/config.yaml` (with fallback to `./hubspot-audit.config.yaml`)

**Config Structure:**
```typescript
interface Config {
  // API Credentials (can also use env vars)
  hubspot: {
    access_token?: string;   // Private App token, or HUBSPOT_ACCESS_TOKEN env var
    portal_id?: string;
    environment?: 'production' | 'sandbox';  // Support multiple portals
  };
  anthropic: {
    api_key?: string;        // Or ANTHROPIC_API_KEY env var
    model?: 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307';  // Cost/quality tradeoff
  };

  // Company Context (for AI recommendations)
  company: {
    name: string;
    industry: string;
    business_model: 'B2B' | 'B2C' | 'B2B2C';
  };

  // Ideal Customer Profile
  icp: {
    company_sizes: string[];
    industries: string[];
    job_titles: string[];
  };

  // Data Quality Rules
  rules: {
    required_contact_fields: string[];
    required_company_fields: string[];
    stale_contact_days: number;          // Default: 365
    min_engagement_months: number;       // Default: 12
    industry_mappings: Record<string, string>;  // "Tech" -> "Technology"
  };

  // Audit Settings
  settings: {
    batch_size: number;                  // Default: 100
    rate_limit: {
      requests_per_10_seconds: number;   // Default: 100 (HubSpot's standard limit)
      burst_limit: number;               // Default: 10 (max concurrent)
      retry_after_429: boolean;          // Default: true
    };
    cache_ttl_minutes: number;           // Default: 30
    output_directory: string;            // Default: './audit-reports'
  };

  // Security Settings
  security: {
    mask_pii_in_logs: boolean;           // Default: true
    credential_storage: 'env' | 'keychain' | 'config';  // Where to read credentials
  };
}
```

**CLI Commands:**
```bash
hubspot-audit config init          # Interactive setup wizard
hubspot-audit config show          # Display current config
hubspot-audit config validate      # Validate config file
hubspot-audit config set <key> <value>  # Set a config value
```

**Tasks:**
1. Define TypeScript types for config (`src/types/config.ts`)
2. Implement ConfigManager class
3. Create config validation with helpful error messages
4. Implement `config init` wizard with inquirer
5. Implement other config commands
6. Handle environment variable fallbacks for API keys

**Acceptance Criteria:**
- [ ] `config init` walks through setup and creates valid config
- [ ] `config validate` catches invalid configs with clear errors
- [ ] API keys can come from config file OR environment variables
- [ ] Config is type-safe throughout codebase
- [ ] Missing config shows helpful setup instructions

**Estimated Effort**: Medium

---

### Epic 3: HubSpot Service

**Objective**: Robust HubSpot API client with caching, rate limiting, and comprehensive CRM access.

**Note**: Implementation informed by Epic 1 research findings. Interface may evolve based on API discoveries.

**HubSpotService Interface:**
```typescript
class HubSpotService {
  // Contacts
  async getContacts(options?: QueryOptions): Promise<Contact[]>
  async getContact(id: string): Promise<Contact>
  async updateContact(id: string, properties: Properties): Promise<void>
  async deleteContact(id: string): Promise<void>
  async searchContacts(query: SearchQuery): Promise<Contact[]>  // CRM Search API
  async getContactProperties(): Promise<PropertyDefinition[]>

  // Companies
  async getCompanies(options?: QueryOptions): Promise<Company[]>
  async getCompany(id: string): Promise<Company>
  async updateCompany(id: string, properties: Properties): Promise<void>
  async searchCompanies(query: SearchQuery): Promise<Company[]>
  async getCompanyProperties(): Promise<PropertyDefinition[]>

  // Deals (needed for pipeline health, lifecycle validation)
  async getDeals(options?: QueryOptions): Promise<Deal[]>
  async getDeal(id: string): Promise<Deal>
  async getDealProperties(): Promise<PropertyDefinition[]>

  // Associations (critical for data quality checks)
  async getAssociations(objectType: ObjectType, objectId: string, toObjectType: ObjectType): Promise<Association[]>
  async createAssociation(fromType: ObjectType, fromId: string, toType: ObjectType, toId: string): Promise<void>

  // Lists
  async getLists(): Promise<List[]>
  async getListMembers(listId: string): Promise<Contact[]>
  async removeFromList(listId: string, contactIds: string[]): Promise<void>

  // Timeline & Engagement (for stale contact detection)
  async getContactTimeline(contactId: string, options?: TimelineOptions): Promise<TimelineEvent[]>
  async getContactEngagement(contactId: string): Promise<EngagementSummary>

  // Email Events (for marketing contact optimization)
  async getEmailEvents(contactId: string): Promise<EmailEvent[]>  // bounces, unsubscribes, opens, clicks
  async getMarketingContactStatus(contactId: string): Promise<MarketingStatus>
  async setMarketingContactStatus(contactId: string, isMarketing: boolean): Promise<void>

  // Workflows (for prevention automation - Phase 2+)
  async getWorkflows(): Promise<Workflow[]>
  async createWorkflow(definition: WorkflowDefinition): Promise<Workflow>

  // Account
  async getAccountInfo(): Promise<AccountInfo>
  async getSubscriptionInfo(): Promise<SubscriptionInfo>  // For feature utilization audit

  // Batch operations
  async batchGetContacts(ids: string[]): Promise<Contact[]>
  async batchUpdateContacts(updates: ContactUpdate[]): Promise<BatchResult>
  async batchUpdateCompanies(updates: CompanyUpdate[]): Promise<BatchResult>

  // Merge (NOTE: Not reversible!)
  async mergeContacts(primaryId: string, secondaryId: string): Promise<void>
}
```

**Features:**
- Automatic pagination for large datasets (cursor-based)
- Rate limiting respecting HubSpot's 100 requests per 10 seconds
- Response caching with configurable TTL
- Retry logic with exponential backoff (3 retries, jitter)
- Comprehensive error handling with clear messages
- Request queuing to prevent burst limit violations
- PII masking in logs (configurable)

**Rate Limiting Strategy:**
```typescript
interface RateLimiter {
  // Token bucket algorithm
  requestsPerWindow: number;      // 100 (HubSpot standard)
  windowSizeMs: number;           // 10000 (10 seconds)
  maxConcurrent: number;          // 10 (burst limit)

  // Backoff on 429
  on429Response(retryAfter: number): void;

  // Queue management
  enqueue<T>(request: () => Promise<T>): Promise<T>;
}
```

**Security Considerations:**
- Never log full API responses containing PII
- Mask email addresses and names in debug logs
- Validate access token scopes before operations
- Fail fast if required scopes missing

**Tasks:**
1. Create HubSpotService class wrapping `@hubspot/api-client`
2. Implement pagination helper for all list endpoints
3. Build rate limiter with token bucket algorithm
4. Implement caching layer with TTL and invalidation
5. Add retry logic with exponential backoff and jitter
6. Create typed error hierarchy (AuthError, RateLimitError, NotFoundError, etc.)
7. Implement CRM Search API wrapper
8. Add association management
9. Implement timeline/engagement fetching
10. Add email events and marketing status APIs
11. Build batch operation handlers with chunking
12. Write unit tests with mocked client
13. Write integration tests against test portal

**Acceptance Criteria:**
- [ ] Can fetch all contacts with automatic pagination
- [ ] Rate limiting prevents 429 errors under load
- [ ] Caching reduces duplicate API calls
- [ ] Retries handle transient failures gracefully
- [ ] Clear error messages for auth failures, not found, rate limits, etc.
- [ ] CRM Search API works for filtered queries
- [ ] Associations can be fetched and created
- [ ] Integration tests pass against real HubSpot portal
- [ ] PII is masked in all log output
- [ ] Batch operations respect rate limits

**Estimated Effort**: Large

---

### Epic 4: CLI Framework

**Objective**: Polished CLI experience with commands, progress display, and formatted output.

**Command Structure:**
```bash
# ─────────────────────────────────────────────────────────────────
# AUDIT COMMANDS (read-only, generates plan files)
# ─────────────────────────────────────────────────────────────────
hubspot-audit audit [type] [options]
hubspot-audit audit contacts --check=data-quality
hubspot-audit audit contacts --check=duplicates
hubspot-audit audit all --comprehensive

# ─────────────────────────────────────────────────────────────────
# PLAN REVIEW COMMANDS (examine plans before execution)
# ─────────────────────────────────────────────────────────────────
hubspot-audit plan show <plan-file>                    # Display full plan details
hubspot-audit plan show <plan-file> --summary         # Show summary only
hubspot-audit plan show <plan-file> --filter=high     # Filter by confidence
hubspot-audit plan diff <plan-file>                   # Show before/after for each action
hubspot-audit plan export <plan-file> --format=csv    # Export for external review

# ─────────────────────────────────────────────────────────────────
# EXECUTION COMMANDS (the ONLY commands that modify data)
# ─────────────────────────────────────────────────────────────────
hubspot-audit execute <plan-file>                      # Execute with confirmation prompt
hubspot-audit execute <plan-file> --dry-run            # Show what would happen
hubspot-audit execute <plan-file> --high-confidence-only  # Only execute high-confidence

# ─────────────────────────────────────────────────────────────────
# ROLLBACK COMMANDS
# ─────────────────────────────────────────────────────────────────
hubspot-audit rollback <execution-id>                  # Rollback an execution
hubspot-audit executions list                          # List recent executions

# ─────────────────────────────────────────────────────────────────
# CONFIG COMMANDS
# ─────────────────────────────────────────────────────────────────
hubspot-audit config init|show|validate|set

# Help
hubspot-audit --help
hubspot-audit audit --help
```

**Global Flags:**
```bash
--config <path>      # Use alternate config file (default: ~/.hubspot-audit/config.yaml)
--verbose, -v        # Increase output verbosity (can stack: -vvv)
--quiet, -q          # Suppress non-essential output
--no-color           # Disable colored output (auto-detected for non-TTY)
--json               # Output results as JSON (implies --no-color)
--output <path>      # Write output to file instead of stdout
```

**Exit Codes (for scripting):**
```
0  - Success, no issues found
1  - Error (config, auth, API failure)
2  - Success, issues found (audit completed with findings)
3  - Partial success (some operations failed)
130 - Interrupted (Ctrl+C)
```

**Progress Display:**
```
Auditing contacts...
  ✓ Fetched 1,832 contacts (2.3s)
  ◐ Analyzing data quality... 45%
```

**Output Formatting:**
```
Data Quality Issues Found: 247 across 1,832 contacts

  Missing Required Fields (123 contacts)
  ├─ email: 45 contacts
  ├─ company: 38 contacts
  └─ job_title: 40 contacts

  Invalid Formats (89 contacts)
  ├─ phone: 67 contacts (not E.164 format)
  └─ email: 22 contacts (invalid format)

  Stale Data (35 contacts)
  └─ No activity in 12+ months

Actions available:
  1. Generate action plan
  2. Export report (JSON/HTML)
  3. Run another audit
```

**Tasks:**
1. Set up Commander.js with command structure
2. Implement interactive prompts with Inquirer
3. Create progress display utilities with Ora
4. Build output formatters (trees, tables, colors) with Chalk
5. Implement error display formatting
6. Add --json flag for machine-readable output
7. Create help text for all commands

**Acceptance Criteria:**
- [ ] All commands parse correctly with helpful --help
- [ ] Progress spinners show during long operations
- [ ] Output is well-formatted with colors and structure
- [ ] --json flag outputs valid JSON for scripting
- [ ] Errors display clearly with suggested fixes
- [ ] Ctrl+C gracefully cancels operations

**Estimated Effort**: Medium

---

### Epic 5: Claude Service

**Objective**: Claude API integration for intelligent analysis with cost controls and reliability.

**Model Selection Strategy:**
| Use Case | Model | Rationale |
|----------|-------|-----------|
| Data Quality Analysis | claude-sonnet-4-20250514 | Good balance of quality/cost for pattern detection |
| Duplicate Analysis | claude-sonnet-4-20250514 | Needs reasoning for fuzzy matching decisions |
| Summary Generation | claude-3-haiku-20240307 | Fast, cheap for text generation |
| Complex Reasoning | claude-sonnet-4-20250514 | When context requires deep analysis |

**ClaudeService Interface:**
```typescript
class ClaudeService {
  constructor(config: ClaudeConfig);

  // Analysis methods
  async analyzeDataQuality(
    contacts: Contact[],
    config: Config
  ): Promise<DataQualityAnalysis>

  async analyzeDuplicates(
    pairs: ContactPair[],
    config: Config
  ): Promise<DuplicateAnalysis>

  async analyzeProperties(
    properties: PropertyUsage[],
    config: Config
  ): Promise<PropertyAnalysis>

  async generateSummary(
    findings: AuditFindings,
    config: Config
  ): Promise<NaturalLanguageSummary>

  // Cost tracking
  getUsageStats(): UsageStats;
  estimateCost(operation: OperationType, dataSize: number): CostEstimate;
}

interface ClaudeConfig {
  model: 'claude-sonnet-4-20250514' | 'claude-3-haiku-20240307';
  maxTokensPerRequest: number;          // Default: 4096
  monthlyBudgetUsd?: number;            // Optional spending cap
  fallbackToRulesOnly: boolean;         // If API unavailable, continue without AI
  maxRetries: number;                   // Default: 3
  timeoutMs: number;                    // Default: 60000
}

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalRequests: number;
  estimatedCostUsd: number;
  byOperation: Record<string, OperationStats>;
}
```

**Context Window Management:**
When data exceeds token limits, use chunking strategy:
```typescript
async function analyzeInChunks<T>(
  data: T[],
  analyzer: (chunk: T[]) => Promise<Analysis>,
  chunkSize: number = 100  // Contacts per chunk
): Promise<Analysis> {
  // 1. Split data into chunks that fit context window
  // 2. Analyze each chunk
  // 3. Merge results with deduplication
  // 4. Generate final summary across all chunks
}
```

**Prompt Safety:**
- Sanitize company names and user data before interpolation
- Use structured tool_use for reliable JSON output (not string parsing)
- Validate all outputs against Zod schemas

**Example with Tool Use (Recommended):**
```typescript
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  tools: [{
    name: "report_data_quality_issues",
    description: "Report data quality issues found in the contacts",
    input_schema: {
      type: "object",
      properties: {
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              contactId: { type: "string" },
              issueType: { type: "string" },
              severity: { enum: ["low", "medium", "high"] },
              description: { type: "string" },
              suggestedFix: { type: "string" }
            },
            required: ["contactId", "issueType", "severity", "description"]
          }
        }
      },
      required: ["issues"]
    }
  }],
  messages: [{ role: "user", content: prompt }]
});
```

**Fallback Behavior:**
When Claude API is unavailable:
1. Log the failure with details
2. If `fallbackToRulesOnly: true`, continue with rule-based checks only
3. Mark results as "AI analysis unavailable"
4. Don't fail the entire audit

**Tasks:**
1. Create ClaudeService class wrapping `@anthropic-ai/sdk`
2. Implement model selection logic based on operation type
3. Design prompt templates for each analysis type
4. Implement tool_use for structured JSON output
5. Build context window chunking for large datasets
6. Add retry logic with exponential backoff
7. Implement token usage tracking and cost estimation
8. Add budget enforcement (optional)
9. Implement fallback to rules-only mode
10. Handle rate limits gracefully (respect Retry-After)
11. Write tests with mocked responses
12. Add input sanitization for prompt safety

**Acceptance Criteria:**
- [ ] Analysis prompts include company context from config
- [ ] Responses are valid JSON via tool_use (not string parsing)
- [ ] Large datasets handled via chunking without errors
- [ ] Retries handle transient API failures
- [ ] Token usage is logged for cost monitoring
- [ ] Cost estimate available before running analysis
- [ ] Fallback to rules-only works when API unavailable
- [ ] Clear errors when API key is invalid/missing

**Estimated Effort**: Medium-Large

---

### Epic 6: Data Quality Audit

**Objective**: First audit module - detect data quality issues in contacts.

**Issues Detected:**
1. **Missing Required Fields**: Based on `config.rules.required_contact_fields`
2. **Invalid Formats**: Email, phone, URL validation
3. **Stale Data**: No activity in X days (configurable)
4. **Inconsistent Values**: Casing, formatting issues
5. **AI-Detected Issues**: Typos, anomalies Claude identifies

**Audit Module Interface:**
```typescript
interface AuditModule {
  name: string;
  description: string;

  run(context: AuditContext): Promise<AuditResult>;
}

interface AuditContext {
  hubspot: HubSpotService;
  claude: ClaudeService;
  config: Config;
  progress: ProgressReporter;
}

interface AuditResult {
  module: string;
  timestamp: Date;
  summary: {
    total_records: number;
    issues_found: number;
    by_severity: Record<Severity, number>;
    by_type: Record<string, number>;
  };
  issues: AuditIssue[];
  ai_insights: string;  // Natural language summary from Claude
}
```

**Tasks:**
1. Define AuditModule interface
2. Implement DataQualityAudit module
3. Add validation rules for common fields (email, phone, URL)
4. Integrate with Claude for AI analysis
5. Generate structured results
6. Write comprehensive tests with fixture data

**Acceptance Criteria:**
- [ ] Detects missing required fields per config
- [ ] Validates email and phone formats
- [ ] Identifies stale contacts based on config threshold
- [ ] Claude provides additional insights beyond rule-based checks
- [ ] Results include both structured data and natural language summary
- [ ] Performance: 1000 contacts analyzed in <30s

**Estimated Effort**: Medium-Large

---

### Epic 7: Action Plan System

**Objective**: Generate actionable fix plans from audit results. Plans are **proposals only** - no changes are made until the user explicitly executes them.

**Key Principle**: This epic is about **generating and presenting plans**, not executing them.
The user must be able to:
1. Review the full plan before any action
2. Filter actions by confidence level
3. Export the plan for offline review
4. Modify or reject specific actions
5. Defer execution indefinitely (plan files persist)

**Action Plan Structure:**
```typescript
interface ActionPlan {
  id: string;
  created_at: Date;
  source_audit: string;

  summary: {
    total_actions: number;
    by_type: Record<ActionType, number>;
    by_confidence: Record<ConfidenceLevel, number>;
    estimated_api_calls: number;
  };

  actions: Action[];
}

interface Action {
  id: string;
  type: ActionType;
  confidence: 'high' | 'medium' | 'low';

  target: {
    object_type: 'contact' | 'company' | 'list';
    object_id: string;
    display_name: string;
  };

  change: {
    description: string;
    property?: string;
    current_value?: any;
    new_value?: any;
  };

  reasoning: string;       // Why this action is recommended
  reversible: boolean;     // Can this be undone?
  requires_confirmation: boolean;  // Extra confirmation for destructive actions
  dependencies?: string[]; // Action IDs that must complete first
}

// Action type reversibility matrix
type ActionType =
  | 'update_property'      // ✓ Reversible - restore original value
  | 'delete_contact'       // ⚠ Reversible only if soft-delete supported
  | 'merge_contacts'       // ❌ NOT REVERSIBLE - HubSpot limitation!
  | 'remove_from_list'     // ✓ Reversible - re-add to list
  | 'set_marketing_status' // ✓ Reversible - toggle status back
  | 'create_association';  // ✓ Reversible - remove association

// CRITICAL: Merge operations cannot be undone in HubSpot.
// Once contacts are merged, the secondary record is permanently deleted.
// The plan builder MUST set reversible=false and requires_confirmation=true for merges.
```

**Plan File Storage:**
- Location: `./audit-reports/`
- Format: `{audit-type}-{timestamp}.json`
- Example: `data-quality-2025-01-15T10-30-00.json`

**Tasks:**
1. Define action plan types
2. Implement PlanBuilder that converts audit results to actions
3. Add confidence scoring logic
4. Implement plan serialization (save/load JSON)
5. Create plan preview display in CLI
6. Add filtering options (by confidence, by type)

**Acceptance Criteria:**
- [ ] Audit results automatically generate action plans
- [ ] Each action has clear reasoning
- [ ] Actions are scored by confidence
- [ ] Plans save to JSON files with readable format
- [ ] CLI shows clear preview of what will change
- [ ] Can filter to high-confidence actions only

**Estimated Effort**: Medium

---

### Epic 8: Execution Engine with Rollback

**Objective**: Safely execute action plans with rollback capability where possible.

**⚠️ Rollback Limitations:**
Not all actions can be rolled back. The execution engine must:
- Clearly warn users about non-reversible actions before execution
- Require explicit confirmation for merge operations
- Mark non-reversible actions in execution records

**Execution Flow:**
1. Load action plan from file
2. Validate plan (check for conflicts, dependencies)
3. Check for non-reversible actions and warn user
4. Display summary and request confirmation
5. Acquire execution lock (prevent concurrent executions)
6. Record current values for all targets (for rollback)
7. Execute actions in dependency order with progress display
8. Use batch APIs where possible for efficiency
9. Save execution record with rollback data
10. Release execution lock
11. Display results summary

**Execution Record:**
```typescript
interface ExecutionRecord {
  id: string;
  plan_id: string;
  executed_at: Date;
  completed_at?: Date;
  status: 'in_progress' | 'completed' | 'failed' | 'partially_completed';

  results: {
    successful: number;
    failed: number;
    skipped: number;
    non_reversible: number;  // Track how many can't be undone
  };

  actions: ExecutedAction[];

  // For resuming failed executions
  resume_from?: string;  // Action ID to resume from
}

interface ExecutedAction {
  action_id: string;
  status: 'success' | 'failed' | 'skipped' | 'pending';
  error?: string;
  executed_at?: Date;

  // Rollback data (null for non-reversible actions)
  rollback_data: {
    object_type: string;
    object_id: string;
    property: string;
    original_value: any;
  } | null;

  is_reversible: boolean;
}
```

**Concurrency Control:**
```typescript
// Only one execution at a time per portal
interface ExecutionLock {
  portal_id: string;
  acquired_at: Date;
  expires_at: Date;  // Auto-expire after 1 hour
  execution_id: string;
}

// Lock file: ./audit-reports/.execution-lock
```

**Rollback Storage:**
- Location: `./audit-reports/executions/`
- Keeps last 30 days of execution records
- Storage limit: 100MB (auto-cleanup oldest)

**CLI Commands:**
```bash
# Execute a plan
hubspot-audit execute ./audit-reports/data-quality-2025-01-15.json

# Dry run (show what would happen)
hubspot-audit execute ./audit-reports/data-quality-2025-01-15.json --dry-run

# Execute only high-confidence actions
hubspot-audit execute ./audit-reports/data-quality-2025-01-15.json --high-confidence-only

# Rollback an execution
hubspot-audit rollback exec-2025-01-15T10-30-00

# List recent executions
hubspot-audit executions list
```

**Tasks:**
1. Implement Executor class with dependency ordering
2. Build execution lock mechanism (prevent concurrent runs)
3. Add pre-execution value capture for rollback
4. Implement batch API usage for efficiency
5. Implement execution with progress display
6. Save execution records with resume capability
7. Implement RollbackManager (respects reversibility flags)
8. Add dry-run mode
9. Add confirmation prompts with non-reversible warnings
10. Implement execution resume for failed runs
11. Add storage cleanup for old execution records
12. Write integration tests

**Acceptance Criteria:**
- [ ] Execution requires explicit confirmation
- [ ] Non-reversible actions (merge) require extra confirmation
- [ ] Concurrent executions prevented via lock
- [ ] Original values captured before any changes
- [ ] Progress shown during execution
- [ ] Batch operations used where possible
- [ ] Failed actions don't stop entire execution
- [ ] Rollback restores original values (for reversible actions)
- [ ] Rollback clearly indicates which actions cannot be undone
- [ ] Dry-run shows exactly what would change
- [ ] Execution can be resumed after failure
- [ ] Execution history preserved for 30 days (with size limit)

**Estimated Effort**: Large

---

## Phase 1 Summary

After completing Phase 1, you will have:

```bash
# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: CONFIGURE (one-time setup)
# ═══════════════════════════════════════════════════════════════════════════
hubspot-audit config init

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: AUDIT (read-only analysis - NO CHANGES MADE)
# ═══════════════════════════════════════════════════════════════════════════
hubspot-audit audit contacts --check=data-quality

# Output:
#   Found 247 issues across 1,832 contacts
#   Action plan saved: ./audit-reports/data-quality-2025-01-15.json
#
#   To review the plan: hubspot-audit plan show ./audit-reports/data-quality-2025-01-15.json
#   To execute:         hubspot-audit execute ./audit-reports/data-quality-2025-01-15.json

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: REVIEW (examine what the plan proposes - NO CHANGES MADE)
# ═══════════════════════════════════════════════════════════════════════════
hubspot-audit plan show ./audit-reports/data-quality-2025-01-15.json

# Shows detailed breakdown of all proposed changes
# User can review each action, filter by confidence, etc.

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: EXECUTE (only after explicit approval - CHANGES MADE HERE)
# ═══════════════════════════════════════════════════════════════════════════
hubspot-audit execute ./audit-reports/data-quality-2025-01-15.json

# Output:
#   Action Plan Summary:
#     - 198 high-confidence actions
#     - 49 medium-confidence actions (require --include-medium flag)
#     - 3 non-reversible actions (merges)
#
#   ⚠️  This will modify 247 contacts in your HubSpot portal.
#
#   Do you want to proceed? [y/N]: _

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: ROLLBACK (if needed)
# ═══════════════════════════════════════════════════════════════════════════
hubspot-audit rollback exec-2025-01-15T10-30-00
```

**Key Safety Feature**: The `audit` command NEVER modifies data. It only reads and generates a plan file.
The user must explicitly run `execute` with a plan file to make any changes.

**Definition of Done for Phase 1:**
- [ ] Can configure tool with company context
- [ ] Data quality audit runs successfully on real HubSpot data
- [ ] Audit results show both rule-based and AI-detected issues
- [ ] Action plan generated with confidence scoring
- [ ] Can execute plan with confirmation
- [ ] Can rollback any execution
- [ ] All tests passing
- [ ] Documentation covers all commands

**Phase 1 Scope Consideration:**

The IDEATION document identifies two additional audits as high-priority for MVP:

1. **Marketing Contact Optimization (Epic 12)** - Provides immediate cost savings (~$495/month)
2. **Feature Utilization Audit (Epic 13)** - Maximizes ROI on subscription (~$400+/month value)

These are currently in Phase 2 to keep Phase 1 focused on the core audit-plan-execute loop.
Options:
- **Option A (Current)**: Keep Phase 1 lean, get core working first, add high-value audits in Phase 2
- **Option B**: Move Marketing Contact and Feature audits to Phase 1 for faster ROI
- **Option C**: Add Marketing Contact to Phase 1 (simpler), defer Feature audit (requires subscription tier logic)

Recommendation: Start with Option A. Once Epic 6 (Data Quality Audit) is working, the pattern
is established and adding new audit types becomes straightforward.

---

## Phase 2: Expand Audits

**Goal**: Add remaining audit modules. Each follows the same pattern established in Phase 1.

### Epic 9: Duplicate Detection Audit

**Detects:**
- Exact email matches
- Fuzzy name matching (Levenshtein distance)
- Same company + similar name
- Phone number matches

**Actions Generated:**
- Merge recommendations with primary record selection
- Confidence scoring based on match quality

**Tasks:**
1. Implement DuplicateAudit module
2. Add exact matching logic
3. Add fuzzy matching with configurable threshold
4. Use Claude for merge recommendations
5. Generate merge action plans

**Estimated Effort**: Medium

---

### Epic 10: Property Consistency Audit

**Detects:**
- Value variations ("Tech" vs "Technology" vs "IT")
- Low-population properties (<5% filled)
- Unused custom properties
- Inconsistent formatting/casing

**Actions Generated:**
- Standardize values per config mappings
- Flag unused properties for review

**Tasks:**
1. Implement PropertyAudit module
2. Analyze value distributions
3. Apply config standardization mappings
4. Use Claude to detect variations
5. Generate standardization actions

**Estimated Effort**: Medium

---

### Epic 11: List Hygiene Audit

**Detects:**
- Unused lists (no activity in 6+ months)
- High membership overlap between lists
- Lists with bounced/unsubscribed members
- Broken filter criteria

**Actions Generated:**
- Archive unused lists
- Remove invalid members
- Consolidation recommendations

**Tasks:**
1. Implement ListAudit module
2. Fetch list metadata and membership
3. Calculate overlap percentages
4. Identify stale lists
5. Generate cleanup actions

**Estimated Effort**: Medium

---

### Epic 12: Marketing Contact Optimization Audit

**Detects:**
- Inactive marketing contacts (no engagement in X months)
- Unsubscribed contacts still marked as marketing
- Bounced emails marked as marketing
- Non-ICP contacts consuming marketing slots

**Actions Generated:**
- Convert to non-marketing status
- Delete recommendations for low-value contacts
- Cost savings calculations

**Output:**
```
Marketing Contact Optimization Report

Current: 8,734 / 10,000 marketing contacts (87%)
Monthly cost: ~$1,200

Conversion Candidates:
├─ High Confidence (892 contacts) - $357/month savings
│  ├─ Unsubscribed: 567 contacts
│  ├─ Hard bounced: 234 contacts
│  └─ Internal/employees: 91 contacts
│
└─ Medium Confidence (564 contacts) - $226/month savings
   ├─ No engagement 18+ months: 345 contacts
   └─ Outside ICP: 219 contacts

Total Potential Savings: $583/month ($6,996/year)
```

**Tasks:**
1. Implement MarketingAudit module
2. Calculate engagement metrics
3. Identify conversion candidates
4. Calculate cost savings
5. Generate conversion actions

**Estimated Effort**: Medium

---

### Epic 13: Feature Utilization Audit

**Detects:**
- Unused HubSpot features you're paying for
- Underutilized features
- Missing configurations that would add value

**Output:**
```
Feature Utilization Report

Subscription: Marketing Hub Professional ($800/month)
Features in use: 23/47 (49%)

Unused High-Value Features:
├─ Lead Scoring - Not configured
│  └─ Recommendation: Set up based on your ICP criteria
├─ A/B Testing - Never used
│  └─ Recommendation: Start with subject line tests
└─ Custom Reports - 0 created
   └─ Recommendation: Create funnel conversion report

Based on your B2B SaaS model, prioritize:
1. Lead Scoring (matches your ICP targeting)
2. Sequences (fits your 60-90 day sales cycle)
```

**Tasks:**
1. Implement FeatureAudit module
2. Query HubSpot account for feature usage
3. Use Claude to generate context-aware recommendations
4. Prioritize based on company config

**Estimated Effort**: Medium

---

### Epic 14: Audit Orchestrator

**Objective**: Run multiple audits and aggregate results.

**Commands:**
```bash
# Run all audits
hubspot-audit audit all

# Run specific combination
hubspot-audit audit contacts --check=data-quality,duplicates

# Comprehensive audit with cross-cutting analysis
hubspot-audit audit all --comprehensive
```

**Cross-Cutting Analysis:**
After running multiple audits, Claude analyzes patterns across findings:
- Common root causes
- Prioritized fix order
- Systemic issues vs one-off problems

**Tasks:**
1. Implement AuditOrchestrator
2. Add parallel execution for independent audits
3. Implement result aggregation
4. Add cross-cutting Claude analysis
5. Generate combined action plan

**Estimated Effort**: Medium

---

### Epic 15: Report Generation

**Objective**: Export audit results in multiple formats.

**Formats:**
- **Terminal**: Colored, formatted output (default)
- **JSON**: Machine-readable, for scripting
- **HTML**: Shareable report with styling

**Commands:**
```bash
# Run audit and save HTML report
hubspot-audit audit contacts --check=data-quality --report=html

# Export existing results
hubspot-audit report ./audit-reports/data-quality-2025-01-15.json --format=html
```

**Tasks:**
1. Create ReportBuilder class
2. Implement terminal formatter (existing, enhance)
3. Implement JSON formatter
4. Implement HTML formatter with template
5. Add report comparison (vs previous audit)

**Estimated Effort**: Medium

---

## Phase 2 Summary

After completing Phase 2:

```bash
# Run all audits
hubspot-audit audit all

# Get specific insights
hubspot-audit audit contacts --check=duplicates
hubspot-audit audit contacts --check=marketing-optimization
hubspot-audit audit features

# Generate HTML report for review
hubspot-audit audit all --report=html --output=./reports/
```

---

## Phase 3: Advanced Features (v2)

These are valuable but not essential for v1. Implement based on need.

### Epic 16: Workflow Generation

Generate HubSpot workflows to prevent recurring issues:
- Phone number standardization workflow
- Duplicate prevention workflow
- Data enrichment workflow

### Epic 17: Smart Alerts

Monitor HubSpot for anomalies:
- Unusual spike in duplicates
- Form submission drops
- Data quality score degradation

### Epic 18: Bulk Operations

Mass updates beyond audit-generated actions:
- Update all contacts matching criteria
- Bulk merge operations
- Mass property transformations

---

## Testing Strategy

### Unit Tests
- Mock external APIs (HubSpot, Claude)
- Test each module in isolation
- Target: 80%+ code coverage
- Run time: <30 seconds

### Integration Tests
- Use test HubSpot portal
- Real API calls with test data
- Test rate limiting and error handling
- Run time: <5 minutes

### Test Data
- Create fixtures with known issues
- Include edge cases (empty data, large batches)
- Reproducible test scenarios

### Test Commands
```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:int      # Integration tests only
npm run test:coverage # With coverage report
```

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| 1,000 contacts audit | <30 seconds |
| 10,000 contacts audit | <2 minutes |
| Action plan generation | <5 seconds |
| Single action execution | <1 second |
| Full execution (100 actions) | <2 minutes |

---

## Definition of Done

### Per Epic:
- [ ] All acceptance criteria met
- [ ] Unit tests written and passing
- [ ] Integration tests passing (where applicable)
- [ ] Code follows project style (ESLint passes)
- [ ] Error handling covers edge cases
- [ ] Progress/output displays correctly
- [ ] **CLAUDE.md updated** with new patterns, commands, or architectural decisions (see table below)

### CLAUDE.md Update Guide

Update CLAUDE.md after each epic with things that require reading multiple files to understand:

| After completing... | Add to CLAUDE.md |
|---------------------|------------------|
| Epic 0 (Foundation) | Actual npm scripts, tsconfig settings, project structure |
| Epic 1 (Research) | Real API findings, rate limit specifics, required scopes, MCP decision |
| Epic 2 (Config) | Config file locations, schema overview, env var names |
| Epic 3 (HubSpot Service) | How to mock it in tests, error types, pagination patterns |
| Epic 4 (CLI) | Actual command examples, exit codes confirmed |
| Epic 5 (Claude Service) | Prompt patterns, token limits discovered, cost estimates |
| Epic 6 (Data Quality) | AuditModule interface, how to add new audit types |
| Epic 7 (Action Plans) | Plan file format, action types, confidence scoring |
| Epic 8 (Execution) | Rollback limitations, lock file location, execution record format |
| Phase 2 audits | Any new patterns or gotchas discovered |

**What NOT to add**: Things easily discoverable from a single file (function signatures, simple configs).

**How to update**: Run `/init` or ask Claude to "Update CLAUDE.md with patterns from [epic]"

### For Phase 1 MVP:
- [ ] All Phase 1 epics complete
- [ ] End-to-end workflow tested on real data
- [ ] Documentation covers all commands
- [ ] CLAUDE.md reflects actual codebase
- [ ] No known critical bugs

### For Phase 2 Complete:
- [ ] All audit types implemented
- [ ] Cross-cutting analysis works
- [ ] Report export works
- [ ] Performance targets met
- [ ] CLAUDE.md documents all audit module patterns

---

## Development Order

**Phase 1** (MVP):
```
Epic 0: Foundation ──┐
                     │
Epic 1: Research ────┼──► Epic 2: Config ──┐
                     │                     │
                     │                     ├──► Epic 4: CLI ──┐
                     │                     │                  │
                     └──► Epic 3: HubSpot ─┤                  ├──► Epic 6: Data Quality ──► Epic 7: Plans ──► Epic 8: Execution
                                           │                  │
                                           ├──► Epic 5: Claude┘
```

**Phase 2** (Expand):
```
Epic 6 Pattern ──► Epic 9: Duplicates
              ──► Epic 10: Properties
              ──► Epic 11: Lists
              ──► Epic 12: Marketing
              ──► Epic 13: Features
              ──► Epic 14: Orchestrator
              ──► Epic 15: Reports
```

---

## Next Steps

1. **Start Epic 0**: Initialize project, install dependencies, set up structure
2. **Complete Epic 1 (Research)**: Deep dive into HubSpot API and MCP before building
3. **Validate HubSpot access**: Set up test portal and Private App with necessary scopes
4. **Validate Anthropic access**: Ensure Claude API key works
5. **Build incrementally**: Complete each epic before moving to next
6. **Test with real data**: Use test HubSpot portal throughout

---

**This plan prioritizes shipping a working tool quickly while maintaining quality. Each phase delivers usable functionality.**
