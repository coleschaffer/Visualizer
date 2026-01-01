// Capture screenshot of a specific element region
export async function captureElementScreenshot(rect: DOMRect): Promise<string | null> {
  try {
    // Request screenshot from background script
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'CAPTURE_SCREENSHOT', rect: serializeRect(rect) },
        (response) => {
          if (response?.success && response.dataUrl) {
            resolve(response.dataUrl);
          } else {
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Failed to capture screenshot:', error);
    return null;
  }
}

// Serialize DOMRect for messaging
function serializeRect(rect: DOMRect): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

// Crop image data to specific region
export function cropImageData(
  imageDataUrl: string,
  rect: { x: number; y: number; width: number; height: number },
  devicePixelRatio: number = window.devicePixelRatio
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Account for device pixel ratio
      const scale = devicePixelRatio;
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;

      ctx.drawImage(
        img,
        rect.x * scale,
        rect.y * scale,
        rect.width * scale,
        rect.height * scale,
        0,
        0,
        rect.width * scale,
        rect.height * scale
      );

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
}
