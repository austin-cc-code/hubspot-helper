# HubSpot CLI Audit Tool - Ideation Document

## Executive Summary

### The Problem
Our HubSpot implementation has become messy and disorganized over time, leading to:
- Incomplete or invalid contact and company data
- Duplicate records across objects
- Inconsistent property usage
- Bloated, unused lists and segments
- Manual cleanup that's time-consuming and error-prone

### The Vision
A CLI tool that acts as an intelligent assistant for HubSpot data hygiene. It audits your HubSpot portal, identifies issues using AI-powered pattern recognition, helps you fix problems efficiently with clear previews and human oversight, and prevents future issues by automatically creating HubSpot workflows that maintain data quality.

### Core Value Proposition
**Automated Intelligence + Human Control + Prevention**: The tool combines Claude's AI capabilities to detect patterns and recommend fixes with a human-in-the-loop workflow that ensures you stay in control of all changes. Beyond cleanup, it learns from your data issues to automatically generate preventive HubSpot workflows that stop problems before they happen.

---

## Tool Capabilities & Features

### Audit Modules

#### 1. Data Quality Audits
Identifies issues with the completeness and validity of your HubSpot data:

- **Missing Required Fields**: Find contacts/companies lacking critical information (emails, names, lifecycle stage, etc.)
- **Invalid/Malformed Data**: Detect improperly formatted emails, phone numbers, dates, URLs
- **Outdated Information**: Identify stale data (old last contact dates, inactive companies)
- **Field Value Consistency**: Check for inconsistent formatting, casing, or conventions

**Example Output:**
```
Data Quality Issues Found: 247 across 1,832 contacts
├─ 123 contacts missing email addresses
├─ 89 contacts with invalid phone number formats
├─ 35 contacts missing company associations
└─ AI detected: 15 contacts with likely typos in job titles
```

#### 2. Duplicate Detection
Intelligently finds and helps merge duplicate records:

- **Contact Deduplication**: Identify duplicate contacts using fuzzy matching on names, emails, phone numbers
- **Company Deduplication**: Find duplicate companies by name, domain, or other identifiers
- **Merge Recommendations**: AI suggests which record to keep as primary and how to merge fields
- **Conflict Resolution**: Intelligent handling of conflicting data between duplicates

**Example Output:**
```
Duplicate Contacts Found: 34 potential matches
├─ High Confidence (95%+): 12 pairs
│  └─ john.smith@example.com vs john.smith@example.com (different lifecycle stages)
├─ Medium Confidence (75-95%): 18 pairs
│  └─ John Smith / J. Smith - same company, similar email
└─ Low Confidence (50-75%): 4 pairs (manual review recommended)
```

#### 3. Property Consistency
Ensures properties are used correctly and uniformly:

- **Property Usage Patterns**: Analyze how properties are being used across records
- **Custom Property Validation**: Check that custom properties follow expected formats
- **Property Mapping**: Identify similar properties that could be consolidated
- **Unused Properties**: Find properties that are rarely or never populated

**Example Output:**
```
Property Consistency Issues: 56 found
├─ "Industry" field has 23 different variations of "Technology"
│  └─ Suggested: Standardize to "Technology" (18), "Tech" (3), "IT" (2)
├─ Custom property "lead_source_custom" overlaps with standard "Lead Source"
│  └─ AI recommends: Migrate data and deprecate custom property
└─ 8 custom properties have <5% population rate
```

#### 4. List/Segment Hygiene
Cleans up and optimizes your lists and segments:

- **Unused List Detection**: Find lists that haven't been used in campaigns or workflows
- **Membership Overlap Analysis**: Identify redundant lists with significant member overlap
- **Broken Filter Criteria**: Detect lists with invalid filters or criteria
- **List Optimization**: AI suggests more efficient segmentation strategies

**Example Output:**
```
List/Segment Issues: 23 lists analyzed
├─ 7 lists unused for >6 months (1,234 total contacts)
├─ 4 list pairs with >90% member overlap
│  └─ "Q4 Newsletter" (543) vs "Newsletter Subscribers" (589) - 98% overlap
└─ 2 lists with broken filters (referencing deleted properties)
```

#### 5. Marketing Contact Optimization
Identifies opportunities to reduce marketing contact costs and clean up your contact database:

- **Inactive Marketing Contacts**: Find marketing contacts with no engagement
- **Non-Marketing Candidates**: Identify contacts that should be converted to non-marketing status
- **Cost Optimization**: Calculate potential savings from contact optimization
- **Deletion Candidates**: Find contacts safe to delete entirely

**Example Output:**
```
Marketing Contact Optimization Report

Current Status:
├─ Marketing contacts: 8,734 / 10,000 limit (87%)
├─ Monthly cost: ~$1,200
└─ Projected limit reached: 5 months

Inactive Marketing Contacts (1,456 contacts):
├─ No email opens in 12+ months: 892 contacts
├─ No email clicks in 12+ months: 1,234 contacts
├─ No form submissions in 12+ months: 1,345 contacts
└─ No page views in 12+ months: 678 contacts

Non-Marketing Contact Candidates (1,234 contacts):
├─ Unsubscribed but still marked as marketing: 567 contacts
│  └─ Cost savings: ~$227/month
├─ Employees/internal contacts: 89 contacts
│  └─ Cost savings: ~$36/month
├─ Competitors/vendors (not prospects): 45 contacts
│  └─ Cost savings: ~$18/month
├─ Invalid/bounced emails: 234 contacts
│  └─ Cost savings: ~$94/month
└─ Dormant leads (no activity in 24+ months): 299 contacts
   └─ Cost savings: ~$120/month

Deletion Candidates (789 contacts):
├─ Test/dummy contacts: 23 contacts
├─ Duplicates (after merge): 45 contacts
├─ Spam submissions: 156 contacts
├─ Bounced + no activity: 234 contacts
└─ GDPR/data retention violations: 331 contacts

AI Recommendations:
1. Convert 567 unsubscribed contacts to non-marketing (immediate)
2. Convert 89 internal contacts to non-marketing (immediate)
3. Review 299 dormant leads for conversion/deletion
4. Delete 789 contacts (low value, high confidence)

Total Potential Savings: ~$495/month
Improved engagement metrics: Bounce rate ↓, Open rate ↑

Generate action plan? [y/N]
```

---

## AI-Powered Recommendations

The tool leverages Claude to provide intelligent, context-aware recommendations:

### Pattern Recognition
- Analyzes your entire HubSpot portal to identify systemic issues
- Learns what "normal" looks like for your specific data
- Detects outliers and anomalies that rule-based systems would miss

### Confidence Scoring
Each recommendation includes a confidence score:
- **High (90-100%)**: Clear issues with obvious fixes
- **Medium (70-89%)**: Likely issues that may need review
- **Low (50-69%)**: Potential issues requiring manual investigation

### Natural Language Explanations
Instead of cryptic error codes, get clear explanations:
```
Issue: Contact "John Doe" (ID: 12345)
Confidence: 92%

Problem: This contact has lifecycle stage "Customer" but no associated deals.

Why this matters: Contacts marked as customers should typically have at least
one closed-won deal. This could indicate:
- The deal wasn't properly created or associated
- The lifecycle stage was manually updated incorrectly
- This is a legacy contact from a data import

Recommended action: Review contact history and either:
1. Create/associate the missing deal, or
2. Update lifecycle stage to accurate value
```

### Contextual Insights
AI considers relationships between objects:
- Cross-references contacts with their companies
- Analyzes deal pipelines and lifecycle stages
- Examines list memberships and engagement history
- Identifies patterns across similar records

---

## Action Execution System

### Preview Mode
Before any changes are made, see exactly what will happen:

```
Action Plan: contacts-data-quality-2025-12-18
Generated: 2025-12-18 at 10:34 AM
Total Actions: 247

Summary:
├─ 123 contacts: Add missing email addresses (from enrichment sources)
├─ 89 contacts: Fix phone number formatting to E.164 standard
└─ 35 contacts: Associate with companies based on email domain

Estimated API Calls: 247
Estimated Duration: ~2 minutes
Risk Level: Low (no data deletion, reversible changes)
```

### Batch Action Plans
Actions are organized into reviewable, executable plans:

1. **Generate**: Tool creates a JSON action plan with all proposed changes
2. **Review**: Examine the plan, filter actions, or modify before execution
3. **Execute**: Apply the approved changes with progress tracking
4. **Report**: Get a detailed summary of what was changed

