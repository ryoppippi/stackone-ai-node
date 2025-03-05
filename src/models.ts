import { type Schema, type Tool, type ToolExecutionOptions, jsonSchema, tool } from 'ai';
// Import OpenAPI and JSON Schema types
import type { JSONSchema7 } from 'json-schema';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { deriveParameters } from './derivations';
import type { Headers, JsonDict, JsonSchemaProperties, JsonSchemaType } from './types';
// Type aliases for common types

/**
 * Base exception for StackOne errors
 */
export class StackOneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StackOneError';
  }
}

/**
 * Raised when the StackOne API returns an error
 */
export class StackOneAPIError extends StackOneError {
  statusCode: number;
  responseBody: unknown;
  providerErrors?: unknown[];
  requestBody?: unknown;

  constructor(message: string, statusCode: number, responseBody: unknown, requestBody?: unknown) {
    // Extract the error message from responseBody if it exists
    let errorMessage = message;
    if (
      responseBody &&
      typeof responseBody === 'object' &&
      'message' in responseBody &&
      responseBody.message &&
      typeof responseBody.message === 'string'
    ) {
      errorMessage = `${message}: ${responseBody.message}`;
    }

    super(errorMessage);
    this.name = 'StackOneAPIError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
    this.requestBody = requestBody;

    // Extract provider errors if they exist
    if (
      responseBody &&
      typeof responseBody === 'object' &&
      'provider_errors' in responseBody &&
      Array.isArray(responseBody.provider_errors)
    ) {
      this.providerErrors = responseBody.provider_errors;
    }
  }

  toString(): string {
    // Format the main error message
    let errorMessage = `API Error: ${this.statusCode} - ${this.message.replace(` for ${this._getUrlFromMessage()}`, '')}`;

    // Add the URL on a new line for better readability
    const url = this._getUrlFromMessage();
    if (url) {
      errorMessage += `\nEndpoint: ${url}`;
    }

    // Add request headers information (for debugging)
    errorMessage += '\n\nRequest Headers:';
    errorMessage += '\n- Authorization: [REDACTED]';
    errorMessage += '\n- User-Agent: stackone-ai-node';

    // Add request body information if available
    if (this.requestBody) {
      errorMessage += '\n\nRequest Body:';
      try {
        if (typeof this.requestBody === 'object') {
          errorMessage += `\n${JSON.stringify(this.requestBody, null, 2)}`;
        } else {
          errorMessage += ` ${String(this.requestBody)}`;
        }
      } catch (_e) {
        errorMessage += ' [Unable to stringify request body]';
      }
    }

    // Add provider error information if available
    if (this.providerErrors && this.providerErrors.length > 0) {
      const providerError = this.providerErrors[0];
      if (typeof providerError === 'object' && providerError !== null) {
        errorMessage += '\n\nProvider Error:';

        if ('status' in providerError) {
          errorMessage += ` ${providerError.status}`;
        }

        // Include raw error message if available
        if (
          'raw' in providerError &&
          typeof providerError.raw === 'object' &&
          providerError.raw !== null &&
          'error' in providerError.raw
        ) {
          errorMessage += ` - ${providerError.raw.error}`;
        }

        // Add provider URL on a new line
        if ('url' in providerError) {
          errorMessage += `\nProvider Endpoint: ${providerError.url}`;
        }
      }
    }

    return errorMessage;
  }

