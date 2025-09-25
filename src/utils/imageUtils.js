export async function compressImageFile(file, opts = {}) {
  const {
    maxWidth = 320,
    maxHeight = 320,
    quality = 0.82,
    preferWebp = true,
  } = opts;

  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const { width, height } = getContainSize(img.width, img.height, maxWidth, maxHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const mimeTry = preferWebp ? 'image/webp' : 'image/jpeg';
  const fallbackMime = preferWebp ? 'image/jpeg' : 'image/webp';

  let blob = await canvasToBlobAsync(canvas, mimeTry, quality);
  if (!blob) {
    blob = await canvasToBlobAsync(canvas, fallbackMime, quality) || await canvasToBlobAsync(canvas, 'image/png');
  }
  return await blobToDataURL(blob);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToBlobAsync(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) {
      canvas.toBlob((b) => resolve(b), type, quality);
    } else {
      // Fallback via dataURL
      try {
        const dataUrl = canvas.toDataURL(type, quality);
        const blob = dataURLToBlob(dataUrl);
        resolve(blob);
      } catch {
        resolve(null);
      }
    }
  });
}

function dataURLToBlob(dataURL) {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function getContainSize(srcW, srcH, maxW, maxH) {
  const ratio = Math.min(maxW / srcW, maxH / srcH, 1);
  return { width: Math.round(srcW * ratio), height: Math.round(srcH * ratio) };
}