**Action Plan Structure:**
```json
{
  "plan_id": "contacts-data-quality-2025-12-18",
  "created_at": "2025-12-18T10:34:00Z",
  "audit_type": "data_quality",
  "object_type": "contacts",
  "total_actions": 247,
  "actions": [
    {
      "action_id": "act_001",
      "type": "update_property",
      "confidence": 95,
      "target": {
        "object_type": "contact",
        "object_id": "12345",
        "name": "John Doe"
      },
      "changes": {
        "property": "phone",
        "current_value": "(555) 123-4567",
        "new_value": "+15551234567",
        "reason": "Standardize to E.164 format"
      },
      "reversible": true,
      "risk_level": "low"
    }
    // ... more actions
  ]
}
```

### Approval Workflow
Every execution requires explicit human confirmation:

```
$ hubspot-audit execute ./audit-reports/contacts-2025-12-18.json

Action Plan Summary:
- 247 total actions
- Risk Level: Low
- Estimated time: ~2 minutes

Do you want to proceed? [y/N]: y

Would you like to:
1. Execute all actions
2. Execute only high-confidence actions (90%+)
3. Review and filter actions first
4. Cancel

Selection: 2

Executing 198 high-confidence actions...
[Progress bar: 45/198 (23%) - ETA: 1m 15s]
```

### Rollback Capabilities
If something goes wrong, undo recent changes:

```
$ hubspot-audit rollback contacts-data-quality-2025-12-18

Rolling back 198 changes from plan: contacts-data-quality-2025-12-18
- Reverting property updates...
- Restoring original values...

Rollback complete: 198/198 actions reversed
```

---

## Workflow Automation & Prevention

While auditing and fixing existing issues is valuable, preventing problems from recurring is even better. The tool can analyze patterns in your data issues and automatically generate HubSpot workflows that prevent those issues from happening in the future.

### Preventive Workflow Generation

The tool learns from the issues it finds during audits and suggests automated workflows to prevent recurrence:

```bash
$ hubspot-audit contacts --check-data-quality --suggest-workflows

Found 247 issues across 1,832 contacts.

Preventive Workflow Recommendations:

1. Auto-format phone numbers (89 contacts affected)
   └─ Create workflow: "When phone number is updated, format to E.164"
   └─ Prevents: Invalid phone number formats
   └─ Estimated prevention: ~15 issues/week

2. Require company association (35 contacts affected)
   └─ Create workflow: "When contact is created, check for company domain match"
   └─ Prevents: Contacts missing company associations
   └─ Estimated prevention: ~5 issues/week

3. Validate email addresses (12 contacts affected)
   └─ Create workflow: "When email is added/updated, validate format and deliverability"
   └─ Prevents: Invalid email addresses
   └─ Estimated prevention: ~2 issues/week

Generate these workflows? [y/N]: y
```

### Workflow Types

#### 1. Data Validation Workflows
Automatically validate and correct data as it enters your system:

- **Format Standardization**
  - Phone numbers → E.164 format
  - Dates → ISO 8601 format
  - Country names → ISO codes
  - Text fields → Proper capitalization

- **Field Validation**
  - Email format and deliverability checks
  - URL validation
  - Numeric range validation
  - Required field enforcement

- **Cross-field Validation**
  - Lifecycle stage vs deal stage consistency
  - Company association requirements
  - Contact role vs company size logic

**Example Workflow:**
```
Workflow: "Standardize Phone Numbers"
Trigger: Contact property "phone" is updated
Actions:
1. Check if phone matches E.164 format
2. If not, attempt to parse and reformat
3. If successful, update phone property
4. If failed, send internal notification for manual review
5. Add "phone_validation_status" property value
```

#### 2. Duplicate Prevention Workflows
Stop duplicates before they're created:

- **Pre-creation Checks**
  - Check for existing contacts with same email before form submission
  - Scan for company name matches before creating new company
  - Alert when similar records exist

- **Auto-merge Workflows**
  - Automatically merge high-confidence duplicates
  - Consolidate list memberships
  - Preserve most recent/complete data

- **Alert Workflows**
  - Notify team when potential duplicate is detected
  - Require manual review for medium-confidence matches

**Example Workflow:**
```
Workflow: "Prevent Duplicate Contacts"
Trigger: Contact is created
Actions:
1. Search for contacts with same email address
2. If exact match found:
   - Do not create new contact
   - Update existing contact with new data
   - Log merge event
3. If fuzzy match found (similar name, company):
   - Create task for sales rep to review
   - Tag contact as "potential_duplicate"
```

#### 3. Data Enrichment Workflows
Automatically fill in missing data:

- **Domain-based Enrichment**
  - Extract company from email domain
  - Look up company info from domain
  - Auto-associate contacts with companies

- **Pattern-based Enrichment**
  - Infer lifecycle stage from behavior
  - Set contact owner based on territory rules
  - Auto-assign to lists based on properties

- **Integration Enrichment**
  - Pull data from external APIs (Clearbit, ZoomInfo)
  - Sync with other systems
  - Cross-reference internal databases

**Example Workflow:**
```
Workflow: "Auto-associate Contacts with Companies"
Trigger: Contact is created with email address
Actions:
1. Extract domain from email address
2. Search for company with matching domain
3. If found:
   - Associate contact with company
   - Inherit company properties (industry, size, etc.)
4. If not found:
   - Check external company database
   - Create company record if high confidence
5. Log enrichment activity
```

#### 4. Property Standardization Workflows
Maintain consistency in property values:

- **Value Normalization**
  - Standardize industry names
  - Consolidate product interests
  - Clean up custom field entries

- **Dropdown Enforcement**
  - Convert free-text to dropdown values
  - Map variations to standard values
  - Flag unrecognized values for review

- **Bulk Standardization**
  - Find and fix variations automatically
  - Update historical records
  - Prevent new variations from being created

**Example Workflow:**
```
Workflow: "Standardize Industry Property"
Trigger: Contact property "industry" is updated
Actions:
1. Check value against standardization map:
   - "Tech", "IT", "Software" → "Technology"
   - "Healthcare", "Medical" → "Healthcare"
   - etc.
2. If match found, update to standard value
3. If no match, check with AI for suggestion
4. If still uncertain, flag for manual review
```

#### 5. List Hygiene Workflows
Keep lists clean and up-to-date automatically:

- **Automatic Removal**
  - Remove bounced emails from lists
  - Remove unsubscribed contacts
  - Remove inactive contacts after period

- **Dynamic List Optimization**
  - Update list criteria based on engagement
  - Remove redundant list memberships
  - Consolidate overlapping lists

- **List Quality Monitoring**
  - Track list health metrics over time
  - Alert when list quality degrades
  - Suggest list cleanup actions

**Example Workflow:**
```
Workflow: "Remove Bounced Contacts from Marketing Lists"
Trigger: Contact email bounces (marketing email bounced event)
Actions:
1. Check bounce type (hard vs soft)
2. If hard bounce:
   - Remove from all marketing lists
   - Set email status to "invalid"
   - Notify contact owner
3. If soft bounce (3+ times):
   - Flag for review
   - Reduce email frequency
```

#### 6. Data Quality Monitoring Workflows
Continuously monitor and maintain data quality:

- **Quality Score Tracking**
  - Calculate data completeness score per contact/company
  - Track quality trends over time
  - Alert when quality drops

- **Field Validation Rules**
  - Enforce business rules
  - Prevent invalid data entry
  - Guide users to correct formats

- **Automated Cleanup**
  - Schedule regular data quality checks
  - Auto-fix common issues
  - Generate reports on data health

**Example Workflow:**
```
Workflow: "Monitor Contact Data Quality"
Trigger: Daily at 9 AM (scheduled)
Actions:
1. For each contact, calculate quality score:
   - Required fields filled: +20 points each
   - Valid email/phone: +10 points each
   - Recent activity: +5 points
   - Associated company: +15 points
2. If quality score < 50:
   - Create task for contact owner
   - Add to "Low Quality Contacts" list
3. Generate daily quality report
4. Email summary to marketing ops team
```

### AI-Powered Workflow Suggestions

The tool uses AI to analyze your specific data patterns and suggest custom workflows:

