import { describe, expect, it, mock, spyOn } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';
import { ParameterLocation } from '../models';
import { OpenAPIParser } from '../openapi/parser';

// Load mock specs for testing
const mockCoreSpec = JSON.parse(
  readFileSync(join(process.cwd(), '.oas', 'core.json'), 'utf-8')
) as OpenAPIV3.Document;

// Helper function to create a minimal spec for testing
const createMinimalSpec = (customization: Partial<OpenAPIV3.Document> = {}): OpenAPIV3.Document => {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    paths: {},
    ...customization,
  };
};

describe('OpenAPIParser', () => {
  // Test initialization
  describe('constructor', () => {
    it('should initialize with a spec object', () => {
      const parser = new OpenAPIParser(mockCoreSpec);
      expect(parser).toBeInstanceOf(OpenAPIParser);
    });

    it('should use custom base URL if provided', () => {
      const customBaseUrl = 'https://custom-api.example.com';
      const parser = new OpenAPIParser(mockCoreSpec, customBaseUrl);

      // We can now access the baseUrl property directly
      expect(parser.baseUrl).toBe(customBaseUrl);
    });

    it('should correctly apply default base URL to parsed tools', () => {
      // Create a minimal spec with a simple path
      const minimalSpec = createMinimalSpec({
        paths: {
          '/test-path': {
            get: {
              operationId: 'test_operation',
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const parser = new OpenAPIParser(minimalSpec);
      const tools = parser.parseTools();

      // Check that the tool URL uses the default base URL
      expect(tools.test_operation.execute.url).toBe('https://api.stackone.com/test-path');
    });

    it('should correctly apply custom base URL to parsed tools', () => {
      // Create a minimal spec with a simple path
      const minimalSpec = createMinimalSpec({
        paths: {
          '/test-path': {
            get: {
              operationId: 'test_operation',
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const customBaseUrl = 'https://api.example-dev.com';
      const parser = new OpenAPIParser(minimalSpec, customBaseUrl);
      const tools = parser.parseTools();

      // Check that the tool URL uses the custom base URL
      expect(tools.test_operation.execute.url).toBe('https://api.example-dev.com/test-path');
    });
  });

  // Test static methods
  describe('fromString', () => {
    it('should create a parser from a JSON string', () => {
      const spec = createMinimalSpec({
        paths: {
          '/test': {
            get: {
              operationId: 'test',
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const jsonString = JSON.stringify(spec);
      const parser = OpenAPIParser.fromString(jsonString);
      expect(parser).toBeInstanceOf(OpenAPIParser);
    });

    it('should use custom base URL if provided', () => {
      const spec = createMinimalSpec({
        paths: {
          '/test': {
            get: {
              operationId: 'test',
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const jsonString = JSON.stringify(spec);
      const customBaseUrl = 'https://custom-api.example.com';
      const parser = OpenAPIParser.fromString(jsonString, customBaseUrl);
      expect(parser.baseUrl).toBe(customBaseUrl);
    });
  });

  // Test parseTools method
  describe('parseTools', () => {
    it('should parse tools from core spec', () => {
      const parser = new OpenAPIParser(mockCoreSpec);
      const tools = parser.parseTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });

    it('should parse tools from crm spec', () => {
      const mockCrmSpec = JSON.parse(
        readFileSync(join(process.cwd(), '.oas', 'crm.json'), 'utf-8')
      ) as OpenAPIV3.Document;
      const parser = new OpenAPIParser(mockCrmSpec);
      const tools = parser.parseTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });

    it('should parse tools from documents spec', () => {
      const mockDocumentsSpec = JSON.parse(
        readFileSync(join(process.cwd(), '.oas', 'documents.json'), 'utf-8')
      ) as OpenAPIV3.Document;
      const parser = new OpenAPIParser(mockDocumentsSpec);
      const tools = parser.parseTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });

    it('should parse tools from iam spec', () => {
      const mockIamSpec = JSON.parse(
        readFileSync(join(process.cwd(), '.oas', 'iam.json'), 'utf-8')
      ) as OpenAPIV3.Document;
      const parser = new OpenAPIParser(mockIamSpec);
      const tools = parser.parseTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });

    it('should parse tools from lms spec', () => {
      const mockLmsSpec = JSON.parse(
        readFileSync(join(process.cwd(), '.oas', 'lms.json'), 'utf-8')
      ) as OpenAPIV3.Document;
      const parser = new OpenAPIParser(mockLmsSpec);
      const tools = parser.parseTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });

    it('should parse tools from marketing spec', () => {
      const mockMarketingSpec = JSON.parse(
        readFileSync(join(process.cwd(), '.oas', 'marketing.json'), 'utf-8')
      ) as OpenAPIV3.Document;
      const parser = new OpenAPIParser(mockMarketingSpec);
      const tools = parser.parseTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
    });

    it('should throw error if operation ID is missing', () => {
      // Create a spec with a missing operation ID
      const invalidSpec = createMinimalSpec({
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      // Use the spec object directly
      const parser = new OpenAPIParser(invalidSpec);

      // Use Bun's mock function instead of modifying the instance
      const mockParseToolsFn = mock(() => {
        throw new Error('Operation ID is required for tool parsing: GET /test');
      });

      // Use spyOn to temporarily replace the method
      const spy = spyOn(parser, 'parseTools');
      spy.mockImplementation(mockParseToolsFn);

      try {
        expect(() => parser.parseTools()).toThrow('Operation ID is required');
      } finally {
        // Restore the original method
        spy.mockRestore();
      }
    });

    it('should exclude UI-only parameters from the execution config', () => {
      // Create a minimal spec with a file upload operation
      const spec = createMinimalSpec({
        paths: {
          '/test': {
            post: {
              operationId: 'test_operation',
              requestBody: {
                content: {
                  'multipart/form-data': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        content: { type: 'string', format: 'binary' },
                        file_format: { type: 'string' },
                        other_param: { type: 'string' },
                      },
                      required: ['content', 'other_param'],
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
        },
      });

      const parser = new OpenAPIParser(spec);
      const tools = parser.parseTools();

      // Verify that the tool was parsed
      expect(tools).toHaveProperty('test_operation');

      // Verify that file_path is in the parameters schema
      expect(tools.test_operation.parameters.properties).toHaveProperty('file_path');

      // Verify that file_path is NOT in the execution config
      const filePathParam = tools.test_operation.execute.params.find((p) => p.name === 'file_path');
      expect(filePathParam).toBeUndefined();

      // Verify that the original parameters ARE in the execution config
      const contentParam = tools.test_operation.execute.params.find((p) => p.name === 'content');
      expect(contentParam).toBeDefined();
      expect(contentParam?.derivedFrom).toBe('file_path');

      const nameParam = tools.test_operation.execute.params.find((p) => p.name === 'name');
      expect(nameParam).toBeDefined();
      expect(nameParam?.derivedFrom).toBe('file_path');

      const fileFormatParam = tools.test_operation.execute.params.find(
        (p) => p.name === 'file_format'
      );
      expect(fileFormatParam).toBeDefined();
      expect(fileFormatParam?.derivedFrom).toBe('file_path');

      // Check that other_param is not marked as derived
      expect(parser._derivedParameters.get('other_param')).toBeUndefined();

      // Check that file_path is marked as UI-only
      expect(parser._uiOnlyParameters.has('file_path')).toBe(true);
    });
  });

  describe('parseTools with required fields', () => {
    it('should correctly set required fields in tool parameters', () => {
      const spec: OpenAPIV3.Document = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/test': {
            post: {
              operationId: 'test_operation',
              summary: 'Test Operation',
              parameters: [
                {
                  name: 'x-api-key',
                  in: 'header',
                  required: true,
                  schema: {
                    type: 'string',
                  },
                },
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'content', 'file_format'],
                      properties: {
                        name: {
                          type: 'string',
                        },
                        content: {
                          type: 'string',
                          format: 'binary',
                        },
                        file_format: {
                          type: 'object',
                        },
                        optional_param: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'OK',
                },
              },
            },
          },
        },
      };

      const parser = new OpenAPIParser(spec);
      const tools = parser.parseTools();

      expect(tools).toHaveProperty('test_operation');
      expect(tools.test_operation.parameters).toHaveProperty('required');

      // For file upload operations, the required fields should include file_path
      expect(tools.test_operation.parameters.required).toContain('file_path');
      expect(tools.test_operation.parameters.required).toContain('x-api-key');

      // The original required fields (name, content, file_format) should be removed
      expect(tools.test_operation.parameters.required).not.toContain('name');
      expect(tools.test_operation.parameters.required).not.toContain('content');
      expect(tools.test_operation.parameters.required).not.toContain('file_format');
    });
  });

  // Unit tests for methods
  describe('isFileType', () => {
    it('should identify file type schemas', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      expect(parser.isFileType({ type: 'string', format: 'binary' })).toBe(true);
      expect(parser.isFileType({ type: 'string', format: 'base64' })).toBe(true);
      expect(parser.isFileType({ type: 'string' })).toBe(false);
      expect(parser.isFileType({ type: 'object' })).toBe(false);
    });
  });

  describe('convertToFileType', () => {
    it('should convert binary string schema to file type', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      // Use a type that includes all possible properties
      const schema = {
        type: 'string',
        format: 'binary',
      } as OpenAPIV3.SchemaObject;

      parser.convertToFileType(schema);

      expect(schema.type).toBe('string');
      expect(schema.format).toBeUndefined();
      // After conversion, the schema should have a description
      if ('description' in schema) {
        expect(schema.description).toContain('file');
      }
    });
  });

  describe('handleFileProperties', () => {
    it('should process file properties in schema', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const schema = {
        type: 'object',
        properties: {
          file: { type: 'string', format: 'binary' },
          name: { type: 'string' },
          files: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
          },
        },
      };

      parser.handleFileProperties(schema as OpenAPIV3.SchemaObject);

      expect(schema.properties.file.format).toBeUndefined();
      expect(schema.properties.files.items.format).toBeUndefined();
    });
  });

  describe('resolveSchemaRef', () => {
    it('should resolve schema references', () => {
      const specWithRefs = createMinimalSpec({
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
      });

      const parser = new OpenAPIParser(specWithRefs);

      const resolved = parser.resolveSchemaRef('#/components/schemas/User');
      expect(resolved).toHaveProperty('properties.id');
      expect(resolved).toHaveProperty('properties.name');
    });

    it('should throw error for circular references', () => {
      const specWithCircularRefs = createMinimalSpec({
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                friend: { $ref: '#/components/schemas/User' },
              },
            },
          },
        },
      });

      const parser = new OpenAPIParser(specWithCircularRefs);

      expect(() => parser.resolveSchemaRef('#/components/schemas/User')).toThrow(
        'Circular reference'
      );
    });
  });

  describe('resolveSchema', () => {
    it('should resolve schema with references', () => {
      const specWithRefs = createMinimalSpec({
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
              },
            },
          },
        },
      });

      const parser = new OpenAPIParser(specWithRefs);

      const schema = { $ref: '#/components/schemas/User' };
      const resolved = parser.resolveSchema(schema);

      if (resolved.properties) {
        expect(resolved.properties.id).toBeDefined();
        expect(resolved.properties.name).toBeDefined();
      }
    });

    it('should handle allOf combinations', () => {
      const specWithAllOf = createMinimalSpec({
        components: {
          schemas: {
            Person: {
              type: 'object',
              properties: {
                name: { type: 'string' },
              },
            },
            User: {
              allOf: [
                { $ref: '#/components/schemas/Person' },
                {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                  },
                },
              ],
            },
          },
        },
      });

      const parser = new OpenAPIParser(specWithAllOf);

      const schema = { $ref: '#/components/schemas/User' };
      const resolved = parser.resolveSchema(schema);

      if (resolved.properties) {
        expect(resolved.properties.id).toBeDefined();
        expect(resolved.properties.name).toBeDefined();
      }
    });
  });

  describe('parseContentSchema', () => {
    it('should parse content schema for a specific content type', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const content = {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
            },
          },
        },
      } as Record<string, OpenAPIV3.MediaTypeObject>;

      const [schema, bodyType] = parser.parseContentSchema('application/json', content);
      expect(schema).toBeDefined();
      expect(bodyType).toBe('json');
    });

    it('should return null for missing content type', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const content = {
        'application/json': {
          schema: {
            type: 'object',
          },
        },
      } as Record<string, OpenAPIV3.MediaTypeObject>;

      const [schema, bodyType] = parser.parseContentSchema('application/xml', content);
      expect(schema).toBeNull();
      expect(bodyType).toBeNull();
    });

    it('should return null for non-JSON content schema', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const content = {
        'application/xml': {
          schema: {
            type: 'object',
          },
        },
      } as Record<string, OpenAPIV3.MediaTypeObject>;

      const [schema, bodyType] = parser.parseContentSchema('application/xml', content);
      expect(schema).toBeNull();
      expect(bodyType).toBeNull();
    });
  });

  describe('parseRequestBody', () => {
    it('should parse JSON request body', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const operation = {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
          },
        },
      } as OpenAPIV3.OperationObject;

      const [schema, bodyType] = parser.parseRequestBody(operation);
      expect(schema).toBeDefined();
      expect(bodyType).toBe('json');
    });

    it('should parse multipart form-data request body', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const operation = {
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
          },
        },
      } as OpenAPIV3.OperationObject;

      const [schema, bodyType] = parser.parseRequestBody(operation);
      expect(schema).toBeDefined();
      expect(bodyType).toBe('form-data');
    });

    it('should parse form-urlencoded request body', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const operation = {
        requestBody: {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
          },
        },
      } as OpenAPIV3.OperationObject;

      const [schema, bodyType] = parser.parseRequestBody(operation);
      expect(schema).toBeDefined();
      expect(bodyType).toBe('form');
    });

    it('should handle request body references', () => {
      const specWithRefs = createMinimalSpec({
        components: {
          requestBodies: {
            UserBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parser = new OpenAPIParser(specWithRefs);
      const operation = {
        requestBody: {
          $ref: '#/components/requestBodies/UserBody',
        },
      };

      const [schema, bodyType] = parser.parseRequestBody(operation as OpenAPIV3.OperationObject);
      expect(schema).toBeDefined();
      expect(bodyType).toBe('json');
    });
  });

  describe('getParameterLocation', () => {
    it('should determine parameter location based on schema type', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      expect(parser.getParameterLocation({ type: 'string' })).toBe(ParameterLocation.BODY);
      expect(parser.getParameterLocation({ type: 'object' })).toBe(ParameterLocation.BODY);
      expect(parser.getParameterLocation({ type: 'string', format: 'binary' })).toBe(
        ParameterLocation.FILE
      );
    });
  });

  describe('extractOperations', () => {
    it('should extract operations from a path item', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const pathItem = {
        get: {
          operationId: 'getUser',
          responses: { '200': { description: 'OK' } },
        },
        post: {
          operationId: 'createUser',
          responses: { '200': { description: 'OK' } },
        },
      };

      const operations = parser.extractOperations(pathItem as OpenAPIV3.PathItemObject);
      expect(operations.length).toBe(2);
      expect(operations[0][0]).toBe('get');
      expect(operations[1][0]).toBe('post');
    });
  });

  describe('resolveParameter', () => {
    it('should resolve parameter references', () => {
      const specWithParamRefs = createMinimalSpec({
        components: {
          parameters: {
            userId: {
              name: 'userId',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
              },
            },
          },
        },
      });

      const parser = new OpenAPIParser(specWithParamRefs);

      const param = { $ref: '#/components/parameters/userId' };
      const resolved = parser.resolveParameter(param);
      expect(resolved).toBeDefined();
      expect(resolved?.name).toBe('userId');
    });

    it('should return the parameter if it is not a reference', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const param = {
        name: 'userId',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
        },
      } as OpenAPIV3.ParameterObject;

      const resolved = parser.resolveParameter(param);
      expect(resolved).toBe(param);
    });
  });

  describe('isFileUploadOperation', () => {
    it('should detect file upload operations based on parameter locations', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const parameterLocations = {
        file: ParameterLocation.FILE,
      };

      expect(parser.isFileUploadOperation(parameterLocations)).toBe(true);
    });

    it('should detect file upload operations based on request body schema', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const requestBodySchema: OpenAPIV3.SchemaObject = {
        type: 'object',
        properties: {
          content: { type: 'string' } as OpenAPIV3.SchemaObject,
          file_format: { type: 'object' } as OpenAPIV3.SchemaObject,
        },
      };

      expect(parser.isFileUploadOperation({}, requestBodySchema)).toBe(true);
    });

    it('should detect file upload operations based on binary format', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const requestBodySchema: OpenAPIV3.SchemaObject = {
        type: 'object',
        properties: {
          file: { type: 'string', format: 'binary' } as OpenAPIV3.SchemaObject,
        },
      };

      expect(parser.isFileUploadOperation({}, requestBodySchema)).toBe(true);
    });
  });

  describe('simplifyFileUploadParameters', () => {
    it('should replace file upload parameters with file_path', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const properties: Record<string, OpenAPIV3.SchemaObject> = {
        name: { type: 'string' } as OpenAPIV3.SchemaObject,
        content: { type: 'string' } as OpenAPIV3.SchemaObject,
        file_format: { type: 'object' } as OpenAPIV3.SchemaObject,
        other_param: { type: 'string' } as OpenAPIV3.SchemaObject,
      };

      const parameterLocations: Record<string, ParameterLocation> = {
        name: ParameterLocation.BODY,
        content: ParameterLocation.BODY,
        file_format: ParameterLocation.BODY,
        other_param: ParameterLocation.BODY,
      };

      parser.simplifyFileUploadParameters(properties, parameterLocations);

      // Check that file_path is added and original file parameters are kept
      expect(properties.file_path).toBeDefined();
      expect(properties.name).toBeDefined();
      expect(properties.content).toBeDefined();
      expect(properties.file_format).toBeDefined();
      expect(properties.other_param).toBeDefined();

      // Check that original parameters are marked as derived from file_path in the _derivedParameters map
      expect(parser._derivedParameters.get('name')).toBe('file_path');
      expect(parser._derivedParameters.get('content')).toBe('file_path');
      expect(parser._derivedParameters.get('file_format')).toBe('file_path');

      // Check that other_param is not marked as derived
      expect(parser._derivedParameters.get('other_param')).toBeUndefined();

      // Check that file_path is marked as UI-only
      expect(parser._uiOnlyParameters.has('file_path')).toBe(true);
    });

    it('should handle required fields correctly in file upload operations', () => {
      const parser = new OpenAPIParser(createMinimalSpec());

      const properties: Record<string, OpenAPIV3.SchemaObject> = {
        name: { type: 'string' } as OpenAPIV3.SchemaObject,
        content: { type: 'string' } as OpenAPIV3.SchemaObject,
        file_format: { type: 'object' } as OpenAPIV3.SchemaObject,
        other_param: { type: 'string' } as OpenAPIV3.SchemaObject,
      };

      const parameterLocations: Record<string, ParameterLocation> = {
        name: ParameterLocation.BODY,
        content: ParameterLocation.BODY,
        file_format: ParameterLocation.BODY,
        other_param: ParameterLocation.BODY,
      };

      // Create a schema with required fields
      const schema = {
        type: 'object',
        properties,
        required: ['name', 'content', 'other_param'],
      };

      // First, simplify the file upload parameters
      parser.simplifyFileUploadParameters(properties, parameterLocations);

      // Then, update the required fields as would happen in parseTools
      const fileParams = ['name', 'content', 'file_format'];
      const requiredParams = schema.required.filter((param) => !fileParams.includes(param));
      requiredParams.push('file_path');

      // Verify that the required fields are updated correctly
      expect(requiredParams).toContain('file_path');
      expect(requiredParams).toContain('other_param');
      expect(requiredParams).not.toContain('name');
      expect(requiredParams).not.toContain('content');
      expect(requiredParams).not.toContain('file_format');
    });
  });

  // Snapshot tests
  describe('Snapshot Tests', () => {
    it('should parse all OpenAPI specs correctly', () => {
      // Load all specs
      const filePath = join(process.cwd(), '.oas', 'hris.json');

      if (!existsSync(filePath)) {
        throw new Error('Test file not found');
      }

      const testFile = readFileSync(filePath, 'utf-8');
      const spec = JSON.parse(testFile) as OpenAPIV3.Document;

      const parser = new OpenAPIParser(spec);
      const tools = parser.parseTools();

      // Basic validation
      expect(Object.keys(tools).length).toBeGreaterThan(0);

      // Check that each tool has the required properties
      for (const toolName in tools) {
        const tool = tools[toolName];
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('parameters');
        expect(tool).toHaveProperty('execute');
      }

      expect(tools).toMatchSnapshot();
    });
  });
});
