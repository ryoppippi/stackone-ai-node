/**
 * GetRelevantTools - A meta tool for discovering relevant tools based on user intent
 * @beta This is a beta feature and may change in future versions
 */

import createFuzzySearch from '@nozbe/microfuzz';
import type { Arrayable } from 'type-fest';
import { BaseTool } from '../tool';
import type { ExecuteConfig, JsonDict, ToolParameters } from '../types';
import { toArray } from '../utils/array';
import { StackOneError } from '../utils/errors';
import { BETA_WARNING } from './consts';
import type { ToolSearchConfig, ToolSearchResult } from './types';

/**
 * A meta tool that searches for relevant tools based on a query
 * @beta
 */
export class GetRelevantTools extends BaseTool {
  private availableTools: BaseTool[];

  constructor(tools: BaseTool[]) {
    const parameters: ToolParameters = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing what tools you need',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of tools to return (default: 10)',
          default: 10,
        },
        minScore: {
          type: 'number',
          description: 'Minimum relevance score (0-1) for results (default: 0.3)',
          default: 0.3,
        },
        filterPatterns: {
          oneOf: [
            { type: 'string' },
            {
              type: 'array',
              items: { type: 'string' },
            },
          ],
          description: 'Optional glob patterns to filter results (e.g., "hris_*", "!*_delete_*")',
        },
        accountId: {
          type: 'string',
          description: 'Account ID to use for StackOne tools',
        },
      },
      required: ['query'],
    };

    const executeConfig: ExecuteConfig = {
      method: 'LOCAL',
      url: 'local://get-relevant-tools',
      bodyType: 'json',
      params: [],
    };

    super(
      'get_relevant_tools',
      `Search for relevant tools based on natural language query. ${BETA_WARNING}`,
      parameters,
      executeConfig
    );

    this.availableTools = tools;
  }

  /**
   * Execute the tool search
   */
  async execute(inputParams?: JsonDict | string): Promise<JsonDict> {
    try {
      const params = typeof inputParams === 'string' ? JSON.parse(inputParams) : inputParams || {};
      const config = params as ToolSearchConfig;

      if (!config.query) {
        throw new StackOneError('Query parameter is required');
      }

      // Perform the search
      const results = this.searchTools(config);

      // Format results for output
      const formattedResults = results.map((result) => ({
        name: result.tool.name,
        description: result.tool.description,
        score: result.score,
        matchReason: result.matchReason,
        parameters: result.tool.parameters,
      }));

      return {
        success: true,
        query: config.query,
        resultsCount: formattedResults.length,
        tools: formattedResults,
        beta: true,
        warning: BETA_WARNING,
      };
    } catch (error) {
      if (error instanceof StackOneError) {
        throw error;
      }
      throw new StackOneError(
        `Error searching for tools: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Search for tools based on the configuration
   */
  private searchTools(config: ToolSearchConfig): ToolSearchResult[] {
    const { query, limit = 10, minScore = 0.3, filterPatterns } = config;

    // Filter tools based on patterns first
    const candidateTools = filterPatterns
      ? this.availableTools.filter((tool) => this.matchesFilter(tool.name, filterPatterns))
      : this.availableTools;

    // Create a fuzzy search function
    const fuzzySearch = createFuzzySearch(candidateTools, {
      // Index on both name and description
      getText: (tool) => [tool.name, tool.description],
    });

    // Search for matches
    const results = fuzzySearch(query);

    // Convert results to our format
    // Note: microfuzz uses lower scores for better matches, so we need to invert
    const scoredTools: ToolSearchResult[] = results
      .map((result) => {
        const tool = result.item;
        const microfuzzScore = result.score;

        // Convert microfuzz score (lower is better) to our score (higher is better)
        // microfuzz scores: 0 = exact, 0.1 = full match, 0.5 = starts with, etc.
        // We'll map these to 0-1 where 1 is best
        let normalizedScore: number;
        let matchReason: string;

        if (microfuzzScore === 0) {
          normalizedScore = 1.0;
          matchReason = 'exact name match';
        } else if (microfuzzScore <= 0.1) {
          normalizedScore = 0.95;
          matchReason = 'full match (case-insensitive)';
        } else if (microfuzzScore <= 0.5) {
          normalizedScore = 0.9;
          matchReason = 'starts with query';
        } else if (microfuzzScore <= 1) {
          normalizedScore = 0.8;
          matchReason = 'contains query at word boundary';
        } else if (microfuzzScore <= 1.5) {
          normalizedScore = 0.7;
          matchReason = 'contains query words';
        } else if (microfuzzScore <= 2) {
          normalizedScore = 0.6;
          matchReason = 'contains query';
        } else {
          // Fuzzy match - map score 2-10 to 0.5-0.1
          normalizedScore = Math.max(0.1, 0.5 - (microfuzzScore - 2) * 0.05);
          matchReason = 'fuzzy match';
        }

        return {
          tool,
          score: normalizedScore,
          matchReason,
        };
      })
      .filter((result) => result.score >= minScore);

    // Sort by score (descending) and limit results
    scoredTools.sort((a, b) => b.score - a.score);
    return scoredTools.slice(0, limit);
  }

  /**
   * Check if a tool name matches filter patterns
   */
  private matchesFilter(toolName: string, filterPattern: Arrayable<string>): boolean {
    const patterns = toArray(filterPattern);

    // Split into positive and negative patterns
    const positivePatterns = patterns.filter((p) => !p.startsWith('!'));
    const negativePatterns = patterns.filter((p) => p.startsWith('!')).map((p) => p.substring(1));

    // If no positive patterns, treat as match all
    const matchesPositive =
      positivePatterns.length === 0 || positivePatterns.some((p) => this.matchGlob(toolName, p));

    // If any negative pattern matches, exclude the tool
    const matchesNegative = negativePatterns.some((p) => this.matchGlob(toolName, p));

    return matchesPositive && !matchesNegative;
  }

  /**
   * Simple glob pattern matching
   */
  private matchGlob(str: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }
}
