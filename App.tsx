import React, { useState, useEffect } from 'react';
import { processSignatureRegions } from './services/imageProcessing';
import { ProcessedSignature, ProcessingStatus, SelectionBox, Theme } from './types';
import { Button } from './components/Button';
import { SignatureCard } from './components/SignatureCard';
import { ImageEditor } from './components/ImageEditor';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [isRecomputing, setIsRecomputing] = useState(false); // New state for background updates
  
  const [signatures, setSignatures] = useState<ProcessedSignature[]>([]);
  const [sensitivity, setSensitivity] = useState<number>(15);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setCurrentFile(file);
    const objectUrl = URL.createObjectURL(file);
    setOriginalImage(objectUrl);
    
    // Load image to get dimensions, then go straight to editor (Empty state)
    const img = new Image();
    img.onload = () => {
      setImgDims({ w: img.width, h: img.height });
      setDetectedBoxes([]); // No initial boxes
      setStatus(ProcessingStatus.EDITING);
    };
    img.src = objectUrl;
  };

  const handleProcessFromEditor = async (boxes: SelectionBox[]) => {
    if (!currentFile) return;
    
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

    try {
      setStatus(ProcessingStatus.PROCESSING);
      setDetectedBoxes(boxesToProcess); 
      
      const results = await processSignatureRegions(
        currentFile, 
        boxesToProcess, 
        sensitivity,
        outputSize.width,
        outputSize.height
      );
      setSignatures(results);
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
       const results = await processSignatureRegions(
         currentFile, 
         detectedBoxes, 
         newSensitivity, 
         newWidth, 
         newHeight
       );
       // Preserve annotations if ID matches
       setSignatures(prev => {
         return results.map(newSig => {
           const existing = prev.find(p => p.id === newSig.id);
           return existing ? { ...newSig, annotation: existing.annotation } : newSig;
         });
       });
       // We do NOT change status to PROCESSING here, so the view stays stable
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

  const logoBoxClass = isCyber
    ? 'bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)] rounded-lg'
    : 'bg-black text-white rounded-full shadow-lg';

  const logoTextMain = isCyber ? 'text-slate-100 font-mono' : 'text-slate-900 font-sans tracking-tight';
  const logoTextAccent = isCyber ? 'text-cyan-500' : 'text-blue-600 font-bold';

  const toolbarClass = isCyber
    ? 'bg-slate-900/80 backdrop-blur border border-slate-800 shadow-2xl rounded-2xl'
    : 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl rounded-[2rem] shadow-slate-200/50';

  // Only apply padding bottom if NOT editing to avoid scrollbars in full-screen editor
  const layoutClass = `min-h-screen font-sans flex flex-col relative transition-colors duration-500 ${mainBgClass} ${status === ProcessingStatus.EDITING ? '' : 'pb-20'}`;

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
        <header className={`${headerClass} sticky top-0 z-50 transition-all duration-300`}>
          <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4 cursor-pointer group" onClick={handleReset}>
              <div className={`w-10 h-10 flex items-center justify-center font-bold text-lg transition-all ${logoBoxClass}`}>
                S
              </div>
              <h1 className={`font-bold text-xl ${logoTextMain}`}>
                赛博签 <span className={logoTextAccent}>PRO</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className={`p-2 rounded-full transition-all ${isCyber ? 'bg-slate-800 text-cyan-400 hover:bg-slate-700' : 'bg-white text-slate-800 shadow-sm hover:shadow-md'}`}
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
                <Button variant="ghost" onClick={handleReset} className="text-xs" theme={theme}>
                  {isCyber ? '// 重置系统' : '重新开始'}
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
          onConfirm={handleProcessFromEditor}
          onCancel={handleReset}
          theme={theme}
        />
      )}

      {/* Main Content */}
      {(status !== ProcessingStatus.EDITING) && (
        <main className="max-w-6xl mx-auto px-6 py-10 flex-1 w-full z-10 relative">
        
          {/* Intro / Upload Section */}
          {status === ProcessingStatus.IDLE && (
            <div className="max-w-xl mx-auto text-center mt-24 animate-fade-in">
              {isCyber && (
                <div className="mb-8 inline-block px-4 py-1.5 rounded-full bg-cyan-950/30 border border-cyan-900 text-cyan-400 text-xs font-mono tracking-widest uppercase shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                  SYSTEM ONLINE // 系统联机
                </div>
              )}
              {!isCyber && (
                <div className="mb-8 inline-block px-4 py-1.5 rounded-full bg-white/50 border border-white/60 text-blue-600 text-xs font-bold tracking-wide shadow-sm backdrop-blur">
                  智能识别 · 纯净输出
                </div>
              )}

              <h2 className={`text-5xl font-bold mb-8 tracking-tight ${isCyber ? 'text-white' : 'text-slate-900'}`}>
                数字签名 <br/> 
                <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isCyber ? 'from-cyan-400 to-blue-500' : 'from-blue-600 to-violet-600'}`}>
                  提取转换系统
                </span>
              </h2>
              
              <p className={`mb-12 leading-relaxed text-base max-w-md mx-auto ${isCyber ? 'text-slate-400 font-mono' : 'text-slate-500 font-sans'}`}>
                {isCyber ? '> 上传手写图像数据' : '上传手写照片'}<br/>
                {isCyber ? '> 手动锁定签名边界' : '选择签名区域'}<br/>
                {isCyber ? '> 生成二值化矢量级输出' : '一键生成透明底电子签名'}
              </p>
              
              <label className={`group relative flex flex-col items-center justify-center w-full h-72 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${isCyber ? 'border-cyan-500/30 bg-slate-900/50 hover:bg-cyan-950/10 hover:border-cyan-400 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]' : 'border-slate-300 bg-white/40 hover:bg-white/60 hover:border-blue-400 hover:shadow-xl hover:scale-[1.02] backdrop-blur-sm'}`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${isCyber ? 'bg-slate-800 border border-slate-700 group-hover:border-cyan-500/50' : 'bg-white shadow-lg text-blue-500'}`}>
                    <svg className={`w-10 h-10 ${isCyber ? 'text-cyan-500' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                  </div>
                  <p className={`mb-2 text-base font-bold uppercase tracking-wider ${isCyber ? 'text-cyan-100' : 'text-slate-700'}`}>
                    {isCyber ? '初始化数据上传' : '点击上传图片'}
                  </p>
                  <p className={`text-sm ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400'}`}>支持 JPG, PNG 格式输入</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            </div>
          )}

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
              <div className={`${toolbarClass} p-5 mb-10 flex flex-wrap items-center justify-between gap-6 sticky top-28 z-20`}>
                
                <div className="flex flex-wrap items-center gap-8">
                  {/* Sensitivity Control */}
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-bold uppercase ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
                      提取阈值
                    </span>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" 
                        min="5" 
                        max="40" 
                        value={sensitivity} 
                        onChange={handleSensitivityChange}
                        className={`w-32 h-1.5 rounded-lg appearance-none cursor-pointer ${isCyber ? 'bg-slate-700 accent-cyan-500' : 'bg-slate-200 accent-blue-500'}`}
                      />
                      <span className={`text-xs px-2.5 py-1 rounded font-medium min-w-[30px] text-center ${isCyber ? 'bg-slate-800 border border-slate-700 text-cyan-400 font-mono' : 'bg-white shadow-sm text-slate-600 font-sans'}`}>
                        {sensitivity}
                      </span>
                    </div>
                  </div>

                  {/* Dimension Control */}
                  <div className={`flex items-center gap-4 pl-8 ${isCyber ? 'border-l border-slate-800' : 'border-l border-slate-200'}`}>
                    <span className={`text-xs font-bold uppercase ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
                      {isCyber ? '分辨率矩阵' : '输出尺寸'}
                    </span>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${isCyber ? 'text-slate-600 font-mono' : 'text-slate-400'}`}>宽</span>
                        <input 
                          type="number" 
                          value={outputSize.width}
                          onChange={(e) => handleOutputSizeChange('width', e.target.value)}
                          onBlur={handleOutputSizeBlur}
                          className={`w-20 px-3 py-1.5 rounded-lg text-center text-xs focus:outline-none focus:ring-2 transition-all ${isCyber ? 'bg-slate-950 border border-slate-700 text-cyan-50 focus:border-cyan-500 font-mono' : 'bg-slate-100 border-transparent text-slate-800 focus:bg-white focus:shadow-sm font-sans'}`}
                        />
                      </div>
                      <span className="text-slate-400">×</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] ${isCyber ? 'text-slate-600 font-mono' : 'text-slate-400'}`}>高</span>
                        <input 
                          type="number" 
                          value={outputSize.height}
                          onChange={(e) => handleOutputSizeChange('height', e.target.value)}
                          onBlur={handleOutputSizeBlur}
                          className={`w-20 px-3 py-1.5 rounded-lg text-center text-xs focus:outline-none focus:ring-2 transition-all ${isCyber ? 'bg-slate-950 border border-slate-700 text-cyan-50 focus:border-cyan-500 font-mono' : 'bg-slate-100 border-transparent text-slate-800 focus:bg-white focus:shadow-sm font-sans'}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 ml-auto">
                   <div className={`text-xs font-medium hidden lg:block mr-4 ${isCyber ? 'text-slate-500 font-mono' : 'text-slate-400 font-sans'}`}>
                     {isCyber ? `计数: ${String(signatures.length).padStart(2, '0')}` : `已生成 ${signatures.length} 个`}
                   </div>
                   <Button variant="secondary" onClick={handleBackToEditor} className="text-xs px-4" theme={theme}>
                    {isCyber ? '// 编辑目标' : '调整选区'}
                   </Button>
                   <Button onClick={handleDownloadAll} className="text-xs px-4" theme={theme}>
                     {isCyber ? '批量下载' : '全部保存'}
                   </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {signatures.map((sig, idx) => (
                  <SignatureCard 
                    key={sig.id} 
                    signature={sig} 
                    index={idx} 
                    onUpdateAnnotation={handleUpdateAnnotation}
                    theme={theme}
                    isUpdating={isRecomputing}
                  />
                ))}
              </div>

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
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
    </div>
  );
};

export default App;