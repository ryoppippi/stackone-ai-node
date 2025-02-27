import fs from 'node:fs';
import path from 'node:path';

const DOCS_DIR = path.join(process.cwd(), '.docs');
const EXAMPLES_DIR = path.join(process.cwd(), 'examples');

/**
 * Convert a TypeScript file to markdown, preserving structure.
 */
const convertFileToMarkdown = (tsFile: string): string => {
  const content = fs.readFileSync(tsFile, 'utf-8');

  // Add title from filename
  const fileName = path.basename(tsFile, '.ts');
  let title: string;
  if (fileName === 'index') {
    title = 'StackOne AI SDK';
  } else {
    title = fileName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const output: string[] = [`# ${title}\n`];

  // Find all docstrings and their positions
  // Match docstrings that start and end on their own lines
  const docstringPattern = /(\n|\A)\s*\/\*\*(.*?)\*\/(\s*\n|\Z)/gs;
  let currentPos = 0;

  // Process all matches in the content
  let match: RegExpExecArray | null = docstringPattern.exec(content);
  while (match !== null) {
    const [fullMatch, , docstringContent] = match;
    const start = match.index;
    const end = start + fullMatch.length;

    // If there's code before this docstring, wrap it
    if (currentPos < start) {
      const code = content.substring(currentPos, start).trim();
      if (code) {
        output.push('\n```typescript');
        output.push(code);
        output.push('```\n');
      }
    }

    // Add the docstring content as markdown, removing asterisks from each line
    const cleanedDocstring = docstringContent
      .split('\n')
      .map((line) => line.trim().replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();

    output.push(cleanedDocstring);
    currentPos = end;

    // Get the next match
    match = docstringPattern.exec(content);
  }

  // Add any remaining code
  if (currentPos < content.length) {
    const remainingCode = content.substring(currentPos).trim();
    if (remainingCode) {
      output.push('\n```typescript');
      output.push(remainingCode);
      output.push('```\n');
    }
  }

  return output.join('\n');
};

/**
 * Convert a TypeScript file to markdown documentation.
 */
const createMarkdownFile = (tsFile: string): void => {
  const markdownContent = convertFileToMarkdown(tsFile);

  // Output to .docs directory
  const fileName = path.basename(tsFile, '.ts');
  const outputPath = path.join(DOCS_DIR, `${fileName}.md`);

  // Create directory if needed
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Write the file
  fs.writeFileSync(outputPath, markdownContent);
  console.log(`Created ${outputPath}`);
};

/**
 * Main function to build documentation.
 */
const main = (): void => {
  // Create docs directory if it doesn't exist
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  // Process all TypeScript files in examples directory
  const files = fs.readdirSync(EXAMPLES_DIR);

  for (const file of files) {
    if (file.endsWith('.ts') && !file.startsWith('test_')) {
      createMarkdownFile(path.join(EXAMPLES_DIR, file));
    }
  }
};

// Run the script
main();
