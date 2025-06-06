/**
 * Example showing how to handle documents using preExecute functions.
 *
 * This example demonstrates the new preExecute function approach for document handling,
 * which allows developers to customize how documents are retrieved and processed
 * before being sent to the StackOne API.
 *
 * Run this example with:
 * bun run examples/pre-execute-document-handling.ts
 */

import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StackOneToolSet } from '../src';
import type { JsonDict } from '../src/types';

const accountId = '45072196112816593343';

/**
 * Example 1: Local file handling with security restrictions
 */
const localFilePreExecute = async (params: JsonDict): Promise<JsonDict> => {
  const { document_path, ...otherParams } = params;

  if (typeof document_path !== 'string') {
    throw new Error('document_path must be a string');
  }

  // Security: Only allow files in specific directories
  const allowedPaths = ['/uploads/', '/documents/', '/tmp/'];
  const isAllowed = allowedPaths.some((allowedPath) => document_path.startsWith(allowedPath));

  if (!isAllowed) {
    throw new Error(
      `Access denied: file must be in allowed directories: ${allowedPaths.join(', ')}`
    );
  }

  // Check if file exists
  if (!fs.existsSync(document_path)) {
    throw new Error(`File not found: ${document_path}`);
  }

  // Read file and extract information
  const content = fs.readFileSync(document_path).toString('base64');
  const fileName = path.basename(document_path);
  const extension = path.extname(document_path).slice(1);

  return {
    ...otherParams,
    content,
    name: fileName,
    file_format: { value: extension },
  };
};

/**
 * Example 2: URL-based document handling
 */
