
import React from 'react';
import { Paperclip, UploadCloud, ImageIcon, X } from 'lucide-react';

interface AttachmentsSectionProps {
  fileInputRef: React.RefObject<HTMLInputElement>;
  files: FileList | null;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clearFiles: (e: React.MouseEvent) => void;
  imageInputRef: React.RefObject<HTMLInputElement>;
  images: File[];
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  removeImage: (index: number) => void;
  imagePreviews: string[];
  setLightboxUrl: (url: string | null) => void;
  attachContainerRef: React.RefObject<HTMLDivElement>;
}

const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  fileInputRef, files, handleFileChange, clearFiles, imageInputRef, images, handleImageChange, handlePaste, removeImage, imagePreviews, setLightboxUrl, attachContainerRef
}) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
            <Paperclip size={16} className="text-indigo-500" /> Attachments
        </h3>
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-100 cursor-pointer flex flex-col items-center justify-center min-h-[120px]" onClick={() => fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                <UploadCloud size={24} className="text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-600">{files && files.length > 0 ? <span className="text-indigo-600">{files.length} Docs</span> : "Upload Docs"}</p>
                {files && files.length > 0 && <button type="button" onClick={clearFiles} className="mt-2 text-[10px] text-red-500 hover:underline">Clear</button>}
            </div>
            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-indigo-50 transition-all flex flex-col items-center justify-center min-h-[120px] relative focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-text" onPaste={handlePaste} onClick={(e) => e.currentTarget.focus()} tabIndex={0} ref={attachContainerRef}>
                <input ref={imageInputRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
                <ImageIcon size={24} className="text-slate-400 mb-2" />
                <div className="text-xs font-semibold text-slate-600">
                    {images.length > 0 ? <span className="text-indigo-600 block mb-1">{images.length} Images Added</span> : <span className="block mb-1">Paste Image</span>}
                    <button type="button" onClick={(e) => { e.stopPropagation(); imageInputRef.current?.click(); }} className="text-indigo-600 hover:underline font-bold">Browse</button>
                </div>
            </div>
        </div>
        {imagePreviews.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
                {imagePreviews.map((url, idx) => (
                    <div key={idx} className="relative flex-shrink-0 group">
                        <img src={url} onClick={() => setLightboxUrl(url)} className="w-14 h-14 object-cover rounded-lg border border-slate-200 cursor-pointer" alt="Preview" />
                        <button type="button" onClick={() => removeImage(idx)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

export default AttachmentsSection;
