/**
 * HubSpot Service
 *
 * Wraps @hubspot/api-client with:
 * - Rate limiting
 * - Caching
 * - Retry logic
 * - Error handling
 * - Pagination
 */

import { Client } from '@hubspot/api-client';
import type { Config } from '../config/schema.js';
import { RateLimiter, createHubSpotRateLimiter } from './RateLimiter.js';
import { CacheService } from './CacheService.js';
import { parseHubSpotError, RateLimitError } from './errors.js';
import { createLogger, safeLog } from '../utils/logger.js';
import type {
  Contact,
  Company,
  Deal,
  PropertyDefinition,
  Association,
  List,
  TimelineEvent,
  EngagementSummary,
  EmailEvent,
  MarketingStatus,
  Workflow,
  WorkflowDefinition,
  AccountInfo,
  SubscriptionInfo,
} from '../types/hubspot.js';

const logger = createLogger('hubspot');

export interface HubSpotServiceConfig {
  accessToken: string;
  rateLimiter?: RateLimiter;
  cache?: CacheService;
  maxRetries?: number;
}

export class HubSpotService {
  private client: Client;
  private rateLimiter: RateLimiter;
  private cache: CacheService;
  private maxRetries: number;

  constructor(config: HubSpotServiceConfig) {
    this.client = new Client({ accessToken: config.accessToken });
    this.rateLimiter = config.rateLimiter || createHubSpotRateLimiter();
    this.cache = config.cache || new CacheService(30);
    this.maxRetries = config.maxRetries ?? 3;

    logger.info('HubSpot service initialized');
  }

  /**
   * Create service from app config
   */
  static fromConfig(config: Config): HubSpotService {
    const accessToken = config.hubspot.access_token || process.env.HUBSPOT_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error(
        'HubSpot access token not found. Set HUBSPOT_ACCESS_TOKEN or configure in config file.'
      );
    }

