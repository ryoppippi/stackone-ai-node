import fs from 'node:fs';
import path from 'node:path';
import { OAS_DIR } from '../constants';
import type { ToolDefinition } from '../models';
import { OpenAPIParser } from './parser';

/**
 * Load all OpenAPI specs from the oas directory
 * @param directory Optional custom directory to load specs from
 * @returns Dict mapping vertical names to their tool definitions
 */
export const loadSpecs = (directory?: string): Record<string, Record<string, ToolDefinition>> => {
  const tools: Record<string, Record<string, ToolDefinition>> = {};

  const oasDir = directory || OAS_DIR;

  // Check if directory exists
  if (!fs.existsSync(oasDir)) {
    return tools;
  }

  // Read all JSON files in the directory
  const files = fs.readdirSync(oasDir).filter((file) => file.endsWith('.json'));

  for (const file of files) {
    const vertical = path.basename(file, '.json');
    const specPath = path.join(oasDir, file);
    const parser = new OpenAPIParser(specPath);
    tools[vertical] = parser.parseTools();
  }

  return tools;
};
