// netlify/functions/generate-upload-url.js

// Reverting to CommonJS 'require' syntax for consistency across all functions.
const { getStore } = require('@netlify/blobs');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
    // This function only accepts GET requests.
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405, // Method Not Allowed
            body: JSON.stringify({ error: 'This function only accepts GET requests.' })
        };
    }

    try {
        // Generate a unique ID for the job.
        const jobId = uuidv4();

        // Connect to the 'audio_uploads' blob store.
        const store = getStore('audio_uploads');
        
        // Generate a secure, temporary URL for the client to upload the file.
        // It's valid for 15 minutes (900 seconds).
        const { url } = await store.getSignedURL(jobId, { expiresIn: 900 });

        // Return the secure URL and the job ID to the browser.
        return {
            statusCode: 200,
            body: JSON.stringify({
                uploadUrl: url,
                jobId: jobId
            }),
        };
    } catch (error) {
        // Log the full error to the function logs for debugging.
        console.error('URL Generation Error:', error);
        
        // Return a detailed error message to the browser.
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: 'Failed to generate a secure upload link.',
                details: error.message 
            }) 
        };
    }
};
