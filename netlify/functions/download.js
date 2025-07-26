// netlify/functions/download.js
const { getStore: getStoreDownload } = require('@netlify/blobs');

exports.handler = async (event) => {
    const jobId = event.queryStringParameters.id;
    const store = getStoreDownload('audio_uploads');

    try {
        const zipData = await store.get(`${jobId}-result`, { type: 'buffer' });
        if (!zipData) {
            return { statusCode: 404, body: 'Result not found.' };
        }
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/zip' },
            body: zipData.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
