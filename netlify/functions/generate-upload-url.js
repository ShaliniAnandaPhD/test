// netlify/functions/generate-upload-url.js
import { getStore } from '@netlify/blobs';
import { v4 as uuidv4 } from 'uuid';

export default async (request, context) => {
    // In v2 functions, the method is on the `request` object.
    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const jobId = uuidv4();
        const store = getStore('audio_uploads');
        // Create a signed URL valid for 15 minutes.
        const { url } = await store.getSignedURL(jobId, { expiresIn: 900 });

        // Use Response.json() for a cleaner v2 response.
        return Response.json({ uploadUrl: url, jobId: jobId });

    } catch (error) {
        console.error('URL Generation Error:', error);
        return Response.json({ 
            error: 'Failed to generate a secure upload link.',
            details: error.message 
        }, { status: 500 });
    }
};

