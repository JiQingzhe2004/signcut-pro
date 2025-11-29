
import { ProcessedSignature, SelectionBox } from '../types';
import { loadOpenCV } from './opencvLoader';

/**
 * Helper: Calculate image brightness mean
 */
const calculateBrightness = (gray: any, cv: any): number => {
  const mean = new cv.Mat();
  const stddev = new cv.Mat();
  cv.meanStdDev(gray, mean, stddev);
  const brightness = mean.data[0];
  mean.delete();
  stddev.delete();
  return brightness;
};

/**
 * Helper: Estimate stroke width from contours
 */
const estimateStrokeWidth = (contours: any, cv: any): number => {
  if (contours.size() === 0) return 3; // Default
  
  let totalPerimeter = 0;
  let totalArea = 0;
  
  for (let i = 0; i < contours.size(); ++i) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    const perimeter = cv.arcLength(contour, true);
    
    if (area > 0 && perimeter > 0) {
      totalArea += area;
      totalPerimeter += perimeter;
    }
  }
  
  if (totalArea === 0 || totalPerimeter === 0) return 3;
  
  // Average stroke width estimation: 2 * area / perimeter
  const avgStrokeWidth = (2 * totalArea) / totalPerimeter;
  return Math.max(2, Math.min(avgStrokeWidth, 10)); // Clamp between 2 and 10
};

/**
 * Helper: Remove shadow using background subtraction (optional, only if needed)
 */
const removeShadow = (gray: any, cv: any, useShadowRemoval: boolean = false): any => {
  if (!useShadowRemoval) {
    // Return a copy of gray if shadow removal is disabled
    const result = gray.clone();
    return result;
  }
  
  const bg = new cv.Mat();
  // Large blur to estimate background
  cv.GaussianBlur(gray, bg, new cv.Size(21, 21), 0);
  
  // Subtract background to enhance foreground (gray - bg, not bg - gray)
  const enhanced = new cv.Mat();
  cv.subtract(gray, bg, enhanced);
  
  // Normalize to 0-255 range
  cv.normalize(enhanced, enhanced, 0, 255, cv.NORM_MINMAX);
  
  bg.delete();
  return enhanced;
};

/**
 * Helper: Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
 */
const applyCLAHE = (gray: any, cv: any): any => {
  try {
    const clahe = cv.createCLAHE(2.0, new cv.Size(8, 8));
    const equalized = new cv.Mat();
    clahe.apply(gray, equalized);
    clahe.delete();
    return equalized;
  } catch (e) {
    // Fallback to regular histogram equalization if CLAHE not available
    const equalized = new cv.Mat();
    cv.equalizeHist(gray, equalized);
    return equalized;
  }
};

/**
 * Helper: Remove noise using morphological opening
 * This is more reliable than connected components in OpenCV.js
 */
const removeNoiseByConnectedComponents = (binary: any, cv: any, minArea: number = 10): any => {
  // Use morphological opening which is simpler and more reliable
  // The kernel size is adjusted based on minArea to remove small components
  const cleaned = binary.clone();
  
  // Calculate kernel size based on minArea (approximate)
  // For small areas, use smaller kernel
  const kernelSize = minArea < 20 ? 3 : minArea < 50 ? 5 : 7;
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kernelSize, kernelSize));
  const anchor = new cv.Point(-1, -1);
  
  // Morphological opening removes small noise
  cv.morphologyEx(cleaned, cleaned, cv.MORPH_OPEN, kernel, anchor, 1);
  
  kernel.delete();
  return cleaned;
};

/**
 * Helper: Apply Otsu thresholding as fallback/complement
 */
const applyOtsuThreshold = (gray: any, cv: any): any => {
  const binary = new cv.Mat();
  cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
  return binary;
};

/**
 * Helper: Combine multiple thresholding methods for better results
 * Uses conservative combination to preserve original stroke width
 */
