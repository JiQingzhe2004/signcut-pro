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
  // For small areas, use smaller kernel
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

    if (box.rotation) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      
      cropCtx.save();
      // Translate to center of crop canvas
      cropCtx.translate(box.width / 2, box.height / 2);
      // Rotate (negative because we are transforming the context to map source pixels)
      cropCtx.rotate(-box.rotation * Math.PI / 180);
      // Translate back relative to source image center
      cropCtx.translate(-cx, -cy);
      
      // Draw the entire source image
      cropCtx.drawImage(canvas, 0, 0);
      cropCtx.restore();
    } else {
      cropCtx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    }
    
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

export const processSingleSignatureWithOpenCV = (
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
  let processingBinary: any = null;
  let contours: any = null;
  let hierarchy: any = null;
  let softMask: any = null;
  let finalMat: any = null;
  let tempRgba: any = null;

  try {
    // 1. Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Gaussian Blur (Denoise)
    const kSize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blurred, kSize, 0);

    // 3. Calculate brightness
    const brightness = calculateBrightness(blurred, cv);
    const baseC = brightness > 160 ? sensitivity + 2 : brightness < 90 ? sensitivity - 2 : sensitivity;

    // 4. Adaptive Thresholding (INVERTED)
    let blockSize = Math.floor(Math.min(src.cols, src.rows) / 8);
    if (blockSize % 2 === 0) blockSize++;
    if (blockSize < 31) blockSize = 31;
    
    adaptiveBinary = new cv.Mat();
    cv.adaptiveThreshold(blurred, adaptiveBinary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, blockSize, baseC);
    
    processingBinary = adaptiveBinary.clone();

    // 5. Basic noise removal (Open)
    const kernelSize = 3;
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelSize, kernelSize));
    const anchor = new cv.Point(-1, -1);
    cv.morphologyEx(processingBinary, processingBinary, cv.MORPH_OPEN, kernel, anchor, 1);
    
    // --- Morphological Weight Adjustment (Based on Sensitivity) ---
    // Allows user to thicken (dilate) or thin (erode) the signature
    // Low sensitivity (<12) -> Thicken
    // High sensitivity (>28) -> Thin
    let morphKernel = null;
    if (sensitivity < 12) {
        // Thicken lines
        morphKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.dilate(processingBinary, processingBinary, morphKernel);
    } else if (sensitivity > 28) {
        // Thin lines
        morphKernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
        cv.erode(processingBinary, processingBinary, morphKernel);
    }
    if (morphKernel) morphKernel.delete();

    // --- Anti-aliasing step ---
    // Create a soft mask by blurring the binary image
    softMask = new cv.Mat();
    cv.GaussianBlur(processingBinary, softMask, new cv.Size(3, 3), 0);

    // --- Resizing and Centering Logic ---
    finalMat = new cv.Mat(targetHeight, targetWidth, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
    
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(processingBinary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    
    let minX = src.cols, minY = src.rows, maxX = 0, maxY = 0;
    let hasContent = false;
    
    // Smart cropping: Filter out noise by comparing to the largest contour
    let maxContourArea = 0;
    const contourStats = []; 
    
    for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        const rect = cv.boundingRect(contour);
        contourStats.push({ area, rect });
        
        if (area > maxContourArea) {
            maxContourArea = area;
        }
        contour.delete(); // Prevent memory leak
    }
    
    // Threshold: 1% of max area or 20px absolute minimum
    const areaThreshold = Math.max(20, maxContourArea * 0.01);

    for (let i = 0; i < contourStats.length; ++i) {
        const { area, rect } = contourStats[i];
        
        if (area > areaThreshold) { 
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
            hasContent = true;
        }
    }
    
    // Create RGBA from soft mask: Black Ink with Alpha from softMask
    // This ensures anti-aliased edges
    tempRgba = new cv.Mat();
    let channels = new cv.MatVector();
    let blackPlane = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    channels.push_back(blackPlane); // R=0
    channels.push_back(blackPlane); // G=0
    channels.push_back(blackPlane); // B=0
    channels.push_back(softMask);   // A=softMask
    cv.merge(channels, tempRgba);
    blackPlane.delete();

    let cropped: any;
    if (hasContent) {
        // Add small padding to ensure anti-aliased edges (from blur) are not cut off
        const blurPad = 4;
        const cropX = Math.max(0, minX - blurPad);
        const cropY = Math.max(0, minY - blurPad);
        const cropW = Math.min(src.cols - cropX, (maxX - minX) + blurPad * 2);
        const cropH = Math.min(src.rows - cropY, (maxY - minY) + blurPad * 2);

        const rect = new cv.Rect(cropX, cropY, cropW, cropH);
        cropped = tempRgba.roi(rect);
    } else {
        cropped = tempRgba;
    }

    // Calculate scaling
    const padding = Math.max(10, Math.min(targetWidth, targetHeight) * 0.05);
    const availW = targetWidth - padding * 2;
    const availH = targetHeight - padding * 2;
    
    const scale = Math.min(availW / cropped.cols, availH / cropped.rows);
    const dsize = new cv.Size(Math.round(cropped.cols * scale), Math.round(cropped.rows * scale));
    
    let resized = new cv.Mat();
    // Use INTER_AREA for downscaling (better quality), INTER_CUBIC for upscaling (smooth edges)
    let interpolation = scale > 1 ? cv.INTER_CUBIC : cv.INTER_AREA;
    cv.resize(cropped, resized, dsize, 0, 0, interpolation);
    
    // Center on White Background
    const dx = Math.floor((targetWidth - dsize.width) / 2);
    const dy = Math.floor((targetHeight - dsize.height) / 2);
    
    let roi = finalMat.roi(new cv.Rect(dx, dy, dsize.width, dsize.height));
    
    // Composite Black Ink onto White Background
    // We have Black Ink with Alpha. Target is White.
    // Result = Ink * Alpha + Bg * (1 - Alpha)
    // Since Ink is Black (0): Result = 0 + 255 * (1 - Alpha) = 255 - 255 * Alpha
    // So we just need to invert the alpha channel and use it as grayscale intensity
    
    let resizedChannels = new cv.MatVector();
    cv.split(resized, resizedChannels);
    let alpha = resizedChannels.get(3);
    
    let inverseAlpha = new cv.Mat();
    cv.bitwise_not(alpha, inverseAlpha); // 0(Transparent) -> 255(White), 255(Ink) -> 0(Black)
    
    let finalChannels = new cv.MatVector();
    finalChannels.push_back(inverseAlpha); // R
    finalChannels.push_back(inverseAlpha); // G
    finalChannels.push_back(inverseAlpha); // B
    let opaque = new cv.Mat(dsize.height, dsize.width, cv.CV_8UC1, new cv.Scalar(255));
    finalChannels.push_back(opaque);       // A
    
    let blended = new cv.Mat();
    cv.merge(finalChannels, blended);
    
    blended.copyTo(roi);
    
    // Cleanup
    channels.delete();
    resizedChannels.delete(); alpha.delete(); inverseAlpha.delete();
    finalChannels.delete(); opaque.delete(); blended.delete();
    roi.delete(); softMask.delete();
    if (hasContent) cropped.delete();
    tempRgba.delete();
    resized.delete();
    contours.delete();
    hierarchy.delete();
    
    // Output
    const destCanvas = document.createElement('canvas');
    destCanvas.width = targetWidth;
    destCanvas.height = targetHeight;
    cv.imshow(destCanvas, finalMat);

    finalMat.delete();
    
    return destCanvas.toDataURL('image/png');

  } catch (e) {
    console.error("OpenCV processing error", e);
    return sourceCanvas.toDataURL(); 
  } finally {
    src.delete(); dst.delete(); gray.delete(); blurred.delete();
    if (kernel && !kernel.isDeleted()) kernel.delete();
    if (adaptiveBinary && !adaptiveBinary.isDeleted()) adaptiveBinary.delete();
    if (processingBinary && !processingBinary.isDeleted()) processingBinary.delete();
    
    // Additional cleanup for smart cropping & anti-aliasing vars
    if (contours && !contours.isDeleted()) contours.delete();
    if (hierarchy && !hierarchy.isDeleted()) hierarchy.delete();
    if (softMask && !softMask.isDeleted()) softMask.delete();
    if (finalMat && !finalMat.isDeleted()) finalMat.delete();
    if (tempRgba && !tempRgba.isDeleted()) tempRgba.delete();
  }
};

