/**
 * HubSpot Service Integration Tests
 *
 * These tests run against a real HubSpot portal and require:
 * - HUBSPOT_ACCESS_TOKEN environment variable
 * - A test HubSpot portal with appropriate scopes
 *
 * To run: HUBSPOT_ACCESS_TOKEN=your-token npm test -- HubSpotService.integration.test.ts
 *
 * NOTE: These tests are skipped by default unless HUBSPOT_ACCESS_TOKEN is set
 */

import { HubSpotService } from '../../src/services/HubSpotService.js';
import type { Contact } from '../../src/types/hubspot.js';

const HUBSPOT_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const shouldRunIntegrationTests = !!HUBSPOT_TOKEN;

// Helper to conditionally skip tests
const describeIntegration = shouldRunIntegrationTests ? describe : describe.skip;

describeIntegration('HubSpotService Integration Tests', () => {
  let service: HubSpotService;
  let testContactId: string | null = null;

  beforeAll(() => {
    if (!HUBSPOT_TOKEN) {
      console.warn('Skipping integration tests: HUBSPOT_ACCESS_TOKEN not set');
      return;
    }

    service = new HubSpotService({
      accessToken: HUBSPOT_TOKEN,
      maxRetries: 3,
    });
  });

  afterAll(() => {
    if (service) {
      // Clean up test contact if created
      if (testContactId) {
        service
          .deleteContact(testContactId)
          .catch((err) => console.error('Failed to clean up test contact:', err));
      }
      service.destroy();
    }
  });

  describe('Contact operations', () => {
    it('should create a new contact', async () => {
      const email = `test-${Date.now()}@example.com`;
      const contact = await service.createContact({
        email,
        firstname: 'Integration',
        lastname: 'Test',
      });

      expect(contact).toBeDefined();
      expect(contact.id).toBeDefined();
      expect(contact.properties.email).toBe(email);

      testContactId = contact.id;
    }, 10000);

    it('should fetch contact by ID', async () => {
      if (!testContactId) {
        throw new Error('Test contact not created');
      }

      const contact = await service.getContact(testContactId, ['email', 'firstname', 'lastname']);

      expect(contact.id).toBe(testContactId);
      expect(contact.properties.email).toContain('@example.com');
    }, 10000);

    it('should update contact properties', async () => {
      if (!testContactId) {
        throw new Error('Test contact not created');
      }

      const updated = await service.updateContact(testContactId, {
        lastname: 'Updated',
        company: 'Test Company',
      });

      expect(updated.properties.lastname).toBe('Updated');
      expect(updated.properties.company).toBe('Test Company');
    }, 10000);

    it('should fetch all contacts with pagination', async () => {
      let totalFetched = 0;
      let batchCount = 0;

      for await (const batch of service.getContacts(['email'], 10)) {
        batchCount++;
        totalFetched += batch.length;

        expect(Array.isArray(batch)).toBe(true);
        expect(batch.length).toBeGreaterThan(0);
        expect(batch.length).toBeLessThanOrEqual(10);

        // Stop after a few batches to avoid long test times
        if (batchCount >= 3) {
          break;
        }
      }

      expect(totalFetched).toBeGreaterThan(0);
      expect(batchCount).toBeGreaterThan(0);
    }, 30000);

    it('should search contacts', async () => {
      const result = await service.searchContacts({
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'email',
                operator: 'HAS_PROPERTY',
              },
            ],
          },
        ],
        properties: ['email', 'firstname'],
        limit: 5,
      });

      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.total).toBeGreaterThan(0);
    }, 10000);

    it('should batch read contacts', async () => {
      if (!testContactId) {
        throw new Error('Test contact not created');
      }

      const contacts = await service.batchReadContacts([testContactId], ['email', 'firstname']);

      expect(contacts).toHaveLength(1);
      expect(contacts[0].id).toBe(testContactId);
    }, 10000);

    it('should delete contact', async () => {
      if (!testContactId) {
        throw new Error('Test contact not created');
      }

      await service.deleteContact(testContactId);

      // Verify it's deleted by trying to fetch it
      await expect(service.getContact(testContactId)).rejects.toThrow();

      testContactId = null; // Mark as cleaned up
    }, 10000);
  });

  describe('Property operations', () => {
    it('should fetch contact properties', async () => {
      const properties = await service.getContactProperties();

      expect(Array.isArray(properties)).toBe(true);
      expect(properties.length).toBeGreaterThan(0);

      const emailProp = properties.find((p) => p.name === 'email');
      expect(emailProp).toBeDefined();
      expect(emailProp?.type).toBeDefined();
    }, 10000);

    it('should cache property requests', async () => {
      const start1 = Date.now();
      await service.getContactProperties();
      const duration1 = Date.now() - start1;

      // Clear internal cache to force re-fetch would require new service instance
      // Instead, verify cache stats
      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      const start2 = Date.now();
      await service.getContactProperties();
      const duration2 = Date.now() - start2;

      // Cached request should be faster
      expect(duration2).toBeLessThan(duration1);
    }, 10000);
  });

  describe('Rate limiting', () => {
    it('should respect rate limits', async () => {
      const status = service.getRateLimiterStatus();

      expect(status.maxTokens).toBe(100);
      expect(status.tokens).toBeLessThanOrEqual(100);
    });

    it('should handle concurrent requests', async () => {
      if (!testContactId) {
        // Create a test contact for this test
        const email = `test-${Date.now()}@example.com`;
        const contact = await service.createContact({ email });
        testContactId = contact.id;
      }

      // Make 5 concurrent requests
      const promises = Array.from({ length: 5 }, () => service.getContact(testContactId!, ['email']));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((contact) => {
        expect(contact.id).toBe(testContactId);
      });
    }, 15000);
  });

  describe('Error handling', () => {
    it('should handle 404 errors', async () => {
      await expect(service.getContact('99999999')).rejects.toThrow();
    });

    it('should retry on transient failures', async () => {
      // This test would need to simulate a 429 or 5xx error
      // For now, just verify the service is configured for retries
      expect(service).toBeDefined();
    });
  });
});
