// netlify/functions/process-audio-background.js
import { getStore } from '@netlify/blobs';
import fs from 'fs';
import os from 'os';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import JSZip from 'jszip';

// Set the path for the ffmpeg binary with error handling.
try {
    if (ffmpegStatic) {
        ffmpeg.setFfmpegPath(ffmpegStatic);
        console.log('FFmpeg path set to:', ffmpegStatic);
    } else {
        console.log('FFmpeg static not available, using system ffmpeg');
    }
} catch (error) {
    console.error('Error setting FFmpeg path:', error);
}

// Defines various audio themes with corresponding ffmpeg filters.
const memoryThemes = {
    childhood: { name: 'Childhood Memory', filters: 'asetrate=44100*1.2,aresample=44100,highpass=f=300,aecho=0.8:0.88:60:0.4,chorus=0.5:0.9:50:0.4:0.25:2' },
    love: { name: 'First Love', filters: 'aphaser=type=t:speed=0.5:decay=0.4,chorus=0.6:0.9:50:0.3:0.25:1.5,equalizer=f=2000:t=h:w=2000:g=3' },
    adventure: { name: 'Adventure', filters: 'equalizer=f=100:t=h:w=200:g=5,equalizer=f=3000:t=h:w=2000:g=3,aecho=0.8:0.9:1000:0.3' },
    party: { name: 'Celebration', filters: 'equalizer=f=80:t=h:w=100:g=8,equalizer=f=4000:t=h:w=2000:g=4,stereotools=mlev=1.5' },
    nostalgic: { name: 'Nostalgic', filters: 'asetrate=44100*0.95,aresample=44100,lowpass=f=3000,aecho=0.8:0.88:40:0.5,aphaser=type=t:speed=0.3' },
    peaceful: { name: 'Peaceful', filters: 'lowpass=f=2000,volume=0.7,aecho=0.8:0.88:120:0.3,atempo=0.9' },
    dreamy: { name: 'Dreamy', filters: 'aphaser=type=t:speed=0.2:decay=0.6,aecho=0.9:0.95:200:0.4,flanger=speed=0.5:depth=3' },
    energetic: { name: 'Energetic', filters: 'equalizer=f=100:t=h:w=200:g=10,equalizer=f=5000:t=h:w=3000:g=5,atempo=1.1,stereotools=mlev=1.8' },
    default: { name: 'Magical Remix', filters: 'chorus=0.7:0.9:55:0.4:0.25:2.5,aecho=0.8:0.88:60:0.4' }
};

/**
 * This function contains the long-running audio processing logic.
 * It's run in the background and does not directly return a response to the client.
 * @param {object} metadata - The job details from the client.
 */
