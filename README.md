# StackOne AI Node.js SDK

StackOne AI provides a unified interface for accessing various SaaS tools through AI-friendly APIs.

## Installation

```bash
# Using npm
npm install @stackone/ai

# Using yarn
yarn add @stackone/ai

# Using bun
bun add @stackone/ai
```

## Authentication

Set the `STACKONE_API_KEY` environment variable:

```bash
export STACKONE_API_KEY=<your-api-key>
```

or load from a .env file using your preferred environment variable library.

## Account IDs

StackOne uses account IDs to identify different integrations. You can specify the account ID when initializing the SDK or when getting tools.

## Quickstart

```typescript
import { StackOneToolSet } from "@stackone/ai";

// Initialize with API key from environment variable
const toolset = new StackOneToolSet();

// Or initialize with explicit API key
// const toolset = new StackOneToolSet('your-api-key');

// Get all HRIS-related tools
const accountId = "45072196112816593343";
const tools = toolset.getTools("hris_*", accountId);

// Use a specific tool
const employeeTool = tools.getTool("hris_list_employees");
if (employeeTool) {
  const employees = await employeeTool.execute();
  console.log(employees);
}
```

## Custom Base URL

You can specify a custom base URL when initializing the SDK. This is useful for testing against development APIs or working with self-hosted StackOne instances.

```typescript
import { StackOneToolSet } from "@stackone/ai";

// Initialize with a custom base URL
const toolset = new StackOneToolSet(
  "your-api-key",
  "your-account-id",
  "https://api.example-dev.com"
);

// Get tools with the custom base URL
const tools = toolset.getTools("hris_*");

// All API requests will use the custom base URL
const employeeTool = tools.getTool("hris_list_employees");
if (employeeTool) {
  const employees = await employeeTool.execute();
  console.log(employees);
}
```

## File Uploads

The SDK supports file uploads for tools that accept file parameters. File uploads have been simplified to use a single `file_path` parameter:

```typescript
import { StackOneToolSet } from "@stackone/ai";
import * as path from "path";

// Initialize with API key and account ID
const toolset = new StackOneToolSet(
  process.env.STACKONE_API_KEY,
  process.env.STACKONE_ACCOUNT_ID
);
const tools = toolset.getTools("documents_*");
const uploadTool = tools.getTool("documents_upload_file");

// Upload a file using the file_path parameter
const result = await uploadTool.execute({
  file_path: path.join(__dirname, "document.pdf"), // Path to the file
});
```

### Using with OpenAI or AI SDK

When using file upload tools with OpenAI or AI SDK, the parameters are automatically simplified to a single `file_path` parameter:

```typescript
import { StackOneToolSet } from "@stackone/ai";
import OpenAI from "openai";

// Initialize with API key and account ID
const toolset = new StackOneToolSet(
  process.env.STACKONE_API_KEY,
  process.env.STACKONE_ACCOUNT_ID
);
const tools = toolset.getTools("documents_*");

// Convert to OpenAI functions
const openAITools = tools.toOpenAI();

// The file upload tool will have a simplified schema with just a file_path parameter
// {
//   "type": "function",
//   "function": {
//     "name": "documents_upload_file",
//     "description": "Upload a document file",
//     "parameters": {
//       "type": "object",
//       "properties": {
//         "file_path": {
//           "type": "string",
//           "description": "Path to the file to upload. The filename will be extracted from the path."
//         }
//       },
//       "required": ["file_path"]
//     }
//   }
// }

// Use with OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Upload this document: /path/to/document.pdf" },
  ],
  tools: openAITools,
});

// When OpenAI calls the tool with the file_path parameter
// The SDK automatically handles:
// 1. Extracting the filename from the path
// 2. Determining the file format from the extension
// 3. Reading and encoding the file
// 4. Sending it to the API with the correct parameters
```

## Integrations

### OpenAI

```

```
