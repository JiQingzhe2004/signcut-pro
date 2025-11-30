export interface ProcessedSignature {
  id: string;
  originalDataUrl: string; // The cropped raw image
  processedDataUrl: string; // The binarized 2:1 image
  width: number;
  height: number;
  annotation?: string; // User provided remark/name
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  DETECTING = 'DETECTING', // New step: Finding boxes
  EDITING = 'EDITING',     // New step: User manual selection
  PROCESSING = 'PROCESSING', // Final step: Generating images
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// User-facing selection box in the editor
export interface SelectionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Theme = 'cyberpunk' | 'ios';

export type ProcessingMode = 'local' | 'gradio';

