
import React, { useEffect, useState } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

const POLL_INTERVAL_MS = 60 * 1000; // Check every 1 minute

const VersionChecker: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch initial version on mount
    const fetchInitialVersion = async () => {
      try {
        // Append timestamp to prevent caching of the version file itself
        const res = await fetch(`./version.json?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setCurrentVersion(data.buildId);
        }
      } catch (e) {
        // Silent fail on dev or if file missing
        console.debug("Could not fetch version info");
      }
    };

    fetchInitialVersion();

    // 2. Poll for changes
    const interval = setInterval(async () => {
      if (!currentVersion) return; // Don't poll if we never got an initial version

      try {
        const res = await fetch(`./version.json?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          // If server version differs from initial client version
          if (data.buildId !== currentVersion) {
            setUpdateAvailable(true);
          }
        }
      } catch (e) {
        console.debug("Version check failed");
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [currentVersion]);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-card-fly-in">
      <div className="bg-indigo-900 text-white p-4 rounded-xl shadow-2xl border border-indigo-700 flex items-start gap-4 max-w-sm">
        <div className="p-2 bg-indigo-800 rounded-lg shrink-0 text-indigo-300">
          <Sparkles size={24} />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm">New Version Available</h4>
          <p className="text-xs text-indigo-200 mt-1 mb-3">
            A new update has been released with improvements. Please refresh to view the changes.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-1.5 bg-white text-indigo-900 text-xs font-bold rounded shadow-sm hover:bg-indigo-50 transition-colors"
            >
              <RefreshCw size={12} /> Refresh Now
            </button>
            <button 
              onClick={() => setUpdateAvailable(false)}
              className="px-3 py-1.5 border border-indigo-700 text-indigo-200 text-xs font-bold rounded hover:bg-indigo-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
        <button 
          onClick={() => setUpdateAvailable(false)} 
          className="text-indigo-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default VersionChecker;
