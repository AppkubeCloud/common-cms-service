// const { Octokit } = require('@octokit/rest');
// const { Pool } = require('pg');
// const { v4: uuidv4 } = require('uuid');
// require('dotenv').config();

// // Load configuration from environment variables
// const config = {
//     GitHubToken: process.env.GITHUB_TOKEN,
//     GitHubOwner: process.env.GITHUB_OWNER,
//     DBUser: process.env.DB_USER,
//     DBPassword: process.env.DB_PASSWORD,
//     DBName: process.env.DB_NAME,
//     DBHost: process.env.DB_HOST
// };

// // Initialize PostgreSQL pool
// const pool = new Pool({
//     user: config.DBUser,
//     password: config.DBPassword,
//     database: config.DBName,
//     host: config.DBHost,
//     ssl: true
// });

// // Handle HTTP request
// async function HandleRequest(req, res) {
//     try {
//         const { siteName, nodeID } = req.body;

//         if (!siteName) {
//             return res.status(400).json({ error: 'Site name is required' });
//         }

//         const nodeName = await getNodeNameByID(nodeID);

//         const siteMetadata = {
//             sitename: siteName,
//             sitepath: `/${siteName}`
//         };

//         const siteID = await insertSite(nodeID, siteName, siteMetadata);

//         const filePath = `${siteName}/example.txt`;

//         const githubClient = new Octokit({
//             auth: config.GitHubToken
//         });

//         await createGitHubSiteFolder(config.GitHubOwner, nodeName, siteName, githubClient);

//         const latestCommit = await getLatestCommit(config.GitHubOwner, nodeName, githubClient);

//         const commitDetails = {
//             siteID,
//             siteName,
//             commitMessage: latestCommit.data.commit.message,
//             authorName: latestCommit.data.commit.author.name,
//             commitTime: latestCommit.data.commit.author.date,
//             recentCommitterName: latestCommit.data.commit.author.name
//         };

//         await storeCommitDetails(commitDetails);

//         res.status(201).json({ site_id: siteID, file_path: filePath });
//     } catch (error) {
//         console.error('Error handling request:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// }

// // Fetch node name by ID
// async function getNodeNameByID(nodeID) {
//     const query = 'SELECT node_name FROM nodes WHERE node_id = $1';
//     const result = await pool.query(query, [nodeID]);
//     return result.rows[0].node_name;
// }

// // Insert site into database
// async function insertSite(nodeID, siteName, siteMetadata) {
//     const query = 'INSERT INTO sites (node_id, site_name, site_metadata) VALUES ($1, $2, $3) RETURNING site_id';
//     const values = [nodeID, siteName, JSON.stringify(siteMetadata)];
//     const result = await pool.query(query, values);
//     return result.rows[0].site_id;
// }

// // Create GitHub site folder
// async function createGitHubSiteFolder(owner, repoName, siteName, githubClient) {
//     const content = Buffer.from('this is site folderss').toString('base64');
//     await githubClient.repos.createOrUpdateFileContents({
//         owner,
//         repo: repoName,
//         path: `${siteName}/.gitkeep`,
//         message: 'Create site folder',
//         content
//     });
// }

// // Get latest commit from GitHub repository
// async function getLatestCommit(owner, repoName, githubClient) {
//     const { data } = await githubClient.repos.listCommits({
//         owner,
//         repo: repoName
//     });
//     return data[0];
// }

// // Store commit details in database
// async function storeCommitDetails(commitDetails) {
//     const query = 'INSERT INTO logs_site (site_id, details) VALUES ($1, $2)';
//     const values = [commitDetails.siteID, JSON.stringify(commitDetails)];
//     await pool.query(query, values);
// }

// module.exports = { HandleRequest };







// Import node-fetch module using CommonJS syntax
import fetch from 'node-fetch';
import pkg from 'pg';
const { Pool } = pkg;
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { Octokit } from '@octokit/rest';


// Load configuration from environment variables
dotenv.config();

