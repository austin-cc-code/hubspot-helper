# HubSpot CLI Audit Tool

AI-powered CLI tool that audits HubSpot data, identifies issues, generates actionable fix plans, and executes changes safely with rollback capability.

## Features

- **Data Quality Audits**: Detect missing fields, invalid formats, stale data
- **Duplicate Detection**: Find and merge duplicate contacts/companies
- **Property Analysis**: Identify inconsistent values and unused properties
- **Marketing Optimization**: Identify contacts consuming marketing slots unnecessarily
- **AI-Powered Insights**: Claude provides context-aware recommendations
- **Safe Execution**: All changes require explicit approval with rollback support

## Safety Model

```
AUDIT (read-only) → PLAN (generate file) → REVIEW → APPROVE → EXECUTE
```

**The tool NEVER modifies HubSpot data automatically.** All changes require explicit user approval.

## Requirements

- Node.js 20 or higher (LTS recommended)
- HubSpot Private App access token
- Anthropic API key (for AI features)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd hubspot-helper

# Install dependencies
npm install

# Build the project
npm run build

# Link for global access (optional)
npm link
```

## Configuration

### 1. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_token
HUBSPOT_PORTAL_ID=your_portal_id
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 2. HubSpot Private App Setup

1. Go to HubSpot > Settings > Integrations > Private Apps
2. Create a new Private App
3. Configure the required scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.companies.read`
   - `crm.objects.companies.write`
   - `crm.schemas.contacts.read`
   - `crm.schemas.companies.read`
4. Copy the access token to your `.env` file

### 3. Configuration File (Optional)

Run the interactive setup wizard:

```bash
hubspot-audit config init
```

Or manually create `~/.hubspot-audit/config.yaml`:

```yaml
company:
  name: Your Company
  industry: Technology
  business_model: B2B

rules:
  required_contact_fields:
    - email
    - firstname
    - lastname
  stale_contact_days: 365
```

## Usage

```bash
# Show help
hubspot-audit --help

# Initialize configuration
hubspot-audit config init

# Run data quality audit (read-only, generates plan)
hubspot-audit audit contacts --check=data-quality

# Review the generated plan
hubspot-audit plan show ./audit-reports/data-quality-2025-01-15.json

# Execute the plan (requires confirmation)
hubspot-audit execute ./audit-reports/data-quality-2025-01-15.json

# Rollback if needed
hubspot-audit rollback exec-2025-01-15T10-30-00
```

## Development

```bash
# Run in development mode (with tsx)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format

# Build for production
npm run build
```

## Project Structure

```
src/
├── cli/           # CLI commands and interface
├── config/        # Configuration management
├── services/      # HubSpot and Claude API clients
├── audits/        # Audit modules (DataQuality, Duplicates, etc.)
├── actions/       # Action plan building and execution
├── reports/       # Report generation (terminal, JSON, HTML)
├── types/         # TypeScript type definitions
└── utils/         # Utilities (logging, validation)

tests/
├── unit/          # Unit tests (mocked dependencies)
├── integration/   # Integration tests (real APIs)
└── fixtures/      # Test data
```

## License

MIT
