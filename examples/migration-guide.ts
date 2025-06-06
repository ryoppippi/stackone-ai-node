import * as fs from 'node:fs';
import * as path from 'node:path';
import { StackOneToolSet } from '../src';
import type { JsonDict, PreExecuteFunction } from '../src/types';

const accountId = '45072196112816593343';

/**
 * BEFORE: Using file_path parameter transformation (still works but limited)
 */
const oldApproach = async (): Promise<void> => {
  console.log('=== OLD APPROACH: file_path transformation ===\n');

  // Create a test file
  const sampleFilePath = path.join('/tmp', 'sample-document.pdf');
  fs.writeFileSync(sampleFilePath, 'This is a sample document.');

  try {
    const toolset = new StackOneToolSet();
    const tools = toolset.getStackOneTools('hris_*', accountId);
    const uploadTool = tools.getTool('hris_upload_employee_document');

    // OLD: Use file_path parameter (automatically transforms to content, name, file_format)
    const _result = await uploadTool.execute(
      {
        file_path: sampleFilePath,
        id: 'employee123',
        category: { value: 'contract' },
      },
      { dryRun: true }
    );

    console.log('✓ Old approach still works');
    console.log('  - Uses built-in file_path transformation');
    console.log('  - Limited to local files only');
    console.log('  - No security restrictions');
    console.log('  - file_path parameter is automatically removed\n');
  } finally {
    if (fs.existsSync(sampleFilePath)) {
      fs.unlinkSync(sampleFilePath);
    }
  }
};

/**
 * AFTER: Using preExecute functions (recommended new approach)
 */
const newApproach = async (): Promise<void> => {
  console.log('=== NEW APPROACH: preExecute functions ===\n');

  // Create a test file
  const sampleFilePath = path.join('/tmp', 'sample-document.pdf');
  fs.writeFileSync(sampleFilePath, 'This is a sample document.');

  try {
    const toolset = new StackOneToolSet();
    const tools = toolset.getStackOneTools('hris_*', accountId);
    const uploadTool = tools.getTool('hris_upload_employee_document');

    // NEW: Drop-in replacement for file_path transformation
    const localFileHandler: PreExecuteFunction = async (params: JsonDict) => {
      const { file_path, ...otherParams } = params;

      if (typeof file_path !== 'string') {
        throw new Error('file_path must be a string');
      }

      // SECURITY: Add path restrictions
      const allowedPaths = ['/uploads/', '/documents/', '/tmp/'];
      const isAllowed = allowedPaths.some((allowedPath) => file_path.startsWith(allowedPath));

      if (!isAllowed) {
        throw new Error(
          `Access denied: file must be in allowed directories: ${allowedPaths.join(', ')}`
        );
      }

      if (!fs.existsSync(file_path)) {
        throw new Error(`File not found: ${file_path}`);
      }

      // Transform file_path to document parameters
      const content = fs.readFileSync(file_path).toString('base64');
      const fileName = path.basename(file_path);
      const extension = path.extname(file_path).slice(1);

      return {
        ...otherParams,
        content,
        name: fileName,
        file_format: { value: extension },
      };
    };

    // Use the same API as before, but with security
    const _result1 = await uploadTool.execute(
      {
        file_path: sampleFilePath,
        id: 'employee123',
        category: { value: 'contract' },
      },
      {
        dryRun: true,
        preExecute: localFileHandler,
      }
    );

    console.log('✓ New approach - local files with security');
    console.log('  - Drop-in replacement for file_path');
    console.log('  - Adds security restrictions');
    console.log('  - Developer controls allowed paths\n');

    // NEW: Support for external document sources
    const s3Handler: PreExecuteFunction = async (params: JsonDict) => {
      const { s3_bucket, s3_key, ...otherParams } = params;

      // Simulate S3 fetch (would use AWS SDK in real implementation)
      console.log(`  Fetching from S3: s3://${s3_bucket}/${s3_key}`);

      return {
        ...otherParams,
        content: Buffer.from(`S3 content for ${s3_key}`).toString('base64'),
        name: path.basename(s3_key as string),
        file_format: { value: path.extname(s3_key as string).slice(1) || 'pdf' },
      };
    };

    const _result2 = await uploadTool.execute(
      {
        s3_bucket: 'company-documents',
        s3_key: 'contracts/employee-123-contract.pdf',
        id: 'employee123',
        category: { value: 'contract' },
      },
      {
        dryRun: true,
        preExecute: s3Handler,
      }
    );

    console.log('✓ New approach - S3 documents');
    console.log('  - Supports external document sources');
    console.log('  - Developer controls authentication');
    console.log('  - Can integrate with any service\n');

    // NEW: Custom document sources
    const databaseHandler: PreExecuteFunction = async (params: JsonDict) => {
      const { document_id, ...otherParams } = params;

      // Simulate database fetch
      console.log(`  Fetching from database: document_id=${document_id}`);

      const document = {
        content: Buffer.from(`Database content for ${document_id}`).toString('base64'),
        fileName: `contract-${document_id}.pdf`,
        extension: 'pdf',
        category: { value: 'employment' },
      };

      return {
        ...otherParams,
        content: document.content,
        name: document.fileName,
        file_format: { value: document.extension },
        // Override parameters with database values
        category: document.category,
      };
    };

    const _result3 = await uploadTool.execute(
      {
        document_id: 'db-doc-456',
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute: databaseHandler,
      }
    );

    console.log('✓ New approach - database documents');
    console.log('  - Fetch from any data source');
    console.log('  - Can override any parameter');
    console.log('  - Full developer control\n');
  } finally {
    if (fs.existsSync(sampleFilePath)) {
      fs.unlinkSync(sampleFilePath);
    }
  }
};

