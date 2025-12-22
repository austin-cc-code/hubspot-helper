/**
 * Prototype: Test Batch Operations
 *
 * Demonstrates batch read/update for efficiency
 * Shows how 100 operations can be done in 1 API call
 */

import { Client } from '@hubspot/api-client';
import dotenv from 'dotenv';

dotenv.config();

async function testBatch(): Promise<void> {
  const client = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN! });

  console.log('📦 Testing HubSpot Batch Operations...\n');

  try {
    // First, get some contact IDs to work with
    console.log('1️⃣  Fetching sample contacts...');
    const contacts = await client.crm.contacts.getAll(5);
    const contactIds = contacts.results.map((c) => c.id);
    console.log(`   ✅ Retrieved ${contactIds.length} contact IDs`);

    // Test 1: Batch Read
    console.log('\n2️⃣  Testing batch read (fetch multiple contacts in one call)...');
    const start = Date.now();
    const batchRead = await client.crm.contacts.batchApi.read({
      properties: ['email', 'firstname', 'lastname', 'company'],
      inputs: contactIds.map((id) => ({ id })),
    });
    const duration = Date.now() - start;
    console.log(`   ✅ Retrieved ${batchRead.results.length} contacts in ${duration}ms`);
    console.log(
      `   📊 Efficiency: 1 API call instead of ${contactIds.length} (${contactIds.length}x faster!)`
    );

    // Test 2: Batch Update (read-only test - just demonstrate structure)
    console.log('\n3️⃣  Demonstrating batch update structure (not executed)...');
    const batchUpdateExample = {
      inputs: [
        {
          id: 'contact-id-1',
          properties: {
            data_quality_score: '85',
            last_audit_date: new Date().toISOString(),
          },
        },
        {
          id: 'contact-id-2',
          properties: {
            data_quality_score: '92',
            last_audit_date: new Date().toISOString(),
          },
        },
        // ... up to 100 contacts
      ],
    };
    console.log('   ℹ️  Batch update structure:');
    console.log(JSON.stringify(batchUpdateExample, null, 2));
    console.log('   📊 Can update up to 100 contacts in 1 API call');

    // Test 3: Error Handling in Batch Operations
    console.log('\n4️⃣  Testing batch with invalid ID (error handling)...');
    try {
      const batchWithError = await client.crm.contacts.batchApi.read({
        properties: ['email'],
        inputs: [{ id: contactIds[0] }, { id: 'invalid-id-12345' }],
      });

      console.log('   ℹ️  Batch operations support partial success:');
      console.log(`   ✅ Successful: ${batchWithError.results.length}`);
      console.log(`   ❌ Errors: ${batchWithError.errors?.length || 0}`);

      if (batchWithError.errors && batchWithError.errors.length > 0) {
        console.log('   📊 Error details:');
        batchWithError.errors.forEach((error: any) => {
          console.log(`      - ${error.message}`);
        });
      }
    } catch (error: any) {
      console.log('   ℹ️  Some errors throw exceptions, need to handle both cases');
    }

    // Performance comparison
    console.log('\n5️⃣  Performance comparison:');
    console.log('   Individual API calls:');
    console.log(`   - 100 contacts = 100 API calls = ~10 seconds (@ 10 req/sec)`);
    console.log('   - Hits rate limit quickly');
    console.log('\n   Batch API:');
    console.log(`   - 100 contacts = 1 API call = ~100ms`);
    console.log('   - 100x faster!');
    console.log('   - Uses 1 rate limit token instead of 100');

    console.log('\n✅ Batch operation tests complete!\n');
    console.log('Key takeaways:');
    console.log('- Always use batch operations for multiple records');
    console.log('- Max 100 records per batch');
    console.log('- Batch operations support partial success (check errors array)');
    console.log('- Much more efficient for rate limiting\n');
  } catch (error: any) {
    console.error('❌ Batch test failed:', error.message);
    process.exit(1);
  }
}

testBatch();
