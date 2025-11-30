import { Client } from "@gradio/client";

export interface GradioGalleryItem {
  image: {
    path: string;
    url: string;
    orig_name?: string;
    size?: number;
    mime_type?: string;
  };
  caption?: string | null;
}

export async function extractSignatures(
  imageFile: File | Blob, 
  boxes?: {x: number, y: number, width: number, height: number}[],
  onResult?: (items: GradioGalleryItem[]) => void
): Promise<GradioGalleryItem[]> {
  try {
    const client = await Client.connect("ZHEJI/signature-extractor");
    
    // If boxes are provided, we should ideally crop the image client-side or pass boxes if API supports it.
    // Assuming the Gradio API currently only accepts a full image and extracts EVERYTHING it finds,
    // or we need to crop client-side and send multiple requests (parallelized).
    
    // STRATEGY: 
    // If boxes are provided, we crop the image for each box and send requests in parallel.
    // If no boxes (full image mode), we send the whole image.
    
    if (boxes && boxes.length > 0) {
        // Client-side cropping with Padding to help AI detection
        // AI models often fail if the object touches the image boundary or is too small.
        // We place the crop on a larger "virtual paper" to simulate a document.
        const CANVAS_SIZE = 800; // Standardize input size to something significant
        
        const imageBitmap = await createImageBitmap(imageFile);
        const blobs = [];

        for (const box of boxes) {
            const canvas = document.createElement('canvas');
            // We want to keep the original resolution of the signature, but place it on a large white background.
            // If the signature is huge (>800), we expand the canvas.
            // If it's small, we keep the canvas at 800 to provide context.
            const targetWidth = Math.max(CANVAS_SIZE, box.width + 200);
            const targetHeight = Math.max(CANVAS_SIZE, box.height + 200);

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            
            // Fill with white background (simulating clean paper)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the image in the center
            const x = (targetWidth - box.width) / 2;
            const y = (targetHeight - box.height) / 2;
            ctx.drawImage(imageBitmap, box.x, box.y, box.width, box.height, x, y, box.width, box.height);
            
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (blob) blobs.push(blob);
        }
        
        // Send requests in PARALLEL to allow incremental display
        const promises = blobs.map(async (blob) => {
            try {
                const result = await client.predict("/extract_all_signatures", {
                    image: blob,
                });
                
                if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                     const signatures = result.data[0] as GradioGalleryItem[];
                     // Trigger callback immediately when this box is done
                     if (onResult) {
                        onResult(signatures);
                     }
                     return signatures;
                }
            } catch (e) {
                // Silently fail for individual boxes
            }
            return [] as GradioGalleryItem[];
        });
        
        // Wait for all to complete for the final return value (if needed)
        const resultsArrays = await Promise.all(promises);
        return resultsArrays.flat();
        
    } else {
        // Full image mode (legacy behavior)
        const result = await client.predict("/extract_all_signatures", {
          image: imageFile,
        });
    
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          const items = result.data[0] as GradioGalleryItem[];
          if (onResult) onResult(items);
          return items;
        }
        return [];
    }

  } catch (error) {
    console.error("Error calling Gradio API:", error);
    throw error;
  }
}
