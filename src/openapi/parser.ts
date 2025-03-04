import type { JSONSchema7 as JsonSchema } from 'json-schema';
import type { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';
import { ParameterLocation, type ToolDefinition } from '../models';

// Define a type for OpenAPI document
type OpenAPIDocument = OpenAPIV3.Document | OpenAPIV3_1.Document;

// Define a type for schema objects
type SchemaObject = OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;

// Define HTTP methods type
type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

/**
 * Parser for OpenAPI specifications
 */
export class OpenAPIParser {
  _spec: OpenAPIDocument;
  _baseUrl: string;
  _derivedParameters: Map<string, string>;
  _uiOnlyParameters: Set<string>;

  /**
   * Create a new OpenAPIParser
   * @param spec The OpenAPI specification object
   * @param customBaseUrl Optional custom base URL to use for all operations
   */
  constructor(spec: OpenAPIDocument, customBaseUrl?: string) {
    this._spec = spec;
    this._baseUrl = customBaseUrl || this.determineBaseUrl();
    this._derivedParameters = new Map<string, string>();
    this._uiOnlyParameters = new Set<string>();
  }

  /**
   * Determine the base URL from the servers array in the OpenAPI spec
   * @returns The base URL to use for all operations
   */
  private determineBaseUrl(): string {
    // Extract base URL from servers if available
    const servers = this._spec.servers || [];
    return servers.length > 0 ? servers[0].url : 'https://api.stackone.com';
  }

  /**
   * Create a parser from a JSON string
   * @param specString OpenAPI specification as a JSON string
   * @param customBaseUrl Optional custom base URL to use for all tools
   * @returns A new OpenAPIParser instance
   */
  public static fromString(specString: string, customBaseUrl?: string): OpenAPIParser {
    const spec = JSON.parse(specString) as OpenAPIDocument;
    return new OpenAPIParser(spec, customBaseUrl);
  }

  /**
   * Check if a schema represents a file type
   */
  public isFileType(schema: JsonSchema | OpenAPIV3.SchemaObject): boolean {
    return (
      (schema.type === 'string' && schema.format === 'binary') ||
      (schema.type === 'string' && schema.format === 'base64')
    );
  }

  /**
   * Convert a binary string schema to a file name field
   */
  public convertToFileType(schema: JsonSchema | OpenAPIV3.SchemaObject): void {
    if (this.isFileType(schema)) {
      // Keep the type as string but set the name to file_name
      schema.type = 'string';
      schema.description = schema.description || 'Path to the file to upload';
      // Remove binary format to avoid confusion
      schema.format = undefined;
    }
  }

  /**
   * Process schema properties to handle file uploads
   */
  public handleFileProperties(schema: JsonSchema | OpenAPIV3.SchemaObject): void {
    if (!schema.properties) {
      return;
    }

    for (const propName of Object.keys(schema.properties)) {
      const propSchema = schema.properties[propName] as JsonSchema;

      // Handle direct file uploads
      if (propSchema.type === 'string' && propSchema.format === 'binary') {
        this.convertToFileType(propSchema);
      }

      // Handle array of files
      if (propSchema.type === 'array' && propSchema.items) {
        const itemsSchema = propSchema.items as JsonSchema;
        if (itemsSchema.type === 'string' && itemsSchema.format === 'binary') {
          this.convertToFileType(itemsSchema);
        }
      }
    }
  }

  /**
   * Resolve a JSON schema reference in the OpenAPI spec
   */
  public resolveSchemaRef(ref: string, visited: Set<string> = new Set()): JsonSchema {
    if (!ref.startsWith('#/')) {
      const errorMsg = `Only local references are supported: ${ref}`;
      throw new Error(errorMsg);
    }

    if (visited.has(ref)) {
      const errorMsg = `Circular reference detected: ${ref}`;
      throw new Error(errorMsg);
    }

    // Create a new set with the current ref added to avoid modifying the original set
    const newVisited = new Set(visited);
    newVisited.add(ref);

    const parts = ref.split('/').slice(1); // Skip the '#'
    let current: unknown = this._spec;
    for (const part of parts) {
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        const errorMsg = `Invalid reference path: ${ref}`;
        throw new Error(errorMsg);
      }
    }

    // After getting the referenced schema, resolve it fully
    const resolved = this.resolveSchema(current as SchemaObject, newVisited);
    return resolved;
  }

  /**
   * Filter out vendor-specific extensions from schema objects
   */
  private filterVendorExtensions(schema: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      // Skip vendor extensions (properties starting with x-)
      if (key.startsWith('x-')) {
        continue;
      }

      // Recursively filter nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        filtered[key] = this.filterVendorExtensions(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        // Handle arrays by filtering each item if it's an object
        filtered[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? this.filterVendorExtensions(item as Record<string, unknown>)
            : item
        );
      } else {
        // Keep non-object values as is
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Resolve all references in a schema, preserving structure
   */
  public resolveSchema(
    schema: SchemaObject | unknown,
    visited: Set<string> = new Set()
  ): JsonSchema {
    // Handle primitive types (string, number, etc)
    if (typeof schema !== 'object' || schema === null) {
      return schema as JsonSchema;
    }

    if (Array.isArray(schema)) {
      return schema.map((item) =>
        this.resolveSchema(item, new Set(visited))
      ) as unknown as JsonSchema;
    }

    // Handle direct reference
    if (typeof schema === 'object' && '$ref' in schema && typeof schema.$ref === 'string') {
      const resolved = this.resolveSchemaRef(schema.$ref, visited);
      if (typeof resolved !== 'object' || resolved === null) {
        return resolved;
      }
      // Merge any additional properties from the original schema
      // Create a new object to avoid modifying the resolved schema
      const result = {
        ...JSON.parse(JSON.stringify(resolved)),
        ...Object.fromEntries(Object.entries(schema).filter(([k]) => k !== '$ref')),
      };
      return this.filterVendorExtensions(result as Record<string, unknown>) as JsonSchema;
    }

    // Handle allOf combinations
    if (typeof schema === 'object' && 'allOf' in schema) {
      const schemaObj = schema as OpenAPIV3.SchemaObject;
      // Create a new object without the allOf property to avoid type issues
      const { allOf, ...restSchema } = schemaObj;
      const mergedSchema: JsonSchema = restSchema as JsonSchema;

      // Merge all schemas in allOf array
      if (Array.isArray(allOf)) {
        for (const subSchema of allOf) {
          const resolved = this.resolveSchema(subSchema, new Set(visited));
          if (typeof resolved !== 'object' || resolved === null) {
            continue;
          }

          // Merge properties
          if ('properties' in resolved) {
            if (!mergedSchema.properties) {
              mergedSchema.properties = {};
            }
            mergedSchema.properties = {
              ...mergedSchema.properties,
              ...resolved.properties,
            };
          }

          // Merge type and other fields
          for (const [key, value] of Object.entries(resolved)) {
            if (key !== 'properties' && !(key in mergedSchema)) {
              (mergedSchema as Record<string, unknown>)[key] = value;
            }
          }
        }
      }

      return this.filterVendorExtensions(mergedSchema as Record<string, unknown>) as JsonSchema;
    }

    // Recursively resolve all nested objects and arrays
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema)) {
      // Skip vendor extensions
      if (key.startsWith('x-')) {
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          resolved[key] = value.map((item) => this.resolveSchema(item, new Set(visited)));
        } else {
          resolved[key] = this.resolveSchema(value, new Set(visited));
        }
      } else {
        resolved[key] = value;
      }
    }

    return resolved as JsonSchema;
  }

  /**
   * Parse content schema for a specific content type
   */
  public parseContentSchema(
    contentType: string,
    content: Record<string, OpenAPIV3.MediaTypeObject>
  ): [JsonSchema | null, string | null] {
    // Check if the content type exists in the content object
    if (!content[contentType]) {
      return [null, null];
    }

    // Get the schema for the content type
    const mediaType = content[contentType];
    const schema = mediaType.schema;

    // Only handle JSON content types for now
    if (contentType === 'application/json') {
      return [this.resolveSchema(schema), 'json'];
    }
    if (contentType === 'multipart/form-data') {
      return [this.resolveSchema(schema), 'form-data'];
    }
    if (contentType === 'application/x-www-form-urlencoded') {
      return [this.resolveSchema(schema), 'form'];
    }

    // Return null for other content types
    return [null, null];
  }

  /**
   * Resolve a request body reference
   */
  public resolveRequestBodyRef(ref: string): OpenAPIV3.RequestBodyObject | null {
    if (!ref.startsWith('#/components/requestBodies/')) {
      return null;
    }

    const name = ref.split('/').pop() as string;
    const requestBodies = this._spec.components?.requestBodies;
    if (!requestBodies || !(name in requestBodies)) {
      return null;
    }

    const refBody = requestBodies[name];
    if ('$ref' in refBody) {
      // Don't support nested references for simplicity
      return null;
    }

    return refBody as OpenAPIV3.RequestBodyObject;
  }

  /**
   * Parse request body from an operation
   */
  public parseRequestBody(
    operation: OpenAPIV3.OperationObject
  ): [JsonSchema | null, string | null] {
    if (!operation.requestBody) {
      return [null, null];
    }

    let requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;

    // Handle request body reference
    if ('$ref' in operation.requestBody) {
      const refBody = this.resolveRequestBodyRef(
        (operation.requestBody as OpenAPIV3.ReferenceObject).$ref
      );
      if (!refBody) {
        return [null, null];
      }
      requestBody = refBody as OpenAPIV3.RequestBodyObject;
    }

    // Check for content
    if (!requestBody.content) {
      return [null, null];
    }

    // Try to parse JSON content first
    if (requestBody.content['application/json']) {
      return this.parseContentSchema('application/json', requestBody.content);
    }

    // Then try multipart/form-data
    if (requestBody.content['multipart/form-data']) {
      return this.parseContentSchema('multipart/form-data', requestBody.content);
    }

    // Then try application/x-www-form-urlencoded
    if (requestBody.content['application/x-www-form-urlencoded']) {
      return this.parseContentSchema('application/x-www-form-urlencoded', requestBody.content);
    }

    // No supported content type found
    return [null, null];
  }

  /**
   * Determine parameter location based on schema type
   */
  public getParameterLocation(propSchema: any): ParameterLocation {
    if (
      propSchema.type === 'string' &&
      (propSchema.format === 'binary' || propSchema.format === 'base64')
    ) {
      return ParameterLocation.FILE;
    }

    if (
      propSchema.type === 'array' &&
      propSchema.items &&
      propSchema.items.type === 'string' &&
      (propSchema.items.format === 'binary' || propSchema.items.format === 'base64')
    ) {
      return ParameterLocation.FILE;
    }

    return ParameterLocation.BODY;
  }

  /**
   * Checks if an operation is a file upload operation
   * @param properties The properties object
   * @param parameterLocations The parameter locations mapping
   * @param requestBodySchema The request body schema
   * @returns True if this is a file upload operation
   */
  public isFileUploadOperation(
    parameterLocations: Record<string, ParameterLocation>,
    requestBodySchema?: JsonSchema | OpenAPIV3.SchemaObject | null
  ): boolean {
    // Check parameter locations
    const hasFileParam = Object.values(parameterLocations).some(
      (location) => location === ParameterLocation.FILE
    );

    if (hasFileParam) {
      return true;
    }

    // Check if the request body has file-related properties
    if (
      requestBodySchema &&
      typeof requestBodySchema === 'object' &&
      'properties' in requestBodySchema
    ) {
      const properties = requestBodySchema.properties as Record<string, any>;

      // Check for common file upload parameters
      const hasFileProperties = ['content', 'file', 'file_format'].some(
        (prop) => prop in properties
      );

      // Also check for binary format properties
      const hasBinaryFormat = Object.values(properties).some(
        (prop) => prop && typeof prop === 'object' && prop.format === 'binary'
      );

      if (hasFileProperties || hasBinaryFormat) {
        return true;
      }
    }

    // If no file parameters found, it's not a file upload operation
    return false;
  }

  /**
   * Simplifies parameters for file upload operations
   * @param properties The properties object to modify
   * @param parameterLocations The parameter locations mapping
   */
  public simplifyFileUploadParameters(
    properties: Record<string, JsonSchema | OpenAPIV3.SchemaObject>,
    parameterLocations: Record<string, ParameterLocation>
  ): void {
    // For file upload operations, we'll add a file_path parameter for the user interface
    // but keep the original parameters for the execution config
    const fileParams = ['name', 'content', 'file_format'];

    // Check if we already have a file_path parameter
    if ('file_path' in properties) {
      return; // Already simplified
    }

    // Add the file_path parameter with a brand new object to avoid references
    properties.file_path = {
      type: 'string',
      description:
        'Path to the file to upload. The filename and format will be automatically extracted from the path.',
    } as JsonSchema;

    // Add file_path to parameter locations
    parameterLocations.file_path = ParameterLocation.FILE;

    // Store information about which parameters should be in the execution config
    // but not exposed to the user interface
    if (!this._uiOnlyParameters) {
      this._uiOnlyParameters = new Set<string>();
    }

    // Mark file_path as a UI-only parameter (not part of the execution config)
    this._uiOnlyParameters.add('file_path');

    // Store derivation information for the original parameters
    if (!this._derivedParameters) {
      this._derivedParameters = new Map<string, string>();
    }

    // Mark the original file parameters as derived from file_path
    for (const key of fileParams) {
      if (key in properties) {
        // Store the derivation information in our map
        this._derivedParameters.set(key, 'file_path');
      }
    }
  }

  /**
   * Parse OpenAPI spec into tool definitions
   */
  public parseTools(): Record<string, ToolDefinition> {
    // Create a new empty tools object to ensure no tools from previous tests are included
    const tools: Record<string, ToolDefinition> = {};

    try {
      const paths = this._spec.paths || {};

      for (const [path, pathItem] of Object.entries(paths)) {
        if (!pathItem) {
          continue;
        }

        // Handle operations (get, post, put, delete, etc.)
        const operations = this.extractOperations(pathItem);

        for (const [method, operation] of operations) {
          // Check for operationId - this is required
          if (!operation.operationId) {
            const errorMsg = `Operation ID is required for tool parsing: ${method.toUpperCase()} ${path}`;
            throw new Error(errorMsg);
          }

          const name = operation.operationId;

          try {
            // Parse request body if present
            const [requestBodySchema, bodyType] = this.parseRequestBody(operation);

            // Track parameter locations and properties
            // Create fresh objects for each operation to avoid shared state issues
            const parameterLocations: Record<string, ParameterLocation> = {};
            const properties: Record<string, JsonSchema> = {};
            let requiredParams: string[] = [];

            // Parse parameters
            for (const param of operation.parameters || []) {
              try {
                // Resolve parameter reference if needed
                const resolvedParam = this.resolveParameter(param);
                if (!resolvedParam) {
                  continue;
                }

                const paramName = resolvedParam.name;
                const paramLocation = resolvedParam.in; // header, query, path, cookie
                parameterLocations[paramName] = paramLocation as ParameterLocation;

                // Add to properties for tool parameters
                const schema = { ...(resolvedParam.schema || {}) };
                if ('description' in resolvedParam) {
                  (schema as Record<string, unknown>).description = resolvedParam.description;
                }
                properties[paramName] = this.resolveSchema(schema);

                // Add to required params if required
                if (resolvedParam.required) {
                  requiredParams.push(paramName);
                }
              } catch (_paramError) {
                // Continue with other parameters even if one fails
              }
            }

            // Add request body properties if present
            if (requestBodySchema && typeof requestBodySchema === 'object') {
              const bodyProps = requestBodySchema.properties || {};

              // Extract required fields from request body
              if ('required' in requestBodySchema && Array.isArray(requestBodySchema.required)) {
                requiredParams = [...requiredParams, ...requestBodySchema.required];
              }

              for (const [propName, propSchema] of Object.entries(bodyProps)) {
                try {
                  // Create a deep copy of the propSchema to avoid shared state
                  properties[propName] = JSON.parse(JSON.stringify(propSchema)) as JsonSchema;
                  parameterLocations[propName] = this.getParameterLocation(
                    propSchema as JsonSchema
                  );
                } catch (_propError) {
                  // Continue with other properties even if one fails
                }
              }
            }

            // Check if this is a file upload operation using our improved method
            const isFileUpload = this.isFileUploadOperation(parameterLocations, requestBodySchema);

            if (isFileUpload) {
              // Remove the file-related parameters from required list
              const fileParams = ['name', 'content', 'file_format'];
              requiredParams = requiredParams.filter((param) => !fileParams.includes(param));

              // Add file_path to required params
              requiredParams.push('file_path');

              // Store the original properties for execution config
              const executionProperties = { ...properties };

              // Apply file upload simplification
              this.simplifyFileUploadParameters(properties, parameterLocations);

              // For file upload operations, we need to remove the file parameters from the user-facing properties
              // but keep them in the execution config
              for (const key of fileParams) {
                if (key in properties) {
                  // Remove the parameter from properties
                  delete properties[key];
                }
              }

              // Create tool definition with deep copies to prevent shared state
              tools[name] = {
                name,
                description: operation.summary || '',
                parameters: {
                  type: 'object',
                  properties: JSON.parse(JSON.stringify(properties)),
                  required: requiredParams.length > 0 ? requiredParams : undefined,
                },
                execute: {
                  method: method.toUpperCase(),
                  url: `${this._baseUrl}${path}`,
                  bodyType: (bodyType as 'json' | 'multipart-form') || 'json',
                  params: Object.entries(parameterLocations)
                    // Filter out UI-only parameters from the execution config
                    .filter(([name]) => !this._uiOnlyParameters.has(name))
                    .map(([name, location]) => {
                      return {
                        name,
                        location,
                        type: (executionProperties[name]?.type as JsonSchema['type']) || 'string',
                        // Add derivedFrom if it exists in our derivation map
                        ...(this._derivedParameters.has(name)
                          ? {
                              derivedFrom: this._derivedParameters.get(name),
                            }
                          : {}),
                      };
                    }),
                },
              };
            } else {
              // Create tool definition with deep copies to prevent shared state
              tools[name] = {
                name,
                description: operation.summary || '',
                parameters: {
                  type: 'object',
                  properties: JSON.parse(JSON.stringify(properties)),
                  required: requiredParams.length > 0 ? requiredParams : undefined,
                },
                execute: {
                  method: method.toUpperCase(),
                  url: `${this._baseUrl}${path}`,
                  bodyType: (bodyType as 'json' | 'multipart-form') || 'json',
                  params: Object.entries(parameterLocations).map(([name, location]) => {
                    return {
                      name,
                      location,
                      type: (properties[name]?.type as JsonSchema['type']) || 'string',
                    };
                  }),
                },
              };
            }
          } catch (operationError) {
            console.error(`Error processing operation ${name}: ${operationError}`);
            // Continue with other operations even if one fails
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing tools: ${error}`);
      // Even if there's an error, we'll return any tools that were successfully parsed
    }

    return tools;
  }

  /**
   * Extract operations from a path item
   */
  public extractOperations(
    pathItem: OpenAPIV3.PathItemObject
  ): [string, OpenAPIV3.OperationObject][] {
    const operations: [string, OpenAPIV3.OperationObject][] = [];

    for (const method of [
      'get',
      'put',
      'post',
      'delete',
      'options',
      'head',
      'patch',
      'trace',
    ] as HttpMethod[]) {
      if (method in pathItem) {
        const operation = pathItem[method] as OpenAPIV3.OperationObject;
        operations.push([method, operation]);
      }
    }

    return operations;
  }

  /**
   * Resolve parameter reference
   */
  public resolveParameter(
    param: OpenAPIV3.ParameterObject | OpenAPIV3.ReferenceObject
  ): OpenAPIV3.ParameterObject | null {
    if (!('$ref' in param)) {
      return param as OpenAPIV3.ParameterObject;
    }

    const ref = param.$ref;
    if (!ref.startsWith('#/components/parameters/')) {
      return null;
    }

    const name = ref.split('/').pop() as string;
    const parameters = this._spec.components?.parameters;
    if (!parameters || !(name in parameters)) {
      return null;
    }

    const refParam = parameters[name];
    if ('$ref' in refParam) {
      return null; // Don't support nested references
    }

    return refParam;
  }

  /**
   * Get the base URL for the API
   */
  public get baseUrl(): string {
    return this._baseUrl;
  }
}