const combineThresholds = (adaptive: any, otsu: any, cv: any): any => {
  // Strategy: Use adaptive as primary (preserves local details), 
  // only use Otsu to fill very small gaps near existing pixels
  // This minimizes stroke thickening
  
  // Start with adaptive threshold (preserves original stroke width better)
  const combined = adaptive.clone();
  
  // Find pixels in Otsu but not in adaptive (potential gaps to fill)
  const gaps = new cv.Mat();
  cv.subtract(otsu, adaptive, gaps); // Otsu pixels not in adaptive
  
  // Only fill gaps that are very close to existing adaptive pixels (1 pixel distance)
  const dilated = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2)); // Smaller kernel
  const anchor = new cv.Point(-1, -1);
  cv.dilate(combined, dilated, kernel, anchor, 1);
  
  // Only add gap pixels that are immediately adjacent to existing pixels
  const nearGaps = new cv.Mat();
  cv.bitwise_and(gaps, dilated, nearGaps);
  cv.bitwise_or(combined, nearGaps, combined);
  
  // Cleanup
  gaps.delete();
  dilated.delete();
  nearGaps.delete();
  kernel.delete();
  
  return combined;
};

/**
 * Helper: Enhance edges using Canny edge detection (disabled to preserve stroke width)
 * Note: This function is kept for compatibility but not used in main pipeline
 * to avoid thickening strokes
 */
const enhanceWithEdges = (gray: any, binary: any, cv: any): any => {
  // Return binary as-is to preserve original stroke width
  // Edge enhancement can add pixels and thicken strokes
  return binary.clone();
};

/**
 * Helper: Fill small holes in binary image
 */
const fillSmallHoles = (binary: any, cv: any, maxHoleArea: number = 50): any => {
  // Use morphological closing to fill small holes
  // This is simpler and more reliable than connected components
  const filled = binary.clone();
  
  // Calculate kernel size based on maxHoleArea (approximate)
  const kernelSize = maxHoleArea < 30 ? 3 : maxHoleArea < 100 ? 5 : 7;
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kernelSize, kernelSize));
  const anchor = new cv.Point(-1, -1);
  
  // Morphological closing fills small holes
  cv.morphologyEx(filled, filled, cv.MORPH_CLOSE, kernel, anchor, 1);
  
  kernel.delete();
  return filled;
};

/**
 * Helper: Smooth binary image to reduce jagged edges
 */
const smoothBinary = (binary: any, cv: any, iterations: number = 1): any => {
  const smoothed = binary.clone();
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const anchor = new cv.Point(-1, -1);
  
  // Apply opening (erode then dilate) to smooth
  cv.morphologyEx(smoothed, smoothed, cv.MORPH_OPEN, kernel, anchor, iterations);
  
  kernel.delete();
  return smoothed;
};

/**
 * Analyze image and recommend optimal sensitivity threshold
 */
export const recommendSensitivity = async (
  file: File
): Promise<number> => {
  await loadOpenCV();
  const cv = window.cv;

  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');
  ctx.drawImage(imageBitmap, 0, 0);

  let src = cv.imread(canvas);
  let gray = new cv.Mat();
  let blurred = new cv.Mat();

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Gaussian Blur (simplified, no shadow removal or CLAHE for recommendation)
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

    // 5. Calculate brightness
    const brightness = calculateBrightness(blurred, cv);

    // 6. Estimate noise density by analyzing edge density
    const edges = new cv.Mat();
    cv.Canny(blurred, edges, 50, 150);
    const edgePixels = cv.countNonZero(edges);
    const totalPixels = blurred.rows * blurred.cols;
    const noiseDensity = edgePixels / totalPixels;
    edges.delete();

    // 7. Recommend threshold based on brightness and noise
    let recommended: number;
    
    if (noiseDensity > 0.15) {
      // High noise density -> lower threshold to reduce noise
      recommended = brightness > 150 ? 12 : brightness < 100 ? 8 : 10;
    } else if (noiseDensity < 0.05) {
      // Low noise density -> higher threshold for better contrast
      recommended = brightness > 150 ? 28 : brightness < 100 ? 20 : 25;
    } else {
      // Medium noise density -> balanced threshold
      recommended = brightness > 150 ? 22 : brightness < 100 ? 15 : 18;
    }

    // Clamp to valid range
    return Math.max(5, Math.min(recommended, 35));

  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
  }
};

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

    // More conservative threshold adjustment
    const brightness = calculateBrightness(blurred, cv);
    const baseC = brightness > 160 ? sensitivity + 2 : brightness < 90 ? sensitivity - 2 : sensitivity;
    
    cv.adaptiveThreshold(blurred, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, baseC);

    // 4. Morphological Close to connect broken Chinese strokes
    // Use original approach with MORPH_CLOSE for better stroke preservation
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
 * Supports streaming: processes one signature at a time and calls onProgress for each
 */
