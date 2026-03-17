
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UserProvider } from './contexts/UserContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NavigationBlockerProvider } from './contexts/NavigationBlockerContext';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <ToastProvider>
          <ThemeProvider>
            <UserProvider>
              <NavigationBlockerProvider>
                <App />
              </NavigationBlockerProvider>
            </UserProvider>
          </ThemeProvider>
        </ToastProvider>
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
