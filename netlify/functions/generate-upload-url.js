// netlify/functions/generate-upload-url.js
const { getStore } = require('@netlify/blobs');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    try {
        const jobId = uuidv4();
        const store = getStore('audio_uploads');
        const { url } = await store.getSignedURL(jobId, { expiresIn: 900 });

        return {
            statusCode: 200,
            body: JSON.stringify({ uploadUrl: url, jobId: jobId }),
        };
    } catch (error) {
        console.error('URL Generation Error:', error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ 
                error: 'Failed to generate a secure upload link.',
                details: error.message 
            }) 
        };
    }
};

