// netlify/functions/status.js
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
    const jobId = event.queryStringParameters.id;
    const store = getStore('audio_uploads');
    
    try {
        const metadata = await store.getJSON(`${jobId}-metadata`);
        if (!metadata) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Job not found.' }) };
        }
        return {
            statusCode: 200,
            body: JSON.stringify({
                status: metadata.status,
                error: metadata.error,
                albumTitle: metadata.albumTitle,
                filename: `${metadata.albumTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`
            }),
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
