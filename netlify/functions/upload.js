// netlify/functions/upload.js
const { getStore } = require('@netlify/blobs');
const Busboy = require('busboy');
const { v4: uuidv4 } = require('uuid');

function parseMultipartForm(event) {
    return new Promise((resolve) => {
        const busboy = Busboy({ headers: { 'content-type': event.headers['content-type'] } });
        const fields = {};
        let uploadData = null;

        busboy.on('file', (fieldname, file, { filename }) => {
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                uploadData = {
                    content: Buffer.concat(chunks),
                    filename: filename,
                };
            });
        });

        busboy.on('field', (fieldname, val) => (fields[fieldname] = val));
        busboy.on('finish', () => resolve({ fields, uploadData }));
        busboy.end(Buffer.from(event.body, 'base64'));
    });
}

exports.handler = async (event) => {
    try {
        const { fields, uploadData } = await parseMultipartForm(event);
        const jobId = uuidv4();
        const store = getStore('audio_uploads');

        // Store the original audio file
        await store.set(jobId, uploadData.content);

        // Store the job metadata (form fields)
        await store.setJSON(`${jobId}-metadata`, {
            ...fields,
            originalFilename: uploadData.filename,
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
            throw new Error('Failed to invoke background function.');
        }

        return {
            statusCode: 202, // Accepted
            body: JSON.stringify({ jobId }),
        };
    } catch (error) {
        console.error('Upload Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
