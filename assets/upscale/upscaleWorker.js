importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");

// In-worker Image class definition (matches imageHelper.js)
class WorkerImage {
  constructor(width, height, data = new Uint8Array(width * height * 4)) {
    this.width = width;
    this.height = height;
    this.data = data;
  }

  getImageCrop(x, y, image, x1, y1, x2, y2) {
    const width = x2 - x1;
    for (let j = 0; j < y2 - y1; j++) {
      const destIndex = (y + j) * this.width * 4 + x * 4;
      const srcIndex = (y1 + j) * image.width * 4 + x1 * 4;
      try {
        this.data.set(
          image.data.subarray(srcIndex, srcIndex + width * 4),
          destIndex
        );
      } catch (err) {
        console.error("getImageCrop error diagnostic:", {
          destImage: { width: this.width, height: this.height, dataLength: this.data.length },
          srcImage: { width: image.width, height: image.height, dataLength: image.data.length },
          params: { x, y, x1, y1, x2, y2, width, j },
          indices: { destIndex, srcIndex, subarrayLength: width * 4 }
        });
        throw err;
      }
    }
  }

  padToTileSize(tileSize) {
    let newWidth = this.width;
    let newHeight = this.height;
    if (this.width < tileSize) {
      newWidth = tileSize;
    }
    if (this.height < tileSize) {
      newHeight = tileSize;
    }
    if (newWidth === this.width && newHeight === this.height) {
      return;
    }
    const newData = new Uint8Array(newWidth * newHeight * 4);
    for (let y = 0; y < this.height; y++) {
      const srcStart = y * this.width * 4;
      const destStart = y * newWidth * 4;
      newData.set(
        this.data.subarray(srcStart, srcStart + this.width * 4),
        destStart
      );
    }
    if (newWidth > this.width) {
      const rightColumnIndex = (this.width - 1) * 4;
      for (let y = 0; y < this.height; y++) {
        const destRowStart = y * newWidth * 4;
        const srcPixelIndex = y * this.width * 4 + rightColumnIndex;
        const padPixel = this.data.subarray(srcPixelIndex, srcPixelIndex + 4);
        for (let x = this.width; x < newWidth; x++) {
          const destPixelIndex = destRowStart + x * 4;
          newData.set(padPixel, destPixelIndex);
        }
      }
    }
    if (newHeight > this.height) {
      const bottomRowStart = (this.height - 1) * newWidth * 4;
      const bottomRow = newData.subarray(
        bottomRowStart,
        bottomRowStart + newWidth * 4
      );
      for (let y = this.height; y < newHeight; y++) {
        const destRowStart = y * newWidth * 4;
        newData.set(bottomRow, destRowStart);
      }
    }
    this.width = newWidth;
    this.height = newHeight;
    this.data = newData;
  }

  cropToOriginalSize(width, height) {
    const newData = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcStart = y * this.width * 4;
      const destStart = y * width * 4;
      newData.set(
        this.data.subarray(srcStart, srcStart + width * 4),
        destStart
      );
    }
    this.width = width;
    this.height = height;
    this.data = newData;
  }
}

// In-worker upscale tensor utilities
function img2tensor(image) {
  // Directly create tensor from raw Uint8Array (bypassing fromPixels and temporary canvas creation)
  const rgba = tf.tensor3d(image.data, [image.height, image.width, 4], 'int32');
  const rgb = rgba.slice([0, 0, 0], [-1, -1, 3]);
  const tensor = rgb.toFloat().div(255).expandDims();
  rgba.dispose();
  rgb.dispose();
  return tensor;
}

async function tensor2img(tensor) {
  const [_, height, width, __] = tensor.shape;
  
  // Pad the 3-channel RGB output to a 4-channel RGBA tensor using mathematical ops on GPU (bypassing toPixels and canvas download)
  const rgba = tf.tidy(() => {
    const rgb = tensor.reshape([height, width, 3]).mul(255).clipByValue(0, 255).cast("int32");
    const alpha = tf.fill([height, width, 1], 255, "int32");
    return tf.concat([rgb, alpha], 2);
  });
  tensor.dispose();
  
  // Direct GPU buffer copy download (much faster than canvas context rendering/reading)
  const data = await rgba.data();
  rgba.dispose();
  
  const uint8Data = new Uint8Array(data);
  const image = new WorkerImage(width, height, uint8Data);
  return image;
}