const processAlbumInBackground = async (metadata) => {
    const { jobId, experiences, albumTitle, recipientName } = metadata;
    console.log('Starting background processing for job:', jobId);
    
    const store = getStore('audio_uploads');
    let tempFiles = [];

    try {
        // Set initial status for the job. The client will poll this status.
        await store.setJSON(`${jobId}-metadata`, { ...metadata, status: 'pending' });
        console.log('Job status set to pending');
        
        // Download the original audio file to a temporary location for processing.
        const originalFilePath = path.join(os.tmpdir(), `original_${jobId}.mp3`);
        tempFiles.push(originalFilePath);
        
        console.log('Downloading audio file from blob store...');
        
        // Use arrayBuffer for more reliable file handling
        const audioBuffer = await store.get(jobId, { type: 'arrayBuffer' });
        if (!audioBuffer) {
            throw new Error('Audio file not found in blob store');
        }
        
        console.log('Audio file retrieved, size:', audioBuffer.byteLength);
        
        // Write the buffer to a temporary file
        fs.writeFileSync(originalFilePath, Buffer.from(audioBuffer));
        console.log('Audio file written to:', originalFilePath);

        const zip = new JSZip();
        zip.file('readme.txt', `Album: ${albumTitle}\nFor: ${recipientName}\nGenerated: ${new Date().toISOString()}`);
        
        // Read original file and add to zip
        const originalBuffer = fs.readFileSync(originalFilePath);
        zip.file('01_original.mp3', originalBuffer);
        console.log('Original file added to zip');
        
        // Process the audio for each "experience" described by the user.
        for (let i = 0; i < experiences.length; i++) {
            const experienceText = experiences[i];
            console.log(`Processing experience ${i + 1}: ${experienceText}`);
            
            let themeKey = 'default';
            // Find a theme that matches the experience description.
            for (const key in memoryThemes) {
                if (experienceText.toLowerCase().includes(key)) {
                    themeKey = key;
                    break;
                }
            }
            
            const theme = memoryThemes[themeKey];
            console.log(`Using theme: ${theme.name} (${themeKey})`);
            
            const outputFilePath = path.join(os.tmpdir(), `output_${jobId}_${i}.mp3`);
            tempFiles.push(outputFilePath);

            // Apply ffmpeg filters to create the themed audio track.
            await new Promise((resolve, reject) => {
                const command = ffmpeg(originalFilePath)
                    .audioFilter(theme.filters)
                    .audioCodec('libmp3lame')
                    .audioBitrate('192k')
                    .toFormat('mp3')
                    .on('start', (commandLine) => {
                        console.log('FFmpeg command:', commandLine);
                    })
                    .on('progress', (progress) => {
                        console.log(`Processing ${i + 1}: ${Math.round(progress.percent || 0)}%`);
                    })
                    .on('error', (err) => {
                        console.error(`FFmpeg error for experience ${i + 1}:`, err);
                        reject(err);
                    })
                    .on('end', () => {
                        console.log(`Completed processing experience ${i + 1}`);
                        resolve();
                    })
                    .save(outputFilePath);
                
                // Add timeout to prevent hanging
                setTimeout(() => {
                    command.kill('SIGKILL');
                    reject(new Error(`FFmpeg timeout for experience ${i + 1}`));
                }, 120000); // 2 minutes timeout
            });
            
            // Read processed file and add to zip
            const processedBuffer = fs.readFileSync(outputFilePath);
            zip.file(`${String(i + 2).padStart(2, '0')}_${themeKey}_remix.mp3`, processedBuffer);
            console.log(`Added processed file ${i + 1} to zip`);
        }

        console.log('Generating final zip file...');
        // Generate the final zip file and store it in the blob store.
        const zipBuffer = await zip.generateAsync({ 
            type: 'nodebuffer', 
            streamFiles: true,
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });
        
        console.log('Zip file generated, size:', zipBuffer.length);
        
        await store.set(`${jobId}-result`, zipBuffer);
        console.log('Zip file stored in blob store');
        
        // Update the job status to 'completed'.
        await store.setJSON(`${jobId}-metadata`, { ...metadata, status: 'completed' });
        console.log('Job completed successfully');
        
    } catch (error) {
        console.error('Background Processing Error:', error);
        // If an error occurs, update the status to 'failed' with the error message.
        await store.setJSON(`${jobId}-metadata`, { 
            ...metadata, 
            status: 'failed', 
            error: error.message || 'Unknown processing error'
        });
    } finally {
        // Clean up any temporary files created during processing.
        console.log('Cleaning up temporary files...');
        tempFiles.forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log('Deleted temp file:', file);
                }
            } catch (cleanupError) {
                console.error('Error deleting temp file:', file, cleanupError);
            }
        });
    }
};

/**
 * The main function handler. It uses the Fetch-style API (request, context).
 * It starts the background job and returns an immediate response to the client.
 */
export default async (request, context) => {
    console.log('Process audio background function called');
    
    try {
        // Parse the job metadata from the incoming request body.
        const metadata = await request.json();
        const { jobId } = metadata;
        
        console.log('Received processing request for job:', jobId);
        console.log('Metadata:', JSON.stringify(metadata, null, 2));

        // Validate required fields
        if (!jobId || !metadata.albumTitle || !metadata.experiences || metadata.experiences.length === 0) {
            return Response.json({ 
                error: 'Missing required fields: jobId, albumTitle, or experiences' 
            }, { status: 400 });
        }

        // Tell Netlify to wait for the processing to finish in the background,
        // even after we've sent the response to the client.
        context.waitUntil(processAlbumInBackground(metadata));

        // Immediately return a 202 Accepted response to let the client know
        // the request was received and is being processed.
        return Response.json(
            { message: 'Processing started', jobId },
            { status: 202 }
        );
        
    } catch (error) {
        console.error('Error in main handler:', error);
        return Response.json({ 
            error: 'Failed to start processing',
            details: error.message 
        }, { status: 500 });
    }
};
