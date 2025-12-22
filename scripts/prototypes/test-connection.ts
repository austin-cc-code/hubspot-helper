/**
 * Prototype: Test HubSpot API Connection
 *
 * Tests basic connectivity and credential validity
 * Verifies required scopes are available
 */

import { Client } from '@hubspot/api-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testConnection(): Promise<void> {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('❌ HUBSPOT_ACCESS_TOKEN not found in environment');
    console.log('\nSet up your credentials:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Add your HubSpot Private App token');
    process.exit(1);
  }

  console.log('🔌 Testing HubSpot API connection...\n');

  const client = new Client({ accessToken });

  try {
    // Test 1: Fetch portal info
    console.log('1️⃣  Testing portal access...');
    const accountInfo = await client.apiRequest({
      method: 'GET',
      path: '/integrations/v1/me',
    });
    console.log(`   ✅ Connected to portal: ${accountInfo.portalId}`);
    console.log(`   📍 Time zone: ${accountInfo.timeZone}`);

    // Test 2: List contacts (read scope)
    console.log('\n2️⃣  Testing contact read access...');
    const contacts = await client.crm.contacts.getAll(1);
    console.log(`   ✅ Contact read access confirmed`);
    console.log(`   📊 Sample contact ID: ${contacts.results[0]?.id || 'N/A'}`);

    // Test 3: List companies (read scope)
    console.log('\n3️⃣  Testing company read access...');
    const companies = await client.crm.companies.getAll(1);
    console.log(`   ✅ Company read access confirmed`);
    console.log(`   📊 Sample company ID: ${companies.results[0]?.id || 'N/A'}`);

    // Test 4: Get property definitions
    console.log('\n4️⃣  Testing property schema access...');
    const properties = await client.crm.properties.coreApi.getAll('contacts');
    console.log(`   ✅ Property schema access confirmed`);
    console.log(`   📊 Available properties: ${properties.results.length}`);

    // Test 5: Check rate limits
    console.log('\n5️⃣  Checking rate limits...');
    const response: any = await client.crm.contacts.getAll(1);
    if (response.headers) {
      const dailyLimit = response.headers['x-hubspot-ratelimit-daily'];
      const remaining = response.headers['x-hubspot-ratelimit-daily-remaining'];
      console.log(`   ✅ Rate limits visible`);
      console.log(`   📊 Daily limit: ${dailyLimit || 'Unknown'}`);
      console.log(`   📊 Remaining today: ${remaining || 'Unknown'}`);
    }

    console.log('\n✅ All tests passed! HubSpot API connection is working.\n');
    console.log('Next steps:');
    console.log('- Run other prototype scripts to test specific operations');
    console.log('- Verify all required scopes are available');
    console.log('- Test search and batch operations\n');
  } catch (error: any) {
    console.error('\n❌ Connection test failed!\n');

    if (error.code === 401) {
      console.error('Authentication failed. Your access token may be invalid or expired.');
      console.error('Generate a new token in: HubSpot > Settings > Integrations > Private Apps\n');
    } else if (error.code === 403) {
      console.error('Access forbidden. Your Private App may be missing required scopes:');
      console.error('- crm.objects.contacts.read');
      console.error('- crm.objects.companies.read');
      console.error('- crm.schemas.contacts.read\n');
    } else {
      console.error(`Error: ${error.message}`);
      if (error.response?.body) {
        console.error(`Details: ${JSON.stringify(error.response.body, null, 2)}`);
      }
    }

    process.exit(1);
  }
}

testConnection();
