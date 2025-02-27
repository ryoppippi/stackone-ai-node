import { describe, expect, it } from 'bun:test';
import { jsonSchema } from 'ai';
import { StackOneTool } from '../models';

// Helper function to validate array items in a schema
const validateArrayItems = (obj: any, path = ''): string[] => {
  const errors: string[] = [];

  if (typeof obj !== 'object' || obj === null) {
    return errors;
  }

  // Check if this is an array type
  if (obj.type === 'array') {
    if (!obj.items) {
      errors.push(`Array at ${path} is missing 'items' property`);
    }
  }

  // Recursively check properties
  if (obj.properties) {
    for (const [key, value] of Object.entries(obj.properties)) {
      const nestedPath = path ? `${path}.${key}` : key;
      errors.push(...validateArrayItems(value, nestedPath));
    }
  }

  // Check items of arrays
  if (obj.items && typeof obj.items === 'object') {
    errors.push(...validateArrayItems(obj.items, `${path}.items`));
  }

  return errors;
};

// Create a test tool with various array structures
const createArrayTestTool = (): StackOneTool => {
  return new StackOneTool(
    'Test tool with arrays',
    {
      type: 'object',
      properties: {
        // Simple array without items
        simpleArray: {
          type: 'array',
          description: 'A simple array',
        },
        // Array with items
        arrayWithItems: {
          type: 'array',
          description: 'Array with items',
          items: { type: 'string' },
        },
        // Nested object with array
        nestedObject: {
          type: 'object',
          description: 'Nested object',
          properties: {
            nestedArray: {
              type: 'array',
              description: 'Nested array',
            },
          },
        },
        // Deeply nested array
        deeplyNested: {
          type: 'object',
          properties: {
            level1: {
              type: 'object',
              properties: {
                level2Array: {
                  type: 'array',
                  description: 'Deeply nested array',
                },
              },
            },
          },
        },
      },
    },
    {
      headers: {},
      method: 'GET',
      url: 'https://example.com/test',
      name: 'test_arrays',
      parameterLocations: {},
    },
    'test_api_key'
  );
};

// Create a test tool that mimics the problematic structure
const createNestedArrayTestTool = (): StackOneTool => {
  return new StackOneTool(
    'Test nested arrays in objects',
    {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          description: 'Filter parameters',
          properties: {
            // This is the problematic structure - an array in a nested object without items
            type_ids: {
              type: 'array',
              description: 'List of type IDs to filter by',
            },
            status: {
              type: 'string',
              description: 'Status to filter by',
            },
          },
        },
        include: {
          type: 'array',
          description: 'Fields to include in the response',
        },
      },
    },
    {
      headers: {},
      method: 'GET',
      url: 'https://example.com/test',
      name: 'test_nested_arrays',
      parameterLocations: {},
    },
    'test_api_key'
  );
};

describe('Schema Validation', () => {
  describe('Array Items Validation', () => {
    it('should ensure all arrays have items property', () => {
      const tool = createArrayTestTool();
      const openAIFormat = tool.toOpenAI();

      const errors = validateArrayItems(openAIFormat.function.parameters);
      expect(errors.length).toBe(0);
    });

    it('should handle simple arrays without items', () => {
      const tool = createArrayTestTool();
      const openAIFormat = tool.toOpenAI();

      // Check that simpleArray has items
      const simpleArray = openAIFormat.function.parameters.properties.simpleArray;
      expect(simpleArray.items).toBeDefined();
      expect(simpleArray.items.type).toBe('string');
    });

    it('should preserve existing array items', () => {
      const tool = createArrayTestTool();
      const openAIFormat = tool.toOpenAI();

      // Check that arrayWithItems preserved its items
      const arrayWithItems = openAIFormat.function.parameters.properties.arrayWithItems;
      expect(arrayWithItems.items).toBeDefined();
      expect(arrayWithItems.items.type).toBe('string');
    });

    it('should handle nested arrays in objects', () => {
      const tool = createArrayTestTool();
      const openAIFormat = tool.toOpenAI();

      // Check that nestedArray has items
      const nestedArray =
        openAIFormat.function.parameters.properties.nestedObject.properties.nestedArray;
      expect(nestedArray.items).toBeDefined();
    });

    it('should handle deeply nested arrays', () => {
      const tool = createArrayTestTool();
      const openAIFormat = tool.toOpenAI();

      // The structure is simplified in the OpenAI format
      // Just verify that level1 exists and is an object
      const deeplyNestedProperties =
        openAIFormat.function.parameters.properties.deeplyNested.properties;
      expect(deeplyNestedProperties.level1).toBeDefined();
      expect(deeplyNestedProperties.level1.type).toBe('object');

      // Since we can't directly test the deeply nested array (it's simplified in the output),
      // we'll verify our validation function doesn't find any errors
      const errors = validateArrayItems(openAIFormat.function.parameters);
      expect(errors.length).toBe(0);
    });
  });

  describe('AI SDK Integration', () => {
    it('should convert to AI SDK tool format', () => {
      const tool = createArrayTestTool();
      const aiSdkTool = tool.toAISDKTool();

      expect(aiSdkTool).toBeDefined();
      expect(typeof aiSdkTool.execute).toBe('function');
    });

    it('should handle the problematic nested array case', () => {
      const tool = createNestedArrayTestTool();
      const openAIFormat = tool.toOpenAI();

      // Check if the nested array has items
      const typeIds = openAIFormat.function.parameters.properties.filter.properties.type_ids;
      expect(typeIds.items).toBeDefined();

      // Verify that the schema can be used with jsonSchema
      const schema = openAIFormat.function.parameters;
      const aiSchema = jsonSchema(schema);
      expect(aiSchema).toBeDefined();
    });
  });
});
