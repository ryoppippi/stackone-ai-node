import { describe, expect, it } from 'bun:test';
import { StackOneError, StackOneAPIError } from './errors';

describe('StackOneError', () => {
  it('should create an error with the correct message and name', () => {
    const message = 'Test error message';
    const error = new StackOneError(message);

    expect(error.message).toBe(message);
    expect(error.name).toBe('StackOneError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(StackOneError);
  });

  it('should inherit from Error', () => {
    const error = new StackOneError('Test');
    expect(error instanceof Error).toBe(true);
  });
});

describe('StackOneAPIError', () => {
  it('should create an API error with basic properties', () => {
    const message = 'API request failed';
    const statusCode = 404;
    const responseBody = { error: 'Not found' };
    const requestBody = { query: 'test' };

    const error = new StackOneAPIError(message, statusCode, responseBody, requestBody);

    expect(error.message).toBe(message);
    expect(error.name).toBe('StackOneAPIError');
    expect(error.statusCode).toBe(statusCode);
    expect(error.responseBody).toBe(responseBody);
    expect(error.requestBody).toBe(requestBody);
    expect(error).toBeInstanceOf(StackOneError);
    expect(error).toBeInstanceOf(StackOneAPIError);
  });

  it('should extract error message from responseBody when available', () => {
    const message = 'API request failed';
    const statusCode = 400;
    const responseBody = { message: 'Invalid request parameters' };

    const error = new StackOneAPIError(message, statusCode, responseBody);

    expect(error.message).toBe('API request failed: Invalid request parameters');
  });

  it('should handle responseBody without message property', () => {
    const message = 'API request failed';
    const statusCode = 500;
    const responseBody = { error: 'Internal server error' };

    const error = new StackOneAPIError(message, statusCode, responseBody);

    expect(error.message).toBe(message);
  });

  it('should extract provider errors from responseBody', () => {
    const message = 'API request failed';
    const statusCode = 400;
    const responseBody = {
      message: 'Provider error occurred',
      provider_errors: [
        {
          status: 401,
          url: 'https://provider.api.com/endpoint',
          raw: { error: 'Unauthorized access' }
        }
      ]
    };

    const error = new StackOneAPIError(message, statusCode, responseBody);

    expect(error.providerErrors).toEqual(responseBody.provider_errors);
  });

  it('should handle responseBody without provider_errors', () => {
    const message = 'API request failed';
    const statusCode = 404;
    const responseBody = { message: 'Not found' };

    const error = new StackOneAPIError(message, statusCode, responseBody);

    expect(error.providerErrors).toBeUndefined();
  });

  it('should format error message correctly in toString()', () => {
    const message = 'API request failed for https://api.example.com/test';
    const statusCode = 404;
    const responseBody = { message: 'Resource not found' };
    const requestBody = { id: 123 };

    const error = new StackOneAPIError(message, statusCode, responseBody, requestBody);
    const formattedMessage = error.toString();

    expect(formattedMessage).toContain('API Error: 404');
    expect(formattedMessage).toContain('Endpoint: https://api.example.com/test');
    expect(formattedMessage).toContain('Request Headers:');
    expect(formattedMessage).toContain('Authorization: [REDACTED]');
    expect(formattedMessage).toContain('User-Agent: stackone-ai-node');
    expect(formattedMessage).toContain('Request Body:');
    expect(formattedMessage).toContain('"id": 123');
  });

  it('should format provider errors in toString()', () => {
    const message = 'API request failed';
    const statusCode = 400;
    const responseBody = {
      provider_errors: [
        {
          status: 401,
          url: 'https://provider.api.com/endpoint',
          raw: { error: 'Unauthorized access' }
        }
      ]
    };

    const error = new StackOneAPIError(message, statusCode, responseBody);
    const formattedMessage = error.toString();

    expect(formattedMessage).toContain('Provider Error: 401');
    expect(formattedMessage).toContain('Unauthorized access');
    expect(formattedMessage).toContain('Provider Endpoint: https://provider.api.com/endpoint');
  });

  it('should handle non-object responseBody', () => {
    const message = 'API request failed';
    const statusCode = 500;
    const responseBody = 'Internal Server Error';

    const error = new StackOneAPIError(message, statusCode, responseBody);

    expect(error.message).toBe(message);
    expect(error.responseBody).toBe(responseBody);
  });

  it('should handle null responseBody', () => {
    const message = 'API request failed';
    const statusCode = 500;
    const responseBody = null;

    const error = new StackOneAPIError(message, statusCode, responseBody);

    expect(error.message).toBe(message);
    expect(error.responseBody).toBe(responseBody);
  });

  it('should handle requestBody that cannot be stringified', () => {
    const message = 'API request failed';
    const statusCode = 400;
    const responseBody = { error: 'Bad request' };
    
    // Create a circular reference that will fail JSON.stringify
    const circularRef: any = { name: 'test' };
    circularRef.self = circularRef;

    const error = new StackOneAPIError(message, statusCode, responseBody, circularRef);
    const formattedMessage = error.toString();

    expect(formattedMessage).toContain('[Unable to stringify request body]');
  });

  it('should extract URL from message correctly', () => {
    const message = 'Request failed for https://api.example.com/users/123';
    const statusCode = 404;
    const responseBody = { error: 'Not found' };

    const error = new StackOneAPIError(message, statusCode, responseBody);
    const formattedMessage = error.toString();

    expect(formattedMessage).toContain('Endpoint: https://api.example.com/users/123');
  });

  it('should handle message without URL', () => {
    const message = 'Generic API error';
    const statusCode = 500;
    const responseBody = { error: 'Server error' };

    const error = new StackOneAPIError(message, statusCode, responseBody);
    const formattedMessage = error.toString();

    expect(formattedMessage).toContain('API Error: 500 - Generic API error');
    expect(formattedMessage).not.toContain('Endpoint:');
  });

  it('should handle provider errors without required fields', () => {
    const message = 'API request failed';
    const statusCode = 400;
    const responseBody = {
      provider_errors: [
        { status: 401 }, // Missing url and raw
        { url: 'https://provider.com' }, // Missing status and raw
        { raw: { error: 'Error' } } // Missing status and url
      ]
    };

    const error = new StackOneAPIError(message, statusCode, responseBody);
    const formattedMessage = error.toString();

    expect(formattedMessage).toContain('Provider Error: 401');
  });
});