const { Client } = require('pg');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.DATABASE_URL;

const db = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function getSiteByIDWithinNode(nodeID, siteID) {
  console.log(`Entering getSiteByIDWithinNode function for node_id: ${nodeID}, site_id: ${siteID}`);

  try {
    const query = 'SELECT site_id, node_id, site_name, site_metadata FROM sites WHERE node_id = $1 AND site_id = $2';
    const { rows } = await db.query(query, [nodeID, siteID]);

    if (rows.length === 0) {
      console.log('Site not found');
      throw new Error('Site not found');
    }

    const site = {
      SiteID: rows[0].site_id,
      NodeID: rows[0].node_id,
      SiteName: rows[0].site_name,
      SiteMetadata: rows[0].site_metadata
    };

    console.log('Exiting getSiteByIDWithinNode function with site details:', site);
    return site;
  } catch (error) {
    console.error('Error retrieving site:', error);
    throw error;
  }
}

async function HandleRequest(event) {
  console.log('Entering HandleRequest function');

  const { site_id: siteID, node_id: nodeID } = event.pathParameters;

  // Check if node_id is missing
  if (!nodeID) {
    console.log('Node ID is missing in the query parameters');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'node_id is required' }),
    };
  }

  try {
    let responseBody = '';

    // If site_id is provided, fetch details of a particular site within the specified node_id
    if (siteID) {
      const site = await getSiteByIDWithinNode(nodeID, siteID);
      responseBody = JSON.stringify(site);
    }

    const response = {
      statusCode: 200,
      body: responseBody,
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
