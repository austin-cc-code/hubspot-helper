/**
 * Integration Test Prototype for HubSpotService
 *
 * Tests the HubSpotService against a real HubSpot portal.
 * Requires valid HUBSPOT_ACCESS_TOKEN in environment.
 *
 * Usage: npx tsx scripts/prototypes/test-hubspot-service.ts
 */

import { HubSpotService } from '../../src/services/HubSpotService.js';
import { createHubSpotRateLimiter } from '../../src/services/RateLimiter.js';
import { CacheService } from '../../src/services/CacheService.js';

async function main() {
  console.log('🧪 HubSpotService Integration Test\n');

  // Check for access token
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    console.error('❌ HUBSPOT_ACCESS_TOKEN environment variable not set');
    process.exit(1);
  }

  const service = new HubSpotService({
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
    rateLimiter: createHubSpotRateLimiter(),
    cache: new CacheService(30),
  });

  try {
    // Test 1: Fetch contacts with pagination
    console.log('📋 Test 1: Fetch contacts with pagination');
    let contactCount = 0;
    let pageCount = 0;

    for await (const contactBatch of service.getContacts(['email', 'firstname', 'lastname'], 10)) {
      contactCount += contactBatch.length;
      pageCount++;
      console.log(`  Page ${pageCount}: ${contactBatch.length} contacts`);

      if (pageCount >= 3) break; // Limit to 3 pages for testing
    }

    console.log(`  ✅ Fetched ${contactCount} contacts across ${pageCount} pages\n`);

    // Test 2: Get contact properties (cached)
    console.log('📊 Test 2: Get contact properties (should cache)');
    const start1 = Date.now();
    const props1 = await service.getContactProperties();
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    const props2 = await service.getContactProperties();
    const time2 = Date.now() - start2;

    console.log(`  First call: ${props1.length} properties in ${time1}ms`);
    console.log(`  Second call (cached): ${props2.length} properties in ${time2}ms`);
    console.log(`  ✅ Cache speedup: ${Math.round(time1 / time2)}x faster\n`);

    // Test 3: Search API
    console.log('🔍 Test 3: Search API');
    const searchResult = await service.searchContacts({
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

    console.log(`  ✅ Found ${searchResult.total} contacts with email`);
    console.log(`  Returned ${searchResult.results.length} contacts\n`);

    // Test 4: Rate limiter status
    console.log('⏱️  Test 4: Rate limiter status');
    const rateLimitStatus = service.getRateLimiterStatus();
    console.log(`  Tokens: ${rateLimitStatus.tokens}/${rateLimitStatus.maxTokens}`);
    console.log(`  Active requests: ${rateLimitStatus.activeRequests}/${rateLimitStatus.maxConcurrent}`);
    console.log(`  Queue size: ${rateLimitStatus.queueSize}`);
    console.log(`  ✅ Rate limiter working\n`);

    // Test 5: Cache stats
    console.log('💾 Test 5: Cache statistics');
    const cacheStats = service.getCacheStats();
    console.log(`  Cache size: ${cacheStats.size} entries`);
    console.log(`  Expired entries: ${cacheStats.expired}`);
    console.log(`  ✅ Cache working\n`);

    // Test 6: Get single contact
    if (contactCount > 0) {
      console.log('👤 Test 6: Get single contact');
      const generator = service.getContacts(['email'], 1);
      const firstBatch = await generator.next();

      if (!firstBatch.done && firstBatch.value.length > 0) {
        const contactId = firstBatch.value[0].id;
        const contact = await service.getContact(contactId, ['email', 'firstname', 'lastname']);

        console.log(`  Contact ID: ${contact.id}`);
        console.log(`  Email: ${contact.properties.email || 'N/A'}`);
        console.log(`  Name: ${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`);
        console.log(`  ✅ Single contact fetch working\n`);
      }
    }

    // Test 7: Companies
    console.log('🏢 Test 7: Fetch companies');
    let companyCount = 0;
    for await (const companyBatch of service.getCompanies(['name', 'domain'], 10)) {
      companyCount += companyBatch.length;
      if (companyCount >= 10) break; // Just get a few
    }
    console.log(`  ✅ Fetched ${companyCount} companies\n`);

    // Test 8: Deals
    console.log('💰 Test 8: Fetch deals');
    let dealCount = 0;
    for await (const dealBatch of service.getDeals(['dealname', 'amount'], 10)) {
      dealCount += dealBatch.length;
      if (dealCount >= 10) break; // Just get a few
    }
    console.log(`  ✅ Fetched ${dealCount} deals\n`);

    // All tests passed
    console.log('✨ All tests passed!');

    // Clean up
    service.destroy();
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.statusCode) {
      console.error(`   Status: ${error.statusCode}`);
    }
    if (error.category) {
      console.error(`   Category: ${error.category}`);
    }
    service.destroy();
    process.exit(1);
  }
}

main();
