import React, { useState, useEffect } from 'react';
import { processSignatureRegions, recommendSensitivity } from './services/imageProcessing';
import { analyzeImageWithAI, getAIConfig, saveAIConfig, AIConfig } from './services/aiService';
import { ProcessedSignature, ProcessingStatus, SelectionBox, Theme, ProcessingMode } from './types';
import { Button } from './components/Button';
import { SignatureCard } from './components/SignatureCard';
import { ImageEditor } from './components/ImageEditor';
import { Logo } from './components/Logo';
import { SignatureLightbox } from './components/SignatureLightbox';
import { AiHelpModal } from './components/AiHelpModal';


const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isRecomputing, setIsRecomputing] = useState(false); // New state for background updates
  
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('local');
  const [signatures, setSignatures] = useState<ProcessedSignature[]>([]);
  const [sensitivity, setSensitivity] = useState<number>(20);
  // Default dimensions 452x224
  const [outputSize, setOutputSize] = useState<{width: number, height: number}>({ width: 452, height: 224 });
  
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  
  // Editor State
  const [detectedBoxes, setDetectedBoxes] = useState<SelectionBox[]>([]);
  const [imgDims, setImgDims] = useState<{w: number, h: number}>({ w: 0, h: 0 });

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

  // Load AI Config on Mount
  useEffect(() => {
    setAiConfig(getAIConfig());
  }, []);

  // Handle Scroll for Auto-hiding Header
  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        // Scrolling Down & past threshold -> Hide
        setShowHeader(false);
      } else {
        // Scrolling Up -> Show
        setShowHeader(true);
      }
      
      lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const processFile = async (file: File) => {
    if (!file) return;
    
    setCurrentFile(file);
    const objectUrl = URL.createObjectURL(file);
    setOriginalImage(objectUrl);
    
    // Load image to get dimensions, then go straight to editor (Empty state)
    const img = new Image();
    img.onload = async () => {
      setImgDims({ w: img.width, h: img.height });
      setDetectedBoxes([]); // No initial boxes
      
      // Auto-recommend sensitivity threshold
      try {
        const recommended = await recommendSensitivity(file);
        setSensitivity(recommended);
      } catch (e) {
        // Keep default sensitivity
      }
      
      setStatus(ProcessingStatus.EDITING);
    };
    img.src = objectUrl;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
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
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const handleProcessFromEditor = async (boxes: SelectionBox[], mode: 'local' | 'ai' = 'local') => {
    if (!currentFile) return;
    
    // 1. Save History immediately
    setDetectedBoxes(boxes);

    let boxesToProcess = boxes;
    // Fallback: If no boxes drawn, use the entire image
    if (boxesToProcess.length === 0) {
      boxesToProcess = [{
        id: 'full-image',
        x: 0,
        y: 0,
        width: imgDims.w,
        height: imgDims.h
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
        setSignatures([]);
        
        // Get the cropped image for the first box (assuming single selection for now, or loop)
        // Currently AI analysis is done on the whole file or we can crop.
        // To match the flow, let's crop the first box to send to AI for analysis
        // Or send the whole file and ask it to focus on the box?
        // Simpler: Send the cropped canvas.

        const img = new Image();
        if (originalImage) img.src = originalImage;
        await new Promise(r => { if (img.complete) r(true); else { img.onload = () => r(true); img.onerror = () => r(true); }});

        const box = boxesToProcess[0]; // Analyze the first box to get parameters
        
        const canvas = document.createElement('canvas');
        canvas.width = box.width;
        canvas.height = box.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
             ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
             
             // Convert canvas to blob
             const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg'));
             if (blob) {
                 console.log("Sending to AI for analysis...");
                 const analysis = await analyzeImageWithAI(blob);
                 console.log("AI Suggested Sensitivity:", analysis.recommendedSensitivity);
                 console.log("AI Reasoning:", analysis.reasoning);
                 
                 // Update sensitivity with AI's recommendation
                 setSensitivity(analysis.recommendedSensitivity);
                 
                 // Now run the standard local processing with this new sensitivity
                 // effectively "driving" the local algorithm with AI intelligence
                 await processSignatureRegions(
                    currentFile, 
                    boxesToProcess, 
                    analysis.recommendedSensitivity,
                    outputSize.width,
                    outputSize.height,
                    (signature, index, total) => {
                      setSignatures(prev => [...prev, { ...signature, annotation: `AI: ${analysis.reasoning.slice(0, 20)}...` }]);
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

    // 3. Standard Local Mode (OpenCV)
    try {
      setStatus(ProcessingStatus.PROCESSING);
      setSignatures([]); // Clear previous results
      
      // Stream processing: process one signature at a time
      await processSignatureRegions(
        currentFile, 
        boxesToProcess, 
        sensitivity,
        outputSize.width,
        outputSize.height,
        (signature, index, total) => {
          // Add each processed signature immediately
          setSignatures(prev => [...prev, signature]);
        }
      );
      
      setStatus(ProcessingStatus.COMPLETED);
    } catch (e) {
      console.error(e);
      setStatus(ProcessingStatus.ERROR);
    }
  };

  const reProcessSignatures = async (newSensitivity: number, newWidth: number, newHeight: number) => {
     if (!currentFile || detectedBoxes.length === 0) return;
     
     // Use local loading state to prevent unmounting the results view
     setIsRecomputing(true);
     
     try {
       // For reprocessing, we update existing signatures in place
       const existingSignatures = [...signatures];
       
       // Whether in Local or AI mode, reprocessing always uses the local algorithm 
       // with the updated parameters (sensitivity/size).
       let updateIndex = 0;
       await processSignatureRegions(
         currentFile, 
         detectedBoxes, 
         newSensitivity, 
         newWidth, 
         newHeight,
         (newSig, index, total) => {
           // Update existing signature at the same index
           if (updateIndex < existingSignatures.length) {
             const existing = existingSignatures[updateIndex];
             setSignatures(prev => {
               const updated = [...prev];
               const idx = updated.findIndex(s => s.id === existing.id);
               if (idx >= 0) {
                 // Keep the annotation (e.g., AI reasoning or user notes)
                 updated[idx] = { ...newSig, annotation: existing.annotation };
               }
               return updated;
             });
             updateIndex++;
           }
         }
       );
     } catch (e) {
       console.error(e);
       // Optional: Show toast error
     } finally {
       setIsRecomputing(false);
     }
  };

  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setSensitivity(val);
    if (status === ProcessingStatus.COMPLETED) {
      reProcessSignatures(val, outputSize.width, outputSize.height);
    }
  };

  const handleOutputSizeChange = (key: 'width' | 'height', val: string) => {
    const num = parseInt(val);
    if (isNaN(num) || num <= 0) return;
    
    const newSize = { ...outputSize, [key]: num };
    setOutputSize(newSize);
  };

  const handleOutputSizeBlur = () => {
    if (status === ProcessingStatus.COMPLETED) {
      reProcessSignatures(sensitivity, outputSize.width, outputSize.height);
    }
  };

  const handleUpdateAnnotation = (id: string, text: string) => {
    setSignatures(prev => prev.map(sig => 
      sig.id === id ? { ...sig, annotation: text } : sig
    ));
  };

  const handleDownloadAll = () => {
    if (signatures.length === 0) return;
    signatures.forEach((sig, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = sig.processedDataUrl;
        const name = sig.annotation ? sig.annotation : `签名_${idx + 1}`;
        link.download = `电子签名_${name}_${sig.width}x${sig.height}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, idx * 250); 
    });
  };

  const handleReset = () => {
    setStatus(ProcessingStatus.IDLE);
    setSignatures([]);
    setOriginalImage(null);
    setCurrentFile(null);
    setDetectedBoxes([]);
    setIsRecomputing(false);
  };

  const handleBackToEditor = () => {
    setStatus(ProcessingStatus.EDITING);
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
    ? 'bg-slate-900/80 backdrop-blur border border-slate-800 shadow-2xl rounded-2xl'
    : 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[2rem] shadow-slate-200/50';

  // Use flexbox layout to ensure footer stays at bottom
  const layoutClass = `min-h-screen font-sans flex flex-col relative transition-colors duration-500 ${mainBgClass}`;

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

      {/* Header */}
      {status !== ProcessingStatus.EDITING && (
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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className={`p-2 sm:p-2.5 rounded-full transition-all touch-manipulation ${isCyber ? 'bg-slate-800 text-cyan-400 hover:bg-slate-700 active:scale-95' : 'bg-white text-slate-800 shadow-sm hover:shadow-md active:scale-95'}`}
                title="切换主题"
              >
                {isCyber ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>

              {status !== ProcessingStatus.IDLE && (
                <Button variant="ghost" onClick={handleReset} className="text-xs px-3 py-2 touch-manipulation" theme={theme}>
                  <span className="hidden sm:inline">{isCyber ? '// 重置系统' : '重新开始'}</span>
                  <span className="sm:hidden">{isCyber ? '重置' : '重置'}</span>
                </Button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Full Screen Editor Mode */}
      {status === ProcessingStatus.EDITING && originalImage && (
        <ImageEditor 
          imageUrl={originalImage}
          initialBoxes={detectedBoxes}
          originalWidth={imgDims.w}
          originalHeight={imgDims.h}
          onConfirm={(boxes) => handleProcessFromEditor(boxes, 'local')}
          onProcessWithAI={(boxes) => handleProcessFromEditor(boxes, 'ai')}
          onCancel={handleReset}
          theme={theme}
        />
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
                    <svg className={`w-8 h-8 sm:w-10 sm:h-10 ${isCyber ? 'text-cyan-500' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                  </div>
                  <p className={`mb-2 text-sm sm:text-base font-bold uppercase tracking-wider ${isCyber ? 'text-cyan-100' : 'text-slate-700'}`}>
                    {isCyber ? '点击或拖拽上传数据' : '点击或拖拽上传图片'}
                  </p>
                  <p className={`text-xs sm:text-sm ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400'}`}>支持 JPG, PNG 格式输入</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>


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
                     {isCyber ? `计数: ${String(signatures.length).padStart(2, '0')}` : `已生成 ${signatures.length} 个`}
                   </div>
                   <Button variant="secondary" onClick={handleBackToEditor} className="text-xs px-3 sm:px-4 py-2 flex-1 sm:flex-none touch-manipulation" theme={theme}>
                    {isCyber ? '// 编辑目标' : '调整选区'}
                   </Button>
                   <Button onClick={handleDownloadAll} className="text-xs px-3 sm:px-4 py-2 flex-1 sm:flex-none touch-manipulation" theme={theme}>
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
                   <Button variant="ghost" onClick={handleBackToEditor} theme={theme}>返回编辑器</Button>
                 </div>
              )}
            </div>
          )}

          {status === ProcessingStatus.ERROR && (
            <div className="text-center mt-24">
               <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${isCyber ? 'bg-red-900/20 text-red-500 border border-red-500/50' : 'bg-red-50 text-red-500'}`}>
                 <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v1m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
               </div>
               <h3 className={`text-xl font-bold mb-2 ${isCyber ? 'text-red-400 font-mono uppercase tracking-widest' : 'text-slate-900'}`}>
                 {isCyber ? '系统错误' : '处理失败'}
               </h3>
               <p className={`mb-8 ${isCyber ? 'text-slate-500 font-mono text-sm' : 'text-slate-500'}`}>
                 {isCyber ? '处理失败，数据流已损坏。' : '抱歉，图片处理过程中出现了错误。'}
               </p>
               <Button onClick={handleReset} variant="secondary" theme={theme}>重试连接</Button>
            </div>
          )}

        </main>
      )}

      {/* Footer */}
      {status !== ProcessingStatus.EDITING && (
        <footer className={`w-full py-4 sm:py-6 mt-auto z-10 relative ${isCyber ? 'border-t border-slate-800' : 'border-t border-slate-200/50'}`}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <p className={`text-center text-xs sm:text-sm ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
              © {new Date().getFullYear()} - 吉庆喆版权所有
            </p>
          </div>
        </footer>
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
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
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
    </div>
  );
};

export default App;