// netlify/functions/status.js
import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    // In v2, URL parameters are accessed via the URL object.
    const url = new URL(request.url);
    const jobId = url.searchParams.get('id');
    
    if (!jobId) {
        return Response.json({ error: 'Job ID is required.' }, { status: 400 });
    }

    const store = getStore('audio_uploads');
    
    try {
        const metadata = await store.getJSON(`${jobId}-metadata`);
        if (!metadata) {
            return Response.json({ error: 'Job not found.' }, { status: 404 });
        }
        
        // Return the job status using Response.json().
        return Response.json({
            status: metadata.status,
            error: metadata.error,
            albumTitle: metadata.albumTitle,
            filename: `${metadata.albumTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.zip`
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
};


