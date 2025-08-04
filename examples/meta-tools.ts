/**
 * Meta Tools Example
 *
 * This example demonstrates how to use the beta meta tools for intelligent
 * tool discovery and orchestration.
 *
 * @beta These are beta features and may change in future versions
 */

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { StackOneToolSet, Tools } from '../src';
import { ACCOUNT_IDS } from './constants';

// Example 1: Using metaRelevantTool to discover tools
async function discoverToolsExample() {
  console.log('\n=== Example 1: Discovering Relevant Tools ===');

  const toolset = new StackOneToolSet();
  const tools = toolset.getTools('hris_*', ACCOUNT_IDS.HRIS);

  // Get the meta tool for finding relevant tools
  const relevantToolsFinder = tools.metaRelevantTool();

  // Example queries for different use cases
  const queries = [
    'list employees',
    'get employee',
    'create employee',
    'list companies',
    'get company',
    'list applications',
  ];

  for (const query of queries) {
    console.log(`\nSearching for: "${query}"`);
    const result = await relevantToolsFinder.execute({
      query,
      limit: 3,
      minScore: 0.5,
    });

    console.log(`Found ${result.resultsCount} tools:`);
    for (const tool of result.tools as Array<{
      name: string;
      score: number;
      matchReason: string;
    }>) {
      console.log(`  - ${tool.name} (score: ${tool.score.toFixed(2)}) - ${tool.matchReason}`);
    }
  }
}

// Example 2: Using metaExecuteTool for complex workflows
async function toolChainExample() {
  console.log('\n=== Example 2: Executing Tool Chains ===');

  const toolset = new StackOneToolSet();
  const tools = toolset.getTools('hris_*', ACCOUNT_IDS.HRIS);

  // Get the meta tool for executing tool chains
  const toolChain = tools.metaExecuteTool();

  // Example: Employee onboarding workflow
  console.log('\nExecuting employee onboarding workflow...');

  const result = await toolChain.execute({
    steps: [
      {
        toolName: 'hris_list_employees',
        parameters: {
          filter: {
            updated_after: '2024-01-01T00:00:00Z',
          },
          page_size: '10',
        },
        stepName: 'Get recent employees',
      },
      {
        toolName: 'hris_get_employee',
        parameters: {
          id: '{{step0.result.items[0].id}}', // Get first employee ID
        },
        stepName: 'Get employee details',
        condition: '{{step0.result.items.length}} > 0',
      },
    ],
    accountId: ACCOUNT_IDS.HRIS,
  });

  console.log(`\nWorkflow execution ${result.success ? 'succeeded' : 'failed'}`);
  console.log(`Total execution time: ${result.executionTime}ms`);

  for (const step of result.stepResults as Array<{
    stepIndex: number;
    stepName: string;
    success: boolean;
    skipped?: boolean;
    error?: string;
  }>) {
    console.log(`\nStep ${step.stepIndex + 1}: ${step.stepName}`);
    console.log(`  Status: ${step.success ? 'Success' : 'Failed'}`);
    if (step.skipped) {
      console.log('  Skipped due to condition');
    }
    if (step.error) {
      console.log(`  Error: ${step.error}`);
    }
  }
}

// Example 3: Using meta tools with AI agents
async function aiAgentExample() {
  console.log('\n=== Example 3: Meta Tools with AI Agents ===');

  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.log('Skipping AI agent example - OPENAI_API_KEY environment variable not set');
    return;
  }

  const toolset = new StackOneToolSet();
  const tools = toolset.getTools('hris_*', ACCOUNT_IDS.HRIS);

  // Get both meta tools
  const { metaRelevantTool, metaExecuteTool } = tools.metaTools();

  // Convert meta tools to AI SDK format
  const aiTools = new Tools([metaRelevantTool, metaExecuteTool]).toAISDK();

  try {
    // Use with AI agent
    const { text, toolCalls } = await generateText({
      model: openai('gpt-4o-mini'),
      tools: aiTools,
      prompt: `You are an HR assistant. First, use meta_relevant_tool to find tools 
               related to listing employees. Then use meta_execute_tool to get the 
               list of employees and fetch details for the first one.`,
      maxSteps: 5,
    });

    console.log('\nAI Agent Response:');
    console.log(text);

    console.log('\nTool calls made:');
    for (const call of toolCalls || []) {
      console.log(`- ${call.toolName}`);
    }
  } catch (error) {
    console.error('Error in AI agent example:', error instanceof Error ? error.message : error);
  }
}

// Example 4: Different ways to use meta tools
async function usageExample() {
  console.log('\n=== Example 4: Different Ways to Use Meta Tools ===');

  const toolset = new StackOneToolSet();

  // Method 1: Get tools and then get meta tools
  const tools = toolset.getTools('hris_*', ACCOUNT_IDS.HRIS);

  // Get individual meta tools
  const relevantTool = tools.metaRelevantTool();
  console.log(`Got meta tool: ${relevantTool.name}`);

  const executeTool = tools.metaExecuteTool();
  console.log(`Got meta tool: ${executeTool.name}`);

  // Get both meta tools at once
  const { metaRelevantTool, metaExecuteTool } = tools.metaTools();
  console.log(`Got both meta tools: ${metaRelevantTool.name}, ${metaExecuteTool.name}`);
}

// Main execution
async function main() {
  console.log('Meta Tools Examples (Beta)');
  console.log('==========================');
  console.log('Note: These are beta features and may change in future versions.\n');

  try {
    await discoverToolsExample();
    await toolChainExample();
    await aiAgentExample();
    await usageExample();
  } catch (error) {
    console.error('Error in examples:', error);
  }
}

// Only run if this file is executed directly
if (import.meta.main) {
  main();
}