```bash
$ hubspot-audit analyze-patterns --suggest-workflows

Analyzing 6 months of data changes and issues...

AI-Identified Patterns:

1. Pattern: 78% of contacts from "Contact Us" form are missing lifecycle stage
   ├─ Root Cause: Form doesn't include lifecycle stage field
   ├─ Impact: High (affects reporting and automation)
   └─ Suggested Workflow:
       "When contact is created from 'Contact Us' form,
        set lifecycle stage to 'MQL' and notify sales team"

2. Pattern: Contacts from partner referrals often have incomplete data
   ├─ Root Cause: Partner integration doesn't map all fields
   ├─ Impact: Medium (15 contacts/month)
   └─ Suggested Workflow:
       "When contact source is 'Partner Referral',
        trigger enrichment workflow and assign to partner manager"

3. Pattern: Industry property variations spike after trade show imports
   ├─ Root Cause: Badge scans capture inconsistent industry values
   ├─ Impact: Medium (affects segmentation)
   └─ Suggested Workflow:
       "After bulk import, run industry standardization
        and generate cleanup report for review"

4. Pattern: Duplicate contacts created when same person fills multiple forms
   ├─ Root Cause: Form submissions create new contacts instead of updating
   ├─ Impact: High (12 duplicates/week)
   └─ Suggested Workflow:
       "Before creating contact from form submission,
        check for existing contact with same email and update instead"

Generate recommended workflows? [y/N]: y

Creating 4 workflows...
├─ Workflow 1: "Auto-set MQL stage for Contact Us form" ✓
├─ Workflow 2: "Enrich partner referral contacts" ✓
├─ Workflow 3: "Standardize industry after import" ✓
└─ Workflow 4: "Prevent form submission duplicates" ✓

All workflows created and activated.
Monitor effectiveness with: hubspot-audit workflows --monitor
```

### Workflow Management Commands

Manage your data quality workflows directly from the CLI:

```bash
# Generate workflows based on audit findings
$ hubspot-audit workflows --generate-from-audit contacts-2025-12-18.json

# List all data quality workflows
$ hubspot-audit workflows --list

# Monitor workflow effectiveness
$ hubspot-audit workflows --monitor

# Update workflow rules
$ hubspot-audit workflows --update "Standardize Phone Numbers" --add-format="+44"

# Disable/enable workflows
$ hubspot-audit workflows --disable "Prevent Duplicate Contacts"
$ hubspot-audit workflows --enable "Prevent Duplicate Contacts"

# Export workflow configurations
$ hubspot-audit workflows --export ./workflows-backup.json

# Import workflow configurations (e.g., to staging environment)
$ hubspot-audit workflows --import ./workflows-backup.json
```

### Workflow Effectiveness Tracking

Monitor how well your preventive workflows are working:

```bash
$ hubspot-audit workflows --monitor --timeframe="30 days"

Workflow Effectiveness Report (Last 30 Days)

1. "Standardize Phone Numbers"
   ├─ Status: Active
   ├─ Executions: 234
   ├─ Success Rate: 97% (227/234)
   ├─ Issues Prevented: ~187 (estimated)
   ├─ Time Saved: ~3.1 hours
   └─ Impact: High ⭐⭐⭐

2. "Prevent Duplicate Contacts"
   ├─ Status: Active
   ├─ Executions: 89
   ├─ Duplicates Prevented: 67
   ├─ False Positives: 3 (manually reviewed)
   ├─ Time Saved: ~5.6 hours
   └─ Impact: Very High ⭐⭐⭐⭐

3. "Auto-associate with Companies"
   ├─ Status: Active
   ├─ Executions: 156
   ├─ Successful Associations: 142 (91%)
   ├─ Manual Review Required: 14
   ├─ Time Saved: ~2.8 hours
   └─ Impact: Medium ⭐⭐

Overall Impact:
├─ Total issues prevented: ~334
├─ Total time saved: ~11.5 hours
├─ Data quality improvement: +18%
└─ Manual cleanup reduction: 67%

Recommendations:
├─ Workflow "Auto-associate with Companies" has 9% failure rate
│  └─ Consider adding external company database lookup
└─ Create new workflow for standardizing industry values (23 variations detected)
```

### Integration with Audit Findings

Workflows are automatically suggested based on audit patterns:

```
┌─────────────────────────────────────────────────────────┐
│  Audit Results → Pattern Analysis → Workflow Generation │
└─────────────────────────────────────────────────────────┘

1. Run audit: Find 89 contacts with invalid phone formats
2. AI analyzes: "Phone formatting is a recurring issue"
3. Tool suggests: "Create phone standardization workflow"
4. User approves: Workflow is deployed to HubSpot
5. Future prevention: New phone numbers are auto-formatted
6. Monitor: Track workflow effectiveness
7. Iterate: Refine workflow rules based on results
```

### Example: Complete Prevention Workflow

**Scenario**: You keep finding contacts missing critical information after trade show imports.

```bash
# Step 1: Run audit after import
$ hubspot-audit contacts --created-after="1 hour ago" --comprehensive

Found 127 newly imported contacts with issues...

# Step 2: Analyze patterns
$ hubspot-audit analyze-patterns --suggest-workflows

AI detected: Trade show imports consistently missing lifecycle stage,
phone formatting issues, and missing company associations.

# Step 3: Generate preventive workflows
Generate prevention workflows? [y/N]: y

Creating workflows:
├─ "Post-import data enrichment" ✓
├─ "Trade show contact validation" ✓
└─ "Auto-format trade show phone numbers" ✓

# Step 4: Configure workflow
$ hubspot-audit workflows --configure "Post-import data enrichment"

Configure: Post-import data enrichment
├─ Trigger: Contact source contains "Trade Show"
├─ Actions:
│  1. Set lifecycle stage to "Lead"
│  2. Format phone number to E.164
│  3. Look up company from email domain
│  4. Add to "Trade Show Follow-up" list
│  5. Assign to trade show coordinator
└─ Notification: Email report to marketing ops

Save and activate? [y/N]: y

# Step 5: Test on next import
(Next trade show import happens...)

# Step 6: Monitor results
$ hubspot-audit workflows --monitor "Post-import data enrichment"

Workflow: Post-import data enrichment
Last Import: 84 contacts from "Tech Summit 2025"
├─ All 84 contacts processed successfully
├─ 0 missing lifecycle stages (was: 23)
├─ 0 phone format issues (was: 15)
├─ 78 automatically associated with companies (was: 35)
└─ Cleanup time saved: ~2.3 hours

Success! This workflow is preventing the issues you found in previous imports.
```

### Workflow Library & Templates

The tool includes pre-built workflow templates for common scenarios:

- **New Contact Hygiene**: Validate and enrich all new contacts
- **Duplicate Prevention**: Stop duplicates before they're created
- **Form Submission Cleanup**: Standardize data from form submissions
- **Import Data Validation**: Clean up bulk imports automatically
- **Property Standardization**: Maintain consistent property values
- **List Maintenance**: Keep lists clean and relevant
- **Lifecycle Management**: Ensure lifecycle stages match reality
- **Data Decay Prevention**: Monitor and refresh stale data

Users can customize templates or create workflows from scratch based on audit findings.

---

## User Experience Flows

### Interactive Mode (Guided Workflow)

For exploratory audits and when you're not sure what you're looking for:

```bash
$ hubspot-audit

╔═══════════════════════════════════════╗
║   HubSpot Audit Tool                  ║
║   AI-Powered Data Hygiene Assistant   ║
╚═══════════════════════════════════════╝

What would you like to audit?
  1. Contacts
  2. Companies
  3. Lists/Segments
  4. Properties
  5. Comprehensive audit (all objects)

Selection: 1

Which contact audit would you like to run?
  1. Data quality check
  2. Find duplicates
  3. Property consistency
  4. All of the above

Selection: 1

Scanning 1,832 contacts...
[Progress bar: 100%]

Analysis complete! Found 247 issues.

Would you like to:
  1. View summary by issue type
  2. View detailed findings
  3. Generate action plan
  4. Export report

Selection: 3

Generating action plan with AI recommendations...
Action plan saved: ./audit-reports/contacts-2025-12-18.json

Review the plan and execute with:
  hubspot-audit execute ./audit-reports/contacts-2025-12-18.json
```

### Command Mode (Scriptable)

For automated workflows and when you know what you want:

```bash
# Run specific audits
$ hubspot-audit contacts --check-data-quality
$ hubspot-audit companies --find-duplicates
$ hubspot-audit lists --cleanup-unused
$ hubspot-audit properties --find-inconsistencies

# Comprehensive audits
$ hubspot-audit all --output=./reports/

# Execute action plans
$ hubspot-audit execute ./audit-reports/contacts-2025-12-18.json

# Rollback changes
$ hubspot-audit rollback contacts-2025-12-18

# Generate reports
$ hubspot-audit report --format=html --open
$ hubspot-audit report --format=csv --output=./reports/

# Scheduling (via cron)
0 9 * * 1 hubspot-audit contacts --weekly-check --notify-email
```

### Hybrid Approach

Switch between modes as needed:

