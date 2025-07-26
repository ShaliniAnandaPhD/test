// netlify/functions/process-audio-background.js
const { getStore } = require('@netlify/blobs');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const JSZip = require('jszip');

ffmpeg.setFfmpegPath(ffmpegStatic);

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

exports.handler = async (event) => {
    const { jobId } = JSON.parse(event.body);
    const store = getStore('audio_uploads');
    let tempFiles = [];

    try {
        const metadata = await store.getJSON(`${jobId}-metadata`);
        const experiences = JSON.parse(metadata.experiences);
        const originalFilePath = path.join(os.tmpdir(), `original_${jobId}`);
        tempFiles.push(originalFilePath);
        
        const audioStream = await store.get(jobId, { type: 'stream' });
        await new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(originalFilePath);
            audioStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        const zip = new JSZip();
        zip.file('readme.txt', `Album: ${metadata.albumTitle}\nFor: ${metadata.recipientName}`);
        zip.file('01_original.mp3', fs.createReadStream(originalFilePath));
        
        for (let i = 0; i < experiences.length; i++) {
            const experienceText = experiences[i];
            let themeKey = 'default';
            for (const key in memoryThemes) {
                if (experienceText.toLowerCase().includes(key)) {
                    themeKey = key;
                    break;
                }
            }
            const theme = memoryThemes[themeKey];
            const outputFilePath = path.join(os.tmpdir(), `output_${jobId}_${i}.mp3`);
            tempFiles.push(outputFilePath);

            await new Promise((resolve, reject) => {
                ffmpeg(originalFilePath)
                    .audioFilter(theme.filters)
                    .audioCodec('libmp3lame')
                    .audioBitrate('192k')
                    .toFormat('mp3')
                    .on('error', reject)
                    .on('end', resolve)
                    .save(outputFilePath);
            });
            zip.file(`${String(i + 2).padStart(2, '0')}_${themeKey}_remix.mp3`, fs.createReadStream(outputFilePath));
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', streamFiles: true });
        await store.set(`${jobId}-result`, zipBuffer);
        
        await store.setJSON(`${jobId}-metadata`, {
            ...metadata,
            status: 'completed',
            finishedAt: new Date().toISOString(),
        });
        
    } catch (error) {
        console.error('Background Processing Error:', error);
        const metadata = await store.getJSON(`${jobId}-metadata`);
        await store.setJSON(`${jobId}-metadata`, {
            ...metadata,
            status: 'failed',
            error: error.message,
        });
    } finally {
        tempFiles.forEach(file => fs.existsSync(file) && fs.unlinkSync(file));
    }
};
