// netlify/functions/upload-audio.js
const { getStore } = require('@netlify/blobs');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
    if (event.httpMethod !== 'PUT') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        const jobId = uuidv4();
        const store = getStore('audio_uploads');
        // The event body is the raw file data, stream it directly to the blob store
        await store.set(jobId, event.body);

        return {
            statusCode: 200,
            body: JSON.stringify({ jobId }),
        };
    } catch (error) {
        console.error('Upload Audio Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
