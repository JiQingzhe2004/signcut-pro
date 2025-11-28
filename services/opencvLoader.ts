
declare global {
  interface Window {
    cv: any;
  }
}

let cvPromise: Promise<void> | null = null;

export const loadOpenCV = (): Promise<void> => {
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    // If already loaded
    if (window.cv && window.cv.Mat) {
      resolve();
      return;
    }

    // Check periodically for the script to initialize
    const interval = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        clearInterval(interval);
        console.log('OpenCV.js loaded successfully');
        resolve();
      }
    }, 100);

    // Timeout safety
    setTimeout(() => {
      if (!window.cv || !window.cv.Mat) {
        clearInterval(interval);
        // We don't strictly reject, because sometimes it's just slow, 
        // but for UX we might want to know.
        console.warn('OpenCV load timeout - proceeding anyway (might fail if not ready)');
        resolve(); 
      }
    }, 10000); 
  });

  return cvPromise;
};