const config = {
    GitHubToken: process.env.GITHUB_TOKEN,
    GitHubOwner: process.env.GITHUB_OWNER,
    DBUser: process.env.DB_USER,
    DBPassword: process.env.DB_PASSWORD,
    DBName: process.env.DB_NAME,
    DBHost: process.env.DB_HOST
};

// Initialize PostgreSQL pool
const pool = new Pool({
    user: config.DBUser,
    password: config.DBPassword,
    database: config.DBName,
    host: config.DBHost,
    ssl: false
});

// Initialize Octokit with fetch implementation
const githubClient = new Octokit({
    auth: config.GitHubToken,
    request: {
        fetch
    }
});

// Handle HTTP request
async function lambdaHandler(event, context) {
    console.log('Received event:', JSON.stringify(event));
    try {
        // Log the event body
        console.log('Event Body:', event.body);
        const body = JSON.parse(event.body);
        const { siteName, nodeID } = body;

        if (!siteName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Site name is required' })
            };
        }

        const nodeName = await getNodeNameByID(nodeID);

        const siteMetadata = {
            sitename: siteName,
            sitepath: `/${siteName}`
        };

        const siteID = await insertSite(nodeID, siteName, siteMetadata);

        const filePath = `${siteName}/example.txt`;

        await createGitHubSiteFolder(config.GitHubOwner, nodeName, siteName, githubClient);

        const latestCommit = await getLatestCommit(config.GitHubOwner, nodeName, githubClient);

        const commitDetails = {
            siteID,
            siteName,
            commitMessage: latestCommit.data.commit.message,
            authorName: latestCommit.data.commit.author.name,
            commitTime: latestCommit.data.commit.author.date,
            recentCommitterName: latestCommit.data.commit.author.name
        };

        await storeCommitDetails(commitDetails);

        return {
            statusCode: 201,
            body: JSON.stringify({ site_id: siteID, file_path: filePath })
        };
    } catch (error) {
        console.error('Error handling request:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
}

// Fetch node name by ID
async function getNodeNameByID(nodeID) {
    const query = 'SELECT node_name FROM nodes WHERE node_id = $1';
    const result = await pool.query(query, [nodeID]);
    return result.rows[0].node_name;
}

// Insert site into database
async function insertSite(nodeID, siteName, siteMetadata) {
    const siteID = uuidv4(); // Generate a UUID for site_id
    const query = 'INSERT INTO sites (site_id, node_id, site_name, site_metadata) VALUES ($1, $2, $3, $4) RETURNING site_id';
    const values = [siteID, nodeID, siteName, JSON.stringify(siteMetadata)];
    const result = await pool.query(query, values);
    return result.rows[0].site_id;
}

// Create GitHub site folder
async function createGitHubSiteFolder(owner, repoName, siteName, githubClient) {
    const content = Buffer.from('this is site folderss').toString('base64');
    const path = `${siteName}/.gitkeep`;
    
    // Get the SHA hash of the existing file (if it exists)
    const { data: existingFile } = await githubClient.repos.getContent({
        owner,
        repo: 'cms-servie',
        path
    });
    
    // Include the SHA hash in the request body
    const requestBody = {
        owner,
        repo: 'cms-service',
        path,
        message: 'Create site folder',
        content,
        sha: existingFile ? existingFile.sha : null // Provide the SHA hash if the file exists
    };

    await githubClient.repos.createOrUpdateFileContents(requestBody);
}


// Get latest commit from GitHub repository
async function getLatestCommit(owner, repoName, githubClient) {
    const { data } = await githubClient.repos.listCommits({
        owner,
        repo: 'cms-service'
    });
    return data[0];
}

// Store commit details in database
async function storeCommitDetails(commitDetails) {
    const query = 'INSERT INTO logs_site (site_id, details) VALUES ($1, $2)';
    const values = [commitDetails.siteID, JSON.stringify(commitDetails)];
    await pool.query(query, values);
}

export { lambdaHandler };

