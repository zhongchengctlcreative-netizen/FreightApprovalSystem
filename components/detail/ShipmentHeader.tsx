
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { FreightRequest, RequestStatus } from '../../types';
import { ArrowLeft, Edit2, Save, Download, Loader2, FileText, Image as ImageIcon, CheckCircle, MoreHorizontal, History } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { fileService } from '../../services/fileService';

interface ShipmentHeaderProps {
  request: FreightRequest;
  isEditing: boolean;
  onBack: () => void;
  backLabel?: string;
  onToggleEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const ShipmentHeader: React.FC<ShipmentHeaderProps> = ({ request, isEditing, onBack, onToggleEdit, onSave, onCancel }) => {
  const { success, error } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('Initializing...');
  
  const state = location.state as { from?: string; search?: string } | null;
  const fromPath = state?.from;
  const previousSearch = state?.search;

  const backLabel = fromPath === 'grid' ? 'Back to Shipment Data' : 'Back to Approvals';
  
  const handleBack = () => {
      const target = fromPath === 'grid' ? '/shipments' : '/approvals';
      navigate(
          { pathname: target, search: previousSearch },
          { state: { lastId: request.id } } // Pass the ID back to restore scroll position/highlight
      );
  };

  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

  // Helper to allow UI updates between heavy synchronous tasks
  const nextStep = async (status: string) => {
      setPdfStatus(status);
      await new Promise(resolve => setTimeout(resolve, 50));
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    
    // Save current scroll position
    const scrollY = window.scrollY;
    
    try {
        await nextStep('Loading PDF libraries...');
        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
        const html2canvas = (await import('html2canvas')).default;

        await nextStep('Preparing layout...');
        document.body.classList.add('generating-pdf'); 
        window.scrollTo(0, 0); 

        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);
        const pageHeightAvailable = pageHeight - (margin * 2);
        
        let cursorY = margin;

        // --- PAGE 1+: SHIPMENT DETAILS ---
        const reportElement = document.getElementById('printable-report');
        if (reportElement) {
            await new Promise(resolve => setTimeout(resolve, 800));
            await nextStep('Capturing shipment details...');
            
            const canvas = await html2canvas(reportElement, {
                scale: 2, 
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                height: reportElement.scrollHeight,
                windowHeight: reportElement.scrollHeight + 100
            });

            if (canvas.width > 0 && canvas.height > 0) {
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const imgHeight = (canvas.height * contentWidth) / canvas.width;
                
                if (imgHeight <= pageHeightAvailable) {
                    // Fits on single page
                    doc.addImage(imgData, 'JPEG', margin, cursorY, contentWidth, imgHeight);
                    cursorY += imgHeight + 10;
                } else {
                    // Spans multiple pages
                    let heightLeft = imgHeight;
                    let position = margin; // Start at top margin

                    // Draw first page
                    doc.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
                    heightLeft -= pageHeightAvailable;

                    // Add pages
                    while (heightLeft > 0) {
                        position = position - pageHeightAvailable; 
                        doc.addPage();
                        doc.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
                        heightLeft -= pageHeightAvailable;
                    }
                    
                    // Reset cursor on the last page based on remaining content height
                    // heightLeft is negative here, representing the empty space at bottom. 
                    // Content ends at: pageHeightAvailable + heightLeft (which subtracts the empty space)
                    cursorY = margin + (pageHeightAvailable + heightLeft) + 10;
                }
            }
        }

        // --- HISTORY ---
        const historyElement = document.getElementById('pdf-history-section');
        if (historyElement) {
            await nextStep('Processing audit history...');
            
            const originalDisplay = historyElement.style.display;
            historyElement.classList.remove('hidden');
            historyElement.style.display = 'block'; 
            
            await new Promise(resolve => setTimeout(resolve, 100));

            const histCanvas = await html2canvas(historyElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            historyElement.style.display = originalDisplay;
            historyElement.classList.add('hidden');
            
            if (histCanvas.width > 0 && histCanvas.height > 0) {
                const histImgData = histCanvas.toDataURL('image/jpeg', 0.95);
                const histHeight = (histCanvas.height * contentWidth) / histCanvas.width;
                
                // Check if it fits on current page
                if (cursorY + histHeight > pageHeight - margin) {
                    doc.addPage();
                    cursorY = margin;
                }
                
                if (Number.isFinite(histHeight) && histHeight > 0) {
                    doc.addImage(histImgData, 'JPEG', margin, cursorY, contentWidth, histHeight);
                    cursorY += histHeight + 10; 
                }
            }
        }

        // --- IMAGES ---
        await nextStep('Fetching attached images...');
        const fileList = await fileService.listFiles(request.id);
        const imageFiles = fileList.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name));

        if (imageFiles.length > 0) {
            // Check if title fits
            if (cursorY > pageHeight - margin - 20) {
                doc.addPage();
                cursorY = margin;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Attached Images', margin, cursorY);
            cursorY += 8;

            for (let i = 0; i < imageFiles.length; i++) {
                const imgFile = imageFiles[i];
                await nextStep(`Embedding image ${i + 1} of ${imageFiles.length}...`);
                
                try {
                    const url = fileService.getPublicUrl(request.id, imgFile.name);
                    if (!url) continue;

                    const response = await fetch(url);
                    const blob = await response.blob();
                    
                    const base64 = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });

                    const imgProps = doc.getImageProperties(base64);
                    const imgW = imgProps.width;
                    const imgH = imgProps.height;
                    
                    if (!imgW || !imgH) continue;

                    const remainingHeight = pageHeight - margin - cursorY;
                    const imgRatio = imgW / imgH;

                    let finalW = contentWidth;
                    let finalH = contentWidth / imgRatio;

                    // Fit on current page if possible, else new page
                    if (finalH > remainingHeight) {
                        doc.addPage();
                        cursorY = margin;
                        
                        // Recalculate dimensions for full new page constraint
                        const fullPageHeight = pageHeight - (margin * 2);
                        if (finalH > fullPageHeight) {
                             finalH = fullPageHeight;
                             finalW = finalH * imgRatio;
                        }
                    }

                    const x = margin + (contentWidth - finalW) / 2;

                    if (Number.isFinite(finalW) && Number.isFinite(finalH) && finalW > 0 && finalH > 0) {
                        doc.addImage(base64, 'JPEG', x, cursorY, finalW, finalH);
                        cursorY += finalH + 5; 
                    }

                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(100);
                    
                    if (cursorY > pageHeight - margin) {
                        doc.addPage();
                        cursorY = margin;
                    }
                    doc.text(imgFile.name, margin, cursorY);
                    cursorY += 10;

                } catch (e) {
                    console.error("Error embedding image:", imgFile.name, e);
                }
            }
        }

