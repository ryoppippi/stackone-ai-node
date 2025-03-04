/**
 * Common type definitions for the StackOne SDK
 */

import type { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/**
 * Generic dictionary type for JSON-compatible objects
 */
export type JsonDict = Record<string, unknown>;

/**
 * HTTP headers type
 */
export type Headers = Record<string, string>;

/**
 * JSON Schema properties type
 */
export type JsonSchemaProperties = Record<string, JSONSchema7Definition>;

/**
 * JSON Schema type
 */
export type JsonSchemaType = JSONSchema7['type'];
