import * as fs from 'node:fs';
import * as path from 'node:path';
import { OAS_DIR } from './constants';
import { StackOneTool, Tools } from './models';
import { OpenAPIParser } from './openapi/parser';

/**
 * Base exception for toolset errors
 */
export class ToolsetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolsetError';
  }
}

/**
 * Raised when there is an error in the toolset configuration
 */
export class ToolsetConfigError extends ToolsetError {
  constructor(message: string) {
    super(message);
    this.name = 'ToolsetConfigError';
  }
}

/**
 * Raised when there is an error loading tools
 */
export class ToolsetLoadError extends ToolsetError {
  constructor(message: string) {
    super(message);
    this.name = 'ToolsetLoadError';
  }
}

/**
 * Main class for accessing StackOne tools
 */
export class StackOneToolSet {
  private apiKey: string;
  private accountId?: string;
  private baseUrl?: string;

  /**
   * Initialize StackOne tools with authentication
   * @param apiKey Optional API key. If not provided, will try to get from STACKONE_API_KEY env var
   * @param accountId Optional account ID. If not provided, will try to get from STACKONE_ACCOUNT_ID env var
   * @param baseUrl Optional base URL for API requests. If not provided, will use the default from the OpenAPI spec
   * @throws ToolsetConfigError If no API key is provided or found in environment
   */
  constructor(apiKey?: string, accountId?: string, baseUrl?: string) {
    const apiKeyValue = apiKey || process.env.STACKONE_API_KEY;
    if (!apiKeyValue) {
      throw new ToolsetConfigError(
        'API key must be provided either through apiKey parameter or ' +
          'STACKONE_API_KEY environment variable'
      );
    }
    this.apiKey = apiKeyValue;
    this.accountId = accountId || process.env.STACKONE_ACCOUNT_ID;
    this.baseUrl = baseUrl;
  }

  /**
   * Check if a tool name matches the filter pattern
   * @param toolName Name of the tool to check
   * @param filterPattern String or array of glob patterns to match against.
   *                     Patterns starting with ! are treated as negative matches.
   * @returns True if the tool name matches any positive pattern and no negative patterns,
   *          False otherwise
   */
  private _matchesFilter(toolName: string, filterPattern: string | string[]): boolean {
    const patterns = Array.isArray(filterPattern) ? filterPattern : [filterPattern];

    // Split into positive and negative patterns
    const positivePatterns = patterns.filter((p) => !p.startsWith('!'));
    const negativePatterns = patterns.filter((p) => p.startsWith('!')).map((p) => p.substring(1));

    // If no positive patterns, treat as match all
    const matchesPositive =
      positivePatterns.length === 0 || positivePatterns.some((p) => this._matchGlob(toolName, p));

    // If any negative pattern matches, exclude the tool
    const matchesNegative = negativePatterns.some((p) => this._matchGlob(toolName, p));

    return matchesPositive && !matchesNegative;
  }

  /**
   * Match a string against a glob pattern
   * @param str String to match
   * @param pattern Glob pattern to match against
   * @returns True if the string matches the pattern, false otherwise
   */
  private _matchGlob(str: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  /**
   * Get tools matching the specified filter pattern
   * @param filterPattern Optional glob pattern or array of patterns to filter tools
   *                     (e.g. "hris_*", ["crm_*", "ats_*"])
   * @param accountId Optional account ID override. If not provided, uses the one from initialization
   * @returns Collection of tools matching the filter pattern
   * @throws ToolsetLoadError If there is an error loading the tools
   */
  getTools(filterPattern?: string | string[], accountId?: string): Tools {
    if (!filterPattern) {
      console.warn(
        'No filter pattern provided. Loading all tools may exceed context windows in ' +
          'AI applications.'
      );
    }

    try {
      const allTools: StackOneTool[] = [];
      const effectiveAccountId = accountId || this.accountId;

      // Check if OAS directory exists
      if (!fs.existsSync(OAS_DIR)) {
        throw new ToolsetLoadError(`OAS directory not found: ${OAS_DIR}`);
      }

      // Load all available specs
      const specFiles = fs
        .readdirSync(OAS_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => path.join(OAS_DIR, file));

      for (const specFile of specFiles) {
        // Read and parse the spec file first
        const specContent = fs.readFileSync(specFile, 'utf-8');
        const spec = JSON.parse(specContent);
        const parser = new OpenAPIParser(spec, this.baseUrl);
        const toolDefinitions = parser.parseTools();

        // Create tools and filter if pattern is provided
        for (const [toolName, toolDef] of Object.entries(toolDefinitions)) {
          if (!filterPattern || this._matchesFilter(toolName, filterPattern)) {
            const tool = new StackOneTool(
              toolName,
              toolDef.description,
              toolDef.parameters,
              toolDef.execute,
              this.apiKey,
              effectiveAccountId
            );
            allTools.push(tool);
          }
        }
      }

      return new Tools(allTools);
    } catch (error) {
      if (error instanceof ToolsetError) {
        throw error;
      }
      throw new ToolsetLoadError(
        `Error loading tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
