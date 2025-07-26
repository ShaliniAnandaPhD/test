// netlify/functions/download.js
import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('id');

    if (!jobId) {
        return new Response('Job ID is required.', { status: 400 });
    }

    const store = getStore('audio_uploads');

    try {
        // Retrieve the zip file as a Buffer.
        const zipData = await store.get(`${jobId}-result`, { type: 'buffer' });
        if (!zipData) {
            return new Response('Result not found.', { status: 404 });
        }
        
        // Return the zip file with the correct headers.
        return new Response(zipData, {
            status: 200,
            headers: { 
                'Content-Type': 'application/zip',
                'Content-Length': zipData.length.toString()
            },
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
};
