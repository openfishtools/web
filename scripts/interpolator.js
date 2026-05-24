document.addEventListener('DOMContentLoaded', () => {
    const dropArea = document.getElementById('tool-interpolator-drop');
    const fileInput = document.getElementById('tool-interpolator-input');
    const progressContainer = document.getElementById('tool-interpolator-progress-container');
    const progressFill = document.getElementById('tool-interpolator-progress-fill');
    const statusText = document.getElementById('tool-interpolator-status');

    let ffmpeg = null;

    const loadFFmpeg = async () => {
        if (ffmpeg) return;
        const { FFmpeg } = window.FFmpeg;
        ffmpeg = new FFmpeg();
        
        ffmpeg.on('progress', ({ progress, time }) => {
            progressFill.style.width = `${progress * 100}%`;
            statusText.textContent = `Interpolating... ${Math.round(progress * 100)}%`;
        });

        await ffmpeg.load({
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm'
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
            
            statusText.textContent = 'Interpolating... 0%';
            
            await ffmpeg.exec([
                '-i', file.name,
                '-vf', 'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1',
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '20',
                '-c:a', 'copy',
                'output_60fps.mp4'
            ]);
            
            statusText.textContent = 'Finishing...';
            const data = await ffmpeg.readFile('output_60fps.mp4');
            
            const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `interpolated_60fps_${file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            statusText.textContent = 'Interpolation complete!';
            setTimeout(() => {
                dropArea.classList.remove('hidden');
                progressContainer.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 3000);
            
        } catch (error) {
            console.error(error);
            statusText.textContent = 'Error during interpolation!';
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