/**
 * Advanced example: Reusable handler factory
 */
const advancedExample = async (): Promise<void> => {
  console.log('=== ADVANCED: Reusable handler patterns ===\n');

  const toolset = new StackOneToolSet();
  const tools = toolset.getStackOneTools('hris_*', accountId);
  const _uploadTool = tools.getTool('hris_upload_employee_document');

  // Factory function for creating document handlers
  function createDocumentHandler(config: {
    allowedPaths?: string[];
    allowedDomains?: string[];
    maxFileSize?: number;
  }): PreExecuteFunction {
    return async (params: JsonDict) => {
      const { source, document_ref, ...otherParams } = params;

      switch (source) {
        case 'local': {
          const filePath = document_ref as string;

          // Security checks
          if (!config.allowedPaths?.some((path) => filePath.startsWith(path))) {
            throw new Error('File path not allowed');
          }

          return {
            ...otherParams,
            content: fs.readFileSync(filePath).toString('base64'),
            name: path.basename(filePath),
            file_format: { value: path.extname(filePath).slice(1) },
          };
        }

        case 'url': {
          const url = document_ref as string;
          const urlObj = new URL(url);

          // Security checks
          if (!config.allowedDomains?.includes(urlObj.hostname)) {
            throw new Error('Domain not allowed');
          }

          console.log(`  Would fetch from URL: ${url}`);
          return {
            ...otherParams,
            content: Buffer.from(`URL content for ${url}`).toString('base64'),
            name: path.basename(urlObj.pathname),
            file_format: { value: 'pdf' },
          };
        }

        default:
          throw new Error(`Unknown source: ${source}`);
      }
    };
  }

  // Create a secure, reusable handler
  const secureHandler = createDocumentHandler({
    allowedPaths: ['/uploads/', '/tmp/'],
    allowedDomains: ['api.company.com', 'docs.company.com'],
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  // Use across multiple tools
  const tools_to_test = [
    'hris_upload_employee_document',
    // Could add more document upload tools here
  ];

  for (const toolName of tools_to_test) {
    try {
      const tool = tools.getTool(toolName);

      const _result = await tool.execute(
        {
          source: 'url',
          document_ref: 'https://api.company.com/documents/contract.pdf',
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: secureHandler,
        }
      );

      console.log(`✓ Reusable handler works with ${toolName}`);
    } catch (error) {
      console.log(`✗ ${toolName} failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('\n✓ Advanced patterns demonstrated');
  console.log('  - Factory functions for reusable handlers');
  console.log('  - Configurable security policies');
  console.log('  - Multi-source document support');
  console.log('  - Works across multiple tools\n');
};

/**
 * Migration summary and recommendations
 */
const migrationSummary = (): void => {
  console.log('=== MIGRATION SUMMARY ===\n');

  console.log('OLD APPROACH (file_path transformations):');
  console.log('  ❌ Security risk - any file accessible');
  console.log('  ❌ Limited to local files only');
  console.log('  ❌ No developer control over file access');
  console.log('  ❌ Hard to customize or extend');
  console.log('  ✅ Simple to use for basic cases\n');

  console.log('NEW APPROACH (preExecute functions):');
  console.log('  ✅ Security-first - developer controls access');
  console.log('  ✅ Multi-source support (local, S3, URLs, database)');
  console.log('  ✅ Can override any parameter, not just documents');
  console.log('  ✅ Reusable and composable');
  console.log('  ✅ Async support for external services');
  console.log('  ✅ Backward compatible (can still use file_path)\n');

  console.log('MIGRATION STEPS:');
  console.log('  1. Replace file_path usage with preExecute functions');
  console.log('  2. Add security restrictions to local file access');
  console.log('  3. Implement handlers for external document sources');
  console.log('  4. Create reusable handler factories for your use cases');
  console.log('  5. Test thoroughly and remove old file_path usage\n');

  console.log('RECOMMENDED APPROACH:');
  console.log('  - Use preExecute functions for all new development');
  console.log('  - Migrate existing file_path usage gradually');
  console.log('  - Create standard handlers for your organization');
  console.log('  - Always implement security restrictions');
  console.log('  - Consider creating a shared handler library\n');
};

// Run all examples
const runMigrationGuide = async (): Promise<void> => {
  try {
    await oldApproach();
    await newApproach();
    await advancedExample();
    migrationSummary();

    console.log('🎉 Migration guide completed successfully!');
  } catch (error) {
    console.error('Migration guide failed:', error);
  }
};

runMigrationGuide().catch(console.error);
