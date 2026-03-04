
import React from 'react';
import { UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Box, Navigation, Container, Layers, Ship, Plane, Train, Truck } from 'lucide-react';
import { RequestFormValues } from '../../services/validationSchemas';
import AttachmentsSection from './AttachmentsSection';

interface CargoSectionProps {
  watch: UseFormWatch<RequestFormValues>;
  setValue: UseFormSetValue<RequestFormValues>;
  isMobile: boolean;
  // Attachments props passed down for mobile view integration
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

const CargoSection: React.FC<CargoSectionProps> = ({ 
  watch, setValue, isMobile,
  fileInputRef, files, handleFileChange, clearFiles, imageInputRef, images, handleImageChange, handlePaste, removeImage, imagePreviews, setLightboxUrl, attachContainerRef
}) => {
  const watchedMethod = watch('shippingMethod');

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-2">
        <Box size={16} className="text-indigo-500" /> Cargo & Logistics
      </h3>
      
      <div className="pt-2 space-y-4">
          <div>
             <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1"><Navigation size={14}/> Shipping Method</label>
             <div className="grid grid-cols-4 gap-2">
                {['Sea', 'Air', 'Rail', 'Road'].map(m => {
                    const Icon = m === 'Sea' ? Ship : m === 'Air' ? Plane : m === 'Rail' ? Train : Truck;
                    const isSelected = watchedMethod === m;
                    return (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setValue('shippingMethod', m)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                                isSelected 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm ring-1 ring-indigo-500' 
                                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                            <Icon size={20} className={`mb-1 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className="text-xs font-bold">{m}</span>
                        </button>
                    )
                })}
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1"><Container size={14}/> Container Size</label>
                 <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={watchedMethod === 'Air'}
                        onClick={() => setValue('containerSize', '')}
                        className={`px-2 py-2 rounded-lg border text-xs font-bold transition-all ${
                            !watch('containerSize') 
                            ? 'bg-slate-700 text-white border-slate-700 shadow-sm' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        N/A
                    </button>
                    {['20', '40', '40HC'].map(sz => (
                        <button
                            key={sz}
                            type="button"
                            disabled={watchedMethod === 'Air'}
                            onClick={() => setValue('containerSize', sz)}
                            className={`px-2 py-2 rounded-lg border text-xs font-bold transition-all ${
                                watch('containerSize') === sz 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {sz === '40HC' ? "40' HC" : `${sz}'`}
                        </button>
                    ))}
                 </div>
              </div>

              <div>
                 <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1"><Layers size={14}/> Conveyance</label>
                 <div className="flex gap-2 h-[42px]"> 
                     {['FCL', 'LCL'].map(mc => (
                        <button
                            key={mc}
                            type="button"
                            disabled={watchedMethod === 'Air'}
                            onClick={() => setValue('meansOfConveyance', mc)}
                            className={`flex-1 rounded-lg border text-xs font-bold transition-all ${
                                watch('meansOfConveyance') === mc
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {mc}
                        </button>
                     ))}
                 </div>
              </div>
          </div>
          
          {/* Attachments within Cargo Section for Mobile Flow */}
          {isMobile && (
            <AttachmentsSection 
                fileInputRef={fileInputRef}
                files={files}
                handleFileChange={handleFileChange}
                clearFiles={clearFiles}
                imageInputRef={imageInputRef}
                images={images}
                handleImageChange={handleImageChange}
                handlePaste={handlePaste}
                removeImage={removeImage}
                imagePreviews={imagePreviews}
                setLightboxUrl={setLightboxUrl}
                attachContainerRef={attachContainerRef}
            />
          )}
      </div>
    </div>
  );
};

export default CargoSection;
