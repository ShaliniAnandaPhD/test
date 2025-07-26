// netlify/functions/upload.js
import { getStore } from '@netlify/blobs';

export default async (request, context) => {
    console.log('Upload function called with method:', request.method);
    
    // We only want to handle POST requests for uploads.
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // The unique job ID will be passed in a custom header from the frontend.
    const jobId = request.headers.get('x-job-id');
    console.log('Job ID received:', jobId);
    
    if (!jobId) {
        return Response.json({ error: 'Job ID is required in x-job-id header.' }, { status: 400 });
    }

    try {
        const store = getStore('audio_uploads');
        console.log('Store initialized');
        
        // Get the raw file data from the request body.
        const fileData = await request.blob();
        console.log('File data received, size:', fileData.size);
        
        if (fileData.size === 0) {
            return Response.json({ error: 'No file data received.' }, { status: 400 });
        }
        
        // Save the file to the blob store using the job ID as its key.
        await store.set(jobId, fileData);
        console.log('File saved to blob store with key:', jobId);

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
