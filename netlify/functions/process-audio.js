const Busboy = require('busboy');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const JSZip = require('jszip');

// Tell fluent-ffmpeg where to find the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegStatic);

// Helper to parse multipart form data
function parseMultipartForm(event) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({
            headers: { 'content-type': event.headers['content-type'] || event.headers['Content-Type'] }
        });
        const fields = {};
        const uploads = {};

        busboy.on('file', (fieldname, file, { filename, encoding, mimeType }) => {
            const saveTo = path.join(os.tmpdir(), `upload_${Date.now()}_${filename}`);
            console.log(`Saving uploaded file to: ${saveTo}`);
            const writeStream = fs.createWriteStream(saveTo);
            file.pipe(writeStream);

            writeStream.on('finish', () => {
                uploads[fieldname] = { filepath: saveTo, filename: filename };
            });
             writeStream.on('error', reject);
        });

        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });

        busboy.on('finish', () => {
            resolve({ fields, uploads });
        });
        
        busboy.on('error', reject);

        busboy.end(Buffer.from(event.body, 'base64'));
    });
}

// Pre-defined themes with FFmpeg audio filters
const memoryThemes = {
    childhood: { icon: '🧸', name: 'Childhood Memory', filters: 'asetrate=44100*1.2,aresample=44100,highpass=f=300,aecho=0.8:0.88:60:0.4,chorus=0.5:0.9:50:0.4:0.25:2' },
    love: { icon: '💌', name: 'First Love', filters: 'aphaser=type=t:speed=0.5:decay=0.4,chorus=0.6:0.9:50:0.3:0.25:1.5,equalizer=f=2000:t=h:w=2000:g=3' },
    adventure: { icon: '🚀', name: 'Adventure', filters: 'equalizer=f=100:t=h:w=200:g=5,equalizer=f=3000:t=h:w=2000:g=3,aecho=0.8:0.9:1000:0.3' },
    party: { icon: '🎉', name: 'Celebration', filters: 'equalizer=f=80:t=h:w=100:g=8,equalizer=f=4000:t=h:w=2000:g=4,stereotools=mlev=1.5' },
    nostalgic: { icon: '📸', name: 'Nostalgic', filters: 'asetrate=44100*0.95,aresample=44100,lowpass=f=3000,aecho=0.8:0.88:40:0.5,aphaser=type=t:speed=0.3' },
    peaceful: { icon: '🌅', name: 'Peaceful', filters: 'lowpass=f=2000,volume=0.7,aecho=0.8:0.88:120:0.3,atempo=0.9' },
    dreamy: { icon: '🌙', name: 'Dreamy', filters: 'aphaser=type=t:speed=0.2:decay=0.6,aecho=0.9:0.95:200:0.4,flanger=speed=0.5:depth=3' },
    energetic: { icon: '⚡', name: 'Energetic', filters: 'equalizer=f=100:t=h:w=200:g=10,equalizer=f=5000:t=h:w=3000:g=5,atempo=1.1,stereotools=mlev=1.8' },
    default: { icon: '✨', name: 'Magical Remix', filters: 'chorus=0.7:0.9:55:0.4:0.25:2.5,aecho=0.8:0.88:60:0.4' }
};

// Main serverless function handler
exports.handler = async (event) => {
    console.log('Netlify function invoked.');
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let uploadedFilePath = null;

    try {
        console.log('Parsing multipart form data...');
        const { fields, uploads } = await parseMultipartForm(event);
        console.log('Form data parsed successfully.');

        const { albumTitle, recipientName } = fields;
        const experiences = JSON.parse(fields.experiences);
        const uploadedFile = uploads.audio;

        if (!uploadedFile || !uploadedFile.filepath) {
            throw new Error('No audio file uploaded or file failed to save.');
        }
        uploadedFilePath = uploadedFile.filepath; // Keep track for cleanup
        console.log(`Uploaded file path: ${uploadedFilePath}`);

        const zip = new JSZip();
        console.log('Creating readme and adding original file to zip via stream...');
        zip.file('readme.txt', `Album: ${albumTitle}\nFor: ${recipientName}\n\nCreated with Memory Album Creator.`);
        zip.file('01_original.mp3', fs.createReadStream(uploadedFilePath));
        console.log('Original file stream added.');

        // FIX: Process each track sequentially and stream the output directly to the zip file
        for (let i = 0; i < experiences.length; i++) {
            const experienceText = experiences[i];
            console.log(`Starting processing for experience ${i + 1}: "${experienceText}"`);
            
            let selectedThemeKey = 'default';
            for (const key in memoryThemes) {
                if (experienceText.toLowerCase().includes(key)) {
                    selectedThemeKey = key;
                    break;
                }
            }
            const themeData = memoryThemes[selectedThemeKey];
            const trackFilename = `${String(i + 2).padStart(2, '0')}_${selectedThemeKey}_remix.mp3`;

            console.log(`Applying FFmpeg filter for track ${i + 1} and streaming to zip...`);
            
            const ffmpegStream = ffmpeg(uploadedFilePath)
                .audioFilter(themeData.filters)
                .audioCodec('libmp3lame')
                .audioBitrate('192k')
                .toFormat('mp3')
                .on('error', (err) => {
                    // This error handler is crucial for catching ffmpeg-specific issues
                    console.error(`FFmpeg error during processing for track ${i + 1}:`, err.message);
                    // We need to reject the promise to stop the loop
                    throw new Error(`FFmpeg error: ${err.message}`);
                })
                .pipe(); // pipe() returns a PassThrough stream

            zip.file(trackFilename, ffmpegStream);
            console.log(`FFmpeg stream for track ${i + 1} successfully piped to zip.`);
        }

        console.log('All tracks piped. Generating zip file from streams...');
        const zipData = await zip.generateAsync({ type: 'base64', streamFiles: true });
        const zipFilename = `${albumTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'memory_album'}.zip`;
        console.log('Zipping complete. Sending response to client.');

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                zip: zipData,
                filename: zipFilename,
                albumTitle: albumTitle
            }),
        };

    } catch (error) {
        console.error('!!! CRITICAL ERROR in function execution:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal error occurred.' }),
        };
    } finally {
        console.log('Cleaning up temporary file...');
        if (uploadedFilePath) {
            try {
                if (fs.existsSync(uploadedFilePath)) {
                    fs.unlinkSync(uploadedFilePath);
                }
            } catch (err) {
                console.error(`Failed to delete temp file: ${uploadedFilePath}`, err);
            }
        }
        console.log('Cleanup complete.');
    }
};
