/**
 * # Error Handling
 *
 * This example shows how to handle errors when using the StackOne SDK.
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { StackOneAPIError, StackOneError, StackOneToolSet, ToolsetConfigError } from '../src';

const errorHandling = async (): Promise<void> => {
  try {
    // Example 1: Handle initialization errors
    console.log('Example 1: Handle initialization errors');
    try {
      // Temporarily save the API key
      const originalKey = process.env.STACKONE_API_KEY;
      // Delete the API key to force an error
      process.env.STACKONE_API_KEY = undefined;

      // This will throw a ToolsetConfigError
      const _toolset = new StackOneToolSet();

      // Restore the API key
      process.env.STACKONE_API_KEY = originalKey;
    } catch (error) {
      if (error instanceof ToolsetConfigError) {
        console.log('✓ Caught ToolsetConfigError:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }

    // Example 2: Handle API errors
    console.log('\nExample 2: Handle API errors');
    const toolset = new StackOneToolSet();
    const accountId = 'invalid-account-id'; // Invalid account ID to force an error

    try {
      const tools = toolset.getTools('hris_*', accountId);
      const employeeTool = tools.getTool('hris_list_employees');

      if (employeeTool) {
        // This will throw a StackOneAPIError due to the invalid account ID
        await employeeTool.execute();
      }
    } catch (error) {
      if (error instanceof StackOneAPIError) {
        console.log('✓ Caught StackOneAPIError:');
        console.log(`  Status code: ${error.statusCode}`);
        console.log(`  Response body: ${JSON.stringify(error.responseBody)}`);
      } else if (error instanceof StackOneError) {
        console.log('✓ Caught StackOneError:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
    }

    // Example 3: Handle invalid tool name
    console.log('\nExample 3: Handle invalid tool name');
    try {
      const tools = toolset.getTools('hris_*');
      const nonExistentTool = tools.getTool('non_existent_tool');

      if (!nonExistentTool) {
        console.log('✓ Tool not found, as expected');
      } else {
        // This should not happen
        console.error('Unexpected: Tool was found');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
    }

    // Example 4: Handle invalid arguments
    console.log('\nExample 4: Handle invalid arguments');
    try {
      const tools = toolset.getTools('hris_*');
      const employeeTool = tools.getTool('hris_get_employee');

      if (employeeTool) {
        // This will throw an error due to missing required arguments
        await employeeTool.execute();
      }
    } catch (error) {
      if (error instanceof StackOneAPIError) {
        console.log('✓ Caught StackOneAPIError:');
        console.log(`  Status code: ${error.statusCode}`);
        console.log(`  Response body: ${JSON.stringify(error.responseBody)}`);
      } else if (error instanceof StackOneError) {
        console.log('✓ Caught StackOneError:', error.message);
      } else {
        console.log('✓ Caught error:', error instanceof Error ? error.message : String(error));
      }
    }
  } catch (error) {
    console.error('Unhandled error:', error);
  }
};

// Run the example
errorHandling().catch(console.error);