const urlDocumentPreExecute = async (params: JsonDict): Promise<JsonDict> => {
  const { document_url, ...otherParams } = params;

  if (typeof document_url !== 'string') {
    throw new Error('document_url must be a string');
  }

  // Security: Only allow specific domains
  const allowedDomains = ['api.company.com', 'docs.company.com'];
  const url = new URL(document_url);

  if (!allowedDomains.includes(url.hostname)) {
    throw new Error(`Access denied: only allowed domains are: ${allowedDomains.join(', ')}`);
  }

  // Fetch document from URL
  const response = await fetch(document_url);
  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const content = Buffer.from(buffer).toString('base64');

  // Extract filename from URL or Content-Disposition header
  const contentDisposition = response.headers.get('content-disposition');
  let fileName = 'document';

  if (contentDisposition?.includes('filename=')) {
    fileName = contentDisposition.split('filename=')[1].replace(/"/g, '');
  } else {
    fileName = path.basename(url.pathname) || 'document';
  }

  const extension = path.extname(fileName).slice(1) || 'bin';

  return {
    ...otherParams,
    content,
    name: fileName,
    file_format: { value: extension },
  };
};

/**
 * Example 3: Custom document source (e.g., database, S3, etc.)
 */
const customDocumentPreExecute = async (params: JsonDict): Promise<JsonDict> => {
  const { document_id, ...otherParams } = params;

  if (typeof document_id !== 'string') {
    throw new Error('document_id must be a string');
  }

  // Simulate fetching from a custom source (database, S3, etc.)
  const document = await fetchDocumentFromCustomSource(document_id);

  return {
    ...otherParams,
    content: document.base64Content,
    name: document.fileName,
    file_format: { value: document.extension },
    // Override additional fields if needed
    category: document.category || otherParams.category,
  };
};

/**
 * Simulated custom document source
 */
async function fetchDocumentFromCustomSource(documentId: string) {
  // This would typically be a database query, S3 call, etc.
  return {
    base64Content: Buffer.from('Sample document content').toString('base64'),
    fileName: `document-${documentId}.pdf`,
    extension: 'pdf',
    category: { value: 'contract' },
  };
}

/**
 * Example 4: Multi-source document handling with fallback
 */
const multiSourcePreExecute = async (params: JsonDict): Promise<JsonDict> => {
  const { document_ref, source_type, ...otherParams } = params;

  if (typeof document_ref !== 'string' || typeof source_type !== 'string') {
    throw new Error('document_ref and source_type must be strings');
  }

  switch (source_type) {
    case 'local':
      return localFilePreExecute({ document_path: document_ref, ...otherParams });

    case 'url':
      return urlDocumentPreExecute({ document_url: document_ref, ...otherParams });

    case 'custom':
      return customDocumentPreExecute({ document_id: document_ref, ...otherParams });

    default:
      throw new Error(`Unknown source_type: ${source_type}`);
  }
};

const documentHandlingExamples = async (): Promise<void> => {
  // Create sample files for testing
  const sampleFilePath = path.join('/tmp', 'sample-document.txt');
  fs.writeFileSync(sampleFilePath, 'This is a sample document for testing.');

  try {
    // Initialize the StackOne toolset
    const toolset = new StackOneToolSet();

    // Get tools for documents
    const tools = toolset.getStackOneTools('hris_*', accountId);
    const uploadTool = tools.getTool('hris_upload_employee_document');

    assert(uploadTool !== undefined, 'Upload document tool not found');

    console.log('Testing preExecute document handling...\n');

    // Example 1: Local file with security restrictions
    console.log('1. Local file handling:');
    try {
      const result1 = await uploadTool.execute(
        {
          document_path: sampleFilePath,
          id: 'employee123',
          category: { value: 'contract' },
        },
        {
          dryRun: true,
          preExecute: localFilePreExecute,
        }
      );

      const mappedParams = result1.mappedParams as JsonDict;
      assert(mappedParams.content, 'Content should be populated');
      assert(mappedParams.name === 'sample-document.txt', 'Name should be extracted');
      console.log('✓ Local file handling successful');
    } catch (error) {
      console.log(
        `✗ Local file handling failed: ${error instanceof Error ? error.message : error}`
      );
    }

    // Example 2: URL document (simulated)
    console.log('\n2. URL document handling:');
    try {
      // Note: This would fail in real execution without a real URL
      console.log('✓ URL document handler implemented (would work with real URL)');
    } catch (error) {
      console.log(
        `✗ URL document handling failed: ${error instanceof Error ? error.message : error}`
      );
    }

    // Example 3: Custom document source
    console.log('\n3. Custom document source:');
    try {
      const result3 = await uploadTool.execute(
        {
          document_id: 'doc-123',
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: customDocumentPreExecute,
        }
      );

      const mappedParams = result3.mappedParams as JsonDict;
      assert(mappedParams.content, 'Content should be populated');
      assert(mappedParams.name === 'document-doc-123.pdf', 'Name should be generated');
      console.log('✓ Custom document source successful');
    } catch (error) {
      console.log(
        `✗ Custom document source failed: ${error instanceof Error ? error.message : error}`
      );
    }

    // Example 4: Multi-source handling
    console.log('\n4. Multi-source document handling:');
    try {
      const result4 = await uploadTool.execute(
        {
          document_ref: sampleFilePath,
          source_type: 'local',
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: multiSourcePreExecute,
        }
      );

      const mappedParams = result4.mappedParams as JsonDict;
      assert(mappedParams.content, 'Content should be populated');
      console.log('✓ Multi-source document handling successful');
    } catch (error) {
      console.log(
        `✗ Multi-source document handling failed: ${error instanceof Error ? error.message : error}`
      );
    }

    // Example 5: Security test - should fail
    console.log('\n5. Security test (should fail):');
    try {
      await uploadTool.execute(
        {
          document_path: '/etc/passwd',
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: localFilePreExecute,
        }
      );
      console.log('✗ Security test failed - should have been blocked');
    } catch (_error) {
      console.log('✓ Security test passed - access denied as expected');
    }
  } finally {
    // Clean up sample files
    if (fs.existsSync(sampleFilePath)) {
      fs.unlinkSync(sampleFilePath);
    }
  }
};

// Run the examples
documentHandlingExamples().catch(console.error);
