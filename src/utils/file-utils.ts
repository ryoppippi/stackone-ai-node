import * as fs from 'node:fs';
import path from 'node:path';
import { StackOneError } from '../models';

/**
 * Utilities for handling file operations
 */

/**
 * Check if a string is a valid base64 encoded value
 */
export function isBase64(str: string): boolean {
  try {
    // Check if string has base64 pattern
    if (!str.match(/^[A-Za-z0-9+/=]+$/)) {
      return false;
    }

    // Check if length is valid multiple of 4
    if (str.length % 4 !== 0) {
      return false;
    }

    // Try to decode and re-encode to check validity
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch (error) {
    console.error(`Error checking if string is base64: ${error}`);
    return false;
  }
}

/**
 * Check if value is a valid file path and the file exists
 */
export function isValidFilePath(filePath: string): boolean {
  if (typeof filePath !== 'string' || filePath.startsWith('data:') || isBase64(filePath)) {
    return false;
  }

  try {
    return fs.existsSync(filePath);
  } catch (error) {
    console.error(`Error checking if file exists: ${error}`);
    return false;
  }
}

/**
 * Read a file and return its contents as a base64 string
 */
export function readFileAsBase64(filePath: string): string {
  try {
    // Verify the file exists
    if (!fs.existsSync(filePath)) {
      throw new StackOneError(`File not found: ${filePath}`);
    }

    // Read the file and convert to base64
    const fileContent = fs.readFileSync(filePath);
    return fileContent.toString('base64');
  } catch (error) {
    throw new StackOneError(
      `Error reading file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Extract information from a file path
 */
export function extractFileInfo(filePath: string): {
  fileName: string;
  extension: string | null;
} {
  // Extract filename from the file path
  const fileName = path.basename(filePath);

  // Extract file extension if it exists
  let extension = null;
  if (fileName.includes('.')) {
    extension = fileName.split('.').pop()?.toLowerCase() || null;
  }

  return { fileName, extension };
}