```bash
# Start in interactive mode
$ hubspot-audit

# Tool remembers your session and generates commands
> Last session: contacts-data-quality-2025-12-18.json
> To re-run this audit, use:
  hubspot-audit contacts --check-data-quality

# Use commands for repetitive tasks
$ hubspot-audit contacts --check-data-quality --auto-plan

# Interactive review before execution
$ hubspot-audit execute ./audit-reports/contacts-2025-12-18.json
> [Interactive prompts for confirmation...]
```

---

## Technical Architecture (Conceptual)

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Interface Layer                     │
│  (Commander.js, Inquirer for interactive prompts)           │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
┌─────────────▼────────────┐    ┌────────────▼──────────────┐
│   HubSpot Integration    │    │    AI Integration         │
│  - API Client            │    │  - Claude API/MCP         │
│  - MCP Server            │    │  - Recommendation Engine  │
│  - Rate Limiting         │    │  - Pattern Analysis       │
│  - Authentication        │    │  - Explanation Generator  │
└─────────────┬────────────┘    └────────────┬──────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Audit Engine     │
                    │  - Rule Engine     │
                    │  - Data Validators │
                    │  - Analyzers       │
                    └─────────┬──────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
┌─────────────▼────────────┐    ┌────────────▼──────────────┐
│   Action Planner         │    │   Execution Engine        │
│  - Plan Generator        │    │  - Change Applicator      │
│  - Confidence Scoring    │    │  - Progress Tracker       │
│  - Risk Assessment       │    │  - Error Handler          │
└─────────────┬────────────┘    │  - Rollback Manager       │
              │                 └────────────┬──────────────┘
              │                              │
              └───────────────┬──────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Reporting System  │
                    │  - Report Generator│
                    │  - Format Exports  │
                    │  - Change History  │
                    └────────────────────┘
```

### Data Flow

1. **User Initiates Audit**
   - Via interactive prompts or command-line arguments
   - Tool validates parameters and authenticates with HubSpot

2. **Data Fetching**
   - Tool fetches relevant data from HubSpot via API/MCP
   - Implements pagination and rate limiting
   - Caches data locally for analysis

3. **Audit Analysis**
   - Rule-based validators check for common issues
   - AI analyzes patterns and detects anomalies
   - Results are aggregated and categorized by type/severity

4. **AI Recommendations**
   - Claude analyzes findings in context
   - Generates fix recommendations with confidence scores
   - Provides natural language explanations

5. **Action Plan Generation**
   - Tool creates structured action plan
   - Assesses risk level for each action
   - Estimates execution time and API usage

6. **User Review & Approval**
   - Present findings and action plan to user
   - Allow filtering, modification, or selective execution
   - Require explicit confirmation before proceeding

7. **Execution**
   - Apply approved changes via HubSpot API
   - Track progress and handle errors gracefully
   - Log all changes for rollback capability

8. **Reporting**
   - Generate completion report
   - Export in multiple formats (JSON, CSV, HTML)
   - Store change history for audit trail

### Safety & Reliability

#### Built-in Safeguards
- **Dry-run by default**: All commands preview changes unless `--apply` flag is used
- **Rate limiting**: Respects HubSpot API limits automatically
- **Error handling**: Graceful failures with clear error messages
- **Retry logic**: Automatic retries for transient failures
- **Transaction logging**: Complete audit trail of all changes
- **Rollback support**: Ability to undo recent changes

#### Data Protection
- **No destructive defaults**: Never deletes data without explicit confirmation
- **Backup recommendations**: Suggests HubSpot backup before major operations
- **Staging support**: Test against sandbox portals before production
- **Incremental execution**: Apply changes in batches with checkpoints

#### Progress Tracking
- **Real-time progress bars**: Visual feedback for long operations
- **Resumable operations**: Can pause and resume long-running audits
- **Detailed logging**: Comprehensive logs for troubleshooting
- **Status persistence**: Save audit state between sessions

---

## Key Features & Differentiators

### AI-Powered Intelligence

#### Context-Aware Analysis
Unlike rule-based tools, the AI understands context:
- Recognizes that "missing company" matters more for B2B vs B2C contacts
- Detects that identical names might be legitimate (e.g., "John Smith")
- Understands industry-specific naming conventions and formats

#### Learning from Your Data
The AI adapts to your specific HubSpot portal:
- Learns what "normal" looks like for your organization
- Recognizes your custom properties and their purposes
- Understands your lifecycle stage definitions and workflows

#### Complex Problem Solving
AI can tackle issues that require reasoning:
- "These 5 contacts should probably be merged, but keep the most recent engagement data"
- "This list is redundant, but these 3 contacts are only in this list - keep them"
- "This company name is misspelled in 12 different ways across contacts"

#### Natural Language Explanations
Every finding includes a human-readable explanation:
- What the issue is
- Why it matters
- How it affects your HubSpot usage
- What the recommended fix does

### Human-in-the-Loop Design

#### Never Automatic
The tool never makes changes without your approval:
- All audits generate action plans first
- You review before any changes are applied
- You can modify or filter actions before execution
- Rollback available if something unexpected happens

#### Clear Previews
Always know exactly what will change:
- See before/after values for all updates
- Understand impact on associated objects
- View API call estimates and execution time
- Assess risk level for each action

#### Granular Control
Choose your level of involvement:
- Execute all actions at once
- Execute only high-confidence actions
- Review and approve each action individually
- Modify action plans before execution

#### Rollback Safety Net
Made a mistake? Undo it:
- Rollback entire action plans
- Rollback individual changes
- View rollback history
- Restore specific property values

### Flexibility & Extensibility

#### Multiple Use Cases Supported
- **Quick spot-checks**: "Find duplicates in this list"
- **Comprehensive audits**: "Analyze everything in my portal"
- **Scheduled maintenance**: Run weekly via cron
- **Pre-campaign validation**: Check list quality before sends
- **Data import cleanup**: Fix issues after bulk imports

#### Scriptable Automation
Integrate into workflows:
- CI/CD pipelines for HubSpot configuration management
- Scheduled audits with email notifications
- Automated reporting for data quality metrics
- Webhook triggers for real-time validation

#### Extensible Rules
Add your own audit logic:
- Custom data quality rules
- Industry-specific validations
- Company-specific naming conventions
- Integration with external data sources

#### Supports Different Workflows
- **Exploratory**: Interactive mode for investigation
- **Expert**: Command-line for power users
- **Automated**: Scheduled execution without interaction
- **Collaborative**: Generate reports for team review

### Prevention Over Cure

#### Automated Workflow Generation
Goes beyond fixing problems to preventing them:
- Analyzes audit findings to identify recurring patterns
- AI suggests specific HubSpot workflows to prevent future issues
- Automatically creates workflows via HubSpot API/MCP
- Monitors workflow effectiveness and suggests refinements

#### Learns From Your Issues
The tool gets smarter over time:
- Identifies systemic problems vs one-off issues
- Detects root causes of data quality problems
- Suggests process improvements, not just data fixes
- Builds a library of preventive workflows specific to your portal

#### Closes the Loop
Creates a continuous improvement cycle:
- Audit → Fix → Learn → Prevent → Monitor → Refine
- Each audit makes future audits cleaner
- Reduces manual intervention over time
- Transforms reactive cleanup into proactive quality management

---

## Example Use Cases

### Use Case 1: Weekly Contact Hygiene Routine

**Scenario**: Every Monday, you want to ensure new contacts from the previous week are clean.

```bash
# Run automated weekly check
$ hubspot-audit contacts --weekly-check --created-after="7 days ago"

Analyzing 127 contacts created in the last 7 days...

Issues Found:
├─ 23 contacts missing lifecycle stage
├─ 15 contacts with invalid phone formats
├─ 8 potential duplicates with existing contacts
└─ 5 contacts missing company associations

AI Insights:
├─ Detected pattern: Most new contacts from form "Contact Us"
│  are missing lifecycle stage (recommend: add to form field)
└─ 3 contacts appear to be test submissions (emails contain "test")

Generate action plan? [y/N]: y

Action plan saved: ./audit-reports/weekly-check-2025-12-18.json
High confidence actions: 31/51 (61%)

Execute high confidence actions now? [y/N]: y
```

**Outcome**: Keeps your database clean with minimal manual effort. AI learns patterns and suggests process improvements.

### Use Case 2: Pre-Campaign List Validation

**Scenario**: Before launching a newsletter to 2,000 contacts, validate the list quality.

```bash
# Audit specific list
$ hubspot-audit list "Q1 2025 Newsletter" --validate

Analyzing list: Q1 2025 Newsletter (2,047 members)