  // Helper method to extract URL from the error message
  private _getUrlFromMessage(): string | null {
    const match = this.message.match(/ for (https?:\/\/[^\s:]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Valid locations for parameters in requests
 */
export enum ParameterLocation {
  HEADER = 'header',
  QUERY = 'query',
  PATH = 'path',
  BODY = 'body',
  FILE = 'file', // this is a special case. It should only be for file_path parameter.
}

/**
 * Configuration for executing a tool against an API endpoint
 */
export interface ExecuteConfig {
  method: string;
  url: string;
  bodyType: 'json' | 'multipart-form' | 'form';
  params: {
    name: string;
    location: ParameterLocation;
    type: JsonSchemaType;
    derivedFrom?: string; // this is the name of the param that this one is derived from.
  }[]; // this params are the full list of params used to execute. This should come straight from the OpenAPI spec.
}

/**
 * Schema definition for tool parameters
 */
export interface ToolParameters {
  type: string;
  properties: JsonSchemaProperties; // these are the params we will expose to the user/agent in the tool. These might be higher level params.
  required?: string[]; // list of required parameter names
}

/**
 * Complete definition of a tool including its schema and execution config
 */
export interface ToolDefinition {
  name?: string; // Make name optional to maintain backward compatibility
  description: string;
  parameters: ToolParameters;
  execute: ExecuteConfig;
}

/**
 * Base class for all StackOne tools. Provides functionality for executing API calls
 * and converting to various formats (OpenAI, AI SDK)
 */
export class StackOneTool {
  name: string;
  description: string;
  parameters: ToolParameters;
  _executeConfig: ExecuteConfig;
  private _apiKey: string;
  private _accountId?: string;

  constructor(
    name: string,
    description: string,
    parameters: ToolParameters,
    executeConfig: ExecuteConfig,
    apiKey: string,
    accountId?: string
  ) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
    this._executeConfig = executeConfig;
    this._apiKey = apiKey;
    this._accountId = accountId;
  }

  /**
   * Get the current account ID
   * @returns The current account ID or undefined if not set
   */
  getAccountId(): string | undefined {
    return this._accountId;
  }

  /**
   * Set the account ID for this tool
   * @param accountId The account ID to set
   * @returns This tool instance for chaining
   */
  setAccountId(accountId: string): StackOneTool {
    this._accountId = accountId;
    return this;
  }

  /**
   * Prepare headers for the API request
   * @returns Headers to use in the request
   */
  private _prepareHeaders(): Headers {
    const authString = Buffer.from(`${this._apiKey}:`).toString('base64');
    const headers: Headers = {
      Authorization: `Basic ${authString}`,
      'User-Agent': 'stackone-ai-node',
    };

    if (this._accountId) {
      headers['x-account-id'] = this._accountId;
    }

    // Add predefined headers
    return { ...headers };
  }

  /**
   * Prepare URL and parameters for the API request
   * @param params Arguments to process
   * @returns Tuple of [url, bodyParams, queryParams]
   */
  private _prepareRequestParams(params: JsonDict): [string, JsonDict, JsonDict] {
    let url = this._executeConfig.url;
    const bodyParams: JsonDict = {};
    const queryParams: JsonDict = {};

    for (const [key, value] of Object.entries(params)) {
      // Find the parameter configuration in the params array
      const paramConfig = this._executeConfig.params.find((p) => p.name === key);
      const paramLocation = paramConfig?.location;

      switch (paramLocation) {
        case ParameterLocation.PATH:
          url = url.replace(`{${key}}`, String(value));
          break;
        case ParameterLocation.QUERY:
          queryParams[key] = value;
          break;
        case ParameterLocation.BODY:
          bodyParams[key] = value;
          break;
        default:
          // Default behavior
          if (url.includes(`{${key}}`)) {
            url = url.replace(`{${key}}`, String(value));
          } else if (
            this._executeConfig.method === 'GET' ||
            this._executeConfig.method === 'DELETE'
          ) {
            queryParams[key] = value;
          } else {
            bodyParams[key] = value;
          }
      }
    }

    return [url, bodyParams, queryParams];
  }

  /**
   * Map user-provided parameters to API parameters
   * @param userParams Parameters provided by the user
   * @returns Parameters ready for API execution
   */
  private _mapParameters(userParams: JsonDict): JsonDict {
    const apiParams: JsonDict = {};

    // First, copy all user params directly
    for (const [key, value] of Object.entries(userParams)) {
      // Skip file_path as it will be handled specially
      if (key !== 'file_path') {
        apiParams[key] = value;
      }
    }

    // Find parameters that need to be derived
    const derivedParamMap = new Map<string, string[]>();

    for (const param of this._executeConfig.params) {
      if (param.derivedFrom && userParams[param.derivedFrom] !== undefined) {
        // Group parameters by their source
        if (!derivedParamMap.has(param.derivedFrom)) {
          derivedParamMap.set(param.derivedFrom, []);
        }
        derivedParamMap.get(param.derivedFrom)?.push(param.name);
      }
    }

    // Apply derivations for each source parameter
    for (const [sourceParam, targetParams] of derivedParamMap.entries()) {
      if (userParams[sourceParam] !== undefined) {
        const derivedValues = deriveParameters(sourceParam, userParams[sourceParam], targetParams);

        // Merge derived values into apiParams
        Object.assign(apiParams, derivedValues);
      }
    }

    return apiParams;
  }

  /**
   * Execute the tool with the given parameters
   * @param params Tool arguments as string or object
   * @returns API response as object
   * @throws StackOneAPIError If the API request fails
   * @throws Error If the arguments are invalid
   */
  async execute(params?: string | JsonDict): Promise<JsonDict> {
    try {
      // Parse arguments
      let userParams: JsonDict = {};
      if (typeof params === 'string') {
        userParams = JSON.parse(params);
      } else if (params) {
        userParams = { ...params }; // Create a shallow copy to avoid modifying the original
      }

      // Remove accountId from params if present - we should not be setting it here
      if ('accountId' in userParams) {
        console.warn(
          'Setting accountId in execute parameters is deprecated. Use setAccountId method instead.'
        );
        userParams.accountId = undefined;
      }

      // Map user parameters to API parameters
      const apiParams = this._mapParameters(userParams);

      // Prepare request parameters
      const [url, bodyParams, queryParams] = this._prepareRequestParams(apiParams);

      // Prepare headers
      const headers = this._prepareHeaders();

      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: this._executeConfig.method,
        headers,
      };

      // Add query parameters to URL
      const urlWithQuery = new URL(url);
      for (const [key, value] of Object.entries(queryParams)) {
        urlWithQuery.searchParams.append(key, String(value));
      }

      // Add body if needed
      if (Object.keys(bodyParams).length > 0) {
        if (this._executeConfig.bodyType === 'multipart-form') {
          // Handle multipart form data (for file uploads)
          const formData = new FormData();
          for (const [key, value] of Object.entries(bodyParams)) {
            formData.append(key, String(value));
          }
          fetchOptions.body = formData;
        } else {
          // Default to JSON body
          fetchOptions.body = JSON.stringify(bodyParams);
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/json',
          };
        }
      }

      // Make the request
      const response = await fetch(urlWithQuery.toString(), fetchOptions);

      // Handle errors
      if (!response.ok) {
        let errorResponseBody: unknown;
        try {
          errorResponseBody = await response.json();
        } catch (_e) {
          // If we can't parse as JSON, use text content instead
          try {
            errorResponseBody = await response.text();
          } catch {
            errorResponseBody = 'Unable to read response body';
          }
        }

        // Create a more descriptive error message
        let errorMessage = `API request failed with status ${response.status}`;

        // Add the URL to the error message for better debugging
        errorMessage += ` for ${urlWithQuery.toString()}`;

        // Include the request body in the error
        const requestBodyForError = fetchOptions.body
          ? this._executeConfig.bodyType === 'json'
            ? bodyParams
            : 'Multipart form data'
          : undefined;

        throw new StackOneAPIError(
          errorMessage,
          response.status,
          errorResponseBody,
          requestBodyForError
        );
      }

      // Parse the response
      let responseData: JsonDict;
      try {
        responseData = (await response.json()) as JsonDict;
      } catch (error) {
        responseData = { error: `Failed to parse response as JSON: ${(error as Error).message}` };
      }

      return responseData;
    } catch (error) {
      if (error instanceof StackOneAPIError) {
        throw error;
      }
      throw new StackOneError(`Unknown error executing tool: ${String(error)}`);
    }
  }

  /**
   * Convert this tool to OpenAI's tool format
   * @returns Tool definition in OpenAI tool format
   */
  toOpenAI(): ChatCompletionTool {
    // Clean properties and handle special types
    const properties: Record<string, JSONSchema7> = {};
    const required: string[] = [];

    // Helper function to recursively ensure all arrays have items property
    const ensureArrayItems = (schema: JSONSchema7): JSONSchema7 => {
      const result = { ...schema };

      // If this is an array, ensure it has items
      if (result.type === 'array' && !result.items) {
        result.items = { type: 'string' };
      }

      // Process properties recursively
      if (result.properties && typeof result.properties === 'object') {
        const newProperties: Record<string, JSONSchema7> = {};
        for (const [key, value] of Object.entries(result.properties)) {
          newProperties[key] = ensureArrayItems(value as JSONSchema7);
        }
        result.properties = newProperties;
      }

      // Process array items recursively
      if (result.items && typeof result.items === 'object' && !Array.isArray(result.items)) {
        result.items = ensureArrayItems(result.items as JSONSchema7);
      }

      return result;
    };

    for (const [name, prop] of Object.entries(this.parameters.properties)) {
      if (typeof prop === 'object' && prop !== null) {
        // Only keep standard JSON Schema properties
        const cleanedProp: JSONSchema7 = {};

        // Copy basic properties
        if ('type' in prop) {
          cleanedProp.type = prop.type;
        }
        if ('description' in prop) {
          cleanedProp.description = prop.description;
        }
        if ('enum' in prop) {
          cleanedProp.enum = prop.enum;
        }

        // Handle array types
        if (cleanedProp.type === 'array') {
          // Ensure all arrays have an items property
          if ('items' in prop && typeof prop.items === 'object' && prop.items !== null) {
            const itemsObj = prop.items as JSONSchema7;
            cleanedProp.items = Object.fromEntries(
              Object.entries(itemsObj).filter(([k]) => ['type', 'description', 'enum'].includes(k))
            ) as JSONSchema7;
          } else {
            // Default to string items if not specified
            cleanedProp.items = { type: 'string' };
          }
        }

        // Handle object types
        if (cleanedProp.type === 'object' && 'properties' in prop) {
          cleanedProp.properties = {};
          if (typeof prop.properties === 'object' && prop.properties !== null) {
            for (const [propName, propDef] of Object.entries(prop.properties)) {
              if (typeof propDef === 'object' && propDef !== null) {
                const subProp = propDef as JSONSchema7;
                const cleanedSubProp: JSONSchema7 = {};

                if ('type' in subProp) {
                  cleanedSubProp.type = subProp.type;
                }
                if ('description' in subProp) {
                  cleanedSubProp.description = subProp.description;
                }
                if ('enum' in subProp) {
                  cleanedSubProp.enum = subProp.enum;
                }

                // Ensure array items for nested arrays
                if (subProp.type === 'array' && !subProp.items) {
                  cleanedSubProp.items = { type: 'string' };
                } else if (subProp.type === 'array' && subProp.items) {
                  cleanedSubProp.items = { type: 'string', ...(subProp.items as JSONSchema7) };
                }

                (cleanedProp.properties as Record<string, JSONSchema7>)[propName] = cleanedSubProp;
              }
            }
          }
        }

        properties[name] = cleanedProp;

        // Add to required list if the property is required
        if (
          'required' in this.parameters &&
          Array.isArray(this.parameters.required) &&
          this.parameters.required.includes(name)
        ) {
          required.push(name);
        }
      }
    }

    // Apply the ensureArrayItems function to the entire schema
    const finalProperties: Record<string, JSONSchema7> = {};
    for (const [key, value] of Object.entries(properties)) {
      finalProperties[key] = ensureArrayItems(value);
    }

    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: finalProperties,
          required: required.length > 0 ? required : undefined,
        },
      },
    };
  }

  /**
   * Convert this tool to an AI SDK tool
   * @returns AI SDK tool
   */
  toAISDK() {
    // Create a wrapper function that will handle the execution
    const executeWrapper = async (
      args: unknown,
      _options: ToolExecutionOptions
    ): Promise<JsonDict> => {
      try {
        return await this.execute(args as JsonDict);
      } catch (error) {
        if (error instanceof StackOneError) {
          throw new Error(`StackOne Error: ${error.message}`);
        }
        throw error;
      }
    };

    // Get the OpenAI format which already has the correct JSON Schema structure
    const openAIFormat = this.toOpenAI();

    // Use the OpenAI function parameters as our JSON schema
    const schema = jsonSchema(openAIFormat.function.parameters as JSONSchema7);

    // Return the AI SDK tool
    return tool({
      description: this.description,
      parameters: schema,
      execute: executeWrapper,
    });
  }
}

