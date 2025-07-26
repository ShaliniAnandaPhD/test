// netlify/functions/upload.js
import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    // We only want to handle POST requests for uploads.
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // The unique job ID will be passed in a custom header from the frontend.
    const jobId = request.headers.get('x-job-id');
    if (!jobId) {
        return Response.json({ error: 'Job ID is required in x-job-id header.' }, { status: 400 });
    }

    try {
        const store = getStore('audio_uploads');
        // Get the raw file data from the request body.
        const fileData = await request.blob();
        
        // Save the file to the blob store using the job ID as its key.
        await store.set(jobId, fileData);

        // Send back a success response.
        return Response.json({ success: true, jobId });

    } catch (error) {
        console.error('Upload Error:', error);
        return Response.json({ 
            error: 'Failed to upload file.',
            details: error.message 
        }, { status: 500 });
    }
};
