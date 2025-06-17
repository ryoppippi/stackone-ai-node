#!/usr/bin/env bun
/**
 * Example demonstrating how to list CRM contacts using StackOne.
 *
 * This example shows:
 * 1. Getting CRM list contacts tool from the toolset
 * 2. Executing the tool to fetch contact data
 * 3. Working with pagination and filtering
 * 4. Validating the response structure
 *
 * Usage:
 *
 * ```bash
 * bun run examples/crm-list-contacts.ts
 * ```
 */

import assert from 'node:assert';
import { StackOneToolSet } from '../src';

const crmListContacts = async (): Promise<void> => {
  const accountId = '46131618745714727365';
  const toolset = new StackOneToolSet();

  // Get CRM list contacts tool
  const tools = toolset.getStackOneTools('crm_list_contacts', accountId);
  const listContactsTool = tools.getStackOneTool('crm_list_contacts');

  assert(listContactsTool !== undefined, 'Expected to find crm_list_contacts tool');
  assert(listContactsTool.getAccountId() === accountId, 'Account ID should match what was set');

  // Execute the tool to get contacts
  console.log('Fetching CRM contacts...');
  const contacts = await listContactsTool.execute();

  // Validate the response structure
  assert(typeof contacts === 'object', 'Expected contacts to be an object');
  assert(Array.isArray(contacts.data), 'Expected contacts.data to be an array');

  console.log(`Found ${contacts.data.length} contacts`);

  // If we have contacts, validate the structure of the first one
  if (contacts.data.length > 0) {
    const firstContact = contacts.data[0];
    console.log('First contact structure:');
    console.log(`- ID: ${firstContact.id}`);
    console.log(`- First Name: ${firstContact.first_name}`);
    console.log(`- Last Name: ${firstContact.last_name}`);
    console.log(`- Company: ${firstContact.company_name}`);
    console.log(`- Emails: ${firstContact.emails?.join(', ')}`);
    console.log(`- Phone Numbers: ${firstContact.phone_numbers?.join(', ')}`);

    // Validate basic contact structure
    assert(typeof firstContact.id === 'string', 'Expected contact id to be a string');
    assert(
      firstContact.first_name === null ||
        firstContact.first_name === undefined ||
        typeof firstContact.first_name === 'string',
      'Expected first_name to be string, null, or undefined'
    );
    assert(
      firstContact.last_name === null ||
        firstContact.last_name === undefined ||
        typeof firstContact.last_name === 'string',
      'Expected last_name to be string, null, or undefined'
    );
  }

  // Example of using tool with specific fields
  const toolsWithFields = toolset.getStackOneTools('crm_list_contacts', accountId);
  const fieldsContactsTool = toolsWithFields.getStackOneTool('crm_list_contacts');

  if (fieldsContactsTool) {
    console.log('\nFetching contacts with specific fields...');
    const specificFieldsContacts = await fieldsContactsTool.execute({
      fields: 'id,first_name,last_name,emails',
    });

    assert(Array.isArray(specificFieldsContacts.data), 'Expected filtered contacts to be an array');
    console.log(`Fetched ${specificFieldsContacts.data.length} contacts with specific fields`);
  }

  console.log('\nCRM list contacts example completed successfully!');
};

crmListContacts();
