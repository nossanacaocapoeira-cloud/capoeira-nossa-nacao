import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface PreviewStudent {
  id: string;
  name: string;
}

interface NavigationContextType {
  path: string;
  navigate: (newPath: string) => void;
  getParam: (name: string) => string | null;
  previewStudent: PreviewStudent | null;
  setPreviewStudent: (student: PreviewStudent | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const PREVIEW_STORAGE_KEY = 'cnn_admin_preview_student';

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState<string>(() => {
    return window.location.pathname + window.location.search || '/';
  });

  const [previewStudent, setPreviewStudentState] = useState<PreviewStudent | null>(() => {
    try {
      const saved = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  });

  const setPreviewStudent = useCallback((student: PreviewStudent | null) => {
    setPreviewStudentState(student);
    try {
      if (student) {
        sessionStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(student));
      } else {
        sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname + window.location.search || '/');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((newPath: string) => {
    const currentFull = window.location.pathname + window.location.search;
    if (currentFull !== newPath) {
      window.history.pushState({}, '', newPath);
      setPath(newPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const getParam = useCallback((name: string): string | null => {
    // Check search params
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has(name)) return searchParams.get(name);

    // Also check if path state has search parameters
    if (path.includes('?')) {
      const queryStr = path.split('?')[1];
      const parsed = new URLSearchParams(queryStr);
      if (parsed.has(name)) return parsed.get(name);
    }

    // Check dynamic path param /admin/alunos/:id
    const cleanPath = path.split('?')[0];
    const currentParts = cleanPath.split('/').filter(Boolean);
    if (name === 'id' && currentParts[0] === 'admin' && currentParts[1] === 'alunos' && currentParts[2]) {
      return currentParts[2];
    }

    return null;
  }, [path]);

  return (
    <NavigationContext.Provider
      value={{ path, navigate, getParam, previewStudent, setPreviewStudent }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
