(function () {
    'use strict';

    const ORT_SOURCES = [
        'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.webgpu.min.js',
        'https://unpkg.com/onnxruntime-web/dist/ort.webgpu.min.js'
    ];

    let ortPromise = null;

    window.ensureOnnxRuntime = function () {
        if (typeof window.ort !== 'undefined' && window.ort.InferenceSession) {
            return Promise.resolve(true);
        }
        if (!ortPromise) {
            ortPromise = new Promise((resolve, reject) => {
                let idx = 0;
                const tryNext = () => {
                    if (idx >= ORT_SOURCES.length) {
                        reject(new Error('ONNX Runtime failed to load.'));
                        return;
                    }
                    const s = document.createElement('script');
                    s.src = ORT_SOURCES[idx++];
                    s.async = true;
                    s.onload = () => {
                        setTimeout(() => {
                            if (typeof window.ort !== 'undefined' && window.ort.InferenceSession) {
                                resolve(true);
                            } else {
                                tryNext();
                            }
                        }, 0);
                    };
                    s.onerror = () => tryNext();
                    document.head.appendChild(s);
                };
                tryNext();
            });
            ortPromise.catch(() => { ortPromise = null; });
        }
        return ortPromise;
    };
})();
