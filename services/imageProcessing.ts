
import { ProcessedSignature, SelectionBox } from '../types';
import { loadOpenCV } from './opencvLoader';

/**
 * Step 1: Detect bounds - Now using OpenCV Contours
 */
export const detectSignatureBounds = async (
  file: File,
  sensitivity: number = 15
): Promise<{ width: number; height: number; boxes: SelectionBox[] }> => {
  await loadOpenCV();
  const cv = window.cv;

  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(imageBitmap, 0, 0);

  // Read image to OpenCV Mat
  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  let binary = new cv.Mat();
  let blurred = new cv.Mat();
  let hierarchy = new cv.Mat();
  let contours = new cv.MatVector();
  let M: any = null;

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Gaussian Blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // 3. Adaptive Threshold (Inverted for contour finding: white text on black bg)
    // Dynamic block size based on image dimension to prevent hollow contours during detection
    let blockSize = Math.floor(Math.min(src.cols, src.rows) / 30);
    if (blockSize % 2 === 0) blockSize++; // Must be odd
    if (blockSize < 11) blockSize = 11;

    const C = sensitivity; 
    cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, C);

    // 4. Morphological Close to connect broken Chinese strokes
    M = cv.Mat.ones(5, 5, cv.CV_8U); 
    let anchor = new cv.Point(-1, -1);
    cv.morphologyEx(binary, binary, cv.MORPH_CLOSE, M, anchor, 2); 

    // 5. Find Contours
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const boxes: SelectionBox[] = [];
    const minArea = (src.cols * src.rows) * 0.001; // Ignore tiny specks

    for (let i = 0; i < contours.size(); ++i) {
      const contour = contours.get(i);
      const rect = cv.boundingRect(contour);
      const area = rect.width * rect.height;

      // Filter: Too small or Too big (whole page)
      if (area > minArea && area < (src.cols * src.rows * 0.90)) {
         // Add padding
         const pad = 20;
         const x = Math.max(0, rect.x - pad);
         const y = Math.max(0, rect.y - pad);
         const w = Math.min(src.cols - x, rect.width + pad * 2);
         const h = Math.min(src.rows - y, rect.height + pad * 2);

         boxes.push({
           id: crypto.randomUUID(),
           x, y, width: w, height: h
         });
      }
    }

    return {
      width: src.cols,
      height: src.rows,
      boxes: boxes
    };

  } finally {
    src.delete(); gray.delete(); binary.delete(); blurred.delete(); 
    hierarchy.delete(); contours.delete(); 
    if(M) M.delete();
  }
};

/**
 * Step 2: Process Regions using OpenCV Adaptive Thresholding
 */
export const processSignatureRegions = async (
  file: File,
  regions: SelectionBox[],
  sensitivity: number = 15,
  outputWidth: number = 452,
  outputHeight: number = 224
): Promise<ProcessedSignature[]> => {
  await loadOpenCV();
  const cv = window.cv;

  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(imageBitmap, 0, 0);

  const results: ProcessedSignature[] = [];

  for (const box of regions) {
    if (box.width <= 0 || box.height <= 0) continue;

    // 1. Extract Crop
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = box.width;
    cropCanvas.height = box.height;
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) continue;
    cropCtx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    
    const rawUrl = cropCanvas.toDataURL('image/png');

    // 2. Process with OpenCV
    const formattedUrl = processSingleSignatureWithOpenCV(cropCanvas, sensitivity, outputWidth, outputHeight, cv);

    results.push({
      id: box.id,
      originalDataUrl: rawUrl,
      processedDataUrl: formattedUrl,
      width: outputWidth,
      height: outputHeight
    });
  }

  return results;
};

const processSingleSignatureWithOpenCV = (
  sourceCanvas: HTMLCanvasElement, 
  sensitivity: number,
  targetWidth: number,
  targetHeight: number,
  cv: any
): string => {
  let src = cv.imread(sourceCanvas);
  let dst = new cv.Mat();
  let gray = new cv.Mat();
  let blurred = new cv.Mat();
  let kernel = new cv.Mat();

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Gaussian Blur (Denoise)
    const kSize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blurred, kSize, 0);

    // 3. Adaptive Thresholding (INVERTED)
    // We want White Text on Black Background first to perform morphological operations.
    // Dynamic Block Size Calculation:
    // To avoid "hollow" outlines, block size must be larger than the stroke width.
    // We estimate standard stroke width might be related to image size.
    // Let's use roughly 1/8th of the smaller dimension.
    let blockSize = Math.floor(Math.min(src.cols, src.rows) / 8);
    if (blockSize % 2 === 0) blockSize++; // Must be odd
    if (blockSize < 31) blockSize = 31;   // Minimum floor
    
    // Sensitivity C:
    // Larger C = More background is removed (stricter).
    // Smaller C = More noise might remain.
    const C = sensitivity; 
    
    // THRESH_BINARY_INV:
    // Pixel > Mean - C  ==> 255 (White) -> Text
    // Pixel < Mean - C  ==> 0   (Black) -> Background
    cv.adaptiveThreshold(blurred, dst, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, C);

    // 4. Morphological Close (Fill Holes / Solidify Strokes)
    // This connects regions and fills gaps inside thick strokes that might have been thresholded out.
    // Kernel size: 3x3 for small images, larger for big ones.
    const kernelSize = Math.max(3, Math.floor(Math.min(src.cols, src.rows) / 100));
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize));
    
    // Morph Close = Dilate -> Erode.
    cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, kernel);

    // 5. Invert back to Black Text on White Background
    cv.bitwise_not(dst, dst);

    // --- Resizing and Centering Logic ---
    // We create a new Mat for the target size filled with White
    let finalMat = new cv.Mat(targetHeight, targetWidth, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
    
    // Calculate aspect ratio fit
    const padding = Math.max(10, Math.min(targetWidth, targetHeight) * 0.05);
    const availW = targetWidth - padding * 2;
    const availH = targetHeight - padding * 2;
    
    // We process 'dst' (Binary), but we want output to be RGBA
    // First resize the binary signature
    const scale = Math.min(availW / dst.cols, availH / dst.rows);
    const dsize = new cv.Size(Math.round(dst.cols * scale), Math.round(dst.rows * scale));
    
    let resized = new cv.Mat();
    cv.resize(dst, resized, dsize, 0, 0, cv.INTER_AREA);

    // Convert resized binary (1 channel) back to RGBA (4 channels)
    // This creates grayscale-looking RGBA (R=G=B).
    let resizedColor = new cv.Mat();
    cv.cvtColor(resized, resizedColor, cv.COLOR_GRAY2RGBA);

    // ROI (Region of Interest) copy
    const dx = Math.floor((targetWidth - dsize.width) / 2);
    const dy = Math.floor((targetHeight - dsize.height) / 2);
    
    let roi = finalMat.roi(new cv.Rect(dx, dy, dsize.width, dsize.height));
    resizedColor.copyTo(roi);
    
    // Output
    const destCanvas = document.createElement('canvas');
    destCanvas.width = targetWidth;
    destCanvas.height = targetHeight;
    cv.imshow(destCanvas, finalMat);

    // Cleanup Loop specific
    resized.delete(); resizedColor.delete(); roi.delete(); finalMat.delete();

    return destCanvas.toDataURL('image/png');

  } catch (e) {
    console.error("OpenCV processing error", e);
    return sourceCanvas.toDataURL(); // Fallback
  } finally {
    src.delete(); dst.delete(); gray.delete(); blurred.delete();
    if (kernel && !kernel.isDeleted()) kernel.delete();
  }
};
