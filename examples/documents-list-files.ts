#!/usr/bin/env bun
/**
 * Example demonstrating how to list documents files using StackOne.
 *
 * This example shows:
 * 1. Getting the documents list files tool from the toolset
 * 2. Executing the tool to fetch file data
 * 3. Working with pagination and field filtering
 * 4. Validating the response structure and file properties
 *
 * Usage:
 *
 * ```bash
 * bun run examples/documents-list-files.ts
 * ```
 */

import assert from 'node:assert';
import { StackOneToolSet } from '../src';

const documentsListFiles = async (): Promise<void> => {
  const accountId = '45668003570419987176';
  const toolset = new StackOneToolSet();

  try {
    // Get documents list files tool
    const tools = toolset.getStackOneTools('documents_list_files', accountId);
    const listFilesTool = tools.getStackOneTool('documents_list_files');

    assert(listFilesTool !== undefined, 'Expected to find documents_list_files tool');
    assert(listFilesTool.getAccountId() === accountId, 'Account ID should match what was set');

    // Execute the tool to get files
    console.log('Fetching documents files...');
    const files = await listFilesTool.execute();

    // Validate the response structure
    assert(typeof files === 'object', 'Expected files to be an object');
    assert(Array.isArray(files.data), 'Expected files.data to be an array');

    console.log(`Found ${files.data.length} files`);

    // If we have files, validate the structure of the first one
    if (files.data.length > 0) {
      const firstFile = files.data[0];
      console.log('First file structure:');
      console.log(`- ID: ${firstFile.id}`);
      console.log(`- Name: ${firstFile.name}`);
      console.log(`- Description: ${firstFile.description}`);
      console.log(`- Size: ${firstFile.size} bytes`);
      console.log(`- Format: ${firstFile.file_format?.value}`);
      console.log(`- Path: ${firstFile.path}`);
      console.log(`- URL: ${firstFile.url}`);
      console.log(`- Owner ID: ${firstFile.owner_id}`);
      console.log(`- Created: ${firstFile.created_at}`);
      console.log(`- Updated: ${firstFile.updated_at}`);

      // Validate basic file structure
      assert(typeof firstFile.id === 'string', 'Expected file id to be a string');
      assert(
        firstFile.name === null ||
          firstFile.name === undefined ||
          typeof firstFile.name === 'string',
        'Expected name to be string, null, or undefined'
      );
      assert(
        firstFile.size === null ||
          firstFile.size === undefined ||
          typeof firstFile.size === 'number',
        'Expected size to be number, null, or undefined'
      );
      assert(
        firstFile.url === null || firstFile.url === undefined || typeof firstFile.url === 'string',
        'Expected url to be string, null, or undefined'
      );
    }

    // Example of using tool with specific fields
    const toolsWithFields = toolset.getStackOneTools('documents_list_files', accountId);
    const fieldsFilesTool = toolsWithFields.getStackOneTool('documents_list_files');

    if (fieldsFilesTool) {
      console.log('\nFetching files with specific fields...');
      const specificFieldsFiles = await fieldsFilesTool.execute({
        fields: 'id,name,size,file_format,url,created_at',
      });

      assert(Array.isArray(specificFieldsFiles.data), 'Expected filtered files to be an array');
      console.log(`Fetched ${specificFieldsFiles.data.length} files with specific fields`);
    }

    // Example with date filtering
    const toolsWithFilter = toolset.getStackOneTools('documents_list_files', accountId);
    const filterFilesTool = toolsWithFilter.getStackOneTool('documents_list_files');

    if (filterFilesTool) {
      console.log('\nFetching files updated after specific date...');
      const filteredFiles = await filterFilesTool.execute({
        filter: {
          updated_after: '2023-01-01T00:00:00.000Z',
        },
      });

      assert(Array.isArray(filteredFiles.data), 'Expected date-filtered files to be an array');
      console.log(`Found ${filteredFiles.data.length} files updated after 2023-01-01`);
    }

    // Example with pagination
    if (files.next) {
      console.log('\nFetching next page of files...');
      const nextPageFiles = await listFilesTool.execute({
        next: files.next,
      });

      assert(Array.isArray(nextPageFiles.data), 'Expected next page files to be an array');
      console.log(`Found ${nextPageFiles.data.length} files on next page`);
    }

    console.log('\nDocuments list files example completed successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

documentsListFiles();
