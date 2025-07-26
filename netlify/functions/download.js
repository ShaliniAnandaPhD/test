// netlify/functions/download.js
import { getStore } from '@netlify/blobs';

export default async (event, context) => {
    // Get the job ID from the query string parameters.
    const jobId = event.queryStringParameters.id;
    const store = getStore('audio_uploads');

    try {
        // Retrieve the generated zip file from the blob store.
        const zipData = await store.get(`${jobId}-result`, { type: 'buffer' });
        if (!zipData) {
            return { statusCode: 404, body: 'Result not found.' };
        }
        // Return the zip file to the client.
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
