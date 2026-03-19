
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from '../types';
import { forwarderService, Forwarder } from '../services/carrierService';
import { destinationService, Destination } from '../services/destinationService';
import { freightService } from '../services/freightService';
import { useToast } from '../contexts/ToastContext';
import { useNavigationBlocker } from '../contexts/NavigationBlockerContext';
import { Save, X, Bookmark, Hash, Copy, LogOut, Trash2, AlertCircle, ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requestSchema, RequestFormValues } from '../services/validationSchemas';

// Sub-components
import RouteSection from './forms/RouteSection';
import CargoSection from './forms/CargoSection';
import FinancialSection from './forms/FinancialSection';
import AttachmentsSection from './forms/AttachmentsSection';
import ApproverSection from './forms/ApproverSection';

interface NewRequestFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  currentUser: User | null;
  users: User[];
}

const DRAFT_KEY = 'freightguard_new_request_draft';

const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
};

const NewRequestForm: React.FC<NewRequestFormProps> = ({ onSubmit, onCancel, currentUser, users }) => {
  const { toast, success } = useToast();
  const { registerBlocker, confirmNavigation, cancelNavigation, pendingPath } = useNavigationBlocker();
  
  const [files, setFiles] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachContainerRef = useRef<HTMLDivElement>(null);
  
  const [ccList, setCcList] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [showCcDropdown, setShowCcDropdown] = useState(false);
  
  const [availableForwarders, setAvailableForwarders] = useState<Forwarder[]>([]);
  const [availableDests, setAvailableDests] = useState<Destination[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showNoApproverConfirmation, setShowNoApproverConfirmation] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [showDeleteDraftConfirmation, setShowDeleteDraftConfirmation] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<RequestFormValues | null>(null);

  const [nextSn, setNextSn] = useState<number | null>(null);

  const draftSavedRef = useRef(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  // Mobile Wizard State
  const [currentStep, setCurrentStep] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 1024);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { 
    register, 
    handleSubmit, 
    control, 
    watch, 
    setValue, 
    getValues,
    reset,
    trigger,
    formState: { errors, isSubmitting, isDirty } 
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      shippingMethod: 'Sea',
      meansOfConveyance: 'FCL',
      containerSize: '20',
      weight: undefined,
      price: undefined,
      inventoryValue: undefined,
      cartonCount: undefined,
      m3: undefined
    },
    mode: 'onChange'
  });

  useEffect(() => {
    const subscription = watch(() => {
        draftSavedRef.current = false;
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  useEffect(() => {
    if (files && files.length > 0) draftSavedRef.current = false;
  }, [files]);

  useEffect(() => {
    if (images.length > 0) draftSavedRef.current = false;
  }, [images]);

  const hasUnsavedWork = (isDirty || (files && files.length > 0) || images.length > 0) && !draftSavedRef.current;

  useEffect(() => {
    registerBlocker(() => {
      setShowExitConfirmation(true);
    }, hasUnsavedWork);
  }, [hasUnsavedWork, registerBlocker]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedWork]);

  const watchedMethod = watch('shippingMethod');
  const watchedOriginCode = watch('originCode');
  const watchedDestCode = watch('destCode');
  const watchedForwarder = watch('forwarder');
  const watchedEtd = watch('etd');
  const watchedFirstApprover = watch('firstApprover');

  useEffect(() => {
    const fetchSn = async () => {
      const date = watchedEtd ? new Date(watchedEtd) : new Date();
      const validDate = isNaN(date.getTime()) ? new Date() : date;
      const yy = Number(validDate.getFullYear().toString().slice(-2));
      const sn = await freightService.getNextSN(yy);
      setNextSn(sn);
    };
    fetchSn();
  }, [watchedEtd]);

  const logIdPreview = useMemo(() => {
    const date = watchedEtd ? new Date(watchedEtd) : new Date();
    const validDate = isNaN(date.getTime()) ? new Date() : date;
    const yy = validDate.getFullYear().toString().slice(-2);
    const week = getWeekNumber(validDate).toString().padStart(2, '0');
    
    const from = (watchedOriginCode || 'XXX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const to = (watchedDestCode || 'XXX').toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    const method = (watchedMethod || 'Sea').toLowerCase();
    const fwd = (watchedForwarder || '').toLowerCase();
    
    let suffix = `SWWK${week}`;
    if (method.includes('rail')) suffix = `RW${week}`;
    else if (method.includes('air')) {
        if (fwd.includes('dhl') || fwd.includes('fedex')) suffix = `AirW${week}`;
        else suffix = `AW${week}`;
    } else if (method.includes('road')) suffix = `AW${week}`;

    const snStr = nextSn ? nextSn.toString().padStart(5, '0') : '#####';

    return `${yy}-${snStr}-${from}-${to}-${suffix}`;
  }, [watchedOriginCode, watchedDestCode, watchedMethod, watchedForwarder, watchedEtd, nextSn]);

  useEffect(() => {
    const fetchData = async () => {
        const [forwarders, dests] = await Promise.all([
          forwarderService.getAllForwarders(),
          destinationService.getAll()
        ]);
        setAvailableForwarders(forwarders.filter(c => c.status === 'ACTIVE'));
        setAvailableDests(dests);
        setLoadingData(false);
    };
    fetchData();
  }, []);

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      setHasSavedDraft(true);
      try {
        const parsed = JSON.parse(savedDraft);
        reset(parsed);
        if (parsed.ccEmails) {
          setCcList(parsed.ccEmails.split(',').map((s: string) => s.trim()).filter(Boolean));
        }
        toast("Draft restored from previous session.", "info");
        draftSavedRef.current = true;
      } catch (e) {
        console.error("Failed to restore draft", e);
      }
    } else {
        setHasSavedDraft(false);
    }
  }, [reset, toast]);

  // Automatically default Approvers
  useEffect(() => {
    if (users.length > 0) {
        const firstDefault = users.find(u => u.name.toUpperCase().includes('KWAI PENG'));
        const secondDefault = users.find(u => u.name.toUpperCase().includes('KEN LIM'));

        const currentFirst = getValues('firstApprover');
        const currentSecond = getValues('secondApprover');

        // Only set if fields are currently empty (don't overwrite draft or user selection)
        if (firstDefault && firstDefault.email && !currentFirst) {
            setValue('firstApprover', firstDefault.email);
        }
        if (secondDefault && secondDefault.email && !currentSecond) {
            setValue('secondApprover', secondDefault.email);
        }
    }
  }, [users, setValue, getValues]);

  useEffect(() => {
    if (!images || images.length === 0) {
        setImagePreviews([]);
        return;
    }
    const newPreviews: string[] = [];
    images.forEach(file => {
        newPreviews.push(URL.createObjectURL(file));
    });
    setImagePreviews(newPreviews);
    return () => {
        newPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [images]);

  useEffect(() => {
    setValue('ccEmails', ccList.join(','));
  }, [ccList, setValue]);

  const originOptions = useMemo(() => {
    // Deduplicate by uppercase code, preferring master records
    const map = new Map<string, any>();
    availableDests.forEach(d => {
      const upperCode = d.code.toUpperCase().trim();
      if (!map.has(upperCode)) {
        map.set(upperCode, { label: d.description || upperCode, value: upperCode, subLabel: upperCode, original: d });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [availableDests]);

  const forwarderOptions = useMemo(() => 
    availableForwarders.map(c => ({ label: c.name, value: c.name, original: c })), 
  [availableForwarders]);

  const approvers = useMemo(() => {
    return users.filter(u => u.role === 'APPROVER' && u.status === 'ACTIVE' && u.email);
  }, [users]);

  const availableSecondApprovers = useMemo(() => {
    return approvers.filter(u => u.email !== watchedFirstApprover);
  }, [approvers, watchedFirstApprover]);

  const filteredCcUsers = useMemo(() => {
    const candidates = users.filter(u => !ccList.includes(u.email) && u.status === 'ACTIVE' && u.email);
    if (!ccInput) return candidates;
    const lower = ccInput.toLowerCase();
    return candidates.filter(u => (u.name && u.name.toLowerCase().includes(lower)) || (u.email && u.email.toLowerCase().includes(lower)));
  }, [users, ccInput, ccList]);

  const executeSubmission = (data: RequestFormValues) => {
    const allFiles = [...(files ? Array.from(files) : []), ...images];
    localStorage.removeItem(DRAFT_KEY);
    setHasSavedDraft(false);
    registerBlocker(() => {}, false);

    onSubmit({
      origin: data.originName,
      originCode: data.originCode,
      destination: data.destName,
      destCode: data.destCode,
      weight: data.weight || 0,
      price: data.price,
      inventoryValue: data.inventoryValue,
      commodity: data.commodity,
      etd: data.etd,
      eta: data.eta,
      forwarder: data.forwarder,
      carrier: data.carrier,
      vesselName: data.vesselName,
      containerSize: data.containerSize,
      shippingMethod: data.shippingMethod,
      meansOfConveyance: data.meansOfConveyance,
      cartonCount: data.cartonCount || 0,
      m3: data.m3 || 0,
      firstApprover: data.firstApprover,
      secondApprover: data.secondApprover || undefined,
      notifiedApprovers: [data.firstApprover, data.secondApprover].filter(Boolean),
      ccEmails: data.ccEmails,
      files: allFiles
    });
  };

  const handleFormSubmit = (data: any) => {
    const formData = data as RequestFormValues;
    if (!formData.firstApprover) {
      setPendingFormData(formData);
      setShowNoApproverConfirmation(true);
      return;
    }
    executeSubmission(formData);
  };

  const handleSaveDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    const currentValues = getValues();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(currentValues));
    draftSavedRef.current = true;
    setHasSavedDraft(true);
    success("Draft saved successfully (Attachments are not saved).");
  };

  const handleDeleteDraft = () => { setShowDeleteDraftConfirmation(true); };
  const confirmDeleteDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasSavedDraft(false);
    draftSavedRef.current = false;
    setShowDeleteDraftConfirmation(false);
    success("Draft deleted from local storage.");
  };

  const confirmSubmitWithoutApprover = () => {
    if (pendingFormData) executeSubmission(pendingFormData);
    setShowNoApproverConfirmation(false);
    setPendingFormData(null);
  };

  const handleCancelRequest = () => {
    if (hasUnsavedWork) setShowExitConfirmation(true);
    else onCancel();
  };

  const confirmExit = () => {
    setShowExitConfirmation(false);
    if (pendingPath) confirmNavigation();
    else onCancel();
  };

  const cancelExit = () => {
    setShowExitConfirmation(false);
    cancelNavigation();
  };

  const handleCopyPreview = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(logIdPreview);
    success("Log ID preview copied to clipboard");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (e.target.files.length > 3) {
        alert("You can only upload a maximum of 3 document files.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setFiles(null);
        return;
      }
      setFiles(e.target.files);
    }
  };

  const clearFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFiles(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      if (images.length + newFiles.length > 5) {
        alert("You can only upload a maximum of 5 images.");
        return;
      }
      setImages(prev => [...prev, ...newFiles]);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newImages: File[] = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const blob = items[i].getAsFile();
            if (blob) {
                const file = new File([blob], `pasted_image_${Date.now()}_${i}.png`, { type: blob.type });
                newImages.push(file);
            }
        }
    }
    if (newImages.length > 0) {
        if (images.length + newImages.length > 5) {
            alert("You can only upload a maximum of 5 images.");
            return;
        }
        setImages(prev => [...prev, ...newImages]);
    }
  };

  const removeImage = (index: number) => { setImages(prev => prev.filter((_, i) => i !== index)); };

  const addCcEmail = (email: string) => {
    if (email && !ccList.includes(email)) setCcList([...ccList, email]);
    setCcInput('');
    setShowCcDropdown(false);
  };

  const removeCcEmail = (email: string) => { setCcList(ccList.filter(e => e !== email)); };

  useEffect(() => {
    if (watchedMethod === 'Air') {
      setValue('containerSize', '');
      setValue('meansOfConveyance', '');
    } else {
      const currentSize = watch('containerSize');
      if (!currentSize) setValue('containerSize', '20');
      const currentConveyance = watch('meansOfConveyance');
      if (!currentConveyance) setValue('meansOfConveyance', 'FCL');
    }
  }, [watchedMethod, setValue, watch]);

  // Mobile Wizard Navigation
  const nextStep = async () => {
      let valid = false;
      if (currentStep === 0) {
          valid = await trigger(['originCode', 'destCode', 'etd', 'forwarder']);
      } else if (currentStep === 1) {
          valid = true;
      }
      
      if (valid) setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => setCurrentStep(prev => prev - 1);

  return (
    <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full animate-fade-in relative">
      <div className="p-4 md:p-6 border-b border-slate-200 bg-white flex flex-col md:flex-row justify-between items-start md:items-center sticky top-0 z-20 shadow-sm gap-2">
        <div className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">New Request</h2>
                <div className="hidden md:flex items-center gap-2 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                    <Hash size={14} className="text-slate-400" />
                    <span className="text-sm font-mono font-medium text-slate-600" title="Preview">{logIdPreview}</span>
                    <button type="button" onClick={handleCopyPreview} className="text-slate-400 hover:text-indigo-600 ml-1 p-0.5 rounded hover:bg-slate-200"><Copy size={14} /></button>
                </div>
            </div>
            <button onClick={handleCancelRequest} className="text-slate-400 hover:text-slate-600 md:hidden"><X size={24} /></button>
          </div>
          {isMobile ? (
              <div className="flex items-center gap-2 mt-3">
                  <div className={`h-2 rounded-full flex-1 transition-colors ${currentStep >= 0 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                  <div className={`h-2 rounded-full flex-1 transition-colors ${currentStep >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                  <div className={`h-2 rounded-full flex-1 transition-colors ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
              </div>
          ) : (
              <p className="text-sm text-slate-500 mt-1">Submit a new shipment for approval.</p>
          )}
        </div>
        <button onClick={handleCancelRequest} className="text-slate-400 hover:text-slate-600 hidden md:block"><X size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 mb-16 md:mb-0">
        <form id="new-request-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6 max-w-5xl mx-auto">
          
          {/* DESKTOP LAYOUT */}
          {!isMobile && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <RouteSection 
                        control={control}
                        register={register}
                        errors={errors}
                        watch={watch}
                        setValue={setValue}
                        originOptions={originOptions}
                        forwarderOptions={forwarderOptions}
                        loadingData={loadingData}
                        setCcList={setCcList}
                        ccList={ccList}
                    />
                    <CargoSection 
                        watch={watch}
                        setValue={setValue}
                        isMobile={false}
                        // Dummy props not used in desktop mode but required by TS if shared
                        fileInputRef={fileInputRef} files={files} handleFileChange={handleFileChange} clearFiles={clearFiles}
                        imageInputRef={imageInputRef} images={images} handleImageChange={handleImageChange} handlePaste={handlePaste}
                        removeImage={removeImage} imagePreviews={imagePreviews} setLightboxUrl={setLightboxUrl} attachContainerRef={attachContainerRef}
                    />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FinancialSection register={register} errors={errors} />
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
                </div>
                <ApproverSection 
                    register={register}
                    errors={errors}
                    approvers={approvers}
                    availableSecondApprovers={availableSecondApprovers}
                    ccList={ccList}
                    ccInput={ccInput}
                    setCcInput={setCcInput}
                    setShowCcDropdown={setShowCcDropdown}
                    showCcDropdown={showCcDropdown}
                    filteredCcUsers={filteredCcUsers}
                    addCcEmail={addCcEmail}
                    removeCcEmail={removeCcEmail}
                />
              </>
          )}

          {/* MOBILE WIZARD LAYOUT */}
          {isMobile && (
              <div className="space-y-6 animate-fade-in pb-12">
                  {currentStep === 0 && (
                    <RouteSection 
                        control={control}
                        register={register}
                        errors={errors}
                        watch={watch}
                        setValue={setValue}
                        originOptions={originOptions}
                        forwarderOptions={forwarderOptions}
                        loadingData={loadingData}
                        setCcList={setCcList}
                        ccList={ccList}
                    />
                  )}
                  {currentStep === 1 && (
                    <CargoSection 
                        watch={watch}
                        setValue={setValue}
                        isMobile={true}
                        fileInputRef={fileInputRef} files={files} handleFileChange={handleFileChange} clearFiles={clearFiles}
                        imageInputRef={imageInputRef} images={images} handleImageChange={handleImageChange} handlePaste={handlePaste}
                        removeImage={removeImage} imagePreviews={imagePreviews} setLightboxUrl={setLightboxUrl} attachContainerRef={attachContainerRef}
                    />
                  )}
                  {currentStep === 2 && (
                      <>
                        <FinancialSection register={register} errors={errors} />
                        <ApproverSection 
                            register={register}
                            errors={errors}
                            approvers={approvers}
                            availableSecondApprovers={availableSecondApprovers}
                            ccList={ccList}
                            ccInput={ccInput}
                            setCcInput={setCcInput}
                            setShowCcDropdown={setShowCcDropdown}
                            showCcDropdown={showCcDropdown}
                            filteredCcUsers={filteredCcUsers}
                            addCcEmail={addCcEmail}
                            removeCcEmail={removeCcEmail}
                        />
                      </>
                  )}
              </div>
          )}

          {Object.keys(errors).length > 0 && (
             <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-700 text-sm animate-pulse mb-4">
                <AlertCircle size={18} />
                <span className="font-bold">Please correct the highlighted errors.</span>
             </div>
          )}

        </form>
      </div>

      <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:static fixed left-0 right-0 md:mb-0 mb-[60px]">
        {isMobile ? (
            <div className="flex w-full gap-3">
                {currentStep > 0 ? (
                    <button type="button" onClick={prevStep} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 flex items-center justify-center gap-2">
                        <ArrowLeft size={18} /> Back
                    </button>
                ) : (
                    <button onClick={handleCancelRequest} className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50">Cancel</button>
                )}
                
                {currentStep < 2 ? (
                    <button type="button" onClick={nextStep} className="flex-[2] px-4 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2">
                        Next <ArrowRight size={18} />
                    </button>
                ) : (
                    <button form="new-request-form" type="submit" disabled={isSubmitting || loadingData} className="flex-[2] flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md transition-all active:scale-95 disabled:opacity-50">
                        <CheckCircle2 size={18} /> Submit
                    </button>
                )}
            </div>
        ) : (
            <div className="flex justify-end gap-3 w-full">
                <button onClick={handleCancelRequest} className="px-6 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                {hasSavedDraft && <button type="button" onClick={handleDeleteDraft} className="px-6 py-2.5 border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2" title="Delete saved draft"><Trash2 size={18} /> Delete Draft</button>}
                <button type="button" onClick={handleSaveDraft} className="px-6 py-2.5 border border-indigo-200 text-indigo-700 font-bold rounded-lg hover:bg-indigo-50 transition-colors flex items-center gap-2"><Bookmark size={18} /> Save Draft</button>
                <button form="new-request-form" type="submit" disabled={isSubmitting || loadingData} className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-50">
                    <Save size={18} /> {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
            </div>
        )}
      </div>

      {showNoApproverConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"><div className="p-6"><div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600 mx-auto"><AlertTriangle size={24} /></div><h3 className="text-xl font-bold text-center text-slate-900 mb-2">No Approver Selected</h3><p className="text-center text-slate-500 text-sm mb-6">You are about to submit this request without assigning a specific First Approver.<br/><br/>The system will notify all available Approvers and Admins.<br/><br/>Do you want to proceed?</p><div className="flex gap-3 justify-center"><button onClick={() => setShowNoApproverConfirmation(false)} className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button><button onClick={confirmSubmitWithoutApprover} className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700">Proceed</button></div></div></div></div>
      )}

      {showDeleteDraftConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up"><div className="p-6 text-center"><div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 mx-auto"><Trash2 size={24} /></div><h3 className="text-xl font-bold text-center text-slate-900 mb-2">Delete Saved Draft?</h3><p className="text-center text-slate-500 text-sm mb-6">Are you sure you want to delete the saved draft? This action cannot be undone.</p><div className="flex gap-3 justify-center"><button onClick={() => setShowDeleteDraftConfirmation(false)} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Cancel</button><button onClick={confirmDeleteDraft} className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700">Delete</button></div></div></div></div>
      )}

      {showExitConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up"><div className="p-6 text-center"><div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600 mx-auto"><LogOut size={24} /></div><h3 className="text-xl font-bold text-center text-slate-900 mb-2">Unsaved Changes</h3><p className="text-center text-slate-500 text-sm mb-6">You have unsaved changes. If you leave now, your progress will be lost unless you save a draft.</p><div className="flex gap-3 justify-center"><button onClick={cancelExit} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50">Continue Editing</button><button onClick={confirmExit} className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700">Discard & Exit</button></div></div></div></div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setLightboxUrl(null)}>
           <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors p-2 bg-white/10 rounded-full"><X size={32} /></button>
           <img src={lightboxUrl} className="max-w-full max-h-[90vh] rounded shadow-2xl animate-fade-in-up object-contain" onClick={(e) => e.stopPropagation()} alt="Full preview" />
        </div>
      )}
    </div>
  );
};

export default NewRequestForm;