/**
 * Simplified processing for AI-extracted signatures.
 * Assumes the input is already a clean signature crop.
 * Performs:
 * 1. Binarization (Force Black Ink)
 * 2. Transparent Background
 * 3. Resizing/Centering
 */
export const processAISignatureWithOpenCV = (
  sourceCanvas: HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number,
  cv: any
): string => {
  let src = cv.imread(sourceCanvas);
  let gray = new cv.Mat();
  let binary = new cv.Mat();
  let resized = new cv.Mat();
  let finalMat: any = null;
  let contours: any = null;
  let hierarchy: any = null;
  let softMask: any = null;
  let tempRgba: any = null;
  
  try {
    // 1. Convert to Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Otsu Thresholding (Inverted)
    // Finds the optimal threshold to separate ink (dark) from background (light)
    // Result: Ink = 255 (White), Bg = 0 (Black)
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

    // --- Morphological Weight Adjustment (Kept compatible with sensitivity param if needed later) ---
    // Currently AI mode doesn't use sensitivity actively, but we can apply a fixed cleanup
    // Or if we passed sensitivity, we could use it. 
    // For now, we just do a light open to remove noise.
    let morphKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.morphologyEx(binary, binary, cv.MORPH_OPEN, morphKernel);
    morphKernel.delete();

    // --- Smart Cropping Step ---
    // Find contours to detect actual content bounds
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let minX = src.cols, minY = src.rows, maxX = 0, maxY = 0;
    let hasContent = false;
    let maxContourArea = 0;
    const contourStats = [];

    for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        const rect = cv.boundingRect(contour);
        contourStats.push({ area, rect });
        if (area > maxContourArea) maxContourArea = area;
        contour.delete(); // Prevent memory leak
    }

    // Threshold: 1% of max area or 20px absolute minimum
    const areaThreshold = Math.max(20, maxContourArea * 0.01);

    for (let i = 0; i < contourStats.length; ++i) {
        const { area, rect } = contourStats[i];
        if (area > areaThreshold) {
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
            hasContent = true;
        }
    }

    // --- Anti-aliasing step ---
    // Create a soft mask by blurring the binary image
    softMask = new cv.Mat();
    cv.GaussianBlur(binary, softMask, new cv.Size(3, 3), 0);

    // 3. Create RGBA with Soft Mask (Black Ink, Transparent Bg)
    tempRgba = new cv.Mat();
    let channels = new cv.MatVector();
    let blackPlane = new cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC1);
    channels.push_back(blackPlane); // R=0
    channels.push_back(blackPlane); // G=0
    channels.push_back(blackPlane); // B=0
    channels.push_back(softMask);   // A=softMask
    cv.merge(channels, tempRgba);
    blackPlane.delete();
    
    // Crop RGBA to content bounds
    let cropped;
    if (hasContent) {
        // Add small padding to preserve soft edges
        const blurPad = 4;
        const cropX = Math.max(0, minX - blurPad);
        const cropY = Math.max(0, minY - blurPad);
        const cropW = Math.min(src.cols - cropX, (maxX - minX) + blurPad * 2);
        const cropH = Math.min(src.rows - cropY, (maxY - minY) + blurPad * 2);
        
        const rect = new cv.Rect(cropX, cropY, cropW, cropH);
        cropped = tempRgba.roi(rect);
    } else {
        cropped = tempRgba;
    }

    // 4. Resize and Center (Unified Size)
    // Calculate aspect ratio fit
    const padding = Math.max(10, Math.min(targetWidth, targetHeight) * 0.05);
    const availW = targetWidth - padding * 2;
    const availH = targetHeight - padding * 2;
    
    const scale = Math.min(availW / cropped.cols, availH / cropped.rows);
    const dsize = new cv.Size(Math.round(cropped.cols * scale), Math.round(cropped.rows * scale));
    
    // Resize using INTER_AREA for quality, INTER_CUBIC for upscaling
    let interpolation = scale > 1 ? cv.INTER_CUBIC : cv.INTER_AREA;
    cv.resize(cropped, resized, dsize, 0, 0, interpolation);

    // Cleanup
    if (hasContent) cropped.delete();

    // Create final canvas with White Background
    finalMat = new cv.Mat(targetHeight, targetWidth, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
    
    // ROI copy
    const dx = Math.floor((targetWidth - dsize.width) / 2);
    const dy = Math.floor((targetHeight - dsize.height) / 2);
    
    let roi = finalMat.roi(new cv.Rect(dx, dy, dsize.width, dsize.height));
    
    // Composite Black Ink onto White Background using Alpha from resized image
    let resizedChannels = new cv.MatVector();
    cv.split(resized, resizedChannels);
    let alpha = resizedChannels.get(3);
    
    let inverseAlpha = new cv.Mat();
    cv.bitwise_not(alpha, inverseAlpha); // 0(Transparent) -> 255(White), 255(Ink) -> 0(Black)
    
    let finalChannels = new cv.MatVector();
    finalChannels.push_back(inverseAlpha); // R
    finalChannels.push_back(inverseAlpha); // G
    finalChannels.push_back(inverseAlpha); // B
    let opaque = new cv.Mat(dsize.height, dsize.width, cv.CV_8UC1, new cv.Scalar(255));
    finalChannels.push_back(opaque);       // A
    
    let blended = new cv.Mat();
    cv.merge(finalChannels, blended);
    
    blended.copyTo(roi);
    
    // Cleanup
    channels.delete();
    resizedChannels.delete(); alpha.delete(); inverseAlpha.delete();
    finalChannels.delete(); opaque.delete(); blended.delete();
    roi.delete(); softMask.delete();

    // Output
    const destCanvas = document.createElement('canvas');
    destCanvas.width = targetWidth;
    destCanvas.height = targetHeight;
    cv.imshow(destCanvas, finalMat);

    return destCanvas.toDataURL('image/png');

  } catch (e) {
    return sourceCanvas.toDataURL();
  } finally {
    src.delete(); gray.delete(); binary.delete(); 
    if (resized && !resized.isDeleted()) resized.delete();
    if (finalMat && !finalMat.isDeleted()) finalMat.delete();
    if (contours && !contours.isDeleted()) contours.delete();
    if (hierarchy && !hierarchy.isDeleted()) hierarchy.delete();
    if (softMask && !softMask.isDeleted()) softMask.delete();
    if (tempRgba && !tempRgba.isDeleted()) tempRgba.delete();
  }
};

/**
 * Process an external image (e.g. from AI) using the simplified pipeline
 */
export const processExternalImage = async (
  imageUrl: string,
  sensitivity: number = 15, // Unused for AI mode now, kept for compatibility
  outputWidth: number = 452,
  outputHeight: number = 224
): Promise<string> => {
  await loadOpenCV();
  const cv = window.cv;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Fill with white first to ensure consistent background for transparent inputs
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      try {
        // Use the simplified AI processing pipeline
        const result = processAISignatureWithOpenCV(canvas, outputWidth, outputHeight, cv);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};
