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

## Quickstart

```typescript
import { StackOneToolSet } from "@stackone/ai";

const toolset = new StackOneToolSet();
const tools = toolset.getTools("hris_*", "your-account-id");
const employeeTool = tools.getTool("hris_list_employees");
const employees = await employeeTool.execute();
```

[View full example](examples/index.ts)

## Account IDs

StackOne uses account IDs to identify different integrations. You can specify the account ID at different levels:

```typescript
import { StackOneToolSet } from "@stackone/ai";

// Method 1: Set at toolset initialization
const toolset = new StackOneToolSet({ accountId: "your-account-id" });

// Method 2: Set when getting tools (overrides toolset account ID)
const tools = toolset.getTools("hris_*", "override-account-id");

// Method 3: Set directly on a tool instance
tool.setAccountId("direct-account-id");
const currentAccountId = tool.getAccountId(); // Get the current account ID
```

[View full example](examples/account-id-usage.ts)

## Custom Base URL

```typescript
import { StackOneToolSet } from "@stackone/ai";

const toolset = new StackOneToolSet({ baseUrl: "https://api.example-dev.com" });
const tools = toolset.getTools("hris_*");
const employeeTool = tools.getTool("hris_list_employees");
```

[View full example](examples/custom-base-url.ts)

## File Uploads

```typescript
import { StackOneToolSet } from "@stackone/ai";

const toolset = new StackOneToolSet();
const uploadTool = toolset
  .getTools("hris_*")
  .getTool("hris_upload_employee_document");
await uploadTool.execute({
  file_path: "/path/to/document.pdf",
  id: "employee-id",
});
```

[View full example](examples/file-uploads.ts)

## Error Handling

```typescript
import { StackOneAPIError, StackOneError } from "@stackone/ai";

try {
  await tool.execute();
} catch (error) {
  if (error instanceof StackOneAPIError) {
    // Handle API errors
  }
}
```

[View full example](examples/error-handling.ts)

## Integrations

### OpenAI

```typescript
import { OpenAI } from "openai";
import { StackOneToolSet } from "@stackone/ai";

const toolset = new StackOneToolSet();
const openAITools = toolset.getTools("hris_*").toOpenAI();
await openai.chat.completions.create({ tools: openAITools });
```

[View full example](examples/openai-integration.ts)

### AI SDK by Vercel

```typescript
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { StackOneToolSet } from "@stackone/ai";

const toolset = new StackOneToolSet();
const aiSdkTools = toolset.getTools("hris_*").toAISDK();
await generateText({ tools: aiSdkTools, maxSteps: 3 });
```

[View full example](examples/ai-sdk-integration.ts)