/**
 * Collection of StackOne tools
 */
export class Tools {
  private tools: StackOneTool[];

  constructor(tools: StackOneTool[]) {
    this.tools = tools;
  }

  /**
   * Get the number of tools in the collection
   */
  get length(): number {
    return this.tools.length;
  }

  /**
   * Get a tool by name
   * @param name Name of the tool to get
   * @returns The tool, or undefined if not found
   */
  getTool(name: string): StackOneTool | undefined {
    return this.tools.find((tool) => tool.name === name);
  }

  /**
   * Convert all tools to OpenAI format
   * @returns Array of tools in the format expected by OpenAI's API
   */
  toOpenAI(): ChatCompletionTool[] {
    return this.tools.map((tool) => tool.toOpenAI());
  }

  /**
   * Convert all tools to AI SDK tools
   * @returns Object with tool names as keys and AI SDK tools as values
   */
  toAISDK(): Record<string, Tool<Schema<unknown>, JsonDict>> {
    const result: Record<string, Tool<Schema<unknown>, JsonDict>> = {};

    for (const stackOneTool of this.tools) {
      result[stackOneTool.name] = stackOneTool.toAISDK();
    }

    return result;
  }

  /**
   * Iterate over the tools
   */
  [Symbol.iterator](): Iterator<StackOneTool> {
    let index = 0;
    const tools = this.tools;

    return {
      next(): IteratorResult<StackOneTool> {
        if (index < tools.length) {
          return { value: tools[index++], done: false };
        }
        return { value: undefined, done: true };
      },
    };
  }
}
