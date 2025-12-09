import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { processSignatureRegions, recommendSensitivity } from './services/imageProcessing';
import { analyzeImageWithAI, getAIConfig, saveAIConfig, AIConfig } from './services/aiService';
import { ProcessedSignature, ProcessingStatus, SelectionBox, Theme, ProcessingMode, UploadedImage } from './types';
import { Button } from './components/Button';
import { SignatureCard } from './components/SignatureCard';
import { ImageEditor } from './components/ImageEditor';
import { Logo } from './components/Logo';
import { SignatureLightbox } from './components/SignatureLightbox';
import { AiHelpModal } from './components/AiHelpModal';
import { FolderNameModal } from './components/FolderNameModal';
import { DownloadProgress } from './components/DownloadProgress';
  import { 
    Trash2, 
    Upload, 
    Settings, 
    Sun, 
    Moon, 
    RotateCcw, 
    Link, 
    X, 
    HelpCircle, 
    AlertCircle, 
    Loader2,
    Image as ImageIcon,
    Plus,
    CloudUpload,
    Edit3,
    Download,
    ArrowLeft,
    Hash
  } from 'lucide-react';


const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isRecomputing, setIsRecomputing] = useState(false); // New state for background updates
  
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('local');
  const [signatures, setSignatures] = useState<ProcessedSignature[]>([]);
  const [defaultSensitivity, setDefaultSensitivity] = useState<number>(20);
  // Default dimensions 452x224
  const [outputSize, setOutputSize] = useState<{width: number, height: number}>({ width: 452, height: 224 });
  
  // Multi-Image State
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  
  // Computed active image
  const activeImage = uploadedImages.find(img => img.id === activeImageId) || null;
  const sensitivity = activeImage?.sensitivity || defaultSensitivity;

  // Theme State
  const [theme, setTheme] = useState<Theme>('ios');
  const isCyber = theme === 'cyberpunk';

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Scroll Header State
  const [showHeader, setShowHeader] = useState(true);
  
  // Drag State
  const [isDragging, setIsDragging] = useState(false);

  // AI Config State
  const [aiConfig, setAiConfig] = useState<AIConfig>({ endpoint: '', apiKey: '', model: '' });
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [showAiHelp, setShowAiHelp] = useState(false);

  // Download Modal State
  const [showFolderModal, setShowFolderModal] = useState(false);

  // URL Input State
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);

  // Batch Download Progress State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleUrlSubmit = async () => {
    if (!urlInput) return;
    setUrlLoading(true);
    try {
      const response = await fetch(urlInput);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const file = new File([blob], "url_image.png", { type: blob.type });
      await addFiles([file]);
      setShowUrlInput(false);
      setUrlInput('');
    } catch (error) {
      console.error("Error loading image from URL:", error);
      alert("无法加载图片，可能是跨域限制或链接无效。");
    } finally {
      setUrlLoading(false);
    }
  };

  // Load AI Config on Mount
  useEffect(() => {
    setAiConfig(getAIConfig());
  }, []);

  // Handle Scroll for Auto-hiding Header
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let lastScrollY = scrollContainer.scrollTop;
    
    const handleScroll = () => {
      const currentScrollY = scrollContainer.scrollTop;
      
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setShowHeader(false);
      } else {
        setShowHeader(true);
      }
      
      lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [status]);

  // Handle Paste Event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Allow paste in IDLE or EDITING
      if (status !== ProcessingStatus.IDLE && status !== ProcessingStatus.EDITING) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }
      if (files.length > 0) {
        addFiles(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [status]);

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;
    
    const newImages: UploadedImage[] = [];
    
    // Process sequentially to ensure order (though parallel is faster, order matters for UI)
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = async () => {
          let recommended = 20;
          try {
            recommended = await recommendSensitivity(file);
          } catch (e) {
            // Keep default
          }

          newImages.push({
            id: Date.now().toString() + Math.random().toString(36).slice(2),
            file,
            previewUrl: objectUrl,
            width: img.width,
            height: img.height,
            boxes: [], // No initial boxes
            sensitivity: recommended,
            name: file.name
          });
          resolve();
        };
        img.onerror = () => resolve();
        img.src = objectUrl;
      });
    }

    if (newImages.length > 0) {
      setUploadedImages(prev => [...prev, ...newImages]);
      
      // If first time adding, or specifically if we are in IDLE, switch to EDITING
      if (status === ProcessingStatus.IDLE) {
        setStatus(ProcessingStatus.EDITING);
        setActiveImageId(newImages[0].id);
      } else if (status === ProcessingStatus.EDITING && !activeImageId) {
        setActiveImageId(newImages[0].id);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addFiles(Array.from(files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const imageFiles = (Array.from(droppedFiles) as File[]).filter(f => f.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        addFiles(imageFiles);
      }
    }
  };

  const updateImageBoxes = (id: string, boxes: SelectionBox[]) => {
    setUploadedImages(prev => prev.map(img => 
      img.id === id ? { ...img, boxes } : img
    ));
  };

  const handleBoxesChange = useCallback((boxes: SelectionBox[]) => {
    if (!activeImageId) return;
    updateImageBoxes(activeImageId, boxes);
  }, [activeImageId]);

  const handleProcessFromEditor = async (boxes: SelectionBox[], mode: 'local' | 'ai' = 'local') => {
    if (!activeImage) return;
    
    // 1. Save History immediately
    updateImageBoxes(activeImage.id, boxes);

    let boxesToProcess = boxes;
    // Fallback: If no boxes drawn, use the entire image
    if (boxesToProcess.length === 0) {
      boxesToProcess = [{
        id: `full-image-${activeImage.id}`,
        x: 0,
        y: 0,
        width: activeImage.width,
        height: activeImage.height
      }];
    }

    setProcessingMode(mode);

    // 2. AI Mode
    if (mode === 'ai') {
      if (!aiConfig.apiKey) {
        setShowAiConfig(true);
        return;
      }

      try {
        setStatus(ProcessingStatus.PROCESSING);
        
        // Remove existing signatures for this image
        setSignatures(prev => prev.filter(s => s.sourceImageId !== activeImage.id));
        
        const img = new Image();
        if (activeImage.previewUrl) img.src = activeImage.previewUrl;
        await new Promise(r => { if (img.complete) r(true); else { img.onload = () => r(true); img.onerror = () => r(true); }});

        // Find the first target box (not exclude) for analysis
        const box = boxesToProcess.find(b => b.type !== 'exclude') || boxesToProcess[0];
        
        const canvas = document.createElement('canvas');
        canvas.width = box.width;
        canvas.height = box.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
             ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
             
             const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg'));
             if (blob) {
                 const analysis = await analyzeImageWithAI(blob);
                 
                 // Update sensitivity for this image
                 updateImageBoxes(activeImage.id, boxes); // Save boxes again just in case
                 setUploadedImages(prev => prev.map(img => 
                    img.id === activeImage.id ? { ...img, sensitivity: analysis.recommendedSensitivity } : img
                 ));
                 
                 await processSignatureRegions(
                    activeImage.file, 
                    boxesToProcess, 
                    analysis.recommendedSensitivity,
                    outputSize.width,
                    outputSize.height,
                    (signature, index, total) => {
                      setSignatures(prev => [...prev, { ...signature, sourceImageId: activeImage.id, annotation: `AI: ${analysis.reasoning.slice(0, 20)}...` }]);
                    }
                 );
             }
        }
        setStatus(ProcessingStatus.COMPLETED);
      } catch (e) {
        console.error("AI Processing Error", e);
        alert("AI 处理失败: 请检查配置是否正确。");
        setStatus(ProcessingStatus.ERROR);
      }
      return;
    }

    // 3. Standard Local Mode (OpenCV) - Batch Process All Images
    try {
      setStatus(ProcessingStatus.PROCESSING);
      setSignatures([]); // Clear previous results

      // Prepare list of images to process, ensuring current active image has latest boxes
      const imagesToProcess = uploadedImages.map(img => 
        img.id === activeImage.id ? { ...img, boxes: boxes } : img
      );

      const newSignatures: ProcessedSignature[] = [];

      // Process all images sequentially to avoid memory spikes
      const isMultiImage = imagesToProcess.length > 1;

      for (const img of imagesToProcess) {
        let imgBoxes = img.boxes;
        
        // If no boxes drawn:
        // - Multi-image mode: Skip this image (to avoid lag)
        // - Single-image mode: Fallback to processing the entire image
        if (imgBoxes.length === 0) {
          if (isMultiImage) {
            continue;
          }

          imgBoxes = [{
            id: `full-image-${img.id}`,
            x: 0,
            y: 0,
            width: img.width,
            height: img.height
          }];
        }

        await processSignatureRegions(
            img.file, 
            imgBoxes, 
            img.sensitivity,
            outputSize.width,
            outputSize.height,
            (signature) => {
              // Collect signatures as they are processed
              // We add sourceImageId to track origin
              newSignatures.push({ ...signature, sourceImageId: img.id });
              // Optional: Update state incrementally if we want real-time feedback
              // setSignatures(prev => [...prev, { ...signature, sourceImageId: img.id }]);
            }
        );
      }
      
      // Update state once with all results
      setSignatures(newSignatures);
      setStatus(ProcessingStatus.COMPLETED);

    } catch (e) {
      console.error(e);
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const reProcessSignatures = async (newSensitivity: number, newWidth: number, newHeight: number) => {
     if (!activeImage) return;
     
     // Prepare boxes logic matching handleProcessFromEditor
     let boxesToProcess = activeImage.boxes;
     if (boxesToProcess.length === 0) {
        boxesToProcess = [{
            id: `full-image-${activeImage.id}`,
            x: 0,
            y: 0,
            width: activeImage.width,
            height: activeImage.height
        }];
     }
     
     setIsRecomputing(true);
     
     try {
       await processSignatureRegions(
         activeImage.file, 
         boxesToProcess, 
         newSensitivity, 
         newWidth, 
         newHeight,
         (newSig, index, total) => {
           setSignatures(prev => {
             const updated = [...prev];
             // Update all signatures that match this ID (should be unique per image usually)
             // But if we have multiple signatures with same ID (bug), we update all?
             // Ideally we map.
             return updated.map(s => {
                 if (s.id === newSig.id && s.sourceImageId === activeImage.id) {
                     return {
                         ...newSig,
                         sourceImageId: activeImage.id,
                         annotation: s.annotation
                     };
                 }
                 return s;
             });
           });
         }
       );
     } catch (e) {
       console.error(e);
     } finally {
       setIsRecomputing(false);
     }
  };

  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (activeImage) {
        setUploadedImages(prev => prev.map(img => img.id === activeImage.id ? { ...img, sensitivity: val } : img));
        if (status === ProcessingStatus.COMPLETED) {
            reProcessSignatures(val, outputSize.width, outputSize.height);
        }
    } else {
        setDefaultSensitivity(val);
    }
  };

  const handleOutputSizeChange = (key: 'width' | 'height', val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num <= 0) return;
    
    const newSize = { ...outputSize, [key]: num };
    setOutputSize(newSize);
  };

  const handleOutputSizeBlur = () => {
    if (status === ProcessingStatus.COMPLETED && activeImage) {
      reProcessSignatures(activeImage.sensitivity, outputSize.width, outputSize.height);
    }
  };

  const handleUpdateAnnotation = (id: string, text: string) => {
    setSignatures(prev => prev.map(sig => 
      sig.id === id ? { ...sig, annotation: text } : sig
    ));
  };

  const handleDownloadAll = () => {
    if (signatures.length === 0) return;
    setShowFolderModal(true);
  };

  const handleConfirmDownload = async (folderName: string) => {
    setShowFolderModal(false);
    setIsDownloading(true);
    setDownloadTotal(signatures.length);
    setDownloadProgress(0);
    
    try {
      const zip = new JSZip();
      const folder = zip.folder(folderName);
      
      if (folder) {
        signatures.forEach((sig, idx) => {
          const name = sig.annotation ? sig.annotation : `签名_${idx + 1}`;
          const filename = `电子签名_${name}.png`;
          
          const base64Data = sig.processedDataUrl.split(',')[1];
          folder.file(filename, base64Data, { base64: true });
          
          // Update progress
          setDownloadProgress(idx + 1);
        });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${folderName}.zip`);
      
      // Reset progress after a short delay
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(0);
        setDownloadTotal(0);
      }, 500);
    } catch (error) {
      console.error("Failed to zip files:", error);
      alert("打包失败，请重试");
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadTotal(0);
    }
  };

  const handleReset = () => {
    setStatus(ProcessingStatus.IDLE);
    setSignatures([]);
    setUploadedImages([]);
    setActiveImageId(null);
    setIsRecomputing(false);
  };

  const handleBackToEditor = () => {
    setStatus(ProcessingStatus.EDITING);
  };

  const removeImage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent selecting the image
    const newImages = uploadedImages.filter(img => img.id !== id);
    
    if (newImages.length === 0) {
      handleReset(); // Go back to start if no images
    } else {
      setUploadedImages(newImages);
      if (activeImageId === id) {
        // If we removed the active image, select the first one (or adjacent)
        setActiveImageId(newImages[0].id);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'cyberpunk' ? 'ios' : 'cyberpunk');
  };

  // Theme-based Classes
  const mainBgClass = isCyber 
    ? 'bg-slate-950 text-cyan-50 selection:bg-cyan-500 selection:text-black' 
    : 'bg-[#F2F2F7] text-slate-900 selection:bg-blue-200 selection:text-blue-900';

  const headerClass = isCyber
    ? 'border-b border-slate-800 bg-slate-950/80 backdrop-blur-md'
    : 'border-b border-white/50 bg-white/70 backdrop-blur-xl shadow-sm';

  const toolbarClass = isCyber
    ? 'bg-slate-900/0 backdrop-blur-md border border-slate-800/50 shadow-2xl rounded-2xl'
    : 'bg-white/0 backdrop-blur-xl border border-white/40 shadow-xl rounded-[2rem] shadow-slate-200/50';

  // Use flexbox layout to ensure footer stays at bottom
  const layoutClass = `h-screen font-sans flex flex-col relative transition-colors duration-500 overflow-hidden ${mainBgClass}`;

  return (
    <div className={layoutClass}>
      {/* Background Effects */}
      {isCyber && (
        <>
          <div className="fixed inset-0 pointer-events-none z-0 bg-grid-pattern opacity-30"></div>
          <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/50 via-slate-950/80 to-slate-950"></div>
        </>
      )}
      {!isCyber && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
           <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/20 rounded-full blur-[100px] mesh-blob"></div>
           <div className="absolute bottom-[10%] right-[10%] w-[60%] h-[60%] bg-purple-400/20 rounded-full blur-[120px] mesh-blob" style={{animationDelay: '2s'}}></div>
           <div className="absolute top-[40%] left-[40%] w-[40%] h-[40%] bg-pink-300/20 rounded-full blur-[90px] mesh-blob" style={{animationDelay: '4s'}}></div>
        </div>
      )}

      {/* Full Screen Editor Mode */}
      {status === ProcessingStatus.EDITING && activeImage && (
        <div className="flex h-full w-full overflow-hidden">
             {/* Sidebar */}
             <div className={`w-20 sm:w-24 flex-shrink-0 flex flex-col px-3 z-20 m-4 rounded-3xl border shadow-2xl ${
                 isCyber ? 'bg-slate-900/10 backdrop-blur-md border-slate-800/50' : 'bg-white/10 backdrop-blur-xl border-white/40'
             }`} style={{ height: 'calc(100% - 2rem)' }}>
                 {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 pt-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                    {uploadedImages.map(img => (
                        <div 
                            key={img.id}
                            onClick={() => setActiveImageId(img.id)}
                            className={`flex-shrink-0 relative aspect-square cursor-pointer rounded-2xl overflow-hidden border-2 transition-all group ${
                                activeImageId === img.id 
                                    ? (isCyber ? 'border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'border-blue-500 ring-2 ring-blue-100')
                                    : 'border-transparent hover:border-gray-400 opacity-70 hover:opacity-100'
                            }`}
                        >
                            <img src={img.previewUrl} alt="thumbnail" className="w-full h-full object-cover" />
                            <div className={`absolute bottom-0 left-0 right-0 h-1 ${img.boxes.length > 0 ? (isCyber ? 'bg-cyan-500' : 'bg-blue-500') : 'bg-transparent'}`}></div>
                            
                            {/* Delete Button */}
                            <button 
                                onClick={(e) => removeImage(e, img.id)}
                                className={`absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 ${
                                    isCyber ? 'bg-black/60 text-red-400 hover:bg-red-900/80 hover:text-red-300' : 'bg-white/80 text-red-500 hover:bg-red-100 hover:text-red-600 shadow-sm'
                                }`}
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
                
                {/* Fixed Upload Button */}
                <label className={`mt-3 flex-shrink-0 aspect-square flex flex-col items-center justify-center cursor-pointer rounded-2xl border-2 border-dashed transition-all ${
                   isCyber 
                       ? 'border-slate-700 hover:border-cyan-500/50 hover:bg-slate-800 text-slate-500 hover:text-cyan-400' 
                       : 'border-gray-300 hover:border-blue-400 hover:bg-white text-gray-400 hover:text-blue-500'
                }`}>
                   <input 
                       type="file" 
                       multiple 
                       accept="image/*" 
                       className="hidden" 
                       onChange={(e) => {
                           if(e.target.files && e.target.files.length > 0) addFiles(Array.from(e.target.files));
                       }}
                   />
                   <Plus className="w-6 h-6" />
                </label>

                 {/* Counter Footer */}
                 <div className={`flex-shrink-0 py-2 text-center text-xs font-medium ${
                     isCyber ? 'text-cyan-400/70' : 'text-slate-500'
                 }`}>
                     {uploadedImages.findIndex(img => img.id === activeImageId) + 1} / {uploadedImages.length}
                 </div>
             </div>
 
             {/* Editor Area */}
             <div className="flex-1 relative h-full overflow-hidden bg-black/5">
                <ImageEditor 
                  key={activeImage.id}
                  imageUrl={activeImage.previewUrl}
                  initialBoxes={activeImage.boxes}
                  originalWidth={activeImage.width}
                  originalHeight={activeImage.height}
                  onConfirm={(boxes) => handleProcessFromEditor(boxes, 'local')}
                  onProcessWithAI={(boxes) => handleProcessFromEditor(boxes, 'ai')}
                  onCancel={handleReset}
                 onBoxesChange={handleBoxesChange}
                 theme={theme}
                 onToggleTheme={toggleTheme}
               />
             </div>
        </div>
      )}

      {/* Scrollable Content Area */}
      {status !== ProcessingStatus.EDITING && (
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col relative z-10 h-full w-full">
          {/* Header */}
      {status !== ProcessingStatus.EDITING && !lightboxOpen && (
        <header 
          className={`${headerClass} sticky top-0 z-50 transition-transform duration-500 ease-in-out ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
            <div className="cursor-pointer group" onClick={handleReset}>
              <Logo theme={theme} />
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Settings Button */}
              <button 
                onClick={() => setShowAiConfig(true)}
                className={`p-2 sm:p-2.5 rounded-full transition-all touch-manipulation ${isCyber ? 'bg-slate-800 text-cyan-400 hover:bg-slate-700 active:scale-95' : 'bg-white text-slate-800 shadow-sm hover:shadow-md active:scale-95'}`}
                title="设置 AI API"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className={`p-2 sm:p-2.5 rounded-full transition-all touch-manipulation ${isCyber ? 'bg-slate-800 text-cyan-400 hover:bg-slate-700 active:scale-95' : 'bg-white text-slate-800 shadow-sm hover:shadow-md active:scale-95'}`}
                title="切换主题"
              >
                {isCyber ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              {status !== ProcessingStatus.IDLE && (
                <Button variant="ghost" onClick={handleReset} className="text-xs px-3 py-2 touch-manipulation flex items-center gap-1" theme={theme}>
                  <RotateCcw className="w-4 h-4" />
                  <span className="hidden sm:inline">{isCyber ? '// 重置系统' : '重新开始'}</span>
                  <span className="sm:hidden">{isCyber ? '重置' : '重置'}</span>
                </Button>
              )}
            </div>
          </div>
        </header>
      )}


      {/* Main Content */}
      {(status !== ProcessingStatus.EDITING) && (
        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 w-full z-10 relative">
        
          {/* Intro / Upload Section */}
          {status === ProcessingStatus.IDLE && (
            <div className="max-w-xl mx-auto text-center py-6 sm:py-12 animate-fade-in">
              {isCyber && (
                <div className="mb-6 sm:mb-8 inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-cyan-950/30 border border-cyan-900 text-cyan-400 text-[10px] sm:text-xs font-mono tracking-widest uppercase shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                  SYSTEM ONLINE // 系统联机
                </div>
              )}
              {!isCyber && (
                <div className="mb-6 sm:mb-8 inline-block px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white/50 border border-white/60 text-blue-600 text-[10px] sm:text-xs font-bold tracking-wide shadow-sm backdrop-blur">
                  智能识别 · 纯净输出
                </div>
              )}

              <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-6 sm:mb-8 tracking-tight ${isCyber ? 'text-white' : 'text-slate-900'}`}>
                数字签名 <br/> 
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isCyber ? 'from-cyan-400 to-blue-500' : 'from-blue-600 to-violet-600'}`}>
                  提取转换系统
                </span>
              </h2>
              
              <p className={`mb-8 sm:mb-12 leading-relaxed text-sm sm:text-base max-w-md mx-auto px-4 ${isCyber ? 'text-slate-400 font-mono' : 'text-slate-500 font-sans'}`}>
                {isCyber ? '> 上传手写图像数据' : '上传手写照片'}<br/>
                {isCyber ? '> 手动锁定签名边界' : '选择签名区域'}<br/>
                {isCyber ? '> 生成二值化矢量级输出' : '一键生成透明底电子签名'}
              </p>
              
              <label 
                className={`group relative flex flex-col items-center justify-center w-full h-56 sm:h-72 border-2 border-dashed rounded-2xl sm:rounded-3xl cursor-pointer transition-all touch-manipulation ${isCyber ? (isDragging ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_30px_rgba(6,182,212,0.3)] scale-[1.02]' : 'border-cyan-500/30 bg-slate-900/50 active:bg-cyan-950/10 active:border-cyan-400 active:shadow-[0_0_30px_rgba(6,182,212,0.15)]') : (isDragging ? 'border-blue-500 bg-blue-50/80 shadow-xl scale-[1.02]' : 'border-slate-300 bg-white/40 active:bg-white/60 active:border-blue-400 active:shadow-xl active:scale-[1.02] backdrop-blur-sm')}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 sm:mb-6 group-active:scale-110 transition-transform ${isCyber ? 'bg-slate-800 border border-slate-700 group-active:border-cyan-500/50' : 'bg-white shadow-lg text-blue-500'}`}>
                    <CloudUpload className={`w-8 h-8 sm:w-10 sm:h-10 ${isCyber ? 'text-cyan-500' : 'text-blue-600'}`} />
                  </div>
                  <p className={`mb-2 text-sm sm:text-base font-bold uppercase tracking-wider ${isCyber ? 'text-cyan-100' : 'text-slate-700'}`}>
                    {isCyber ? '点击、拖拽或粘贴上传数据' : '点击、拖拽或粘贴上传图片'}
                  </p>
                  <p className={`text-xs sm:text-sm ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400'}`}>支持 JPG, PNG等 格式输入，可直接粘贴截图</p>
                </div>
                <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileUpload} />
              </label>

              {/* URL Input */}
              <div className={`mt-8 mx-auto transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${showUrlInput ? 'w-full max-w-lg px-4' : 'w-44'}`}>
                <div className="relative h-12">
                  {/* Button State */}
                  <div className={`absolute inset-0 w-full h-full transition-all duration-300 ${showUrlInput ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}>
                    <button 
                      onClick={() => setShowUrlInput(true)} 
                      className={`group w-full h-full flex items-center justify-center gap-2 rounded-full text-sm font-medium transition-all duration-300 ${
                        isCyber
                          ? 'bg-cyan-950/20 border border-cyan-900/50 text-cyan-400 hover:bg-cyan-950/40 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-white border border-slate-200 text-slate-600 shadow-sm hover:shadow-md hover:text-blue-600 hover:border-blue-200'
                      }`}
                    >
                      <Link className="w-4 h-4 opacity-70" />
                      <span>输入链接</span>
                    </button>
                  </div>

                  {/* Input State */}
                  <div className={`absolute inset-0 w-full h-full flex items-center gap-3 transition-all duration-500 delay-75 ${showUrlInput ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                    <div className={`flex-1 h-full flex items-center rounded-full overflow-hidden border transition-colors ${
                      isCyber 
                        ? 'bg-slate-900/80 border-slate-700 shadow-inner' 
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}>
                      <div className={`pl-4 flex-shrink-0 ${isCyber ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Link className="w-4 h-4" />
                      </div>
                      <input 
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className={`flex-1 h-full bg-transparent border-none outline-none px-3 text-sm ${
                          isCyber
                            ? 'text-white placeholder-slate-600'
                            : 'text-slate-800 placeholder-slate-400'
                        }`}
                        onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                        autoFocus={showUrlInput}
                      />
                      <button 
                         onClick={handleUrlSubmit}
                         disabled={urlLoading}
                         className={`h-full px-6 flex items-center justify-center text-sm font-medium transition-all whitespace-nowrap ${
                           isCyber
                             ? 'bg-cyan-950/40 text-cyan-400 hover:bg-cyan-500 hover:text-black border-l border-slate-700'
                             : 'bg-black text-white hover:bg-gray-800'
                         }`}
                       >
                        {urlLoading ? (
                          <Loader2 className="animate-spin h-4 w-4" />
                        ) : '确定'}
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => setShowUrlInput(false)}
                      className={`h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-full transition-all ${isCyber ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>


            </div>
          )}

          {/* Testing Page */}


          {/* Processing States (Initial) */}
          {(status === ProcessingStatus.DETECTING || status === ProcessingStatus.PROCESSING) && (
            <div className="flex flex-col items-center justify-center h-80">
              <div className="relative w-20 h-20">
                 <div className={`absolute inset-0 border-4 rounded-full ${isCyber ? 'border-slate-800' : 'border-slate-200'}`}></div>
                 <div className={`absolute inset-0 border-4 border-t-transparent rounded-full animate-spin ${isCyber ? 'border-cyan-500' : 'border-blue-500'}`}></div>
              </div>
              <p className={`mt-8 font-medium tracking-widest text-sm animate-pulse ${isCyber ? 'text-cyan-400 font-mono uppercase' : 'text-slate-600 font-sans'}`}>
                {status === ProcessingStatus.DETECTING 
                  ? (isCyber ? '>> 正在解析矩阵数据...' : '正在分析图片...') 
                  : (isCyber ? '>> 正在渲染最终输出...' : '正在生成电子签名...')}
              </p>
            </div>
          )}

          {/* Results Section */}
          {status === ProcessingStatus.COMPLETED && (
            <div className="animate-fade-in">
              {/* Controls Toolbar */}
              <div className={`${toolbarClass} p-4 sm:p-5 mb-6 sm:mb-10 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-4 sm:gap-6 sticky z-20 transition-all duration-500 ease-in-out ${showHeader ? 'top-20 sm:top-28' : 'top-4 sm:top-6'}`}>
                
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-4 sm:gap-8 w-full sm:w-auto">
                  {/* Sensitivity Control (Hidden in AI mode) */}
                  {processingMode !== 'ai' && (
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 sm:flex-none">
                      <span className={`text-xs font-bold uppercase whitespace-nowrap ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
                        提取阈值
                      </span>
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-none">
                        <input 
                          type="range" 
                          min="5" 
                          max="40" 
                          value={sensitivity} 
                          onChange={handleSensitivityChange}
                          className={`flex-1 sm:w-32 h-2 sm:h-1.5 rounded-lg appearance-none cursor-pointer touch-manipulation ${isCyber ? 'bg-slate-700 accent-cyan-500' : 'bg-slate-200 accent-blue-500'}`}
                        />
                        <span className={`text-xs px-2.5 py-1 rounded font-medium min-w-[30px] text-center ${isCyber ? 'bg-slate-800 border border-slate-700 text-cyan-400 font-mono' : 'bg-white shadow-sm text-slate-600 font-sans'}`}>
                          {sensitivity}
                        </span>
                      </div>
                    </div>
                  )}
                  

                  {/* Dimension Control */}
                  <div className={`flex items-center gap-3 sm:gap-4 ${isCyber ? 'sm:border-l border-slate-800 sm:pl-8' : 'sm:border-l border-slate-200 sm:pl-8'}`}>
                    <span className={`text-xs font-bold uppercase whitespace-nowrap ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
                      {isCyber ? '分辨率矩阵' : '输出尺寸'}
                    </span>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className={`text-[10px] ${isCyber ? 'text-slate-600 font-mono' : 'text-slate-400'}`}>宽</span>
                        <input 
                          type="number" 
                          value={outputSize.width}
                          onChange={(e) => handleOutputSizeChange('width', e.target.value)}
                          onBlur={handleOutputSizeBlur}
                          className={`w-16 sm:w-20 px-2 sm:px-3 py-1.5 rounded-lg text-center text-xs focus:outline-none focus:ring-2 transition-all touch-manipulation ${isCyber ? 'bg-slate-950 border border-slate-700 text-cyan-50 focus:border-cyan-500 font-mono' : 'bg-slate-100 border-transparent text-slate-800 focus:bg-white focus:shadow-sm font-sans'}`}
                        />
                      </div>
                      <span className="text-slate-400">×</span>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className={`text-[10px] ${isCyber ? 'text-slate-600 font-mono' : 'text-slate-400'}`}>高</span>
                        <input 
                          type="number" 
                          value={outputSize.height}
                          onChange={(e) => handleOutputSizeChange('height', e.target.value)}
                          onBlur={handleOutputSizeBlur}
                          className={`w-16 sm:w-20 px-2 sm:px-3 py-1.5 rounded-lg text-center text-xs focus:outline-none focus:ring-2 transition-all touch-manipulation ${isCyber ? 'bg-slate-950 border border-slate-700 text-cyan-50 focus:border-cyan-500 font-mono' : 'bg-slate-100 border-transparent text-slate-800 focus:bg-white focus:shadow-sm font-sans'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto sm:ml-auto">
                   <div className={`text-xs font-medium hidden lg:block mr-4 ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
                     <span className="inline-flex items-center gap-1">
                       <Hash className="w-3 h-3" />
                       {isCyber ? `计数: ${String(signatures.length).padStart(2, '0')}` : `已生成 ${signatures.length} 个`}
                     </span>
                   </div>
                   <Button variant="secondary" onClick={handleBackToEditor} className="text-xs px-3 sm:px-4 py-2 flex-1 sm:flex-none touch-manipulation" theme={theme}>
                     <Edit3 className="w-4 h-4 mr-1" />
                     {isCyber ? '// 编辑目标' : '调整选区'}
                   </Button>
                   <Button onClick={handleDownloadAll} className="text-xs px-3 sm:px-4 py-2 flex-1 sm:flex-none touch-manipulation" theme={theme}>
                     <Download className="w-4 h-4 mr-1" />
                     {isCyber ? '批量下载' : '全部保存'}
                   </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {signatures.map((sig, idx) => (
                  <SignatureCard 
                    key={sig.id} 
                    signature={sig} 
                    index={idx} 
                    onUpdateAnnotation={handleUpdateAnnotation}
                    onPreview={(index) => {
                      setLightboxIndex(index);
                      setLightboxOpen(true);
                    }}
                    theme={theme}
                    isUpdating={isRecomputing}
                  />
                ))}
              </div>

              {/* Global Lightbox */}
              <SignatureLightbox
                signatures={signatures}
                currentIndex={lightboxIndex}
                isOpen={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                theme={theme}
              />

              {signatures.length === 0 && (
                 <div className={`text-center py-16 rounded-2xl border-2 border-dashed mt-8 ${isCyber ? 'bg-slate-900/30 border-slate-800' : 'bg-white/40 border-slate-200'}`}>
                   <p className={`mb-6 text-sm ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>未生成目标数据</p>
                   <Button variant="ghost" onClick={handleBackToEditor} theme={theme}>
                     <ArrowLeft className="w-4 h-4 mr-1" />
                     返回编辑器
                   </Button>
                 </div>
              )}
            </div>
          )}

          {status === ProcessingStatus.ERROR && (
            <div className="text-center mt-24">
               <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isCyber ? 'bg-red-900/20 text-red-500 border border-red-500/50' : 'bg-red-50 text-red-500'}`}>
                 <AlertCircle className="w-10 h-10" />
               </div>
               <h3 className={`text-xl font-bold mb-2 ${isCyber ? 'text-red-400 font-mono uppercase tracking-widest' : 'text-slate-900'}`}>
                 {isCyber ? '系统错误' : '处理失败'}
               </h3>
               <p className={`mb-8 ${isCyber ? 'text-slate-500 font-mono text-sm' : 'text-slate-500'}`}>
                 {isCyber ? '处理失败，数据流已损坏。' : '抱歉，图片处理过程中出现了错误。'}
               </p>
               <Button onClick={handleReset} variant="secondary" theme={theme}>
                 <RotateCcw className="w-4 h-4 mr-1" />
                 重试连接
               </Button>
            </div>
          )}

        </main>
      )}

      {/* Footer */}
      {status !== ProcessingStatus.EDITING && !lightboxOpen && (
        <footer className={`w-full py-4 sm:py-6 mt-auto z-10 relative ${isCyber ? 'border-t border-slate-800' : 'border-t border-slate-200/50'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className={`text-center text-xs sm:text-sm ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
              © {new Date().getFullYear()} - 吉庆喆
            </p>
          </div>
        </footer>
      )}

        </div>
      )}

      {/* AI Config Modal */}
      {showAiConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className={`p-6 rounded-2xl shadow-2xl w-96 max-w-[90%] ${isCyber ? 'bg-slate-900 border border-slate-800 text-white' : 'bg-white text-slate-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">通用 AI 设置</h3>
              <button 
                onClick={() => setShowAiHelp(true)}
                className={`p-1.5 rounded-full transition-colors ${isCyber ? 'hover:bg-slate-800 text-cyan-500' : 'hover:bg-slate-100 text-blue-500'}`}
                title="查看配置帮助"
              >
                <HelpCircle className="w-5 h-5" />
              </button>
            </div>
            <p className={`text-sm mb-4 ${isCyber ? 'text-slate-400' : 'text-slate-500'}`}>
              配置兼容 OpenAI 接口的 API 端点和密钥。
              配置仅保存在本地浏览器。
            </p>
            
            <div className="space-y-3">
              <div>
                <label className={`text-xs block mb-1 ${isCyber ? 'text-slate-500' : 'text-slate-500'}`}>API Endpoint</label>
                <input 
                  type="text" 
                  value={aiConfig.endpoint}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className={`w-full p-2 rounded-lg outline-none border text-sm ${isCyber ? 'bg-slate-950 border-slate-800 focus:border-cyan-500 text-white' : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900'}`}
                />
              </div>

              <div>
                <label className={`text-xs block mb-1 ${isCyber ? 'text-slate-500' : 'text-slate-500'}`}>API Key</label>
                <input 
                  type="password" 
                  value={aiConfig.apiKey}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className={`w-full p-2 rounded-lg outline-none border text-sm ${isCyber ? 'bg-slate-950 border-slate-800 focus:border-cyan-500 text-white' : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900'}`}
                />
              </div>

              <div>
                <label className={`text-xs block mb-1 ${isCyber ? 'text-slate-500' : 'text-slate-500'}`}>Model Name</label>
                <input 
                  type="text" 
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="gpt-4o / gemini-1.5-flash / deepseek-chat"
                  className={`w-full p-2 rounded-lg outline-none border text-sm ${isCyber ? 'bg-slate-950 border-slate-800 focus:border-cyan-500 text-white' : 'bg-slate-50 border-slate-200 focus:border-blue-500 text-slate-900'}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setShowAiConfig(false)} theme={theme}>取消</Button>
              <Button onClick={() => {
                saveAIConfig(aiConfig);
                setShowAiConfig(false);
              }} theme={theme}>保存</Button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showAiHelp && (
        <AiHelpModal onClose={() => setShowAiHelp(false)} theme={theme} />
      )}

      {/* Folder Name Modal */}
      <FolderNameModal 
        isOpen={showFolderModal}
        onClose={() => setShowFolderModal(false)}
        onConfirm={handleConfirmDownload}
        theme={theme}
      />

      {/* Download Progress Modal */}
      <DownloadProgress
        isDownloading={isDownloading}
        progress={downloadProgress}
        total={downloadTotal}
        theme={theme}
      />
    </div>
  );
};

export default App;
