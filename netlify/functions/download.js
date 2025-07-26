// netlify/functions/download.js
import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    console.log('Download function called');
    
    const url = new URL(request.url);
    const jobId = url.searchParams.get('id');

    console.log('Download requested for job ID:', jobId);

    if (!jobId) {
        return new Response('Job ID is required.', { status: 400 });
    }

    const store = getStore('audio_uploads');

    try {
        // Retrieve the zip file as a Buffer.
        const zipData = await store.get(`${jobId}-result`, { type: 'arrayBuffer' });
        console.log('Retrieved zip data, size:', zipData ? zipData.byteLength : 'null');
        
        if (!zipData) {
            console.log('No result file found for job:', jobId);
            return new Response('Result not found.', { status: 404 });
        }
        
        // Convert ArrayBuffer to Buffer for response
        const buffer = Buffer.from(zipData);
        
        // Return the zip file with the correct headers.
        return new Response(buffer, {
            status: 200,
            headers: { 
                'Content-Type': 'application/zip',
                'Content-Length': buffer.length.toString(),
                'Content-Disposition': 'attachment; filename="memory-album.zip"'
            },
        });

    } catch (error) {
        console.error('Download error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
};
