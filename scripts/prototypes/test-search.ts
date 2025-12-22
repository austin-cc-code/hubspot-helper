/**
 * Prototype: Test CRM Search API
 *
 * Demonstrates efficient filtering using Search API vs fetching all records
 */

import { Client } from '@hubspot/api-client';
import dotenv from 'dotenv';

dotenv.config();

async function testSearch(): Promise<void> {
  const client = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN! });

  console.log('🔍 Testing HubSpot Search API...\n');

  try {
    // Example 1: Find contacts with email addresses
    console.log('1️⃣  Finding contacts with email addresses...');
    const withEmail = await client.crm.contacts.searchApi.doSearch({
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
      properties: ['email', 'firstname', 'lastname', 'company'],
      limit: 10,
    });
    console.log(`   ✅ Found ${withEmail.total} contacts with email`);
    console.log(`   📊 Showing first ${withEmail.results.length}:`);
    withEmail.results.forEach((contact) => {
      console.log(
        `      - ${contact.properties.firstname} ${contact.properties.lastname} (${contact.properties.email})`
      );
    });

    // Example 2: Find contacts missing required fields
    console.log('\n2️⃣  Finding contacts missing phone numbers...');
    const missingPhone = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'phone',
              operator: 'NOT_HAS_PROPERTY',
            },
          ],
        },
      ],
      properties: ['email', 'firstname', 'lastname'],
      limit: 10,
    });
    console.log(`   ✅ Found ${missingPhone.total} contacts without phone`);

    // Example 3: Find recently created contacts
    console.log('\n3️⃣  Finding contacts created in last 30 days...');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentContacts = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'createdate',
              operator: 'GTE',
              value: thirtyDaysAgo.getTime().toString(),
            },
          ],
        },
      ],
      properties: ['email', 'firstname', 'createdate'],
      sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
      limit: 10,
    });
    console.log(`   ✅ Found ${recentContacts.total} recent contacts`);

    // Example 4: Complex filter (AND logic within group)
    console.log('\n4️⃣  Finding contacts with email AND company...');
    const withEmailAndCompany = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'HAS_PROPERTY',
            },
            {
              propertyName: 'company',
              operator: 'HAS_PROPERTY',
            },
          ],
        },
      ],
      properties: ['email', 'company'],
      limit: 10,
    });
    console.log(`   ✅ Found ${withEmailAndCompany.total} contacts with both`);

    // Example 5: OR logic using multiple filter groups
    console.log('\n5️⃣  Finding contacts with email OR phone...');
    const withEmailOrPhone = await client.crm.contacts.searchApi.doSearch({
      filterGroups: [
        {
          filters: [{ propertyName: 'email', operator: 'HAS_PROPERTY' }],
        },
        {
          filters: [{ propertyName: 'phone', operator: 'HAS_PROPERTY' }],
        },
      ],
      properties: ['email', 'phone'],
      limit: 10,
    });
    console.log(`   ✅ Found ${withEmailOrPhone.total} contacts with either`);

    console.log('\n✅ Search API tests complete!\n');
    console.log('Key takeaways:');
    console.log('- Use Search API for filtered queries (much faster than fetch all)');
    console.log('- Supports AND logic within filter groups');
    console.log('- Supports OR logic between filter groups');
    console.log('- Max 10,000 results per query\n');
  } catch (error: any) {
    console.error('❌ Search test failed:', error.message);
    process.exit(1);
  }
}

testSearch();
