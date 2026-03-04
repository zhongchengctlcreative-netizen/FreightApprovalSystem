
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FreightRequest, FileObject } from '../types';
import { fileService } from '../services/fileService';
import { Loader2, UploadCloud, File as FileIcon, Trash2, AlertTriangle, Paperclip, Image as ImageIcon, X, ZoomIn, Eye, Plus } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface FileManagementProps {
  request: FreightRequest;
  canUpload: boolean;
}

const formatFileSize = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const isImageFile = (filename: string) => {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename);
};

const FileManagement: React.FC<FileManagementProps> = ({ request, canUpload }) => {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingIdentifier, setDeletingIdentifier] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<FileObject | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fileList = await fileService.listFiles(request.id);
      setFiles(fileList as FileObject[]);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch files.');
    } finally {
      setLoading(false);
    }
  }, [request.id]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const processFiles = async (filesToProcess: File[]) => {
    if (filesToProcess.length === 0) return;

    setUploading(true);
    setError(null);

    const uploadPromises = filesToProcess.map(async (file: File) => {
      let fileToUpload = file;
      
      // Perform Image Compression if it's an image
      if (file.type.startsWith('image/')) {
        try {
          console.log(`Compressing ${file.name} (${formatFileSize(file.size)})...`);
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
            initialQuality: 0.8
          };
          fileToUpload = await imageCompression(file, options);
          console.log(`Compressed ${file.name} to ${formatFileSize(fileToUpload.size)}`);
        } catch (compressionError) {
          console.error("Compression failed, uploading original:", compressionError);
        }
      }

      return fileService.uploadFile(request.id, fileToUpload);
    });

    try {
      await Promise.all(uploadPromises);
    } catch (e: any) {
      setError(e.message || 'An error occurred during upload.');
    } finally {
      setUploading(false);
      if(fileInputRef.current) fileInputRef.current.value = "";
      if(imageInputRef.current) imageInputRef.current.value = "";
      fetchFiles();
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (!selectedFiles) return;
    await processFiles(Array.from(selectedFiles));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (!canUpload) return;
    const items = e.clipboardData.items;
    const filesToUpload: File[] = [];

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                const file = new File([blob], `pasted_image_${Date.now()}_${i}.png`, { type: blob.type });
                filesToUpload.push(file);
            }
        }
    }

    if (filesToUpload.length > 0) {
        await processFiles(filesToUpload);
    }
  };

  const handleRequestDelete = (e: React.MouseEvent, file: FileObject) => {
    e.preventDefault();
    e.stopPropagation();
    setFileToDelete(file);
  };

  const confirmDelete = async () => {
    if (!fileToDelete) return;
    const file = fileToDelete;
    setFileToDelete(null);
    const identifier = file.id || file.name;
    setDeletingIdentifier(identifier);
    setError(null);

    try {
      await fileService.deleteFile(request.id, file.name);
      await fetchFiles();
    } catch (e: any) {
      setError(e.message || 'Failed to delete file.');
    } finally {
      setDeletingIdentifier(null);
    }
  };
  
  const handleView = (fileName: string) => {
    const url = fileService.getPublicUrl(request.id, fileName);
    if(url) {
      if (isImageFile(fileName)) setLightboxUrl(url);
      else window.open(url, '_blank');
    } else {
      setError("Could not generate view link.");
    }
  };

  const docs = files.filter(f => !isImageFile(f.name));
  const images = files.filter(f => isImageFile(f.name));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 relative pdf-hidden">
      
      {/* Document Section */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Paperclip size={16} className="text-slate-500" />
          Attached Documents
        </h3>
        {canUpload && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-xs font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {uploading ? 'Processing...' : 'Upload Files'}
          </button>
        )}
        <input type="file" multiple ref={fileInputRef} onChange={handleUpload} className="hidden" disabled={!canUpload} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-lg mb-4 flex items-center gap-2 animate-fade-in">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="space-y-2 mb-6">
        {loading && files.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Loader2 size={24} className="animate-spin mx-auto" />
          </div>
        ) : docs.length > 0 ? (
          docs.map(file => {
            const identifier = file.id || file.name;
            const isDeleting = deletingIdentifier === identifier;
            return (
              <div key={identifier} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                <div className="p-2 bg-slate-100 rounded text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <FileIcon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate cursor-pointer hover:text-indigo-600 transition-colors" title={file.name} onClick={() => handleView(file.name)}>{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.metadata?.size || 0)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => handleView(file.name)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="View File"><Eye size={16} /></button>
                  {canUpload && (
                    <button type="button" onClick={(e) => handleRequestDelete(e, file)} disabled={isDeleting} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50" title="Delete">
                      {isDeleting ? <Loader2 size={16} className="animate-spin text-red-500" /> : <Trash2 size={16} />}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          !loading && files.length === 0 && (
            <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-lg">
              <p className="text-sm text-slate-500">No documents attached.</p>
            </div>
          )
        )}
      </div>

      {/* NEW: Dedicated Image Upload Area */}
      {canUpload && (
        <div 
            className="mb-6 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer flex flex-col items-center justify-center outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 group"
            onClick={() => imageInputRef.current?.click()}
            onPaste={handlePaste}
            tabIndex={0}
        >
            <input 
                type="file" 
                accept="image/*" 
                multiple 
                ref={imageInputRef} 
                className="hidden" 
                onChange={handleUpload} 
                disabled={uploading}
            />
            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3 group-hover:bg-white group-hover:text-indigo-600 group-hover:shadow-sm transition-all">
                {uploading ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
            </div>
            <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-800 transition-colors">
                {uploading ? 'Uploading...' : <>Click to insert image or <span className="text-indigo-600 bg-indigo-100 px-1 rounded">Ctrl+V</span> to paste</>}
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG, WEBP, GIF</p>
        </div>
      )}

      {(images.length > 0) && (
        <div className="border-t border-slate-100 pt-4 animate-fade-in">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
            <ImageIcon size={16} className="text-indigo-500" />
            Image Previews
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map(img => {
              const url = fileService.getPublicUrl(request.id, img.name);
              const identifier = img.id || img.name;
              const isDeleting = deletingIdentifier === identifier;

              return (
                <div key={identifier} className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm hover:shadow-md transition-all">
                  {url ? (
                    <img 
                      src={url} 
                      alt={img.name} 
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageIcon size={24} /></div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 cursor-zoom-in" onClick={() => url && setLightboxUrl(url)}>
                    <div className="flex justify-end">
                      {canUpload && (
                        <button onClick={(e) => { e.stopPropagation(); handleRequestDelete(e, img); }} disabled={isDeleting} className="p-1.5 bg-white/90 text-red-600 rounded-full hover:bg-white hover:scale-110 transition-all shadow-sm">
                          {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white font-bold text-xs bg-black/20 p-1 rounded backdrop-blur-sm pointer-events-none self-center mb-4">
                      <ZoomIn size={14} /> Full View
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm px-2 py-1 text-[10px] text-slate-700 truncate font-medium border-t border-slate-100">
                    {img.name}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fileToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in no-print" onClick={() => setFileToDelete(null)}>
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600"><Trash2 size={24} /></div>
              <div><h4 className="text-lg font-bold text-slate-800">Delete File?</h4><p className="text-sm text-slate-500 mt-2">Are you sure you want to delete <span className="font-semibold text-slate-900">{fileToDelete.name}</span>?</p></div>
              <div className="flex gap-3 w-full mt-2"><button onClick={() => setFileToDelete(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors">Cancel</button><button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm">Delete</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Portal */}
      {lightboxUrl && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4 animate-fade-in no-print" onClick={() => setLightboxUrl(null)}>
           <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 bg-white/10 rounded-full"><X size={32} /></button>
           <img src={lightboxUrl} className="max-w-full max-h-[90vh] rounded shadow-2xl animate-fade-in-up object-contain" onClick={(e) => e.stopPropagation()} alt="Full preview" />
        </div>,
        document.body
      )}
    </div>
  );
};

export default FileManagement;
