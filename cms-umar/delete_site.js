const { Client } = require('pg');
const { Octokit } = require('@octokit/rest');
const { DateTime } = require('luxon');

require('dotenv').config();

const db = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  ssl: true // Assuming SSL is enabled
});

const githubToken = process.env.GITHUB_TOKEN;
const githubOwner = process.env.GITHUB_OWNER;

async function init() {
  try {
    await db.connect();
    console.log('Connected to the database');
  } catch (error) {
    console.error('Error connecting to the database:', error);
    process.exit(1);
  }
}

async function HandleDeleteRequest(event) {
  console.log('Entering HandleDeleteRequest function');

  const { node_id: nodeIDStr, site_id: siteIDStr } = event.pathParameters;

  if (!nodeIDStr || !siteIDStr) {
    console.log('Missing node_id or site_id in path parameters');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'node_id and site_id are required' })
    };
  }

  const nodeID = parseInt(nodeIDStr);
  const siteID = parseInt(siteIDStr);

  let repoName;
  try {
    repoName = await getRepoNameByNodeID(nodeID);
  } catch (error) {
    console.error(`Error fetching repo name for node_id ${nodeID}:`, error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Error fetching repo name for node_id ${nodeID}` })
    };
  }

  console.log(`Received request with node_id: ${nodeID}, repoName: ${repoName}, and siteID: ${siteID}`);

  let site;
  try {
    site = await getSiteByID(siteID);
  } catch (error) {
    console.error('Error fetching site information from the database:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error fetching site information from the database' })
    };
  }

  if (site.node_id !== nodeID) {
    console.log('Mismatched node_id values');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Mismatched node_id values' })
    };
  }

  let commitDetails;
  try {
    commitDetails = await getRecentCommitDetails(repoName, site.site_name);
  } catch (error) {
    console.error('Error fetching recent commit details:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error fetching recent commit details' })
    };
  }

  try {
    await deleteGitHubSiteFolder(repoName, site.site_name);
  } catch (error) {
    console.error('Error deleting GitHub site folder:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error deleting GitHub site folder' })
    };
  }

  try {
    await deleteSiteFromDatabase(siteID);
  } catch (error) {
    console.error('Error deleting site record from the database:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error deleting site record from the database' })
    };
  }

  return {
    statusCode: 204,
    body: ''
  };
}

async function getRepoNameByNodeID(nodeID) {
  const query = 'SELECT node_name FROM nodes WHERE node_id = $1';
  const result = await db.query(query, [nodeID]);
  return result.rows[0].node_name;
}

async function getSiteByID(siteID) {
  const query = 'SELECT * FROM sites WHERE site_id = $1';
  const result = await db.query(query, [siteID]);
  return result.rows[0];
}

async function deleteGitHubSiteFolder(repoName, siteName) {
  console.log('Entering deleteGitHubSiteFolder function');

  const octokit = new Octokit({ auth: githubToken });

  try {
    await octokit.repos.deleteFile({
      owner: githubOwner,
      repo: repoName,
      path: `${siteName}/.gitkeep`,
      message: 'Delete site folder'
    });
    console.log('GitHub site folder deleted successfully');
  } catch (error) {
    if (error.status === 404) {
      console.log('GitHub site folder not found, assuming already deleted');
      return;
    }
    throw error;
  }
}

async function deleteSiteFromDatabase(siteID) {
  const query = 'DELETE FROM sites WHERE site_id = $1';
  await db.query(query, [siteID]);
}

async function getRecentCommitDetails(repoName, siteName) {
  const octokit = new Octokit({ auth: githubToken });

  const commitList = await octokit.repos.listCommits({
    owner: githubOwner,
    repo: repoName,
    path: siteName
  });

  if (commitList.data.length === 0) {
    console.log('No commits found for the site:', siteName);
    throw new Error('No commits found for the site');
  }

  const latestCommit = commitList.data[0];
  const commitMessage = latestCommit.commit.message;
  const authorName = latestCommit.commit.author.name;
  const commitTime = DateTime.fromISO(latestCommit.commit.author.date).toJSDate();
  const recentCommitterNamePtr = latestCommit.commit.author.name;

  return {
    siteName: siteName,
    commitMessage: commitMessage,
    authorName: authorName,
    commitTime: commitTime,
    recentCommitterName: recentCommitterNamePtr
  };
}

exports.HandleDeleteRequest = HandleDeleteRequest;
