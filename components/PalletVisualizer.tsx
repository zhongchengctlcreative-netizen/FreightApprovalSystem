import React from 'react';
import { X, Box, Layers, ArrowRight, Maximize2 } from 'lucide-react';

interface PalletVisualizerProps {
  isOpen: boolean;
  onClose: () => void;
  sku: {
    partNo: string;
    l: number;
    w: number;
    h: number;
  };
  calc: {
    maxCartonsPerLayer: number;
    maxLayers: number;
    maxCartonsPerPallet: number;
    bestOrientation: string; // 'normal' | 'rotated'
  };
}

const PALLET_L = 121;
const PALLET_W = 101;
const PALLET_H = 137;
const PALLET_BASE_H = 15;

const PalletVisualizer: React.FC<PalletVisualizerProps> = ({ isOpen, onClose, sku, calc }) => {
  if (!isOpen) return null;

  // Calculate scaling factor for visualization
  // We want the pallet (121cm) to fit in roughly 300px width
  const scale = 2.5; 
  
  const palletWidthPx = PALLET_L * scale;
  const palletDepthPx = PALLET_W * scale;
  const palletHeightPx = PALLET_H * scale;
  const baseHeightPx = PALLET_BASE_H * scale;

  // Carton dimensions based on orientation
  const cartonLPx = (calc.bestOrientation === 'normal' ? sku.l : sku.w) * scale;
  const cartonWPx = (calc.bestOrientation === 'normal' ? sku.w : sku.l) * scale;
  const cartonHPx = sku.h * scale;

  // Calculate grid for Top View
  const cols = Math.floor(PALLET_L / (calc.bestOrientation === 'normal' ? sku.l : sku.w));
  const rows = Math.floor(PALLET_W / (calc.bestOrientation === 'normal' ? sku.w : sku.l));
  
  // Generate cartons for Top View
  const topViewCartons = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (topViewCartons.length < calc.maxCartonsPerLayer) {
        topViewCartons.push({
          left: c * cartonLPx,
          top: r * cartonWPx,
          width: cartonLPx,
          height: cartonWPx
        });
      }
    }
  }

  // Generate layers for Side View
  const sideViewLayers = [];
  for (let i = 0; i < calc.maxLayers; i++) {
    sideViewLayers.push({
      bottom: baseHeightPx + (i * cartonHPx),
      height: cartonHPx
    });
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
              <Box size={20} className="text-indigo-600" /> 
              Palletization Simulator
            </h3>
            <p className="text-sm text-slate-500">Visualizing packing for SKU: <span className="font-mono font-bold text-slate-700">{sku.partNo}</span></p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-full">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Carton Dims</div>
              <div className="font-mono text-lg font-bold text-slate-800">{sku.l} x {sku.w} x {sku.h} cm</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Ti-Hi (Layer x High)</div>
              <div className="font-mono text-lg font-bold text-indigo-600">{calc.maxCartonsPerLayer} x {calc.maxLayers}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Total Per Pallet</div>
              <div className="font-mono text-lg font-bold text-emerald-600">{calc.maxCartonsPerPallet} ctns</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500 uppercase font-bold mb-1">Efficiency</div>
              <div className="font-mono text-lg font-bold text-slate-800">
                {Math.round((calc.maxCartonsPerLayer * sku.l * sku.w) / (PALLET_L * PALLET_W) * 100)}% Area
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Top View Visualization */}
            <div className="flex flex-col items-center">
              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Maximize2 size={18} /> Top View (Layer Pattern)
              </h4>
              <div 
                className="relative bg-white border-2 border-slate-800 shadow-lg"
                style={{ width: palletWidthPx, height: palletDepthPx }}
              >
                {/* Pallet Label */}
                <div className="absolute -top-6 left-0 w-full text-center text-xs text-slate-400 font-mono">121 cm</div>
                <div className="absolute -left-6 top-0 h-full flex items-center text-xs text-slate-400 font-mono" style={{ writingMode: 'vertical-rl' }}>101 cm</div>

                {/* Cartons */}
                {topViewCartons.map((carton, idx) => (
                  <div
                    key={idx}
                    className="absolute bg-indigo-100 border border-indigo-300 flex items-center justify-center text-[10px] text-indigo-400 font-mono hover:bg-indigo-200 transition-colors"
                    style={{
                      left: carton.left,
                      top: carton.top,
                      width: carton.width,
                      height: carton.height
                    }}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>
              <div className="mt-4 text-sm text-slate-500 text-center">
                <span className="font-bold">{calc.maxCartonsPerLayer} cartons</span> per layer<br/>
                Orientation: <span className="font-mono bg-slate-200 px-1 rounded">{calc.bestOrientation === 'normal' ? 'Lengthwise' : 'Rotated'}</span>
              </div>
            </div>

            {/* Side View Visualization */}
            <div className="flex flex-col items-center">
              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Layers size={18} /> Side View (Stacking Height)
              </h4>
              <div className="relative flex items-end justify-center" style={{ height: palletHeightPx + 40 }}>
                {/* Height Marker */}
                <div className="absolute right-0 top-0 bottom-0 w-px bg-slate-300 border-r border-dashed border-slate-300 h-full" style={{ height: palletHeightPx }}></div>
                <div className="absolute -right-12 top-0 text-xs text-slate-400 font-mono">137 cm (Max)</div>
                
                {/* Pallet Stack Container */}
                <div className="relative w-48 flex flex-col-reverse">
                  
                  {/* Pallet Base */}
                  <div 
                    className="w-full bg-slate-800 border-t-4 border-slate-600 relative flex items-center justify-center"
                    style={{ height: baseHeightPx }}
                  >
                    <span className="text-[10px] text-slate-400 font-mono">Pallet Base (15cm)</span>
                  </div>

                  {/* Layers */}
                  {sideViewLayers.map((layer, idx) => (
                    <div
                      key={idx}
                      className="w-full bg-emerald-100 border-b border-emerald-200 flex items-center justify-center text-[10px] text-emerald-600 font-mono relative group hover:bg-emerald-200 transition-colors"
                      style={{ height: layer.height }}
                    >
                      Layer {idx + 1}
                      
                      {/* Tooltip for layer height */}
                      <div className="absolute left-full ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        {((idx + 1) * sku.h + PALLET_BASE_H).toFixed(1)} cm
                      </div>
                    </div>
                  ))}

                  {/* Remaining Space Indicator */}
                  <div 
                    className="w-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400 italic"
                    style={{ height: palletHeightPx - baseHeightPx - (calc.maxLayers * cartonHPx) }}
                  >
                    Empty Space
                  </div>
                </div>
              </div>
              <div className="mt-4 text-sm text-slate-500 text-center">
                Total Height: <span className="font-bold text-slate-800">{(calc.maxLayers * sku.h + PALLET_BASE_H).toFixed(1)} cm</span><br/>
                <span className="text-xs">(Includes 15cm pallet base)</span>
              </div>
            </div>

          </div>
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
          * Visualization is an approximation based on optimal uniform stacking. Actual stacking may vary.
        </div>
      </div>
    </div>
  );
};

export default PalletVisualizer;