    return new HubSpotService({
      accessToken,
      rateLimiter: createHubSpotRateLimiter({
        maxTokens: config.settings.rate_limit.requests_per_10_seconds,
        refillIntervalMs: 10000,
        maxConcurrent: config.settings.rate_limit.burst_limit,
      }),
      cache: new CacheService(config.settings.cache_ttl_minutes),
    });
  }

  // ===================================================================
  // CONTACTS
  // ===================================================================

  /**
   * Get all contacts with pagination
   */
  async *getContacts(
    properties?: string[],
    limit: number = 100
  ): AsyncGenerator<Contact[], void, unknown> {
    logger.info({ properties, limit }, 'Fetching all contacts');

    let after: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response: any = await this.executeWithRetry(async () => {
        return await this.client.crm.contacts.basicApi.getPage(limit, after, properties);
      });

      yield response.results as Contact[];

      after = response.paging?.next?.after;
      hasMore = !!after;

      logger.debug({ fetched: response.results.length, hasMore }, 'Contacts batch fetched');
    }

    logger.info('All contacts fetched');
  }

  /**
   * Get single contact by ID
   */
  async getContact(id: string, properties?: string[]): Promise<Contact> {
    logger.debug({ id, properties }, 'Fetching contact');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.contacts.basicApi.getById(id, properties);
      return response as unknown as Contact;
    });
  }

  /**
   * Create contact
   */
  async createContact(properties: Record<string, string>): Promise<Contact> {
    logger.info(safeLog({ properties }), 'Creating contact');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.contacts.basicApi.create({ properties });
      return response as unknown as Contact;
    });
  }

  /**
   * Update contact
   */
  async updateContact(id: string, properties: Record<string, string>): Promise<Contact> {
    logger.info({ id, ...safeLog({ properties }) }, 'Updating contact');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.contacts.basicApi.update(id, { properties });
      return response as unknown as Contact;
    });
  }

  /**
   * Delete contact (soft delete)
   */
  async deleteContact(id: string): Promise<void> {
    logger.warn({ id }, 'Deleting contact');

    await this.executeWithRetry(async () => {
      await this.client.crm.contacts.basicApi.archive(id);
    });
  }

  /**
   * Merge contacts (NOT REVERSIBLE!)
   */
  async mergeContacts(primaryId: string, secondaryId: string): Promise<void> {
    logger.warn({ primaryId, secondaryId }, 'Merging contacts (irreversible)');

    await this.executeWithRetry(async () => {
      // Use the merge API - secondary contact will be permanently deleted
      await this.client.crm.contacts.mergeApi.merge({
        primaryObjectId: primaryId,
        objectIdToMerge: secondaryId,
      });

      logger.warn(
        { primaryId, secondaryId },
        'Successfully merged contacts - secondary contact deleted'
      );
    });
  }

  // ===================================================================
  // COMPANIES
  // ===================================================================

  /**
   * Get all companies with pagination
   */
  async *getCompanies(
    properties?: string[],
    limit: number = 100
  ): AsyncGenerator<Company[], void, unknown> {
    logger.info({ properties, limit }, 'Fetching all companies');

    let after: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response: any = await this.executeWithRetry(async () => {
        return await this.client.crm.companies.basicApi.getPage(limit, after, properties);
      });

      yield response.results as Company[];

      after = response.paging?.next?.after;
      hasMore = !!after;

      logger.debug({ fetched: response.results.length, hasMore }, 'Companies batch fetched');
    }

    logger.info('All companies fetched');
  }

  /**
   * Get single company by ID
   */
  async getCompany(id: string, properties?: string[]): Promise<Company> {
    logger.debug({ id, properties }, 'Fetching company');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.companies.basicApi.getById(id, properties);
      return response as unknown as Company;
    });
  }

  /**
   * Update company
   */
  async updateCompany(id: string, properties: Record<string, string>): Promise<Company> {
    logger.info({ id, ...safeLog({ properties }) }, 'Updating company');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.companies.basicApi.update(id, { properties });
      return response as unknown as Company;
    });
  }

  // ===================================================================
  // DEALS
  // ===================================================================

  /**
   * Get all deals with pagination
   */
  async *getDeals(
    properties?: string[],
    limit: number = 100
  ): AsyncGenerator<Deal[], void, unknown> {
    logger.info({ properties, limit }, 'Fetching all deals');

    let after: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response: any = await this.executeWithRetry(async () => {
        return await this.client.crm.deals.basicApi.getPage(limit, after, properties);
      });

      yield response.results as Deal[];

      after = response.paging?.next?.after;
      hasMore = !!after;

      logger.debug({ fetched: response.results.length, hasMore }, 'Deals batch fetched');
    }

    logger.info('All deals fetched');
  }

  /**
   * Get single deal by ID
   */
  async getDeal(id: string, properties?: string[]): Promise<Deal> {
    logger.debug({ id, properties }, 'Fetching deal');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.deals.basicApi.getById(id, properties);
      return response as unknown as Deal;
    });
  }

  /**
   * Update deal
   */
  async updateDeal(id: string, properties: Record<string, string>): Promise<Deal> {
    logger.info({ id, ...safeLog({ properties }) }, 'Updating deal');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.deals.basicApi.update(id, { properties });
      return response as unknown as Deal;
    });
  }

  // ===================================================================
  // PROPERTIES
  // ===================================================================

  /**
   * Get property definitions (cached)
   */
  async getContactProperties(): Promise<PropertyDefinition[]> {
    return await this.cache.getOrCompute(
      'properties:contacts',
      async () => {
        logger.debug('Fetching contact properties');

        return await this.executeWithRetry(async () => {
          const response = await this.client.crm.properties.coreApi.getAll('contacts');
          return response.results as PropertyDefinition[];
        });
      },
      60 // Cache for 1 hour (properties rarely change)
    );
  }

  /**
   * Get company property definitions (cached)
   */
  async getCompanyProperties(): Promise<PropertyDefinition[]> {
    return await this.cache.getOrCompute(
      'properties:companies',
      async () => {
        logger.debug('Fetching company properties');

        return await this.executeWithRetry(async () => {
          const response = await this.client.crm.properties.coreApi.getAll('companies');
          return response.results as PropertyDefinition[];
        });
      },
      60 // Cache for 1 hour
    );
  }

  /**
   * Get deal property definitions (cached)
   */
  async getDealProperties(): Promise<PropertyDefinition[]> {
    return await this.cache.getOrCompute(
      'properties:deals',
      async () => {
        logger.debug('Fetching deal properties');

        return await this.executeWithRetry(async () => {
          const response = await this.client.crm.properties.coreApi.getAll('deals');
          return response.results as PropertyDefinition[];
        });
      },
      60 // Cache for 1 hour
    );
  }

  // ===================================================================
  // SEARCH API
  // ===================================================================

  /**
   * Search contacts
   */
  async searchContacts(query: {
    filterGroups: Array<{
      filters: Array<{
        propertyName: string;
        operator: string;
        value?: string;
      }>;
    }>;
    properties?: string[];
    limit?: number;
    after?: string;
    sorts?: Array<{
      propertyName: string;
      direction: 'ASCENDING' | 'DESCENDING';
    }>;
  }): Promise<{ results: Contact[]; total: number; paging?: { next?: { after: string } } }> {
    logger.debug({ query: safeLog(query) }, 'Searching contacts');

    return await this.executeWithRetry(async () => {
      const response: any = await this.client.crm.contacts.searchApi.doSearch({
        filterGroups: query.filterGroups as any,
        properties: query.properties || [],
        limit: query.limit || 100,
        after: query.after,
        sorts: query.sorts as any,
      });

      return {
        results: response.results as Contact[],
        total: response.total,
        paging: response.paging,
      };
    });
  }

  // ===================================================================
  // BATCH OPERATIONS
  // ===================================================================

  /**
   * Batch read contacts
   */
  async batchReadContacts(ids: string[], properties?: string[]): Promise<Contact[]> {
    logger.debug({ count: ids.length, properties }, 'Batch reading contacts');

    if (ids.length === 0) {
      return [];
    }

    if (ids.length > 100) {
      logger.warn({ count: ids.length }, 'Batch size exceeds 100, chunking');
      // Chunk into groups of 100
      const chunks = this.chunkArray(ids, 100);
      const results: Contact[] = [];

      for (const chunk of chunks) {
        const chunkResults = await this.batchReadContacts(chunk, properties);
        results.push(...chunkResults);
      }

      return results;
    }

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.contacts.batchApi.read({
        properties: properties || [],
        propertiesWithHistory: [],
        inputs: ids.map((id) => ({ id })),
      });

      return response.results.map((r) => ({
        id: r.id,
        properties: r.properties as Record<string, string | null>,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        archived: r.archived || false,
      })) as Contact[];
    });
  }

  /**
   * Batch update contacts
   */
  async batchUpdateContacts(
    updates: Array<{ id: string; properties: Record<string, string> }>
  ): Promise<{ successful: Contact[]; errors: Array<{ id: string; error: string }> }> {
    logger.info({ count: updates.length }, 'Batch updating contacts');

    if (updates.length === 0) {
      return { successful: [], errors: [] };
    }

    if (updates.length > 100) {
      logger.warn({ count: updates.length }, 'Batch size exceeds 100, chunking');
      const chunks = this.chunkArray(updates, 100);
      const allSuccessful: Contact[] = [];
      const allErrors: Array<{ id: string; error: string }> = [];

      for (const chunk of chunks) {
        const result = await this.batchUpdateContacts(chunk);
        allSuccessful.push(...result.successful);
        allErrors.push(...result.errors);
      }

      return { successful: allSuccessful, errors: allErrors };
    }

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.contacts.batchApi.update({
        inputs: updates.map((u) => ({ id: u.id, properties: u.properties })),
      });

      const errors: Array<{ id: string; error: string }> = [];
      const successful = response.results.map((r) => ({
        id: r.id,
        properties: r.properties as Record<string, string | null>,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        archived: r.archived || false,
      })) as Contact[];

      return {
        successful,
        errors,
      };
    });
  }

  // ===================================================================
  // ASSOCIATIONS
  // ===================================================================

  /**
   * Get associations between objects
   */
  async getAssociations(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string
  ): Promise<Association[]> {
    logger.debug({ fromObjectType, fromObjectId, toObjectType }, 'Fetching associations');

    return await this.executeWithRetry(async () => {
      const response = await this.client.crm.associations.batchApi.read(fromObjectType, toObjectType, {
        inputs: [{ id: fromObjectId }],
      });

      const result = response.results[0];
      if (!result || !result.to) {
        return [];
      }

      return result.to.map((assoc: any) => ({
        id: assoc.id,
        type: assoc.type || toObjectType,
      })) as Association[];
    });
  }

  /**
   * Create association between objects
   */
  async createAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string,
    associationType?: string
  ): Promise<void> {
    logger.info(
      { fromObjectType, fromObjectId, toObjectType, toObjectId, associationType },
      'Creating association'
    );

    await this.executeWithRetry(async () => {
      await this.client.crm.associations.batchApi.create(fromObjectType, toObjectType, {
        inputs: [
          {
            _from: { id: fromObjectId },
            to: { id: toObjectId },
            type: associationType || 'contact_to_company',
          },
        ],
      });
    });
  }

  /**
   * Remove association between objects
   */
  async removeAssociation(
    fromObjectType: string,
    fromObjectId: string,
    toObjectType: string,
    toObjectId: string
  ): Promise<void> {
    logger.info(
      { fromObjectType, fromObjectId, toObjectType, toObjectId },
      'Removing association'
    );

    await this.executeWithRetry(async () => {
      await this.client.crm.associations.batchApi.archive(fromObjectType, toObjectType, {
        inputs: [
          {
            _from: { id: fromObjectId },
            to: { id: toObjectId },
            type: 'contact_to_company', // Default type
          },
        ],
      });
    });
  }

  // ===================================================================
  // LISTS
  // ===================================================================

  /**
   * Get all lists
   */
  async getLists(): Promise<List[]> {
    logger.info('Fetching all lists');

    return await this.executeWithRetry(async () => {
      const response: any = await this.client.crm.lists.listsApi.getAll();
      return (response.lists || []).map((list: any) => ({
        listId: list.listId,
        name: list.name,
        dynamic: list.dynamic,
        size: list.size || 0,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      })) as List[];
    });
  }

  /**
   * Get list members (contacts)
   */
  async getListMembers(listId: string): Promise<Contact[]> {
    logger.debug({ listId }, 'Fetching list members');

    return await this.executeWithRetry(async () => {
      const response: any = await this.client.crm.lists.membershipsApi.getPage(
        listId,
        undefined,
        undefined
      );
      return response.results as Contact[];
    });
  }

  /**
   * Remove contacts from list
   */
  async removeFromList(listId: string, contactIds: string[]): Promise<void> {
    logger.info({ listId, count: contactIds.length }, 'Removing contacts from list');

    if (contactIds.length === 0) {
      return;
    }

    // Chunk into groups of 100
    const chunks = this.chunkArray(contactIds, 100);

    for (const chunk of chunks) {
      await this.executeWithRetry(async () => {
        await this.client.crm.lists.membershipsApi.remove(listId, chunk);
      });
    }
  }

  /**
   * Add contacts to list
   */
  async addToList(listId: string, contactIds: string[]): Promise<void> {
    logger.info({ listId, count: contactIds.length }, 'Adding contacts to list');

    if (contactIds.length === 0) {
      return;
    }

    // Chunk into groups of 100
    const chunks = this.chunkArray(contactIds, 100);

    for (const chunk of chunks) {
      await this.executeWithRetry(async () => {
        await this.client.crm.lists.membershipsApi.add(listId, chunk);
      });
    }
  }

  // ===================================================================
  // TIMELINE & ENGAGEMENT
  // ===================================================================

  /**
   * Get contact timeline events
   * Note: HubSpot's timeline API is complex; this is a simplified implementation
   */
  async getContactTimeline(
    contactId: string,
    options?: { limit?: number; after?: string }
  ): Promise<TimelineEvent[]> {
    logger.debug({ contactId, options }, 'Fetching contact timeline');

    // Note: Timeline events are typically accessed via engagements API
    // For now, return empty array as timeline API is complex
    logger.warn('Timeline events API not fully implemented - requires engagements API');
    return [];
  }

  /**
   * Get contact engagement summary
   * Aggregates engagement metrics from contact properties
   */
  async getContactEngagement(contactId: string): Promise<EngagementSummary> {
    logger.debug({ contactId }, 'Fetching contact engagement');

    const contact = await this.getContact(contactId, [
      'lastmodifieddate',
      'notes_last_contacted',
      'num_contacted_notes',
      'hs_email_open',
      'hs_email_click',
      'hs_email_delivered',
      'form_submissions',
      'hs_analytics_num_page_views',
    ]);

    return {
      lastActivityDate:
        contact.properties.notes_last_contacted || contact.properties.lastmodifieddate || undefined,
      emailsSent: parseInt(contact.properties.hs_email_delivered || '0', 10),
      emailsOpened: parseInt(contact.properties.hs_email_open || '0', 10),
      emailsClicked: parseInt(contact.properties.hs_email_click || '0', 10),
      formSubmissions: parseInt(contact.properties.form_submissions || '0', 10),
      pageViews: parseInt(contact.properties.hs_analytics_num_page_views || '0', 10),
    };
  }

  // ===================================================================
  // EMAIL & MARKETING STATUS
  // ===================================================================

  /**
   * Get email events for contact
   * Note: This requires Marketing Hub and uses the email events API
   */
  async getEmailEvents(contactId: string): Promise<EmailEvent[]> {
    logger.debug({ contactId }, 'Fetching email events');

    // Note: Email events API requires specific scopes and Marketing Hub
    // This is a placeholder implementation
    logger.warn('Email events API requires Marketing Hub and additional scopes');
    return [];
  }

  /**
   * Get marketing contact status
   */
  async getMarketingContactStatus(contactId: string): Promise<MarketingStatus> {
    logger.debug({ contactId }, 'Fetching marketing contact status');

    const contact = await this.getContact(contactId, [
      'hs_marketable_status',
      'hs_marketable_reason_type',
      'hs_marketable_until_renewal',
    ]);

    return {
      isMarketingContact: contact.properties.hs_marketable_status === 'true',
      status: contact.properties.hs_marketable_reason_type || 'unknown',
      statusUpdatedAt: contact.properties.hs_marketable_until_renewal || undefined,
    };
  }

  /**
   * Set marketing contact status
   */
  async setMarketingContactStatus(contactId: string, isMarketing: boolean): Promise<void> {
    logger.info({ contactId, isMarketing }, 'Setting marketing contact status');

    await this.updateContact(contactId, {
      hs_marketable_status: isMarketing ? 'true' : 'false',
    });
  }

  // ===================================================================
  // WORKFLOWS
  // ===================================================================

  /**
   * Get workflows
   * Note: Requires Workflows API access
   */
  async getWorkflows(): Promise<Workflow[]> {
    logger.info('Fetching workflows');

    // Note: Workflows API is in automation API
    logger.warn('Workflows API requires specific scopes and is limited in @hubspot/api-client');
    return [];
  }

  /**
   * Create workflow
   * Note: Requires Workflows API access and is complex
   */
  async createWorkflow(definition: WorkflowDefinition): Promise<Workflow> {
    logger.info({ name: definition.name }, 'Creating workflow');

    // Note: Workflow creation is complex and requires automation API
    logger.warn('Workflow creation requires specific scopes and complex API calls');
    throw new Error('Workflow creation not yet implemented - requires automation API');
  }

  // ===================================================================
  // ACCOUNT INFO
  // ===================================================================

  /**
   * Get account information
   */
  async getAccountInfo(): Promise<AccountInfo> {
    logger.info('Fetching account info');

    // Account info requires settings API which is not available in @hubspot/api-client
    logger.warn('Account info API not fully supported in @hubspot/api-client');
    return {
      portalId: 0, // Would come from settings API
      accountType: 'unknown',
      timeZone: 'UTC',
      currency: 'USD',
      utcOffset: '+00:00',
    };
  }

  /**
   * Get subscription information
   * Note: Requires access to account/subscription APIs
   */
  async getSubscriptionInfo(): Promise<SubscriptionInfo> {
    logger.info('Fetching subscription info');

    logger.warn('Subscription info API not fully supported in @hubspot/api-client');
    return {
      subscriptions: [],
    };
  }

  // ===================================================================
  // UTILITY METHODS
  // ===================================================================

  /**
   * Execute API call with rate limiting and retry logic
   */
  private async executeWithRetry<T>(fn: () => Promise<T>, retries: number = 0): Promise<T> {
    try {
      // Apply rate limiting
      return await this.rateLimiter.execute(fn);
    } catch (error: any) {
      // Parse HubSpot error
      try {
        parseHubSpotError(error);
      } catch (parsedError: any) {
        // Handle rate limit errors with retry
        if (parsedError instanceof RateLimitError && retries < this.maxRetries) {
          const retryAfter = parsedError.retryAfter || 10;
          const delay = this.calculateBackoff(retries, retryAfter);

          logger.warn(
            { retries, delay, retryAfter },
            'Rate limited, retrying after delay'
          );

          await this.sleep(delay);
          return await this.executeWithRetry(fn, retries + 1);
        }

        throw parsedError;
      }

      throw error;
    }
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(retries: number, minDelay: number): number {
    const exponentialDelay = Math.min(30000, minDelay * 1000 * Math.pow(2, retries));
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    return exponentialDelay + jitter;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get rate limiter status
   */
  getRateLimiterStatus(): ReturnType<RateLimiter['getStatus']> {
    return this.rateLimiter.getStatus();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): ReturnType<CacheService['getStats']> {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Cleanup (destroy rate limiter, clear cache)
   */
  destroy(): void {
    this.rateLimiter.destroy();
    this.cache.clear();
    logger.info('HubSpot service destroyed');
  }
}