Issues Found:
├─ 89 contacts with invalid/missing email addresses
├─ 23 contacts have opted out or unsubscribed
├─ 15 contacts are marked as bounced in previous campaigns
└─ 7 contacts are duplicates (would receive multiple emails)

Segment Optimization Suggestions:
├─ Remove bounced/unsubscribed: -38 contacts
├─ Fix/verify invalid emails: 89 contacts need review
├─ Merge duplicates: -7 contacts
└─ Estimated clean list size: ~1,920 contacts

Campaign Impact Estimate:
├─ Current deliverability: ~91.5%
├─ After cleanup: ~99.6%
└─ Bounce rate reduction: ~8.1%

Generate cleanup action plan? [y/N]: y
```

**Outcome**: Prevents sending to invalid contacts, improves deliverability, protects sender reputation.

### Use Case 3: Property Standardization Project

**Scenario**: Your team has been inconsistent with the "Industry" property - you want to standardize it.

```bash
# Analyze property usage
$ hubspot-audit properties --property="Industry" --analyze

Analyzing property: Industry (1,832 contacts)

Value Distribution:
├─ "Technology": 456 contacts
├─ "Tech": 234 contacts
├─ "IT": 89 contacts
├─ "Software": 123 contacts
├─ "SaaS": 67 contacts
├─ [... 18 more variations of technology-related values]
└─ Empty/Null: 234 contacts

AI Analysis:
Detected 23 variations that likely refer to the same industry category.

Standardization Recommendations:
1. "Technology" cluster (969 contacts):
   - Consolidate: Tech, IT, Software, SaaS, Information Technology
   - Recommended value: "Technology"

2. "Healthcare" cluster (234 contacts):
   - Consolidate: Healthcare, Health Care, Medical, Healthcare Services
   - Recommended value: "Healthcare"

[... more clusters ...]

Confidence: 92% - High confidence standardization rules

Generate standardization action plan? [y/N]: y
```

**Outcome**: Creates consistency in property values, improves reporting and segmentation accuracy.

### Use Case 4: Post-Import Cleanup

**Scenario**: You just imported 500 contacts from a trade show and need to clean up the data.

```bash
# Audit recently imported contacts
$ hubspot-audit contacts --created-after="1 hour ago" --comprehensive

Analyzing 487 recently imported contacts...

Import Quality Assessment:
├─ Overall data completeness: 67%
├─ Contacts with missing critical fields: 234 (48%)
└─ Potential issues requiring attention: 312

Issues by Category:
├─ Missing Data (234 contacts)
│  ├─ No phone number: 189
│  ├─ No company: 145
│  └─ No job title: 98
│
├─ Data Quality (78 contacts)
│  ├─ Invalid email formats: 12
│  ├─ Malformed phone numbers: 45
│  └─ Suspicious/test data: 21
│
└─ Duplicates (67 contacts)
   └─ Match existing contacts in CRM: 67

AI Insights:
├─ Import source appears to be trade show badge scan
├─ Many phone numbers in European format (not E.164)
├─ 21 contacts have placeholder emails (@example.com, @test.com)
└─ Recommend: Enrich company data via domain lookup

Enrichment Opportunities:
├─ 145 contacts missing company - can enrich from email domain
├─ 98 contacts missing job title - can infer from LinkedIn (manual)
└─ Data enrichment services could fill ~60% of gaps

Generate action plan with enrichment? [y/N]: y
```

**Outcome**: Quickly cleans up bulk imports, identifies enrichment opportunities, prevents duplicate creation.

### Use Case 5: Duplicate Contact Resolution

**Scenario**: You suspect there are many duplicate contacts and want to clean them up.

```bash
# Find duplicates with AI-powered matching
$ hubspot-audit contacts --find-duplicates --smart-matching

Scanning 1,832 contacts for duplicates...
Using AI-powered fuzzy matching...

Duplicate Groups Found: 43 groups (102 total duplicate contacts)

High Confidence Matches (34 groups):
├─ john.smith@example.com (ID: 123) ↔ john.smith@example.com (ID: 456)
│  ├─ Confidence: 98%
│  ├─ Same email, different lifecycle stages (MQL vs Customer)
│  └─ AI recommends: Merge into 456 (more recent activity)
│
├─ Jane Doe / Jane M. Doe (ID: 789, 012)
│  ├─ Confidence: 94%
│  ├─ Same company, phone, similar names
│  └─ AI recommends: Merge into 789 (more complete data)

Medium Confidence Matches (9 groups):
├─ Bob Johnson (ID: 345) ↔ Robert Johnson (ID: 678)
│  ├─ Confidence: 78%
│  ├─ Different emails but same company and phone
│  └─ AI suggests: Manual review (could be two people)

Merge Strategy:
├─ High confidence (34 groups): Auto-merge with review
├─ Medium confidence (9 groups): Manual review recommended
└─ Total contacts after deduplication: 1,730 (-102)

Generate merge action plan? [y/N]: y

Action plan will include:
├─ Field merge strategy (keep most recent data)
├─ Associated object handling (deals, tickets, etc.)
├─ List membership consolidation
└─ Activity history merge

Proceed? [y/N]: y
```

**Outcome**: Eliminates duplicates intelligently, preserves important data, cleans up database.

### Use Case 6: Complete Audit-Fix-Prevent Cycle

**Scenario**: You notice data quality issues and want to fix them permanently.

```bash
# Week 1: Initial audit discovers issues
$ hubspot-audit contacts --comprehensive

Found 456 issues across 1,832 contacts:
├─ 234 missing lifecycle stages
├─ 127 invalid phone formats
├─ 95 missing company associations

AI Pattern Analysis:
├─ 78% of "missing lifecycle stage" contacts came from "Contact Us" form
├─ 85% of phone format issues from manual entry (not form submissions)
└─ 67% of missing companies could be auto-associated via email domain

Recommendations:
1. Fix current issues (generate action plan)
2. Create 3 preventive workflows to stop recurrence

Generate action plan and workflows? [y/N]: y

# Fix existing issues
Action plan created: 456 fixes
Execute? [y/N]: y
✓ Fixed 456 issues in 3 minutes

# Create preventive workflows
Creating workflows:
├─ "Auto-set lifecycle stage from Contact Us form" ✓
├─ "Standardize phone numbers on entry" ✓
└─ "Auto-associate contacts with companies" ✓

Workflows deployed and active.

# Week 2: Run audit again
$ hubspot-audit contacts --comprehensive

Found 12 issues across 1,889 contacts:
├─ 8 missing lifecycle stages (down from 234)
├─ 3 invalid phone formats (down from 127)
├─ 1 missing company association (down from 95)

Workflow Impact:
├─ Prevented ~47 issues this week
├─ 97% reduction in new issues
└─ Time saved: ~4 hours

AI detected: The 8 remaining lifecycle stage issues are from
a different form ("Newsletter Signup"). Suggest extending workflow?

Extend workflow to cover "Newsletter Signup" form? [y/N]: y
✓ Workflow updated

# Week 6: Check progress
$ hubspot-audit contacts --comprehensive --compare="6 weeks ago"

Found 3 issues across 2,104 contacts:
├─ 2 missing lifecycle stages (down 99% from 234)
├─ 1 invalid phone format (down 99% from 127)
├─ 0 missing company associations (down 100% from 95)

Overall Data Quality: 99.7% (up from 92.1%)

Workflow Performance:
├─ Total issues prevented: ~276 over 6 weeks
├─ Total time saved: ~23 hours
├─ Manual cleanup: Nearly eliminated
└─ All workflows performing at 98%+ effectiveness

Your HubSpot data is now maintaining itself! 🎉

Next steps:
- Expand audits to Companies and Lists
- Add more advanced workflows as needed
- Monitor quarterly for any new patterns
```

**Outcome**: Transforms one-time cleanup into sustained data quality through automation. The tool learns from problems, prevents recurrence, and reduces ongoing manual effort to near zero.

### Use Case 7: Marketing Contact Cost Optimization

**Scenario**: Your HubSpot bill is increasing and you're approaching contact limits.

```bash
$ hubspot-audit contacts --optimize-marketing-contacts

Analyzing marketing contact usage...

Current Status:
├─ Marketing contacts: 9,234 / 10,000 limit (92%)
├─ Estimated monthly cost: ~$1,350
├─ Growth rate: +234 contacts/month
└─ ⚠️  Will hit limit in 3 months

Marketing Contact Analysis:

Inactive Contacts (1,678 contacts):
├─ No email engagement in 12+ months: 1,245 contacts
├─ Never opened an email: 234 contacts
├─ Unsubscribed >6 months ago: 199 contacts