export const processSignatureRegions = async (
  file: File,
  regions: SelectionBox[],
  sensitivity: number = 15,
  outputWidth: number = 452,
  outputHeight: number = 224,
  onProgress?: (signature: ProcessedSignature, index: number, total: number) => void
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
  const total = regions.length;

  for (let i = 0; i < regions.length; i++) {
    const box = regions[i];
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

    const signature: ProcessedSignature = {
      id: box.id,
      originalDataUrl: rawUrl,
      processedDataUrl: formattedUrl,
      width: outputWidth,
      height: outputHeight
    };

    results.push(signature);

    // Call progress callback if provided (streaming mode)
    if (onProgress) {
      onProgress(signature, results.length - 1, total);
    }
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
  let adaptiveBinary: any = null;
  let otsuBinary: any = null;
  let combinedBinary: any = null;
  let cleanedBinary: any = null;

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Gaussian Blur (Denoise) - Apply blur first to reduce noise
    const kSize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blurred, kSize, 0);

    // 3. Calculate brightness for subtle threshold adjustment
    const brightness = calculateBrightness(blurred, cv);
    const baseC = brightness > 160 ? sensitivity + 2 : brightness < 90 ? sensitivity - 2 : sensitivity;

    // 4. Adaptive Thresholding (INVERTED)
    let blockSize = Math.floor(Math.min(src.cols, src.rows) / 8);
    if (blockSize % 2 === 0) blockSize++;
    if (blockSize < 31) blockSize = 31;
    blockSize = Math.min(blockSize, Math.floor(Math.min(src.cols, src.rows) / 4));
    
    adaptiveBinary = new cv.Mat();
    cv.adaptiveThreshold(blurred, adaptiveBinary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, baseC);

    // 5. Otsu Thresholding as complement (for better edge detection)
    otsuBinary = applyOtsuThreshold(blurred, cv);

    // 6. Combine adaptive and Otsu thresholds (keep pixels detected by both)
    combinedBinary = combineThresholds(adaptiveBinary, otsuBinary, cv);
    
    // Clean up temporary binaries
    adaptiveBinary.delete();
    otsuBinary.delete();
    adaptiveBinary = null;
    otsuBinary = null;

    // 7. Remove noise using connected component analysis
    const imageArea = src.cols * src.rows;
    const minNoiseArea = Math.max(5, Math.floor(imageArea * 0.0001)); // 0.01% of image area
    cleanedBinary = removeNoiseByConnectedComponents(combinedBinary, cv, minNoiseArea);
    combinedBinary.delete();
    combinedBinary = null;

    // 8. Very light morphological close to connect only tiny broken strokes
    // Use minimal kernel and single iteration to preserve original stroke width
    const kernelSize = Math.max(2, Math.floor(Math.min(src.cols, src.rows) / 200)); // Even smaller kernel
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize));
    let anchor = new cv.Point(-1, -1);
    // Single iteration with small kernel to minimize thickening
    cv.morphologyEx(cleanedBinary, cleanedBinary, cv.MORPH_CLOSE, kernel, anchor, 1);
    
    // 9. Skip hole filling to preserve original stroke appearance
    // (Hole filling can thicken strokes, so we skip it to maintain original width)
    
    // 10. Final noise removal (remove any remaining small artifacts)
    const finalCleaned = removeNoiseByConnectedComponents(cleanedBinary, cv, minNoiseArea * 2);
    cleanedBinary.delete();
    cleanedBinary = null;

    // 11. Invert back to Black Text on White Background
    cv.bitwise_not(finalCleaned, dst);
    finalCleaned.delete();

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
