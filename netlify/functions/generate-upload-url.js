// netlify/functions/generate-upload-url.js
const { getStore } = require('@netlify/blobs');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        const jobId = uuidv4();
        const store = getStore('audio_uploads');
        
        // Generate a signed URL that allows the client to upload directly.
        // The URL is valid for 15 minutes.
        const { url } = await store.getSignedURL(jobId, { expiresIn: 900 });

        return {
            statusCode: 200,
            body: JSON.stringify({
                uploadUrl: url,
                jobId: jobId
            }),
        };
    } catch (error) {
        console.error('URL Generation Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
