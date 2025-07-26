// netlify/functions/generate-upload-url.js
import { getStore } from '@netlify/blobs';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (event) => {
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

