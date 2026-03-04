import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type BlockerCallback = () => void;

interface NavigationBlockerContextType {
  registerBlocker: (callback: BlockerCallback, isDirty: boolean) => void;
  navigateWithCheck: (to: string) => void;
  confirmNavigation: () => void;
  cancelNavigation: () => void;
  pendingPath: string | null;
}

const NavigationBlockerContext = createContext<NavigationBlockerContextType | undefined>(undefined);

export const NavigationBlockerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const [blockerCallback, setBlockerCallback] = useState<BlockerCallback | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const registerBlocker = useCallback((callback: BlockerCallback, dirty: boolean) => {
    setBlockerCallback(() => callback);
    setIsDirty(dirty);
  }, []);

  const navigateWithCheck = useCallback((to: string) => {
    if (isDirty && blockerCallback) {
      setPendingPath(to);
      blockerCallback(); // Trigger the modal in the form
    } else {
      navigate(to);
    }
  }, [isDirty, blockerCallback, navigate]);

  const confirmNavigation = useCallback(() => {
    if (pendingPath) {
      navigate(pendingPath);
      setPendingPath(null);
      setIsDirty(false); // Reset dirty state after forcing navigation
    }
  }, [pendingPath, navigate]);

  const cancelNavigation = useCallback(() => {
    setPendingPath(null);
  }, []);

  return (
    <NavigationBlockerContext.Provider 
      value={{ 
        registerBlocker, 
        navigateWithCheck, 
        confirmNavigation, 
        cancelNavigation,
        pendingPath 
      }}
    >
      {children}
    </NavigationBlockerContext.Provider>
  );
};

export const useNavigationBlocker = () => {
  const context = useContext(NavigationBlockerContext);
  if (context === undefined) {
    throw new Error('useNavigationBlocker must be used within a NavigationBlockerProvider');
  }
  return context;
};