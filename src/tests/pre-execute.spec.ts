/**
 * Tests for preExecute function functionality
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { StackOneToolSet } from '../toolsets/stackone';
import type { JsonDict, PreExecuteFunction } from '../types';

describe('PreExecute Function Tests', () => {
  let toolset: StackOneToolSet;
  let testFilePath: string;

  beforeEach(() => {
    toolset = new StackOneToolSet();

    // Create a test file
    testFilePath = path.join('/tmp', 'test-document.txt');
    fs.writeFileSync(testFilePath, 'Test document content');
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test('should execute preExecute function before parameter transformation', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const preExecute: PreExecuteFunction = async (params: JsonDict) => {
      const { document_id, ...otherParams } = params;

      return {
        ...otherParams,
        content: 'dGVzdCBjb250ZW50', // base64 encoded "test content"
        name: 'test-document.txt',
        file_format: { value: 'txt' },
      };
    };

    const result = await uploadTool.execute(
      {
        document_id: 'doc123',
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute,
      }
    );

    const mappedParams = result.mappedParams as JsonDict;
    expect(mappedParams.content).toBe('dGVzdCBjb250ZW50');
    expect(mappedParams.name).toBe('test-document.txt');
    expect((mappedParams.file_format as any).value).toBe('txt');
    expect(mappedParams.document_id).toBeUndefined(); // Should be removed by preExecute
  });

  test('should handle async preExecute functions', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const preExecute: PreExecuteFunction = async (params: JsonDict) => {
      // Simulate async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      return {
        ...params,
        content: 'YXN5bmMgY29udGVudA==', // base64 encoded "async content"
        name: 'async-document.pdf',
        file_format: { value: 'pdf' },
      };
    };

    const result = await uploadTool.execute(
      {
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute,
      }
    );

    const mappedParams = result.mappedParams as JsonDict;
    expect(mappedParams.content).toBe('YXN5bmMgY29udGVudA==');
    expect(mappedParams.name).toBe('async-document.pdf');
  });

  test('should handle preExecute function errors', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const preExecute: PreExecuteFunction = async () => {
      throw new Error('PreExecute function error');
    };

    await expect(
      uploadTool.execute(
        { id: 'employee123' },
        {
          dryRun: true,
          preExecute,
        }
      )
    ).rejects.toThrow('PreExecute function error');
  });

  test('should work without preExecute function (backward compatibility)', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    // Test using existing file_path transformation
    const result = await uploadTool.execute(
      {
        file_path: testFilePath,
        id: 'employee123',
      },
      { dryRun: true }
    );

    const mappedParams = result.mappedParams as JsonDict;
    expect(mappedParams.content).toBeDefined();
    expect(mappedParams.name).toBe('test-document.txt');
    expect((mappedParams.file_format as any).value).toBe('txt');
  });

  test('should allow preExecute to override transformed parameters', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const preExecute: PreExecuteFunction = async (params: JsonDict) => {
      // Override the file_path transformation with custom content
      const { file_path, ...otherParams } = params; // Remove file_path to prevent transformation
      return {
        ...otherParams,
        content: 'b3ZlcnJpZGRlbiBjb250ZW50', // base64 encoded "overridden content"
        name: 'overridden-document.pdf',
        file_format: { value: 'pdf' },
      };
    };

    const result = await uploadTool.execute(
      {
        file_path: testFilePath, // This would normally be transformed
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute,
      }
    );

    const mappedParams = result.mappedParams as JsonDict;
    expect(mappedParams.content).toBe('b3ZlcnJpZGRlbiBjb250ZW50');
    expect(mappedParams.name).toBe('overridden-document.pdf');
    expect((mappedParams.file_format as any).value).toBe('pdf');
  });

  test('should handle local file document handler pattern', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const localFileHandler: PreExecuteFunction = async (params: JsonDict) => {
      const { document_path, ...otherParams } = params;

      if (typeof document_path !== 'string') {
        throw new Error('document_path must be a string');
      }

      // Security check
      if (!document_path.startsWith('/tmp/')) {
        throw new Error('Access denied: file must be in /tmp/ directory');
      }

      if (!fs.existsSync(document_path)) {
        throw new Error(`File not found: ${document_path}`);
      }

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

    const result = await uploadTool.execute(
      {
        document_path: testFilePath,
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute: localFileHandler,
      }
    );

    const mappedParams = result.mappedParams as JsonDict;
    expect(mappedParams.content).toBeDefined();
    expect(mappedParams.name).toBe('test-document.txt');
    expect((mappedParams.file_format as any).value).toBe('txt');
  });

  test('should handle security restrictions in preExecute', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const secureHandler: PreExecuteFunction = async (params: JsonDict) => {
      const { document_path } = params;

      if (typeof document_path === 'string' && document_path.includes('/etc/')) {
        throw new Error('Access denied: cannot access system files');
      }

      return params;
    };

    await expect(
      uploadTool.execute(
        {
          document_path: '/etc/passwd',
          id: 'employee123',
        },
        {
          dryRun: true,
          preExecute: secureHandler,
        }
      )
    ).rejects.toThrow('Access denied: cannot access system files');
  });

  test('should handle custom document source pattern', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const customSourceHandler: PreExecuteFunction = async (params: JsonDict) => {
      const { document_id, ...otherParams } = params;

      // Simulate fetching from a custom source
      const document = {
        content: Buffer.from(`Custom content for ${document_id}`).toString('base64'),
        fileName: `document-${document_id}.pdf`,
        extension: 'pdf',
      };

      return {
        ...otherParams,
        content: document.content,
        name: document.fileName,
        file_format: { value: document.extension },
      };
    };

    const result = await uploadTool.execute(
      {
        document_id: 'custom-doc-123',
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute: customSourceHandler,
      }
    );

    const mappedParams = result.mappedParams as JsonDict;
    expect(mappedParams.content).toBeDefined();
    expect(mappedParams.name).toBe('document-custom-doc-123.pdf');
    expect((mappedParams.file_format as any).value).toBe('pdf');
  });

  test('should handle multi-source document handler pattern', async () => {
    const tools = toolset.getStackOneTools('hris_*');
    const uploadTool = tools.getTool('hris_upload_employee_document');

    const multiSourceHandler: PreExecuteFunction = async (params: JsonDict) => {
      const { source_type, document_ref, ...otherParams } = params;

      switch (source_type) {
        case 'local':
          if (!fs.existsSync(document_ref as string)) {
            throw new Error(`File not found: ${document_ref}`);
          }
          return {
            ...otherParams,
            content: fs.readFileSync(document_ref as string).toString('base64'),
            name: path.basename(document_ref as string),
            file_format: { value: path.extname(document_ref as string).slice(1) },
          };

        case 'custom':
          return {
            ...otherParams,
            content: Buffer.from(`Custom content for ${document_ref}`).toString('base64'),
            name: `custom-${document_ref}.pdf`,
            file_format: { value: 'pdf' },
          };

        default:
          throw new Error(`Unknown source_type: ${source_type}`);
      }
    };

    // Test local source
    const result1 = await uploadTool.execute(
      {
        source_type: 'local',
        document_ref: testFilePath,
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute: multiSourceHandler,
      }
    );

    const mappedParams1 = result1.mappedParams as JsonDict;
    expect(mappedParams1.content).toBeDefined();
    expect(mappedParams1.name).toBe('test-document.txt');

    // Test custom source
    const result2 = await uploadTool.execute(
      {
        source_type: 'custom',
        document_ref: 'doc-456',
        id: 'employee123',
      },
      {
        dryRun: true,
        preExecute: multiSourceHandler,
      }
    );

    const mappedParams2 = result2.mappedParams as JsonDict;
    expect(mappedParams2.content).toBeDefined();
    expect(mappedParams2.name).toBe('custom-doc-456.pdf');
  });
});
