/**
 * Example showing reusable document handlers for the StackOne toolset.
 *
 * This example demonstrates how to create reusable document handler functions
 * that can be used across different tools and applications.
 *
 * Run this example with:
 * bun run examples/document-handlers.ts
 */

import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StackOneToolSet } from '../src';
import type { JsonDict, PreExecuteFunction } from '../src/types';

const accountId = '45072196112816593343';

/**
 * Document handler configuration
 */
interface DocumentHandlerConfig {
  allowedPaths?: string[];
  allowedDomains?: string[];
  maxFileSize?: number; // in bytes
  allowedExtensions?: string[];
}

/**
 * Document handler factory
 */
class DocumentHandlers {
  /**
   * Create a local file document handler with security restrictions
   */
  static createLocalFileHandler(config: DocumentHandlerConfig = {}): PreExecuteFunction {
    const {
      allowedPaths = ['/uploads/', '/documents/', '/tmp/'],
      maxFileSize = 10 * 1024 * 1024, // 10MB default
      allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'png'],
    } = config;

    return async (params: JsonDict): Promise<JsonDict> => {
      const { file_path, document_path, ...otherParams } = params;
      const filePath = (file_path || document_path) as string;

      if (typeof filePath !== 'string') {
        throw new Error('file_path or document_path must be provided as a string');
      }

      // Security: Check allowed paths
      const isAllowed = allowedPaths.some((allowedPath) => filePath.startsWith(allowedPath));
      if (!isAllowed) {
        throw new Error(
          `Access denied: file must be in allowed directories: ${allowedPaths.join(', ')}`
        );
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Check file size
      const stats = fs.statSync(filePath);
      if (stats.size > maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${maxFileSize} bytes)`);
      }

      // Check file extension
      const extension = path.extname(filePath).slice(1).toLowerCase();
      if (!allowedExtensions.includes(extension)) {
        throw new Error(
          `File extension not allowed: ${extension} (allowed: ${allowedExtensions.join(', ')})`
        );
      }

      // Read and process file
      const content = fs.readFileSync(filePath).toString('base64');
      const fileName = path.basename(filePath);

      return {
        ...otherParams,
        content,
        name: fileName,
        file_format: { value: extension },
      };
    };
  }

  /**
   * Create a URL-based document handler
   */
  static createUrlHandler(config: DocumentHandlerConfig = {}): PreExecuteFunction {
    const {
      allowedDomains = ['api.company.com', 'docs.company.com'],
      maxFileSize = 10 * 1024 * 1024, // 10MB default
    } = config;

    return async (params: JsonDict): Promise<JsonDict> => {
      const { document_url, ...otherParams } = params;

      if (typeof document_url !== 'string') {
        throw new Error('document_url must be a string');
      }

      // Security: Check allowed domains
      const url = new URL(document_url);
      if (!allowedDomains.includes(url.hostname)) {
        throw new Error(`Access denied: only allowed domains are: ${allowedDomains.join(', ')}`);
      }

      // Fetch document
      const response = await fetch(document_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.statusText}`);
      }

      // Check content length
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number.parseInt(contentLength) > maxFileSize) {
        throw new Error(`Document too large: ${contentLength} bytes (max: ${maxFileSize} bytes)`);
      }

      const buffer = await response.arrayBuffer();
      const content = Buffer.from(buffer).toString('base64');

      // Extract filename
      let fileName = 'document';
      const contentDisposition = response.headers.get('content-disposition');

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
  }

  /**
   * Create an S3 document handler
   */
  static createS3Handler(config: {
    bucket: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }): PreExecuteFunction {
    return async (params: JsonDict): Promise<JsonDict> => {
      const { s3_key, ...otherParams } = params;

      if (typeof s3_key !== 'string') {
        throw new Error('s3_key must be a string');
      }

      // Note: In a real implementation, you would use the AWS SDK here
      // This is a placeholder showing the structure
      console.log(`Would fetch from S3: bucket=${config.bucket}, key=${s3_key}`);

      // Simulated S3 response
      const simulatedContent = Buffer.from(`Simulated S3 content for ${s3_key}`).toString('base64');
      const fileName = path.basename(s3_key);
      const extension = path.extname(fileName).slice(1) || 'bin';

      return {
        ...otherParams,
        content: simulatedContent,
        name: fileName,
        file_format: { value: extension },
      };
    };
  }

  /**
   * Create a database document handler
   */
  static createDatabaseHandler(_dbConnection: any): PreExecuteFunction {
    return async (params: JsonDict): Promise<JsonDict> => {
      const { document_id, ...otherParams } = params;

      if (typeof document_id !== 'string') {
        throw new Error('document_id must be a string');
      }

      // Note: In a real implementation, you would query your database here
      console.log(`Would query database for document_id: ${document_id}`);

      // Simulated database response
      const document = {
        content: Buffer.from(`Database document content for ${document_id}`).toString('base64'),
        fileName: `document-${document_id}.pdf`,
        extension: 'pdf',
        metadata: {
          category: 'contract',
          uploadedBy: 'user123',
        },
      };

      return {
        ...otherParams,
        content: document.content,
        name: document.fileName,
        file_format: { value: document.extension },
        // Override with metadata if needed
        category: document.metadata.category,
      };
    };
  }

  /**
   * Create a composite handler that can handle multiple document sources
   */
  static createCompositeHandler(handlers: Record<string, PreExecuteFunction>): PreExecuteFunction {
    return async (params: JsonDict): Promise<JsonDict> => {
      const { source_type, ...otherParams } = params;

      if (typeof source_type !== 'string') {
        throw new Error('source_type must be specified for composite handler');
      }

      const handler = handlers[source_type];
      if (!handler) {
        throw new Error(`No handler configured for source_type: ${source_type}`);
      }

      return handler(otherParams);
    };
  }
}