        await nextStep('Finalizing PDF...');
        doc.save(`FreightGuard_Audit_${request.id}.pdf`);
        success("PDF downloaded successfully.");

    } catch (e: any) {
        console.error(e);
        error("PDF generation failed: " + e.message);
    } finally {
        document.body.classList.remove('generating-pdf');
        setIsGeneratingPdf(false);
        window.scrollTo(0, scrollY);
    }
  };

  const statusColor = {
    [RequestStatus.APPROVED]: 'bg-green-100 text-green-800 border-green-200',
    [RequestStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
    [RequestStatus.PENDING]: 'bg-amber-100 text-amber-800 border-amber-200',
    [RequestStatus.PENDING_L2]: 'bg-blue-100 text-blue-800 border-blue-200',
    [RequestStatus.FLAGGED]: 'bg-orange-100 text-orange-800 border-orange-200',
    [RequestStatus.CANCELLED]: 'bg-slate-100 text-slate-800 border-slate-200',
  };

  const getStatusLabel = (status: RequestStatus) => {
    if (status === RequestStatus.PENDING) return 'PENDING L1';
    if (status === RequestStatus.PENDING_L2) return 'PENDING L2';
    return status;
  };

  return (
    <>
      <div className="mb-4 md:mb-6 flex flex-wrap items-center justify-between gap-3 pdf-hidden">
        
        <button onClick={handleBack} className="flex items-center text-slate-500 hover:text-slate-800 transition-colors font-medium">
          <ArrowLeft size={20} className="mr-2" /> 
          <span className="hidden md:inline">{backLabel}</span>
          <span className="md:hidden">Back</span>
        </button>
        
        <div className="flex items-center gap-2 md:gap-3">
          <button 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 bg-slate-900 border border-slate-800 text-white rounded-full text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              title="Download PDF"
          >
              {isGeneratingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="hidden md:inline">{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
          </button>

          {!isEditing ? (
            <button onClick={onToggleEdit} className="flex items-center gap-2 px-3 py-1.5 md:px-4 bg-white border border-slate-200 text-slate-700 rounded-full text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm">
              <Edit2 size={14} /> 
              <span className="hidden md:inline">Edit Details</span>
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={onCancel} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={onSave} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-full text-sm font-semibold hover:bg-indigo-700 shadow-sm"><Save size={14} /> <span className="hidden md:inline">Save</span></button>
            </div>
          )}
          <div className={`px-3 py-1.5 md:px-4 rounded-full border text-[10px] md:text-sm font-bold uppercase tracking-wide whitespace-nowrap ${statusColor[request.status]}`}>
            {getStatusLabel(request.status)}
          </div>
        </div>
      </div>

      {/* PDF Generation Overlay */}
      {isGeneratingPdf && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white/95 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-2xl border border-slate-100 flex flex-col items-center max-w-sm w-full text-center relative overflow-hidden">
                {/* Progress Bar background decoration */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-pulse"></div>
                
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative">
                    <Loader2 size={40} className="text-indigo-600 animate-spin absolute" />
                    <FileText size={20} className="text-indigo-400 opacity-50" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 mb-2">Generating Report</h3>
                <p className="text-slate-500 text-sm mb-6 min-h-[20px] font-medium animate-pulse">{pdfStatus}</p>
                
                <div className="flex flex-col gap-2 w-full text-xs text-slate-400 border-t border-slate-100 pt-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        <span>Shipment Details Captured</span>
                    </div>
                    <div className={`flex items-center gap-2 transition-colors ${pdfStatus.includes('images') || pdfStatus.includes('Finalizing') ? 'text-slate-600' : 'text-slate-300'}`}>
                        {pdfStatus.includes('images') || pdfStatus.includes('Finalizing') ? <Loader2 size={14} className="animate-spin text-indigo-500" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200"></div>}
                        <span>Processing High-Res Images</span>
                    </div>
                </div>
            </div>
            <p className="mt-8 text-slate-400 text-xs font-medium uppercase tracking-widest">FreightGuard Approval System</p>
        </div>,
        document.body
      )}

      {/* Hidden History Section for PDF Generation Only - Manually toggled during capture */}
      <div id="pdf-history-section" className="hidden bg-white rounded-xl border border-slate-200 p-6 mt-6 w-[800px]">
         <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
            <History size={16} className="text-slate-400" /> Audit History
         </h3>
         <div className="relative border-l-2 border-slate-100 ml-2 space-y-8 pb-2">
            
            {/* 1. Submission */}
            <div className="ml-4 relative">
               <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-slate-200 border-4 border-white shadow-sm"></div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.submissionDate)}</p>
               <p className="text-sm font-bold text-slate-800">Request Submitted</p>
               <p className="text-xs text-slate-500">by {request.requester}</p>
            </div>
            
            {/* 2. Previous Rejection */}
            {request.rejectionDate && request.status !== RequestStatus.REJECTED && request.status !== RequestStatus.CANCELLED && (
                <div className="ml-4 relative">
                  <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-red-300 border-4 border-white shadow-sm"></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.rejectionDate)}</p>
                  <p className="text-sm font-bold text-red-800">Previously Rejected</p>
                  <p className="text-xs text-slate-500">by <span className="font-semibold text-slate-700">{request.rejectedBy || 'Unknown'}</span></p>
                  {request.rejectionReason && <p className="text-xs text-slate-500 mt-1 bg-red-50 p-2 rounded-md italic border border-red-100">"{request.rejectionReason}"</p>}
                </div>
            )}

            {/* 3. Resubmission */}
            {request.resubmissionDate && (
                <div className="ml-4 relative">
                  <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-4 border-white shadow-sm"></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.resubmissionDate)}</p>
                  <p className="text-sm font-bold text-indigo-700">Resubmitted</p>
                  {request.resubmissionNote && <p className="text-xs text-slate-500 mt-1 bg-indigo-50 p-2 rounded-md italic border border-indigo-100">"{request.resubmissionNote}"</p>}
                </div>
            )}

            {/* 4. L1 Approval */}
            {request.l1ApprovalDate && (
              <div className="ml-4 relative">
                <div className="absolute -left-[25px] top-0 w-4 h-4 rounded-full bg-amber-500 border-4 border-white shadow-sm"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{formatDate(request.l1ApprovalDate)}</p>
                <p className="text-sm font-bold text-amber-700">Level 1 Approved</p>
                <p className="text-xs text-slate-500">by <span className="font-semibold text-slate-700">{request.l1ApprovedBy || 'Unknown'}</span></p>
                {request.l1ApprovalRemark && <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded-md italic border border-slate-100">"{request.l1ApprovalRemark}"</p>}
              </div>
            )}

            {/* 5. Final Status */}
            {(request.status === RequestStatus.APPROVED || request.status === RequestStatus.REJECTED || request.status === RequestStatus.CANCELLED) && (
              <div className="ml-4 relative">
                <div className={`absolute -left-[25px] top-0 w-4 h-4 rounded-full border-4 border-white shadow-sm ${
                    request.status === 'APPROVED' ? 'bg-green-500' : 
                    request.status === 'REJECTED' ? 'bg-red-500' : 'bg-slate-500'
                }`}></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    {formatDate(request.approvalDate || request.rejectionDate || request.cancellationDate)}
                </p>
                <p className={`text-sm font-bold ${
                    request.status === 'APPROVED' ? 'text-green-700' : 
                    request.status === 'REJECTED' ? 'text-red-700' : 'text-slate-800'
                }`}>
                    Request {request.status}
                </p>
                <p className="text-xs text-slate-500">
                    by <span className="font-semibold text-slate-700">{request.approvedBy || request.rejectedBy || request.cancelledBy || 'Unknown'}</span>
                </p>
                {(request.approvalRemark || (request.status === 'REJECTED' && request.rejectionReason) || request.cancellationReason) && (
                    <p className="text-xs text-slate-500 mt-1 bg-slate-50 p-2 rounded-md italic border border-slate-100">
                        "{request.approvalRemark || (request.status === 'REJECTED' ? request.rejectionReason : request.cancellationReason)}"
                    </p>
                )}
              </div>
            )}
         </div>
      </div>
    </>
  );
};

export default ShipmentHeader;
