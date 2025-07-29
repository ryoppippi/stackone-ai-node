import { ExecuteToolChain, GetRelevantTools } from '../meta-tools';
import { loadStackOneSpecs } from '../openapi/loader';
import { StackOneTool, Tools } from '../tool';
import type { ToolDefinition } from '../types';
import { removeJsonSchemaProperty } from '../utils/schema';
import { type BaseToolSetConfig, ToolSet, ToolSetConfigError } from './base';

/**
 * Configuration for StackOne toolset
 */
export interface StackOneToolSetConfig extends BaseToolSetConfig {
  apiKey?: string;
  accountId?: string;
  strict?: boolean;
  removedParams?: string[]; // List of parameters to remove from all tools
  includeMetaTools?: boolean; // Whether to include meta tools (default: true)
}

/**
 * Configuration for workflow
 */
export interface WorkflowConfig {
  key: string;
  input: string;
  model: string;
  tools: string[];
  accountIds: string[];
  cache?: boolean;
}

/**
 * Class for loading StackOne tools from the OAS directory
 */
export class StackOneToolSet extends ToolSet {
  /**
   * Account ID for StackOne API
   */
  private accountId?: string;
  private readonly _removedParams: string[];
  private readonly includeMetaTools: boolean;

  /**
   * Initialize StackOne toolset with API key and optional account ID
   * @param config Configuration object containing API key and optional account ID
   */
  constructor(config?: StackOneToolSetConfig) {
    const apiKey = config?.apiKey || process.env.STACKONE_API_KEY;

    if (!apiKey && config?.strict) {
      throw new ToolSetConfigError(
        'No API key provided. Set STACKONE_API_KEY environment variable or pass apiKey in config.'
      );
    }

    if (!apiKey) {
      console.warn(
        'No API key provided. Set STACKONE_API_KEY environment variable or pass apiKey in config.'
      );
    }

    const authentication = {
      type: 'basic' as const,
      credentials: {
        username: apiKey || '',
        password: '',
      },
    };

    const accountId = config?.accountId || process.env.STACKONE_ACCOUNT_ID;

    const headers = {
      ...config?.headers,
      ...(accountId ? { 'x-account-id': accountId } : {}),
    };

    // Initialize base class
    super({
      baseUrl: config?.baseUrl,
      authentication,
      headers,
    });

    this.accountId = accountId;
    this._removedParams = ['source_value'];
    this.includeMetaTools = config?.includeMetaTools !== false; // Default to true

    // Load tools
    this.loadTools();
  }

  /**
   * Get StackOne tools matching a filter pattern
   * @param filterPattern Optional glob pattern or array of patterns to filter tools
   * @param accountId Optional account ID to use for the tools
   * @returns Collection of tools matching the filter pattern
   */
  getStackOneTools(filterPattern?: string | string[], accountId?: string): Tools {
    // Use provided account ID or fall back to the instance account ID
    const effectiveAccountId = accountId || this.accountId;

    // Create headers with account ID if provided
    const headers: Record<string, string> = effectiveAccountId
      ? { 'x-account-id': effectiveAccountId }
      : {};

    // Get tools with headers
    const tools = this.getTools(filterPattern, headers);

    // If meta tools are included and no specific filter is provided or filter matches meta tools
    if (this.includeMetaTools && this.shouldIncludeMetaTools(filterPattern)) {
      const allTools = tools.toArray();

      // Add meta tools
      const metaTools = [new GetRelevantTools(allTools), new ExecuteToolChain(tools)];

      // Return combined tools
      return new Tools([...allTools, ...metaTools]);
    }

    return tools;
  }

  /**
   * Plan a workflow
   * @param config Configuration object containing workflow details
   * @returns Workflow object
   */
  plan(_: WorkflowConfig): Promise<StackOneTool> {
    throw new Error('Not implemented yet');
  }

  /**
   * Load tools from the OAS directory
   */
  private loadTools(): void {
    const specs = loadStackOneSpecs(this.baseUrl, this._removedParams);

    // Process each vertical
    for (const [_, tools] of Object.entries(specs)) {
      // Process each tool
      for (const [toolName, toolDef] of Object.entries(tools)) {
        // Remove account ID parameter if not provided
        if (!this.accountId) {
          this.removeAccountIdParameter(toolDef);
        }

        // Create tool
        const tool = new StackOneTool(
          toolName,
          toolDef.description,
          toolDef.parameters,
          toolDef.execute,
          this.headers
        );

        // Add tool to the list
        this.tools.push(tool);
      }
    }
  }

  /**
   * Remove account ID parameter from a tool definition
   * @param toolDef Tool definition to modify
   */
  private removeAccountIdParameter(toolDef: ToolDefinition): void {
    // Remove from parameters
    if (toolDef.parameters.properties && 'x-account-id' in toolDef.parameters.properties) {
      removeJsonSchemaProperty(toolDef.parameters.properties, 'x-account-id');
    }

    // Remove from required parameters
    if (toolDef.parameters.required) {
      toolDef.parameters.required = toolDef.parameters.required.filter(
        (param) => param !== 'x-account-id'
      );
    }
  }

  /**
   * Check if meta tools should be included based on filter pattern
   * @param filterPattern Filter pattern to check
   * @returns Whether meta tools should be included
   */
  private shouldIncludeMetaTools(filterPattern?: string | string[]): boolean {
    // If no filter, include meta tools
    if (!filterPattern) {
      return true;
    }

    // Check if any pattern would match meta tool names
    const metaToolNames = ['get_relevant_tools', 'execute_tool_chain'];
    const patterns = Array.isArray(filterPattern) ? filterPattern : [filterPattern];

    for (const pattern of patterns) {
      // If pattern starts with !, it's a negative pattern
      if (pattern.startsWith('!')) {
        const negPattern = pattern.substring(1);
        // If any meta tool matches negative pattern, exclude meta tools
        if (metaToolNames.some((name) => this._matchGlob(name, negPattern))) {
          return false;
        }
      } else {
        // If any meta tool matches positive pattern, include meta tools
        if (metaToolNames.some((name) => this._matchGlob(name, pattern))) {
          return true;
        }
      }
    }

    // If only positive patterns and no match, exclude meta tools
    return patterns.every((p) => p.startsWith('!'));
  }
}
