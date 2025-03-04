/**
 * Parameter derivation functions for StackOne tools
 *
 * This file contains functions to derive parameter values from other parameters,
 * particularly for file uploads where we want to extract multiple values from a file path.
 */

import { StackOneError } from './models';
import type { JsonDict } from './types';
import { extractFileInfo, isValidFilePath, readFileAsBase64 } from './utils/file-utils';

/**
 * Type definition for a derivation function
 * Takes a source value and returns a derived value
 */
export type DerivationFunction = (sourceValue: unknown) => unknown;

/**
 * Map of parameter derivation functions
 * Keys are parameter names, values are functions to derive that parameter
 */
export const derivationFunctions: Record<string, DerivationFunction> = {
  /**
   * Derive file content from file_path
   * Reads the file and returns its base64-encoded content
   */
  content: (filePath: unknown): string => {
    if (typeof filePath !== 'string') {
      throw new StackOneError('file_path must be a string');
    }

    if (!isValidFilePath(filePath)) {
      throw new StackOneError(`Invalid file path or file not found: ${filePath}`);
    }

    return readFileAsBase64(filePath);
  },

  /**
   * Derive file name from file_path
   * Extracts the filename with extension
   */
  name: (filePath: unknown): string => {
    if (typeof filePath !== 'string') {
      throw new StackOneError('file_path must be a string');
    }

    if (!isValidFilePath(filePath)) {
      throw new StackOneError(`Invalid file path or file not found: ${filePath}`);
    }

    const { fileName } = extractFileInfo(filePath);
    return fileName;
  },

  /**
   * Derive file format from file_path
   * Extracts the file extension and returns it as an object with a value property
   */
  file_format: (filePath: unknown): JsonDict | null => {
    if (typeof filePath !== 'string') {
      throw new StackOneError('file_path must be a string');
    }

    const { extension } = extractFileInfo(filePath);
    return extension ? { value: extension } : null;
  },
};

/**
 * Apply derivation functions to derive parameters from a source parameter
 *
 * @param sourceParam Name of the source parameter
 * @param sourceValue Value of the source parameter
 * @param targetParams Array of parameter names to derive
 * @returns Object with derived parameter values
 */
export const deriveParameters = (
  sourceParam: string,
  sourceValue: unknown,
  targetParams: string[]
): JsonDict => {
  const result: JsonDict = {};

  for (const param of targetParams) {
    const derivationFn = derivationFunctions[param];
    if (derivationFn) {
      try {
        const derivedValue = derivationFn(sourceValue);
        if (derivedValue !== null) {
          result[param] = derivedValue;
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new StackOneError(
            `Error deriving parameter ${param} from ${sourceParam}: ${error.message}`
          );
        }
        throw new StackOneError(`Unknown error deriving parameter ${param} from ${sourceParam}`);
      }
    }
  }

  return result;
};
