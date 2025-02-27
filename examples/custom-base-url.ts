#!/usr/bin/env bun
/**
 * Example demonstrating how to use a custom base URL with StackOne tools.
 *
 * This is useful for:
 * 1. Testing against development APIs
 * 2. Working with self-hosted StackOne instances
 *
 * Usage:
 *
 * ```bash
 * bun run examples/custom-base-url.ts
 * ```
 */

import { StackOneToolSet } from '../src';

const customBaseUrl = async (): Promise<void> => {
  /**
   * Default base URL
   */
  const defaultToolset = new StackOneToolSet();
  const hrisTools = defaultToolset.getTools('hris_*');

  console.log(`Found ${hrisTools.length} HRIS tools with default base URL`);
  const defaultTool = hrisTools.getTool('hris_get_employee');
  if (defaultTool) {
    console.log(`Default tool URL: ${defaultTool._executeConfig.url}`);
    // Should start with https://api.stackone.com
  }

  /**
   * Custom base URL
   */
  const devToolset = new StackOneToolSet(
    process.env.STACKONE_API_KEY,
    process.env.STACKONE_ACCOUNT_ID,
    'https://api.example-dev.com'
  );
  const devHrisTools = devToolset.getTools('hris_*');

  console.log(`Found ${devHrisTools.length} HRIS tools with custom base URL`);
  const devTool = devHrisTools.getTool('hris_get_employee');
  if (devTool) {
    console.log(`Custom tool URL: ${devTool._executeConfig.url}`);
    // Should start with https://api.example-dev.com
  }

  /**
   * Note this uses the same tools but substitutes the base URL
   */
  if (defaultTool && devTool) {
    console.assert(defaultTool.name === devTool.name, 'Tool names should be the same');
    console.assert(
      defaultTool._executeConfig.url.includes('https://api.stackone.com'),
      'Default tool should use the default base URL'
    );
    console.assert(
      devTool._executeConfig.url.includes('https://api.example-dev.com'),
      'Custom tool should use the custom base URL'
    );
  }
};

// Run the example
customBaseUrl().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
