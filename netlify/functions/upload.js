// netlify/functions/upload.js
const { getStore } = require('@netlify/blobs');
const Busboy = require('busboy');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
    const jobId = uuidv4();
    const store = getStore('audio_uploads');
    const fields = {};

    try {
        await new Promise((resolve, reject) => {
            const busboy = Busboy({ headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] } });

            busboy.on('file', async (fieldname, file, { filename }) => {
                try {
                    // FIX: Stream the upload directly to Netlify Blobs to handle large files
                    await store.set(jobId, file);
                    fields.originalFilename = filename; // Store filename for metadata
                } catch (err) {
                    console.error('Blob store streaming error:', err);
                    reject(err);
                }
            });

            busboy.on('field', (fieldname, val) => {
                fields[fieldname] = val;
            });

            busboy.on('finish', resolve);
            busboy.on('error', reject);
            busboy.end(Buffer.from(event.body, 'base64'));
        });

        if (!fields.originalFilename) {
            throw new Error("No file was uploaded.");
        }

        // Store the job metadata (form fields)
        await store.setJSON(`${jobId}-metadata`, {
            ...fields,
            status: 'pending',
            submittedAt: new Date().toISOString(),
        });

        // Invoke the background function asynchronously
        const response = await fetch(
          `${process.env.URL}/.netlify/functions/process-audio-background`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ jobId }),
          }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to invoke background function: ${errorText}`);
        }

        return {
            statusCode: 202, // Accepted
            body: JSON.stringify({ jobId }),
        };
    } catch (error) {
        console.error('Upload Error:', error);
        // If we have a jobId, try to clean up
        if (jobId) {
            try {
                await store.delete(jobId);
                await store.delete(`${jobId}-metadata`);
            } catch (cleanupError) {
                console.error('Cleanup error:', cleanupError);
            }
        }
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
