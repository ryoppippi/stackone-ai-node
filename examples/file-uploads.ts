/**
 * Example showing how to upload files using the StackOne SDK.
 * 
 * This example demonstrates how to upload files using the simplified file_path parameter,
 * which is the only parameter needed for file uploads. The SDK automatically derives
 * the necessary file parameters (content, name, file_format) from the file_path.
 */

// Load environment variables from .env file
import { config } from 'dotenv';

config();

import * as fs from 'node:fs';
import * as path from 'node:path';
import { StackOneAPIError, StackOneToolSet } from '../src';

const accountId = '45072196112816593343';

const main = async () => {
  try {
    // Create a sample file for testing
    const sampleFilePath = path.join(__dirname, 'sample-file.txt');
    fs.writeFileSync(sampleFilePath, 'This is a sample file for testing file uploads.');

    // Initialize the StackOne toolset with your API key and account ID
    const toolset = new StackOneToolSet();
    
    // Get tools for documents
    const tools = toolset.getTools('hris_*', accountId);
    
    // Get the upload file tool
    const uploadTool = tools.getTool('hris_upload_employee_document');

    // Check if upload tool exists
    if (!uploadTool) {
      console.error('Upload document tool not found');
      return;
    }

    try {
      // Upload a file using the file_path parameter
      // The SDK will automatically derive content, name, and file_format from the file_path
      const result = await uploadTool.execute({
        file_path: sampleFilePath,
        id: 'c28xIQaWQ6MzM5MzczMDA2NzMzMzkwNzIwNA',
        category: { value: 'shared' },
      });
      
      // Only log the final result
      console.log('Upload successful:', result);
      
    } catch (error) {
      if (error instanceof StackOneAPIError) {
        // Use the toString method to get the properly formatted error message
        console.error(error.toString());
      } else {
        console.error('Error:', error);
      }
    }

    // Clean up the sample file
    fs.unlinkSync(sampleFilePath);
    console.log('Sample file deleted.');
    
  } catch (error) {
    console.error('Error:', error);
  }
};

main();
