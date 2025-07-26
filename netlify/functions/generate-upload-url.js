// netlify/functions/generate-upload-url.js
const { getStore } = require('@netlify/blobs');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
    // --- Defensive Check 1: Ensure we are handling a GET request ---
    // This is the first line of defense. If the request is not GET,
    // we stop immediately.
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405, // Method Not Allowed
            body: JSON.stringify({ error: 'This function only accepts GET requests.' })
        };
    }

    try {
        // --- Step 1: Generate a unique ID for the job ---
        // This ID will be used as the filename in blob storage and to track the job status.
        const jobId = uuidv4();

        // --- Step 2: Connect to the correct blob store ---
        // 'audio_uploads' must match the store name defined in your netlify.toml file.
        const store = getStore('audio_uploads');
        
        // --- Step 3: Generate a secure, temporary URL for the upload ---
        // This "signed URL" gives the browser permission to upload a file directly
        // to blob storage without needing server credentials.
        // We set it to expire in 900 seconds (15 minutes).
        const { url: uploadUrl } = await store.getSignedURL(jobId, { expiresIn: 900 });

        // --- Success Case: Return the URL and Job ID to the browser ---
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uploadUrl: uploadUrl,
                jobId: jobId
            }),
        };

    } catch (error) {
        // --- Error Handling: Catch any errors during the process ---

        // Log the *entire* error object to the Netlify function logs.
        // This is more detailed than just error.message and can help debug
        // complex environment-specific issues.
        console.error('FATAL URL Generation Error:', error);

        // Return a detailed error message to the browser.
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to generate a secure upload link.',
                details: error.message // Provide the specific error message for context.
            }),
        };
    }
};

