document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('tool-compressor-drop');
    const fileInput = document.getElementById('tool-compressor-input');
    const progressContainer = document.getElementById('tool-compressor-progress-container');
    const progressFill = document.getElementById('tool-compressor-progress-fill');
    const statusText = document.getElementById('tool-compressor-status');

    let ffmpeg = null;

    const loadFFmpeg = async () => {
        if (ffmpeg) return;
        const { FFmpeg } = window.FFmpegWASM;
        ffmpeg = new FFmpeg();
        
        ffmpeg.on('log', ({ message }) => {
            console.log(`[FFmpeg Compressor] ${message}`);
        });
        
        ffmpeg.on('progress', ({ progress, time }) => {
            progressFill.style.width = `${progress * 100}%`;
            statusText.textContent = `Compressing... ${Math.round(progress * 100)}%`;
        });

        const { toBlobURL } = window.FFmpegUtil;
        await ffmpeg.load({
            coreURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js', 'text/javascript'),
            wasmURL: await toBlobURL('https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm', 'application/wasm')
        });
    };

    const processVideo = async (file) => {
        if (!file) return;
        
        dropArea.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        progressFill.style.width = '0%';
        statusText.textContent = 'Loading FFmpeg...';

        try {
            await loadFFmpeg();
            const { fetchFile } = window.FFmpegUtil;
            
            statusText.textContent = 'Reading file...';
            await ffmpeg.writeFile(file.name, await fetchFile(file));
            
            statusText.textContent = 'Compressing... 0%';
            
            await ffmpeg.exec([
                '-i', file.name,
                '-c:v', 'libx264',
                '-preset', 'veryslow',
                '-crf', '24',
                '-c:a', 'copy',
                'output.mp4'
            ]);
            
            statusText.textContent = 'Finishing...';
            const data = await ffmpeg.readFile('output.mp4');
            
            const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `compressed_${file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            statusText.textContent = 'Compression complete!';
            setTimeout(() => {
                dropArea.classList.remove('hidden');
                progressContainer.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 3000);
            
        } catch (error) {
            console.error(error);
            statusText.textContent = 'Error during compression!';
            setTimeout(() => {
                dropArea.classList.remove('hidden');
                progressContainer.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 3000);
        }
    };

    if (dropArea) {
        dropArea.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) processVideo(file);
        });

        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.style.background = 'var(--md-sys-color-surface-container-highest)';
        });

        dropArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropArea.style.background = '';
        });

        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('video/')) {
                processVideo(file);
            }
        });
    }
});
