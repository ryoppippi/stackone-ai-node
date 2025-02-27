/**
 * # File Uploads
 *
 * This example shows how to upload files using the StackOne SDK.
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'node:fs';
import * as path from 'node:path';
import { StackOneAPIError, StackOneToolSet } from '../src';

const fileUploads = async (): Promise<void> => {
  // Initialize StackOne
  const toolset = new StackOneToolSet();
  const accountId = '45072196112816593343';

  // Get document tools
  const tools = toolset.getTools('documents_*', accountId);

  // Find the upload document tool
  const uploadTool = tools.getTool('documents_upload_document');

  if (!uploadTool) {
    console.error('Upload document tool not found');
    return;
  }

  try {
    // Create a sample file to upload
    const sampleFilePath = path.join(__dirname, 'sample.txt');
    fs.writeFileSync(sampleFilePath, 'This is a sample file for testing file uploads.');

    console.log(`Created sample file at: ${sampleFilePath}`);

    // Read the file as a Buffer
    const fileContent = fs.readFileSync(sampleFilePath);

    // Upload the file
    console.log('Uploading file...');
    const result = await uploadTool.execute({
      file: fileContent,
      filename: 'sample.txt',
      folder_id: 'root', // Assuming 'root' is a valid folder ID
    });

    console.log('Upload successful:');
    console.log(JSON.stringify(result, null, 2));

    // Clean up the sample file
    fs.unlinkSync(sampleFilePath);
    console.log('Sample file deleted');
  } catch (error) {
    if (error instanceof StackOneAPIError) {
      console.error(`API Error (${error.statusCode}):`, error.responseBody);
    } else {
      console.error('Error:', error instanceof Error ? error.message : String(error));
    }

    // Clean up the sample file if it exists
    const sampleFilePath = path.join(__dirname, 'sample.txt');
    if (fs.existsSync(sampleFilePath)) {
      fs.unlinkSync(sampleFilePath);
      console.log('Sample file deleted');
    }
  }
};

// Run the example
fileUploads().catch(console.error);
