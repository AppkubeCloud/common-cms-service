const { Client } = require('pg');
const { Octokit } = require('@octokit/rest');
const { v4: uuidv4 } = require('uuid');

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

async function HandleUpdateRequest(event) {
  console.log('Entering HandleUpdateRequest function');

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

  const requestBody = JSON.parse(event.body);

  if (!requestBody.site_name) {
    console.log('New site name not provided');
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'New site name not provided' })
    };
  }

  try {
    await updateGitHubSiteFolder(repoName, site.site_name, requestBody.site_name);
    await updateSiteInDatabase(siteID, requestBody.site_name, repoName, requestBody.site_name);
    const commitDetails = await getRecentCommitDetails(repoName, requestBody.site_name);
    await storeCommitDetailsInLogsSite(siteID, commitDetails);

    console.log('Exiting HandleUpdateRequest function');
    return {
      statusCode: 200,
      body: JSON.stringify({ site_id: siteID, site_name: requestBody.site_name })
    };
  } catch (error) {
    console.error('Error handling update request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
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

async function updateGitHubSiteFolder(repoName, oldSiteName, newSiteName) {
  console.log(`Updating GitHub site folder in repo ${repoName} from ${oldSiteName} to ${newSiteName}`);

  const octokit = new Octokit({ auth: githubToken });

  try {
    await octokit.repos.createOrUpdateFileContents({
      owner: githubOwner,
      repo: repoName,
      path: `${oldSiteName}/.gitkeep`,
      message: `Update site folder from ${oldSiteName} to ${newSiteName}`,
      content: Buffer.from('placeholder content').toString('base64')
    });

    await octokit.repos.deleteFile({
      owner: githubOwner,
      repo: repoName,
      path: `${oldSiteName}/.gitkeep`,
      message: `Update site folder from ${oldSiteName} to ${newSiteName}`,
    });

    console.log('GitHub site folder updated successfully');
  } catch (error) {
    console.error('Error updating GitHub site folder:', error);
    throw error;
  }
}

async function updateSiteInDatabase(siteID, newSiteName, repoName, siteName) {
  const query = 'UPDATE sites SET site_name = $1, site_metadata = $2 WHERE site_id = $3';
  const updatedMetadata = { site_name: newSiteName, site_path: `/${newSiteName}` };
  const values = [newSiteName, JSON.stringify(updatedMetadata), siteID];
  await db.query(query, values);
}

async function getRecentCommitDetails(repoName, siteName) {
  const octokit = new Octokit({ auth: githubToken });

  try {
    const commitList = await octokit.repos.listCommits({
      owner: githubOwner,
      repo: repoName,
      path: siteName
    });

    if (commitList.data.length === 0) {
      throw new Error('No commits found for the site');
    }

    const latestCommit = commitList.data[0];
    const commitMessage = latestCommit.commit.message;
    const authorName = latestCommit.commit.author.name;
    const commitTime = latestCommit.commit.author.date;
    const recentCommitterName = latestCommit.commit.author.name;

    return {
      site_name: siteName,
      commit_message: commitMessage,
      author_name: authorName,
      commit_time: commitTime,
      recent_committer_name: recentCommitterName
    };
  } catch (error) {
    console.error('Error getting recent commit details:', error);
    throw error;
  }
}

async function storeCommitDetailsInLogsSite(siteID, commitDetails) {
  const query = 'INSERT INTO logs_site (site_id, details) VALUES ($1, $2)';
  const values = [siteID, JSON.stringify(commitDetails)];
  await db.query(query, values);
}

exports.HandleUpdateRequest = HandleUpdateRequest;
