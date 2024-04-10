const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { Octokit } = require('@octokit/rest');

// Database configuration
const client = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  ssl: true,
});
client.connect();

// GitHub configuration
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function getAllSitesByNodeID(nodeID) {
  try {
    const res = await client.query('SELECT * FROM sites WHERE node_id = $1', [nodeID]);
    return res.rows;
  } catch (error) {
    console.error('Error retrieving sites:', error);
    throw error;
  }
}

async function HandleRequest(event) {
  console.log('Entering HandleRequest function');

  // Extract query parameters
  const { node_id: nodeID } = event.pathParameters;

  // Check if node_id is missing
  if (!nodeID) {
    console.log('Node ID is missing in the query parameters');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'node_id is required' }),
    };
  }

  try {
    // Call the function to get all sites by node_id
    const sites = await getAllSitesByNodeID(nodeID);

    // Prepare the API Gateway response
    const response = {
      statusCode: 200,
      body: JSON.stringify(sites),
      headers: {
        'Content-Type': 'application/json',
      },
    };

    console.log('Exiting HandleRequest function with response:', response);
    return response;
  } catch (error) {
    console.error('Error handling request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
}

module.exports = { HandleRequest };
