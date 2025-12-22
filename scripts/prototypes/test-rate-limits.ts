/**
 * Prototype: Test Rate Limiting
 *
 * Empirically tests HubSpot's rate limits
 * Observes rate limit headers and 429 responses
 */

import { Client } from '@hubspot/api-client';
import dotenv from 'dotenv';

dotenv.config();

interface RateLimitInfo {
  dailyLimit: number;
  dailyRemaining: number;
  intervalMs: number;
  maxPerInterval: number;
  remainingInInterval: number;
}

function extractRateLimits(headers: any): RateLimitInfo | null {
  if (!headers) return null;

  return {
    dailyLimit: parseInt(headers['x-hubspot-ratelimit-daily'] || '0'),
    dailyRemaining: parseInt(headers['x-hubspot-ratelimit-daily-remaining'] || '0'),
    intervalMs: parseInt(headers['x-hubspot-ratelimit-interval-milliseconds'] || '10000'),
    maxPerInterval: parseInt(headers['x-hubspot-ratelimit-max'] || '100'),
    remainingInInterval: parseInt(headers['x-hubspot-ratelimit-remaining'] || '0'),
  };
}

async function testRateLimits(): Promise<void> {
  const client = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN! });

  console.log('⏱️  Testing HubSpot Rate Limits...\n');
  console.log('This test will make rapid API calls to observe rate limit behavior.\n');

  try {
    // Test 1: Check initial rate limits
    console.log('1️⃣  Checking initial rate limit status...');
    const initial: any = await client.crm.contacts.getAll(1);
    const initialLimits = extractRateLimits(initial.headers);

    if (initialLimits) {
      console.log(`   📊 Daily limit: ${initialLimits.dailyLimit}`);
      console.log(`   📊 Daily remaining: ${initialLimits.dailyRemaining}`);
      console.log(`   📊 Interval: ${initialLimits.intervalMs}ms`);
      console.log(`   📊 Max per interval: ${initialLimits.maxPerInterval}`);
      console.log(`   📊 Remaining in current interval: ${initialLimits.remainingInInterval}\n`);
    } else {
      console.log('   ⚠️  Rate limit headers not available\n');
    }

    // Test 2: Make rapid requests to test interval limits
    console.log('2️⃣  Making 10 rapid requests to test interval limits...');
    const requestTimes: number[] = [];
    const rateLimits: (RateLimitInfo | null)[] = [];

    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      try {
        const response: any = await client.crm.contacts.getAll(1);
        const duration = Date.now() - start;
        requestTimes.push(duration);
        rateLimits.push(extractRateLimits(response.headers));

        const limits = rateLimits[i];
        if (limits) {
          console.log(
            `   Request ${i + 1}: ${duration}ms - Remaining: ${limits.remainingInInterval}/${limits.maxPerInterval}`
          );
        } else {
          console.log(`   Request ${i + 1}: ${duration}ms`);
        }
      } catch (error: any) {
        if (error.code === 429) {
          console.log(`   ⚠️  Request ${i + 1}: Rate limited (429 response)`);
          console.log(`   📊 Retry-After: ${error.response?.headers?.['retry-after'] || 'N/A'} seconds`);
          break;
        }
        throw error;
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Calculate statistics
    const avgDuration = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;
    const maxDuration = Math.max(...requestTimes);
    const minDuration = Math.min(...requestTimes);

    console.log('\n   📊 Statistics:');
    console.log(`      Average response time: ${avgDuration.toFixed(0)}ms`);
    console.log(`      Min response time: ${minDuration}ms`);
    console.log(`      Max response time: ${maxDuration}ms`);

    // Test 3: Demonstrate token bucket concept
    console.log('\n3️⃣  Token Bucket Algorithm Concept:');
    console.log('   - Start with 100 tokens (requests)');
    console.log('   - Each API call consumes 1 token');
    console.log('   - Tokens refill to 100 every 10 seconds');
    console.log('   - Can burst all 100 immediately, but then must wait for refill');
    console.log('   - Our implementation will queue requests to stay under limit\n');

    // Test 4: Check if limits reset
    console.log('4️⃣  Rate limit reset behavior:');
    console.log('   - Interval-based: Resets every 10 seconds');
    console.log('   - Daily: Resets at midnight (portal timezone)');
    console.log('   - 429 response includes Retry-After header\n');

    console.log('✅ Rate limit tests complete!\n');
    console.log('Implementation recommendations:');
    console.log('1. Track tokens in a bucket (100 initial, refill to 100 every 10s)');
    console.log('2. Queue requests when tokens exhausted');
    console.log('3. Implement exponential backoff for 429 responses');
    console.log('4. Add jitter to prevent thundering herd');
    console.log('5. Use batch operations to reduce request count\n');
  } catch (error: any) {
    console.error('❌ Rate limit test failed:', error.message);
    process.exit(1);
  }
}

testRateLimits();