/**
 * Helper function to create a secure document handler with best practices
 */
function createSecureDocumentHandler(): PreExecuteFunction {
  return DocumentHandlers.createCompositeHandler({
    local: DocumentHandlers.createLocalFileHandler({
      allowedPaths: ['/uploads/', '/tmp/'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
      allowedExtensions: ['pdf', 'doc', 'docx', 'txt'],
    }),
    url: DocumentHandlers.createUrlHandler({
      allowedDomains: ['api.company.com'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
    }),
    s3: DocumentHandlers.createS3Handler({
      bucket: 'company-documents',
      region: 'us-east-1',
    }),
    database: DocumentHandlers.createDatabaseHandler(null), // Would pass real DB connection
  });
}

const documentHandlerExamples = async (): Promise<void> => {
  // Create sample files for testing
  const sampleFilePath = path.join('/tmp', 'test-document.pdf');
  fs.writeFileSync(sampleFilePath, 'This is a test PDF document.');

  try {
    // Initialize the StackOne toolset
    const toolset = new StackOneToolSet();
    const tools = toolset.getStackOneTools('hris_*', accountId);
    const uploadTool = tools.getTool('hris_upload_employee_document');

    assert(uploadTool !== undefined, 'Upload document tool not found');

    console.log('Testing reusable document handlers...\n');

    // Test local file handler
    console.log('1. Testing local file handler:');
    const localHandler = DocumentHandlers.createLocalFileHandler();
    try {
      const _result = await uploadTool.execute(
        {
          file_path: sampleFilePath,
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: localHandler,
        }
      );
      console.log('✓ Local file handler successful');
    } catch (error) {
      console.log(`✗ Local file handler failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test S3 handler
    console.log('\n2. Testing S3 handler:');
    const s3Handler = DocumentHandlers.createS3Handler({
      bucket: 'my-documents',
      region: 'us-east-1',
    });
    try {
      const _result = await uploadTool.execute(
        {
          s3_key: 'documents/contract.pdf',
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: s3Handler,
        }
      );
      console.log('✓ S3 handler successful');
    } catch (error) {
      console.log(`✗ S3 handler failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test composite handler
    console.log('\n3. Testing composite handler:');
    const compositeHandler = createSecureDocumentHandler();
    try {
      const _result = await uploadTool.execute(
        {
          source_type: 'local',
          file_path: sampleFilePath,
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: compositeHandler,
        }
      );
      console.log('✓ Composite handler successful');
    } catch (error) {
      console.log(`✗ Composite handler failed: ${error instanceof Error ? error.message : error}`);
    }

    // Test security restrictions
    console.log('\n4. Testing security restrictions:');
    const restrictiveHandler = DocumentHandlers.createLocalFileHandler({
      allowedPaths: ['/very-restricted/'],
      allowedExtensions: ['pdf'],
    });
    try {
      await uploadTool.execute(
        {
          file_path: sampleFilePath,
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: restrictiveHandler,
        }
      );
      console.log('✗ Security restriction test failed - should have been blocked');
    } catch (_error) {
      console.log('✓ Security restriction test passed - access denied as expected');
    }
  } finally {
    // Clean up sample files
    if (fs.existsSync(sampleFilePath)) {
      fs.unlinkSync(sampleFilePath);
    }
  }
};

// Run the examples
documentHandlerExamples().catch(console.error);
