// netlify/functions/status.js
import { getStore } from '@netlify/blobs';

export default async (event, context) => {
    // Get the job ID from the query string parameters.
    const jobId = event.queryStringParameters.id;
    const store = getStore('audio_uploads');
    
    try {
        // Retrieve the metadata for the job.
        const metadata = await store.getJSON(`${jobId}-metadata`);
        if (!metadata) {
            return { statusCode: 404, body: JSON.stringify({ error: 'Job not found.' }) };
        }
        // Return the current status and other details of the job.
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