Non-Marketing Candidates (1,456 contacts - $583/month savings):
├─ HIGH CONFIDENCE (892 contacts - $357/month)
│  ├─ Unsubscribed: 567 contacts
│  ├─ Hard bounced: 234 contacts
│  └─ Internal employees: 91 contacts
│
└─ MEDIUM CONFIDENCE (564 contacts - $226/month)
   ├─ Dormant 18+ months: 345 contacts
   ├─ Competitors/vendors: 67 contacts
   └─ Wrong target audience: 152 contacts

Deletion Candidates (543 contacts):
├─ Test contacts: 23 contacts
├─ Duplicate (post-merge): 78 contacts
├─ Spam submissions: 234 contacts
└─ Data retention violations: 208 contacts

AI Recommendations:

Priority 1 (Do immediately):
├─ Convert 567 unsubscribed to non-marketing
├─ Convert 234 bounced emails to non-marketing
├─ Convert 91 internal employees to non-marketing
└─ Savings: $357/month, frees 892 contact slots

Priority 2 (Review & execute):
├─ Review 345 dormant leads
│  └─ AI suggests: 78% can be safely converted
├─ Manual check: 67 competitors/vendors
└─ Potential savings: $176/month, 467 contact slots

Priority 3 (Delete):
├─ Delete 543 low-value contacts
└─ Frees: 543 contact slots

Impact Summary:
├─ Total potential savings: $533/month ($6,396/year)
├─ Contact slots freed: 1,902 (extends runway by 8+ months)
├─ Improved email metrics: Higher open rates, lower bounce rates
└─ Better deliverability: Cleaner sender reputation

Create optimization action plan? [y/N]: y

Action Plan Created: marketing-optimization-2025-12-18.json
├─ 892 high-confidence conversions (auto-execute recommended)
├─ 564 medium-confidence (manual review suggested)
└─ 543 deletions (high confidence)

Execute high-confidence actions now? [y/N]: y

Executing...
├─ Converting 892 contacts to non-marketing ✓
├─ Updating contact properties ✓
├─ Removing from marketing lists ✓
└─ Creating workflow to prevent future issues ✓

Complete!
├─ Monthly savings: $357
├─ Annual savings: $4,284
├─ New marketing contact usage: 8,342 / 10,000 (83%)
├─ Runway extended: From 3 months to 7+ months

Preventive Workflow Created: "Marketing Contact Gatekeeper"
└─ Automatically converts unsubscribed/bounced contacts to non-marketing

Schedule monthly optimization check? [y/N]: y
```

**Outcome**: Immediate cost savings of $357/month with potential for $533/month total. Extends contact limit runway and improves email deliverability. Automated workflow prevents future bloat.

---

## Success Metrics

### Quantitative Metrics
- **Time Saved**: Hours of manual cleanup eliminated per week
- **Issues Resolved**: Number of data quality issues fixed
- **Duplicates Removed**: Reduction in duplicate contact/company records
- **Data Completeness**: Percentage improvement in filled critical fields
- **API Efficiency**: Reduction in unnecessary API calls from clean data
- **Issues Prevented**: Number of issues stopped by automated workflows
- **Workflow Effectiveness**: Success rate and impact of preventive workflows
- **Cleanup Reduction**: Percentage decrease in manual intervention over time

### Qualitative Metrics
- **User Satisfaction**: Confidence in HubSpot data quality
- **Recommendation Accuracy**: Usefulness of AI suggestions
- **Adoption Rate**: Frequency of tool usage and action plan execution
- **Process Improvement**: Number of systemic issues identified and fixed
- **Campaign Performance**: Improvement in email deliverability and engagement

### Example Dashboard
```
HubSpot Data Health Score: 87/100 (↑ 23 points from last month)

├─ Contact Data Quality: 92/100
│  └─ 1,687 of 1,832 contacts have complete critical fields (92%)
│
├─ Duplicate Records: 95/100
│  └─ Only 12 potential duplicates remaining (down from 102)
│
├─ Property Consistency: 78/100
│  └─ 3 properties still have inconsistent values (down from 8)
│
└─ List Hygiene: 85/100
   └─ 4 unused lists remaining (down from 11)

Action Items:
├─ Review 12 potential duplicate pairs (medium confidence)
├─ Standardize "Industry" property (312 contacts affected)
└─ Archive 4 unused lists

Estimated cleanup time: 45 minutes
```

---

## Next Steps

### 1. Review & Refine This Document
- Validate the features align with your needs
- Identify any missing capabilities
- Prioritize features for initial development

### 2. MVP Feature Selection
Recommend starting with:
- **Core audits**: Data quality, duplicates, property consistency, list hygiene, **marketing contact optimization**
- **AI-powered recommendations** via Claude with pattern analysis
- **Action plan generation** with preview and human approval
- **Execution with rollback** for safe changes
- **Basic workflow generation** (2-3 preventive workflow types)
- **Smart alerts** for proactive anomaly detection
- **Bulk operations** for mass updates and transformations

This provides immediate value through:
- **Cost savings**: Marketing contact optimization (~$495/month potential savings)
- **Time savings**: Bulk operations instead of manual clicking
- **Problem prevention**: Workflows + alerts stop issues before they happen
- **Foundation**: Establishes core architecture for v2 features

### 3. Technical Setup
- Set up TypeScript/Node.js project
- Configure HubSpot API access and MCP server for data + workflow management
- Integrate Claude API/MCP for AI capabilities
- Choose CLI framework (Commander.js, Oclif, etc.)
- Research HubSpot Workflows API for automation creation

### 4. Iterative Development

**Phase 1 (MVP)** - Core Value:
- Foundation: CLI framework, HubSpot API, Claude integration
- Core audits: Data quality, duplicates, properties, lists
- **Marketing contact optimization** (cost savings feature)
- Action plans with preview
- Execution with rollback
- Basic workflow generation
- Smart alerts
- Bulk operations

**Phase 2 (v2)** - Operational Excellence:
- Configuration as code & version control
- Performance & cost monitoring
- Compliance & data governance (GDPR/CCPA)
- Auto-generated documentation
- Advanced workflow types & templates
- Enhanced reporting & dashboards

**Phase 3+** - Future Expansion:
- Evaluate based on user feedback and demand
- Change Impact Analysis
- Environment Management
- Deal Pipeline Health
- Integration Monitoring
- Form Analytics & Optimization

### 5. Feedback Loop
- Use the tool on your own HubSpot portal
- Refine AI prompts based on recommendation quality
- Add custom rules for your specific use cases
- Expand to additional audit types

---

## Questions for Further Discussion

1. **HubSpot Objects**: Are there other objects beyond Contacts, Companies, and Lists that need auditing? (Deals, Tickets, Custom Objects?)

2. **Enrichment**: Should the tool integrate with data enrichment services (Clearbit, ZoomInfo) to auto-fill missing data?

3. **Permissions**: What level of HubSpot API permissions will be available? Need workflow creation/management permissions for automation features.

4. **Team Usage**: Will this be used by one person or multiple team members? (Affects audit history, collaboration features, workflow ownership)

5. **Reporting**: Who needs to see audit reports? (Just you, or management/stakeholders?)

6. **Frequency**: How often will audits run? (Ad-hoc, daily, weekly?) This affects performance optimization needs.

7. **Scale**: What's the rough size of your HubSpot data? (Affects pagination, caching strategies)

8. **Workflow Automation Confirmed**: ✓ Tool will use AI to recommend workflows and automatically create them via HubSpot API/MCP. Should workflows be created in "draft" mode for review first, or deployed active immediately with option to disable?

9. **Workflow Templates**: Should the tool include a library of pre-built workflow templates, or only generate workflows based on audit findings?

---

## Additional Capabilities to Consider

Beyond auditing, cleanup, and prevention, here are additional features that could significantly improve HubSpot management:

### 1. Configuration as Code & Version Control

**Problem**: HubSpot configuration changes are hard to track, test, and roll back. No way to know "what changed and when."

**Solution**: Treat HubSpot configuration as code with version control:

```bash
# Export current HubSpot configuration
$ hubspot-audit config --export

Exporting HubSpot configuration...
├─ Properties (47 custom properties) ✓
├─ Workflows (23 active workflows) ✓
├─ Lists (89 lists) ✓
├─ Forms (12 forms) ✓
├─ Email templates (34 templates) ✓
└─ Pipelines & stages ✓

Configuration saved to: ./hubspot-config/
Committed to git: commit abc123f

# Compare environments
$ hubspot-audit config --diff production staging

Configuration Differences: Production vs Staging

