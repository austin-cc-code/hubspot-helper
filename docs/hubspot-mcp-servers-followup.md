# HubSpot MCP Servers - Follow-Up Research

**Date:** 2026-01-14

## Context

While this project uses `@hubspot/api-client` directly (see Epic 1 decision in plan.md), there are now several open source HubSpot MCP servers available that may be worth evaluating for potential integration or reference.

## Available Open Source MCP Servers

### 1. peakmojo/mcp-hubspot (MIT License)
**Repository:** https://github.com/peakmojo/mcp-hubspot

**Features:**
- Python-based with FAISS vector storage for semantic search
- Built-in caching and performance optimization
- 7 core tools: create/search contacts & companies, get activity/conversations
- Docker support for multiple architectures

**Installation:**
```bash
npx -y @smithery/cli@latest install mcp-hubspot --client claude
```

**Required Scopes:** `crm.objects.contacts`, `crm.objects.companies`, `sales-email-read`

---

### 2. shinzo-labs/hubspot-mcp (MIT License)
**Repository:** https://github.com/shinzo-labs/hubspot-mcp

**Features:**
- Complete HubSpot CRM API coverage
- All standard objects (contacts, companies, deals, tickets, quotes, products, invoices, line items)
- Advanced: Associations v4, batch operations, Zod type safety
- Multiple deployment options (Smithery, NPX, source build)
- Telemetry included (can be disabled via `TELEMETRY_ENABLED`)

**Installation:**
```bash
npx -y @smithery/cli install @shinzo-labs/hubspot-mcp
```

---

### 3. calypsoCodex/hubspot-mcp-extended
**Note:** Announced October 2025, check for repository

**Features:**
- 106 comprehensive tools
- Generated from HubSpot's official OpenAPI specs
- Full CRM coverage including advanced objects

---

### 4. lkm1developer/hubspot-mcp-server (MIT License)
**Repository:** https://github.com/lkm1developer/hubspot-mcp-server

Basic implementation - minimal information available.

---

### 5. SanketSKasar/HubSpot-MCP-Server
**Repository:** https://github.com/SanketSKasar/HubSpot-MCP-Server

**Features:**
- Based on official HubSpot MCP npm package
- Supports HTTP, HTTP Streamable, and STDIO transports

---

## Official HubSpot MCP Server

**Endpoint:** mcp.hubspot.com
**Announced:** May 2025 (Public Beta)
**Documentation:** https://developers.hubspot.com/mcp

**Features:**
- Read-only CRM access (contacts, companies, deals, tickets, etc.)
- OAuth 2.0 authentication
- Scope-based access control
- No access to sensitive/PHI data
- Requires new HubSpot Developer Platform

**Status:** Not clear if open source

---

## Follow-Up Actions

- [ ] Evaluate if any MCP server offers capabilities we need that aren't in `@hubspot/api-client`
- [ ] Consider MCP integration for AI analysis features (Epic 6 Phase 2?)
- [ ] Compare API coverage vs. our direct client implementation
- [ ] Review security models (especially OAuth 2.0 vs. private app tokens)
- [ ] Assess if vector storage/semantic search features from peakmojo could enhance audit capabilities
- [ ] Check if batch operations in shinzo-labs are more efficient than our current approach

---

## Original Research Sources

- [HubSpot Official MCP Server](https://developers.hubspot.com/mcp)
- [peakmojo/mcp-hubspot](https://github.com/peakmojo/mcp-hubspot)
- [shinzo-labs/hubspot-mcp](https://github.com/shinzo-labs/hubspot-mcp)
- [HubSpot MCP Server Public Beta](https://developers.hubspot.com/changelog/mcp-server-beta)
- [HubSpot Community Discussion](https://community.hubspot.com/t5/APIs-Integrations/Open-source-MCP-for-HubSpot-106-CRM-Tools-Public-Beta/m-p/1216305)
