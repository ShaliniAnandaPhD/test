// netlify/functions/generate-upload-url.js
import { getStore } from '@netlify/blobs';
import { v4 as uuidv4 } from 'uuid';

export default async (event, context) => {
    // The httpMethod is available on the event object.
    if (event.httpMethod !== 'GET') {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: 'Method Not Allowed' }) 
        };
    }

    try {
        // Generate a unique ID for the job.
        const jobId = uuidv4();
        // Get a reference to the 'audio_uploads' blob store.
        const store = getStore('audio_uploads');
        // Create a signed URL that allows a client to upload a file directly.
        // The URL is valid for 900 seconds (15 minutes).
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

