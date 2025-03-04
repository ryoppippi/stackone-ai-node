import { beforeEach, describe, expect, it } from 'bun:test';
import { env } from 'bun';
import { ParameterLocation, StackOneTool, Tools } from '../models';
import { OpenAPIParser } from '../openapi/parser';
import { StackOneToolSet } from '../toolset';

// Mock environment variables
env.STACKONE_API_KEY = 'test_key';

describe('StackOneToolSet', () => {
  it('should initialize with API key from constructor', () => {
    const toolset = new StackOneToolSet('custom_key');
    expect(toolset).toBeDefined();
  });

  it('should initialize with API key from environment', () => {
    const toolset = new StackOneToolSet();
    expect(toolset).toBeDefined();
  });

  it('should throw error if no API key is provided', () => {
    // Temporarily remove environment variable
    const originalKey = env.STACKONE_API_KEY;
    env.STACKONE_API_KEY = undefined;

    expect(() => new StackOneToolSet()).toThrow();

    // Restore environment variable
    env.STACKONE_API_KEY = originalKey;
  });

  it('should correctly filter tools with a pattern', () => {
    // Create a test instance of StackOneToolSet
    const toolset = new StackOneToolSet('test_key');

    // Test the private _matchesFilter method directly
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('hris_get_employee', 'hris_*')).toBe(true);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('crm_get_contact', 'hris_*')).toBe(false);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('hris_get_employee', ['hris_*', 'crm_*'])).toBe(true);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('crm_get_contact', ['hris_*', 'crm_*'])).toBe(true);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('ats_get_candidate', ['hris_*', 'crm_*'])).toBe(false);

    // Test negative patterns
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('hris_get_employee', ['*', '!crm_*'])).toBe(true);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('crm_get_contact', ['*', '!crm_*'])).toBe(false);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchesFilter('hris_get_employee', ['*', '!hris_*'])).toBe(false);
  });

  it('should correctly match glob patterns', () => {
    // Create a test instance of StackOneToolSet
    const toolset = new StackOneToolSet('test_key');

    // Test the private _matchGlob method directly
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchGlob('hris_get_employee', 'hris_*')).toBe(true);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchGlob('hris_get_employee', 'crm_*')).toBe(false);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchGlob('hris_get_employee', '*_get_*')).toBe(true);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchGlob('hris_get_employee', 'hris_get_?mployee')).toBe(true);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchGlob('hris_get_employee', 'hris.get.employee')).toBe(false);
    // @ts-ignore - Accessing private method for testing
    expect(toolset._matchGlob('hris.get.employee', 'hris.get.employee')).toBe(true);
    // @ts-ignore - Accessing private method for testing
    // In the _matchGlob implementation, backslashes are used to escape dots in the pattern
    // but the pattern itself doesn't contain the backslashes, so we need to use a raw string
    expect(toolset._matchGlob('hris.get.employee', 'hris\\.get\\.employee')).toBe(false);
  });

  it('should use custom base URL when creating OpenAPIParser', () => {
    // Create a minimal OpenAPI spec
    const minimalSpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
      servers: [{ url: 'https://api.stackone.com' }],
    };

    // Create parsers with different base URLs
    const defaultParser = new OpenAPIParser(minimalSpec);
    const customParser = new OpenAPIParser(minimalSpec, 'https://api.custom-domain.com');

    // Access the baseUrl property directly
    expect(defaultParser.baseUrl).toBe('https://api.stackone.com');
    expect(customParser.baseUrl).toBe('https://api.custom-domain.com');
  });

  it('should pass custom base URL from StackOneToolSet to OpenAPIParser', () => {
    // Create a StackOneToolSet with a custom base URL
    const customBaseUrlValue = 'https://api.example-dev.com';
    const toolset = new StackOneToolSet('test-key', undefined, customBaseUrlValue);

    // Directly check that the baseUrl property is set correctly
    // @ts-ignore - Accessing private property for testing
    expect(toolset.baseUrl).toBe(customBaseUrlValue);
  });

  it('should filter tools correctly with getTools', () => {
    // Save original methods to restore later
    const originalGetTools = StackOneToolSet.prototype.getTools;

    // Create mock tools
    const createMockTool = (name: string, description: string): StackOneTool => {
      return new StackOneTool(
        name,
        description,
        {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID' },
          },
        },
        {
          method: 'GET',
          url: `https://api.stackone.com/${name}/{id}`,
          bodyType: 'json',
          params: [
            {
              name: 'id',
              location: ParameterLocation.PATH,
              type: 'string',
            },
          ],
        },
        'test_key'
      );
    };

    // Create a set of mock tools with different prefixes
    const mockTools = [
      createMockTool('hris_get_employee', 'Get employee details'),
      createMockTool('hris_list_employees', 'List employees'),
      createMockTool('crm_get_contact', 'Get contact details'),
      createMockTool('crm_list_contacts', 'List contacts'),
      createMockTool('ats_get_candidate', 'Get candidate details'),
    ];

    // Replace the getTools method with our mock implementation
    StackOneToolSet.prototype.getTools = function (
      filterPattern?: string | string[],
      _accountId?: string
    ): Tools {
      // If no filter pattern, return all tools
      if (!filterPattern) {
        return new Tools(mockTools);
      }

      // Filter tools based on the pattern
      const filteredTools = mockTools.filter((tool) =>
        // @ts-ignore - Accessing private method for testing
        this._matchesFilter(tool.name, filterPattern)
      );

      return new Tools(filteredTools);
    };

    try {
      const toolset = new StackOneToolSet('test_key');

      // Test with no filter (should return all tools)
      const allTools = toolset.getTools();
      expect(allTools.length).toBe(5);

      // Test with HRIS filter
      const hrisTools = toolset.getTools('hris_*');
      expect(hrisTools.length).toBe(2);
      for (const tool of hrisTools) {
        expect(tool.name.startsWith('hris_')).toBe(true);
      }

      // Test with CRM filter
      const crmTools = toolset.getTools('crm_*');
      expect(crmTools.length).toBe(2);
      for (const tool of crmTools) {
        expect(tool.name.startsWith('crm_')).toBe(true);
      }

      // Test with multiple filters
      const multiFilterTools = toolset.getTools(['hris_*', 'crm_*']);
      expect(multiFilterTools.length).toBe(4);
      for (const tool of multiFilterTools) {
        expect(tool.name.startsWith('hris_') || tool.name.startsWith('crm_')).toBe(true);
      }

      // Test with negative filter
      const negativeFilterTools = toolset.getTools(['*', '!hris_*']);
      expect(negativeFilterTools.length).toBe(3);
      for (const tool of negativeFilterTools) {
        expect(tool.name.startsWith('hris_')).toBe(false);
      }

      // Test with specific tool name
      const specificTool = toolset.getTools('hris_get_employee');
      expect(specificTool.length).toBe(1);
      expect(specificTool.getTool('hris_get_employee')).toBeDefined();

      // Test with non-matching filter
      const nonMatchingTools = toolset.getTools('non_existent_*');
      expect(nonMatchingTools.length).toBe(0);
    } finally {
      // Restore original method
      StackOneToolSet.prototype.getTools = originalGetTools;
    }
  });

  // Replace the single test with multiple focused tests
  describe('real tool loading', () => {
    // Create a toolset once for all tests in this group
    const toolset = new StackOneToolSet('test_key');
    let allTools: Tools;
    let verticals: string[] = [];

    // Setup before running the tests
    beforeEach(() => {
      // Get all tools without any filter
      allTools = toolset.getTools();

      // Extract verticals from tool names
      const verticalSet = new Set<string>();
      for (const tool of allTools) {
        const vertical = tool.name.split('_')[0];
        if (vertical) {
          verticalSet.add(vertical);
        }
      }
      verticals = Array.from(verticalSet);
    });

    it('should load tools from the .oas directory', () => {
      // Verify that tools were loaded
      expect(allTools.length).toBeGreaterThan(0);
    });

    it('should have at least one vertical', () => {
      // Verify we have at least one vertical
      expect(verticals.length).toBeGreaterThan(0);
    });

    it('should filter tools by vertical', () => {
      // Skip if no verticals found
      if (verticals.length === 0) {
        return;
      }

      // Test filtering with the first vertical we found
      const firstVertical = verticals[0];
      const verticalTools = toolset.getTools(`${firstVertical}_*`);

      // Verify that filtered tools were loaded
      expect(verticalTools.length).toBeGreaterThan(0);

      // Verify that all tools start with the vertical prefix
      for (const tool of verticalTools) {
        expect(tool.name.startsWith(`${firstVertical}_`)).toBe(true);
      }
    });

    it('should filter tools with multiple patterns', () => {
      // Skip if less than 2 verticals found
      if (verticals.length < 2) {
        return;
      }

      // Use the first two verticals for testing multiple filters
      const patterns = [`${verticals[0]}_*`, `${verticals[1]}_*`];
      const multiFilterTools = toolset.getTools(patterns);

      // Verify that filtered tools were loaded
      expect(multiFilterTools.length).toBeGreaterThan(0);

      // Verify that all tools start with either vertical prefix
      for (const tool of multiFilterTools) {
        const matchesPattern =
          tool.name.startsWith(`${verticals[0]}_`) || tool.name.startsWith(`${verticals[1]}_`);
        expect(matchesPattern).toBe(true);
      }
    });
  });
});