async function upscale(image, model, alpha = false) {
  const result = tf.tidy(() => {
    const tensor = img2tensor(image);
    let predictRes = model.predict(tensor);
    if (alpha) {
      predictRes = tf.greater(predictRes, 0.5);
    }
    return predictRes;
  });
  const resultImage = await tensor2img(result);
  tf.dispose(result);
  return resultImage;
}

// Cache for loaded model and backend initialization status
let isBackendInitialized = false;
let cachedModel = null;
let cachedModelName = "";

self.addEventListener("message", async (e) => {
  const { data } = e;
  let model_url = "";
  let model_name = "";

  if (data?.model_type === "realesrgan") {
    model_url = `/realesrgan/${data?.model}-${data?.tile_size}/model.json`;
    model_name = `realesrgan-${data?.model}-${data?.tile_size}`;
  } else {
    model_url = `/realcugan/${data?.factor}x-${data?.denoise}-${data?.tile_size}/model.json`;
    model_name = `realcugan-${data?.factor}x-${data?.denoise}-${data?.tile_size}`;
  }

  const absolute_model_url = self.location.origin + model_url;

  if (!isBackendInitialized) {
    self.postMessage({ info: "Initializing TFJS backend..." });

    try {
      // Helper to safely set environment flags without throwing registry errors
      const safeSetFlag = (name, value) => {
        try {
          if (tf.env().flags && name in tf.env().flags) {
            tf.env().set(name, value);
          }
        } catch (e) {
          console.warn(`Could not set TFJS flag ${name}:`, e);
        }
      };

      await tf.ready();
      
      self.postMessage({ info: `TFJS ready. Setting backend to ${data?.backend || "webgl"}...` });

      // Set performance environment flags after tf.ready() to ensure they are registered
      safeSetFlag('CHECK_COMPUTATION_FOR_ERRORS', false);
      
      // WebGL Backend optimizations
      safeSetFlag('WEBGL_VERSION', 2);
      safeSetFlag('WEBGL_FORCE_F16_TEXTURES', true);
      safeSetFlag('WEBGL_FORCE_F16_OPERATOR', true);
      safeSetFlag('WEBGL_PACK', true);
      safeSetFlag('WEBGL_EXP_CONV', true);
      safeSetFlag('WEBGL_PACK_BINARY_OPERATIONS', true);
      safeSetFlag('WEBGL_PACK_IMAGE_OPERATIONS', true);
      safeSetFlag('WEBGL_LAZILY_UNPACK', true);

      if (!(await tf.setBackend(data?.backend || "webgl"))) {
        self.postMessage({
          alertmsg: `${data?.backend} backend is not supported or initialized in your browser.`,
          info: `Error: ${data?.backend} not supported.`
        });
        return;
      }

      isBackendInitialized = true;
      self.postMessage({ info: `Backend set to ${tf.getBackend()}. Loading model...` });
    } catch (err) {
      self.postMessage({
        alertmsg: `Failed to set backend: ${err.message}`,
        info: `Error: ${err.message}`
      });
      return;
    }
  }

  let model;
  if (cachedModel && cachedModelName === model_name) {
    model = cachedModel;
  } else {
    if (cachedModel) {
      try {
        cachedModel.dispose();
      } catch (err) {
        console.warn("Error disposing cached model:", err);
      }
      cachedModel = null;
      cachedModelName = "";
    }

    try {
      model = await tf.loadGraphModel(`indexeddb://${model_name}`);
      console.log("Model loaded successfully from cache:", model_name);
      self.postMessage({ info: "Loaded from cache" });
    } catch (error) {
      self.postMessage({ info: "Downloading model..." });
      try {
        model = await tf.loadGraphModel(absolute_model_url);
        await model.save(`indexeddb://${model_name}`);
        self.postMessage({ info: "Model cached successfully" });
      } catch (fetchError) {
        self.postMessage({
          alertmsg: `Failed to download model weights from ${absolute_model_url}. Error: ${fetchError.message}`,
        });
        return;
      }
    }

    cachedModel = model;
    cachedModelName = model_name;
  }

  if (!model) {
    self.postMessage({ alertmsg: "Model failed to load." });
    return;
  }

  const input = new WorkerImage(data.width, data.height, new Uint8Array(data.input));
  const width_ori = input.width;
  const height_ori = input.height;
  input.padToTileSize(data?.tile_size || 64);
  
  let withPadding = false;
  if (input.width !== width_ori || input.height !== height_ori) {
    withPadding = true;
  }

  let hasAlpha = data.hasAlpha;
  function sendprogress(progress) {
    if (hasAlpha) {
      self.postMessage({
        progress: progress,
        info: `Processing Alpha ${progress.toFixed(1)}%`,
      });
    } else {
      self.postMessage({
        progress: progress,
        info: `Processing ${progress.toFixed(1)}%`,
      });
    }
  }

  async function enlargeImageWithFixedInput(
    model,
    inputImg,
    factor = 4,
    input_size = 64,
    min_lap = 12
  ) {
    const width = inputImg.width;
    const height = inputImg.height;
    const output = new WorkerImage(width * factor, height * factor);

    let num_x = 1;
    for (; (input_size * num_x - width) / (num_x - 1) < min_lap; num_x++);
    let num_y = 1;
    for (; (input_size * num_y - height) / (num_y - 1) < min_lap; num_y++);

    const locs_x = new Array(num_x);
    const locs_y = new Array(num_y);
    const pad_left = new Array(num_x);
    const pad_top = new Array(num_y);
    const pad_right = new Array(num_x);
    const pad_bottom = new Array(num_y);

    const total_lap_x = input_size * num_x - width;
    const total_lap_y = input_size * num_y - height;
    const base_lap_x = Math.floor(total_lap_x / (num_x - 1));
    const base_lap_y = Math.floor(total_lap_y / (num_y - 1));
    const extra_lap_x = total_lap_x - base_lap_x * (num_x - 1);
    const extra_lap_y = total_lap_y - base_lap_y * (num_y - 1);

    locs_x[0] = 0;
    for (let i = 1; i < num_x; i++) {
      if (i <= extra_lap_x) {
        locs_x[i] = locs_x[i - 1] + input_size - base_lap_x - 1;
      } else {
        locs_x[i] = locs_x[i - 1] + input_size - base_lap_x;
      }
    }
    locs_y[0] = 0;
    for (let i = 1; i < num_y; i++) {
      if (i <= extra_lap_y) {
        locs_y[i] = locs_y[i - 1] + input_size - base_lap_y - 1;
      } else {
        locs_y[i] = locs_y[i - 1] + input_size - base_lap_y;
      }
    }

    pad_left[0] = 0;
    pad_top[0] = 0;
    pad_right[num_x - 1] = 0;
    pad_bottom[num_y - 1] = 0;

    for (let i = 1; i < num_x; i++) {
      pad_left[i] = Math.floor((locs_x[i - 1] + input_size - locs_x[i]) / 2);
    }
    for (let i = 1; i < num_y; i++) {
      pad_top[i] = Math.floor((locs_y[i - 1] + input_size - locs_y[i]) / 2);
    }
    for (let i = 0; i < num_x - 1; i++) {
      pad_right[i] = locs_x[i] + input_size - locs_x[i + 1] - pad_left[i + 1];
    }
    for (let i = 0; i < num_y - 1; i++) {
      pad_bottom[i] = locs_y[i] + input_size - locs_y[i + 1] - pad_top[i + 1];
    }

    const total = num_x * num_y;
    let current = 0;

    for (let i = 0; i < num_x; i++) {
      for (let j = 0; j < num_y; j++) {
        const x1 = locs_x[i];
        const y1 = locs_y[j];
        const x2 = locs_x[i] + input_size;
        const y2 = locs_y[j] + input_size;

        const tile = new WorkerImage(input_size, input_size);
        tile.getImageCrop(0, 0, inputImg, x1, y1, x2, y2);

        const scaled = await upscale(tile, model, hasAlpha);
        
        output.getImageCrop(
          (x1 + pad_left[i]) * factor,
          (y1 + pad_top[j]) * factor,
          scaled,
          pad_left[i] * factor,
          pad_top[j] * factor,
          scaled.width - pad_right[i] * factor,
          scaled.height - pad_bottom[j] * factor
        );

        current++;
        let progress = (current / total) * 100;
        sendprogress(progress);
      }
    }

    return output;
  }

  const factor = data?.factor || 4;
  const tile_size = data?.tile_size || 64;
  const min_lap = data?.min_lap || 12;

  let output;
  try {
    output = await enlargeImageWithFixedInput(
      model,
      input,
      factor,
      tile_size,
      min_lap
    );
  } catch (e) {
    self.postMessage({ alertmsg: `Upscale runtime error: ${e.toString()}` });
    return;
  }

  if (withPadding) {
    output.cropToOriginalSize(width_ori * factor, height_ori * factor);
  }

  // Brief pause to allow message delivery
  await new Promise((resolve) => setTimeout(resolve, 10));

  self.postMessage(
    {
      progress: 100,
      done: true,
      output: output.data.buffer,
      info: `Processing complete`,
    },
    [output.data.buffer]
  );
});
