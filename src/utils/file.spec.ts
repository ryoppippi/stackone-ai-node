import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { StackOneError } from './errors';
import {
  directoryExists,
  extractFileInfo,
  getFileNameWithoutExtension,
  isBase64,
  isValidFilePath,
  joinPaths,
  listFilesInDirectory,
  readFileAsBase64,
  readJsonFile,
} from './file';

describe('File utilities', () => {
  let tempDir: string;
  let tempFile: string;
  let tempJsonFile: string;
  let tempSubDir: string;

  beforeEach(() => {
    // Create temporary directory and files for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stackone-test-'));
    tempFile = path.join(tempDir, 'test.txt');
    tempJsonFile = path.join(tempDir, 'test.json');
    tempSubDir = path.join(tempDir, 'subdir');

    // Create test files
    fs.writeFileSync(tempFile, 'Hello World');
    fs.writeFileSync(tempJsonFile, JSON.stringify({ test: 'data', number: 42 }));
    fs.mkdirSync(tempSubDir);
    fs.writeFileSync(path.join(tempSubDir, 'nested.txt'), 'nested content');
  });

  afterEach(() => {
    // Clean up temporary files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('isBase64', () => {
    it('should return true for valid base64 strings', () => {
      expect(isBase64('SGVsbG8gV29ybGQ=')).toBe(true); // "Hello World"
      expect(isBase64('dGVzdA==')).toBe(true); // "test"
      expect(isBase64('YWJjZGVmZ2hpams=')).toBe(true); // "abcdefghijk"
    });

    it('should return true for data URLs', () => {
      expect(isBase64('data:image/png;base64,iVBORw0KGgoAAAANS')).toBe(true);
      expect(isBase64('data:text/plain;base64,SGVsbG8=')).toBe(true);
      expect(isBase64('data:application/json;base64,eyJ0ZXN0IjoidmFsdWUifQ==')).toBe(true);
    });

    it('should return false for invalid base64 strings', () => {
      expect(isBase64('not-base64')).toBe(false);
      expect(isBase64('Hello World')).toBe(false);
      expect(isBase64('123456789')).toBe(false);
      expect(isBase64('invalid@#$%')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      expect(isBase64(123 as any)).toBe(false);
      expect(isBase64(null as any)).toBe(false);
      expect(isBase64(undefined as any)).toBe(false);
      expect(isBase64({} as any)).toBe(false);
      expect(isBase64([] as any)).toBe(false);
    });

    it('should return true for empty string (matches base64 regex)', () => {
      expect(isBase64('')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(isBase64('A')).toBe(false); // Too short
      expect(isBase64('AB')).toBe(false); // Too short
      expect(isBase64('ABC')).toBe(false); // Too short
      expect(isBase64('ABCD')).toBe(true); // Minimum valid base64
    });
  });

  describe('isValidFilePath', () => {
    it('should return true for existing file paths', () => {
      expect(isValidFilePath(tempFile)).toBe(true);
    });

    it('should return false for non-existent file paths', () => {
      expect(isValidFilePath('/non/existent/file.txt')).toBe(false);
      expect(isValidFilePath(path.join(tempDir, 'nonexistent.txt'))).toBe(false);
    });

    it('should return false for data URLs', () => {
      expect(isValidFilePath('data:image/png;base64,iVBORw0KGgoAAAANS')).toBe(false);
    });

    it('should return false for base64 strings', () => {
      expect(isValidFilePath('SGVsbG8gV29ybGQ=')).toBe(false);
    });

    it('should return false for non-string inputs', () => {
      expect(isValidFilePath(123 as any)).toBe(false);
      expect(isValidFilePath(null as any)).toBe(false);
      expect(isValidFilePath(undefined as any)).toBe(false);
    });

    it('should return true for directories (checks existence, not file type)', () => {
      expect(isValidFilePath(tempDir)).toBe(true); // Directory exists, so returns true
    });
  });

  describe('readFileAsBase64', () => {
    it('should read file and return base64 string', () => {
      const result = readFileAsBase64(tempFile);
      const expected = Buffer.from('Hello World').toString('base64');
      expect(result).toBe(expected);
    });

    it('should throw StackOneError for non-existent file', () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.txt');
      expect(() => readFileAsBase64(nonExistentFile)).toThrow(StackOneError);
      expect(() => readFileAsBase64(nonExistentFile)).toThrow(`File not found: ${nonExistentFile}`);
    });

    it('should handle binary files', () => {
      const binaryFile = path.join(tempDir, 'binary.bin');
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      fs.writeFileSync(binaryFile, binaryData);

      const result = readFileAsBase64(binaryFile);
      const expected = binaryData.toString('base64');
      expect(result).toBe(expected);
    });

    it('should handle empty files', () => {
      const emptyFile = path.join(tempDir, 'empty.txt');
      fs.writeFileSync(emptyFile, '');

      const result = readFileAsBase64(emptyFile);
      expect(result).toBe('');
    });
  });

  describe('extractFileInfo', () => {
    it('should extract filename and extension correctly', () => {
      expect(extractFileInfo('/path/to/file.txt')).toEqual({
        fileName: 'file.txt',
        extension: 'txt'
      });

      expect(extractFileInfo('document.pdf')).toEqual({
        fileName: 'document.pdf',
        extension: 'pdf'
      });

      expect(extractFileInfo('/home/user/image.JPG')).toEqual({
        fileName: 'image.JPG',
        extension: 'jpg' // Should be lowercase
      });
    });

    it('should handle files without extensions', () => {
      expect(extractFileInfo('/path/to/filename')).toEqual({
        fileName: 'filename',
        extension: null
      });

      expect(extractFileInfo('README')).toEqual({
        fileName: 'README',
        extension: null
      });
    });

    it('should handle files with multiple dots', () => {
      expect(extractFileInfo('/path/to/file.tar.gz')).toEqual({
        fileName: 'file.tar.gz',
        extension: 'gz'
      });

      expect(extractFileInfo('backup.2023.12.25.sql')).toEqual({
        fileName: 'backup.2023.12.25.sql',
        extension: 'sql'
      });
    });

    it('should handle hidden files', () => {
      expect(extractFileInfo('.gitignore')).toEqual({
        fileName: '.gitignore',
        extension: 'gitignore' // Takes last part after splitting on dots
      });

      expect(extractFileInfo('.env.local')).toEqual({
        fileName: '.env.local',
        extension: 'local'
      });
    });

    it('should handle edge cases', () => {
      expect(extractFileInfo('.')).toEqual({
        fileName: '.',
        extension: null
      });

      expect(extractFileInfo('..')).toEqual({
        fileName: '..',
        extension: null
      });

      expect(extractFileInfo('')).toEqual({
        fileName: '',
        extension: null
      });
    });
  });

  describe('directoryExists', () => {
    it('should return true for existing directories', () => {
      expect(directoryExists(tempDir)).toBe(true);
      expect(directoryExists(tempSubDir)).toBe(true);
    });

    it('should return false for non-existent directories', () => {
      expect(directoryExists('/non/existent/directory')).toBe(false);
      expect(directoryExists(path.join(tempDir, 'nonexistent'))).toBe(false);
    });

    it('should return false for files (not directories)', () => {
      expect(directoryExists(tempFile)).toBe(false);
    });

    it('should handle permission errors gracefully', () => {
      // This is hard to test cross-platform, but the function should handle exceptions
      expect(() => directoryExists('/root/protected')).not.toThrow();
    });
  });

  describe('listFilesInDirectory', () => {
    beforeEach(() => {
      // Create additional test files
      fs.writeFileSync(path.join(tempDir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(tempDir, 'file2.js'), 'content2');
      fs.writeFileSync(path.join(tempDir, 'file3.md'), 'content3');
    });

    it('should list all files in directory', () => {
      const files = listFilesInDirectory(tempDir);
      expect(files).toContain('test.txt');
      expect(files).toContain('test.json');
      expect(files).toContain('file1.txt');
      expect(files).toContain('file2.js');
      expect(files).toContain('file3.md');
      expect(files).toContain('subdir');
    });

    it('should apply filter when provided', () => {
      const txtFiles = listFilesInDirectory(tempDir, (name) => name.endsWith('.txt'));
      expect(txtFiles).toContain('test.txt');
      expect(txtFiles).toContain('file1.txt');
      expect(txtFiles).not.toContain('test.json');
      expect(txtFiles).not.toContain('file2.js');
    });

    it('should return empty array for non-existent directory', () => {
      const files = listFilesInDirectory('/non/existent');
      expect(files).toEqual([]);
    });

    it('should return empty array when filter matches nothing', () => {
      const files = listFilesInDirectory(tempDir, (name) => name.endsWith('.nonexistent'));
      expect(files).toEqual([]);
    });

    it('should handle empty directory', () => {
      const emptyDir = path.join(tempDir, 'empty');
      fs.mkdirSync(emptyDir);
      
      const files = listFilesInDirectory(emptyDir);
      expect(files).toEqual([]);
    });
  });

  describe('readJsonFile', () => {
    it('should read and parse JSON file correctly', () => {
      const result = readJsonFile(tempJsonFile);
      expect(result).toEqual({ test: 'data', number: 42 });
    });

    it('should throw StackOneError for non-existent file', () => {
      const nonExistentFile = path.join(tempDir, 'nonexistent.json');
      expect(() => readJsonFile(nonExistentFile)).toThrow(StackOneError);
      expect(() => readJsonFile(nonExistentFile)).toThrow(`JSON file not found: ${nonExistentFile}`);
    });

    it('should throw StackOneError for invalid JSON', () => {
      const invalidJsonFile = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(invalidJsonFile, '{ invalid json }');

      expect(() => readJsonFile(invalidJsonFile)).toThrow(StackOneError);
      expect(() => readJsonFile(invalidJsonFile)).toThrow('Error parsing JSON file:');
    });

    it('should work with generic type parameter', () => {
      interface TestInterface {
        test: string;
        number: number;
      }

      const result = readJsonFile<TestInterface>(tempJsonFile);
      expect(result.test).toBe('data');
      expect(result.number).toBe(42);
    });

    it('should handle empty JSON file', () => {
      const emptyJsonFile = path.join(tempDir, 'empty.json');
      fs.writeFileSync(emptyJsonFile, '{}');

      const result = readJsonFile(emptyJsonFile);
      expect(result).toEqual({});
    });

    it('should handle JSON arrays', () => {
      const arrayJsonFile = path.join(tempDir, 'array.json');
      fs.writeFileSync(arrayJsonFile, '[1, 2, 3]');

      const result = readJsonFile<number[]>(arrayJsonFile);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('getFileNameWithoutExtension', () => {
    it('should return filename without extension', () => {
      expect(getFileNameWithoutExtension('/path/to/file.txt')).toBe('file');
      expect(getFileNameWithoutExtension('document.pdf')).toBe('document');
      expect(getFileNameWithoutExtension('/home/user/image.jpg')).toBe('image');
    });

    it('should handle files without extensions', () => {
      expect(getFileNameWithoutExtension('/path/to/filename')).toBe('filename');
      expect(getFileNameWithoutExtension('README')).toBe('README');
    });

    it('should handle files with multiple dots', () => {
      expect(getFileNameWithoutExtension('/path/to/file.tar.gz')).toBe('file.tar');
      expect(getFileNameWithoutExtension('backup.2023.12.25.sql')).toBe('backup.2023.12.25');
    });

    it('should handle hidden files', () => {
      expect(getFileNameWithoutExtension('.gitignore')).toBe(''); // lastIndexOf('.') is 0, substring(0,0) = ''
      expect(getFileNameWithoutExtension('.env.local')).toBe('.env');
    });

    it('should handle edge cases', () => {
      expect(getFileNameWithoutExtension('.')).toBe(''); // lastIndexOf('.') is 0, substring(0,0) = ''
      expect(getFileNameWithoutExtension('..')).toBe('.'); // lastIndexOf('.') is 1, substring(0,1) = '.'
      expect(getFileNameWithoutExtension('')).toBe(''); // no dot, returns original
      expect(getFileNameWithoutExtension('file.')).toBe('file');
    });
  });

  describe('joinPaths', () => {
    it('should join path segments correctly', () => {
      expect(joinPaths('a', 'b', 'c')).toBe(path.join('a', 'b', 'c'));
      expect(joinPaths('/home', 'user', 'documents')).toBe(path.join('/home', 'user', 'documents'));
      expect(joinPaths('..', 'parent', 'file.txt')).toBe(path.join('..', 'parent', 'file.txt'));
    });

    it('should handle single segment', () => {
      expect(joinPaths('single')).toBe('single');
      expect(joinPaths('/root')).toBe('/root');
    });

    it('should handle empty segments', () => {
      expect(joinPaths('a', '', 'c')).toBe(path.join('a', '', 'c'));
      expect(joinPaths('', 'b', 'c')).toBe(path.join('', 'b', 'c'));
    });

    it('should handle no segments', () => {
      expect(joinPaths()).toBe('.');
    });

    it('should normalize paths', () => {
      expect(joinPaths('a', '..', 'b')).toBe(path.join('a', '..', 'b'));
      expect(joinPaths('a', '.', 'b')).toBe(path.join('a', '.', 'b'));
    });

    it('should handle absolute and relative paths', () => {
      expect(joinPaths('/absolute', 'relative')).toBe(path.join('/absolute', 'relative'));
      expect(joinPaths('relative', '/absolute')).toBe(path.join('relative', '/absolute'));
    });
  });
});