Workflows:
├─ Added in production: "Q1 Lead Scoring" (not in staging)
├─ Modified: "Contact Enrichment" (different triggers)
└─ Deleted in staging: "Old Newsletter Flow"

Properties:
├─ Production has 3 properties not in staging
└─ "lead_score" has different options in each environment

Recommendation: Sync staging with production? [y/N]

# Roll back a change
$ hubspot-audit config --rollback commit-abc123f

# Apply config to different portal
$ hubspot-audit config --apply ./hubspot-config/ --portal=staging
```

**Benefits**:
- Track every configuration change with git history
- Test changes in staging before production
- Easily roll back problematic changes
- Document your HubSpot setup automatically
- Enable team collaboration with pull requests

### 2. Change Impact Analysis

**Problem**: Changing a property, workflow, or list can break things in unexpected ways.

**Solution**: Analyze impact before making changes:

```bash
$ hubspot-audit impact --property="lifecycle_stage" --action="delete"

Impact Analysis: Deleting property "lifecycle_stage"

⚠️  HIGH RISK - This change will affect:

Workflows (12 affected):
├─ "Lead Nurture Campaign" - uses lifecycle_stage as enrollment trigger
├─ "Customer Onboarding" - sets lifecycle_stage value
├─ "Sales Notification" - branches on lifecycle_stage
└─ [9 more workflows...]

Lists (34 affected):
├─ "MQL List" - filtered by lifecycle_stage = "MQL"
├─ "Customer Segment" - uses lifecycle_stage in criteria
└─ [32 more lists...]

Reports (8 affected):
├─ "Conversion Funnel" - groups by lifecycle_stage
└─ [7 more reports...]

Forms (3 affected):
└─ Hidden field that sets lifecycle_stage on submission

Estimated contacts affected: 1,832 (100%)
Estimated time to fix broken dependencies: 2-4 hours

Recommendation: DO NOT DELETE
Alternative: Archive property and create replacement with migration plan

Generate migration plan? [y/N]
```

**Use Cases**:
- Before deleting properties, see what depends on them
- Understand workflow dependencies
- Preview list membership changes
- Analyze form field impact

### 3. Environment Management & Sync

**Problem**: Keeping staging and production environments in sync is manual and error-prone.

**Solution**: Automated environment synchronization:

```bash
# Promote staging changes to production
$ hubspot-audit env --promote staging production --dry-run

Promotion Plan: Staging → Production

New Workflows (2):
├─ "New Lead Scoring v2" - AI-powered lead qualification
└─ "Form Submission Validator" - Prevents duplicate submissions

Modified Workflows (5):
├─ "Contact Enrichment" - Updated to use new API
└─ [4 more...]

New Properties (3):
├─ "lead_quality_score" (number, 0-100)
└─ [2 more...]

Conflicts Detected:
├─ Property "industry" has different dropdown values in production
│  └─ Resolve: Merge values or overwrite?
└─ Workflow "Email Campaign" modified in both environments
   └─ Resolve: Keep production, staging, or manual merge?

Approve promotion? [y/N]

# Clone production data to staging (sanitized)
$ hubspot-audit env --clone production staging --sanitize

Cloning production → staging...
├─ Copying workflows (23 workflows) ✓
├─ Copying properties (47 properties) ✓
├─ Copying sample contacts (100 records, emails sanitized) ✓
└─ Copying lists (89 lists) ✓

Staging environment ready for testing.
```

### 4. Compliance & Data Governance (GDPR/CCPA)

**Problem**: Managing data retention, consent, and compliance is complex and manual.

**Solution**: Automated compliance management:

```bash
$ hubspot-audit compliance --check-gdpr

GDPR Compliance Report

Data Retention Issues (47 contacts):
├─ 23 contacts: No activity in 3+ years (suggest archival)
├─ 12 contacts: Unsubscribed >2 years ago (consider deletion)
└─ 12 contacts: Bounced emails but data retained

Consent Issues (89 contacts):
├─ 67 contacts created before GDPR (May 2018) - no consent record
├─ 15 contacts: Consent expired (re-opt-in needed)
└─ 7 contacts: Conflicting consent records

Right to Erasure Requests:
├─ 3 pending deletion requests (>30 days old)
└─ Automated workflow suggestion: Process deletion requests weekly

Generate compliance action plan? [y/N]

# Automate data retention
$ hubspot-audit compliance --create-retention-policy

Data Retention Policy Builder:
1. Inactive contacts (no activity in X years):
   └─ Action: Archive or delete? [archive]
   └─ Duration: [3] years

2. Unsubscribed contacts:
   └─ Action: Delete after [2] years

3. Bounced emails:
   └─ Action: Delete contact or just clear email? [clear email]

Create automated workflow? [y/N]
```

**Features**:
- Track consent across all contacts
- Automate data retention policies
- Handle deletion requests
- Audit data processing activities
- Generate compliance reports

### 5. Performance & Cost Monitoring

**Problem**: HubSpot has API limits, marketing contact limits, and costs can spiral without monitoring.

**Solution**: Track usage and optimize costs:

```bash
$ hubspot-audit performance --monitor

HubSpot Usage & Cost Monitor

API Usage (Last 30 days):
├─ API calls: 456,789 / 500,000 daily limit (91%)
├─ Peak usage: 23,456 calls/hour (during nightly sync)
└─ ⚠️  Warning: Approaching daily limit on 12 of last 30 days

Recommendations:
├─ Implement request batching for contact updates
├─ Cache frequently accessed data
└─ Schedule bulk operations during off-peak hours
   Estimated API reduction: 35%

Marketing Contacts:
├─ Current: 8,734 / 10,000 limit (87%)
├─ Growth rate: +234/month
└─ Estimated time until limit: 5 months

Inactive Marketing Contacts (candidates for non-marketing):
├─ 1,234 contacts: No email open/click in 6+ months
├─ 567 contacts: Unsubscribed but still counted as marketing
└─ Potential savings: ~$400/month by converting to non-marketing

Generate optimization plan? [y/N]

# Monitor workflow performance
$ hubspot-audit workflows --performance

Workflow Performance Analysis

Slow Workflows (execution time):
├─ "Contact Enrichment" - avg 45 seconds (API calls to external service)
│  └─ Suggestion: Implement caching for domain lookups
├─ "Lead Scoring" - avg 30 seconds (complex calculations)
│  └─ Suggestion: Pre-calculate common scores
└─ "Data Validation" - avg 25 seconds (multiple API checks)
   └─ Suggestion: Batch validation checks

High-volume Workflows:
├─ "Form Submission Handler" - 2,340 executions/day
│  └─ Optimization: Reduce redundant checks
└─ "Email Engagement Tracker" - 8,901 executions/day
   └─ Consider: Consolidate with other engagement workflows

Estimated time savings: 4.5 hours/day in workflow execution
```

### 6. Smart Alerts & Anomaly Detection

**Problem**: Issues go unnoticed until they cause problems.

**Solution**: Proactive monitoring and intelligent alerts:

```bash
$ hubspot-audit alerts --configure

Smart Alert Configuration

AI-Powered Anomaly Detection:
├─ ✓ Unusual spike in duplicates (>50% increase week-over-week)
├─ ✓ Form submission rate drops >30%
├─ ✓ Email bounce rate spikes
├─ ✓ Workflow execution failures
├─ ✓ List membership changes >20% in single day
└─ ✓ Data quality score drops >10 points

Alert Delivery:
├─ Email: austin@company.com
├─ Slack: #hubspot-alerts
└─ CLI: Desktop notification

Example Alert:
┌─────────────────────────────────────────┐
│ 🚨 Anomaly Detected                     │
├─────────────────────────────────────────┤
│ Form "Contact Us" submissions dropped   │
│ 87% in last 24 hours                    │
│                                         │
│ Normal: ~45 submissions/day             │
│ Today: 6 submissions                    │
│                                         │
│ Possible causes:                        │
│ • Form broken or not loading            │
│ • Recent website changes                │
│ • Bot protection blocking legitimate    │
│   users                                 │
│                                         │
│ Action: Test form at /contact          │
└─────────────────────────────────────────┘
```

### 7. Auto-Generated Documentation

**Problem**: No one knows how HubSpot is configured or why certain workflows exist.

**Solution**: Automatically generate and maintain documentation:

```bash
$ hubspot-audit docs --generate

Generating HubSpot Documentation...

Created documentation:
├─ docs/overview.md - High-level architecture
├─ docs/workflows.md - All workflows with purposes
├─ docs/properties.md - Custom property definitions
├─ docs/integrations.md - External integrations
├─ docs/data-flow.md - How data flows through system
└─ docs/runbook.md - Common operations guide

