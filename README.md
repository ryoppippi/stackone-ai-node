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
const toolset = new StackOneToolSet();
const tools = toolset.getTools("documents_*");
const uploadTool = tools.getTool("documents_upload_file");

// Upload a file using the file_path parameter
const result = await uploadTool.execute({
  file_path: "/path/to/document.pdf", // Path to the file
});

The name, file format, and content of the file are automatically extracted from the path.
```

## Integrations

### OpenAI

```typescript
import { OpenAI } from "openai";
import { StackOneToolSet } from "@stackone/ai";

const openai = new OpenAI();
const toolset = new StackOneToolSet();

const tools = toolset.getTools("hris_*");
const tool = tools.getTool("hris_list_employees");

const result = await completionTool.execute({
  model: "gpt-4o-mini",
  prompt: "What are the names of the employees?",
  tools: [tool.toOpenAI()],
});
```

### AI SDK by Vercel

```typescript
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { StackOneToolSet } from "@stackone/ai";

// Initialize StackOne
const toolset = new StackOneToolSet();
const tools = toolset.getTools("hris_*", "your-account-id");

// Convert to AI SDK tools
const aiSdkTools = tools.toAISDKTools();

// Use with AI SDK
const { text } = await generateText({
  model: openai("gpt-4o-mini"),
  tools: aiSdkTools,
  prompt: "Get employee details",
  maxSteps: 3, // Automatically calls tools when needed
});
```
