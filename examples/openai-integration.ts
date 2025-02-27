/**
 * This example shows how to use StackOne tools with OpenAI.
 */

import OpenAI from 'openai';
import { StackOneToolSet } from '../src';

const openaiIntegration = async (): Promise<void> => {
  // Initialize StackOne
  const toolset = new StackOneToolSet();
  const accountId = '45072196112816593343';

  // Get the correct tool
  const tools = toolset.getTools('hris_get_employee', accountId);
  const openAITools = tools.toOpenAI();

  // Initialize OpenAI client
  const openai = new OpenAI();

  try {
    await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that can access HRIS information.',
        },
        {
          role: 'user',
          content:
            'What is the employee with id: c28xIQaWQ6MzM5MzczMDA2NzMzMzkwNzIwNA phone number?',
        },
      ],
      tools: openAITools,
    });

    // {
    //   "index": 0,
    //   "message": {
    //     "role": "assistant",
    //     "content": null,
    //     "tool_calls": [
    //       {
    //         "id": "call_1ffppzVwBWnTbBR1KKD38GA3",
    //         "type": "function",
    //         "function": {
    //           "name": "hris_get_employee",
    //           "arguments": "{\"id\":\"c28xIQaWQ6MzM5MzczMDA2NzMzMzkwNzIwNA\",\"fields\":\"phone_number\"}"
    //         }
    //       }
    //     ],
    //     "refusal": null
    //   },
    //   "logprobs": null,
    //   "finish_reason": "tool_calls"
    // }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Run the example
openaiIntegration().catch(console.error);