# Example: Auto-generated workflow documentation

## Workflow: "Contact Enrichment"
**Purpose**: Automatically enriches new contacts with company data
**Created**: 2024-03-15 by austin@company.com
**Last Modified**: 2025-01-10
**Status**: Active

### Trigger
- Contact is created OR contact property "company_domain" changes

### Actions
1. Extract domain from email address
2. Look up company by domain (HubSpot API)
3. If found:
   - Associate contact with company
   - Copy company industry to contact
   - Copy company size to contact
4. If not found:
   - Query Clearbit API for company data
   - Create company if confidence > 80%
5. Set "enrichment_status" property

### Dependencies
- Integrates with: Clearbit API
- Used by: "Lead Scoring" workflow
- Sets properties: company_industry, company_size, enrichment_status

### Performance
- Avg execution time: 12 seconds
- Daily executions: ~45
- Success rate: 94%

### Related Audit Findings
- This workflow was created to address issue #234 (missing company associations)
- Prevents ~35 data quality issues/week
```

### 8. Bulk Operations & Mass Updates

**Problem**: Need to update hundreds of records but HubSpot UI is slow/limited.

**Solution**: Efficient bulk operations:

```bash
# Update all contacts matching criteria
$ hubspot-audit bulk --update contacts \
  --where="lifecycle_stage=MQL AND last_activity>90_days_ago" \
  --set="lead_status=cold"

Found 234 contacts matching criteria.
Preview changes? [y/N]: y

# Apply complex transformations
$ hubspot-audit bulk --transform contacts \
  --where="industry IS NULL" \
  --transform="infer_industry_from_company_domain"

AI-powered transformation:
├─ Analyzing 456 contacts with missing industry
├─ Looking up domains via Clearbit
├─ Applying ML model for industry classification
└─ Confidence threshold: 80%

Results:
├─ High confidence matches: 389 contacts
├─ Medium confidence: 45 contacts (manual review)
└─ No match: 22 contacts

Apply high confidence changes? [y/N]

# Bulk merge operations
$ hubspot-audit bulk --merge companies \
  --strategy="domain_match" \
  --confidence=90

Found 67 duplicate companies (90%+ confidence)
Preview merge plan? [y/N]
```

### 9. Deal Pipeline Health & Revenue Operations

**Problem**: Deals get stuck, pipelines clog up, revenue forecasting is inaccurate.

**Solution**: Pipeline analytics and optimization:

```bash
$ hubspot-audit pipeline --health

Deal Pipeline Health Report

Stuck Deals (no activity in 30+ days):
├─ "Demo Scheduled" stage: 23 deals ($456K)
├─ "Proposal Sent" stage: 12 deals ($234K)
└─ "Negotiation" stage: 8 deals ($189K)

AI Insights:
├─ Deals in "Demo Scheduled" stuck avg 45 days
│  └─ Pattern: No follow-up task created after demo
│  └─ Suggestion: Create auto-task workflow
│
└─ "Proposal Sent" deals have 60% close rate if followed up within 3 days
   └─ Current avg follow-up time: 7 days
   └─ Suggestion: Add urgent notification workflow

Stage Conversion Analysis:
├─ "Qualified" → "Demo": 78% (good)
├─ "Demo" → "Proposal": 45% (below target 60%)
│  └─ Investigate: Why are demos not converting?
└─ "Proposal" → "Closed Won": 35% (target: 40%)

Revenue Forecast Accuracy:
├─ Last quarter forecast: $1.2M
├─ Actual closed: $987K (82% accuracy)
└─ Primary miss: 12 deals pushed to next quarter

Generate optimization workflows? [y/N]
```

### 10. Integration Health Monitoring

**Problem**: Integrations break silently and you don't know until data is wrong.

**Solution**: Monitor and test integrations:

```bash
$ hubspot-audit integrations --monitor

Integration Health Status

Salesforce Sync:
├─ Status: ⚠️  Warning
├─ Last sync: 2 hours ago (normal: every 15 min)
├─ Sync errors: 12 records failed
│  └─ Error: "Required field missing: Account.Industry"
└─ Action: Check Salesforce mapping

Zapier Webhooks:
├─ Status: ✓ Healthy
├─ Last received: 2 minutes ago
└─ Success rate: 99.2%

Clearbit Enrichment:
├─ Status: ✗ Failed
├─ Error: API key expired
├─ Impact: 45 contacts not enriched today
└─ Action: Update API key in settings

Custom API Integration:
├─ Status: ⚠️  Degraded
├─ Response time: 4.5s (normal: 0.8s)
├─ Timeout errors: 5 in last hour
└─ Recommendation: Check external API health

# Test integration before deploying
$ hubspot-audit integrations --test "Salesforce Sync" --dry-run

Testing Salesforce integration (dry-run)...
├─ Connection: ✓ Success
├─ Authentication: ✓ Valid
├─ Field mapping: ✓ All fields mapped correctly
├─ Test sync (10 sample records): ✓ Success
└─ Performance: 850ms avg per record

Safe to enable. Enable now? [y/N]
```

### 11. Form Analytics & Optimization

**Problem**: Forms have issues but you don't know which fields cause abandonment.

**Solution**: Form performance analysis:

```bash
$ hubspot-audit forms --analyze

Form Performance Report

"Contact Us" Form:
├─ Submissions: 234 this month
├─ Abandonment rate: 67% (industry avg: 45%)
├─ Avg completion time: 3m 45s
└─ ⚠️  High abandonment

Field Analysis:
├─ "Email" - 2% abandonment (good)
├─ "Phone" - 15% abandonment (users skip)
│  └─ Suggestion: Make optional or remove
├─ "Company Size" - 34% abandonment ⚠️
│  └─ Issue: Too many options (23 dropdown values)
│  └─ Suggestion: Simplify to 5 ranges
└─ "How did you hear about us?" - 28% abandonment
   └─ Suggestion: Move to optional or post-submission

AI Recommendations:
1. Remove or make optional: Phone, "How did you hear"
2. Simplify dropdown: Company Size (23 → 5 options)
3. Add progressive profiling (ask less upfront)
4. Estimated improvement: 67% → 38% abandonment
5. Projected increase: +89 submissions/month

Generate optimized form? [y/N]
```

### Feature Prioritization

Based on business impact and implementation complexity:

**MVP (Phase 1)** - Core Features:
1. ✅ **Core Audits** - Data quality, duplicates, properties, lists, **marketing contact optimization**
2. ✅ **AI Recommendations** - Pattern analysis and fix suggestions
3. ✅ **Action Plans** - Preview and batch execution with rollback
4. ✅ **Workflow Generation** - Basic preventive workflows (2-3 types)
5. **Smart Alerts** - Proactive anomaly detection and notifications
6. **Bulk Operations** - Mass updates and transformations

**v2 (Phase 2)** - Advanced Features:
7. **Configuration as Code** - Version control for HubSpot setup
8. **Performance & Cost Monitoring** - API usage, contact limits, optimization
9. **Compliance & Data Governance** - GDPR/CCPA, data retention, consent management
10. **Auto-Generated Documentation** - Keep HubSpot setup documented automatically
11. **Advanced Workflows** - More workflow types and templates
12. **Enhanced Reporting** - Trends, dashboards, team collaboration

**Future Ideas** - Post-v2 Considerations:
13. **Change Impact Analysis** - See what breaks before making changes (complexity TBD)
14. **Environment Management** - Staging/production sync
15. **Deal Pipeline Health** - Revenue operations and stuck deal detection
16. **Integration Monitoring** - Track Salesforce, Zapier, custom integrations
17. **Form Analytics** - Optimization and abandonment analysis

### Why This Prioritization?

**MVP focuses on immediate pain relief**:
- Marketing contact optimization provides **instant cost savings** (~$495/month)
- Smart alerts **prevent issues before they happen**
- Bulk operations **save hours of manual work**
- Core audits + workflows create the **foundation for everything else**

**v2 adds operational excellence**:
- Configuration as code enables **safe testing and deployment**
- Performance monitoring prevents **runaway costs**
- Compliance features avoid **legal/regulatory issues**
- Documentation helps with **team collaboration and knowledge transfer**

**Future ideas are valuable but can wait**:
- Require deeper HubSpot API understanding (Change Impact Analysis)
- More specialized use cases (Deals, Forms, Integrations)
- Can be added based on user feedback after v2

---

**This ideation document provides the conceptual foundation for building the HubSpot CLI Audit Tool. Once refined, we can move forward with detailed implementation planning and development.**
