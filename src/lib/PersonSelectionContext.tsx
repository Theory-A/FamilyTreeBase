"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

type SelectorField = "parents" | "partners" | "children" | null;

interface PersonSelectionContextType {
  activeSelector: SelectorField;
  setActiveSelector: (field: SelectorField) => void;
  onPersonSelected: ((personId: string) => void) | null;
  registerSelector: (field: SelectorField, callback: (personId: string) => void) => void;
  unregisterSelector: (field: SelectorField) => void;
}

const PersonSelectionContext = createContext<PersonSelectionContextType | null>(null);

export function PersonSelectionProvider({ children }: { children: ReactNode }) {
  const [activeSelector, setActiveSelector] = useState<SelectorField>(null);
  const [callbacks, setCallbacks] = useState<Record<string, (personId: string) => void>>({});

  const registerSelector = useCallback((field: SelectorField, callback: (personId: string) => void) => {
    if (field) {
      setCallbacks((prev) => ({ ...prev, [field]: callback }));
      setActiveSelector(field);
    }
  }, []);

  const unregisterSelector = useCallback((field: SelectorField) => {
    if (field) {
      setCallbacks((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setActiveSelector((current) => (current === field ? null : current));
    }
  }, []);

  const onPersonSelected = activeSelector ? callbacks[activeSelector] || null : null;

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({
      activeSelector,
      setActiveSelector,
      onPersonSelected,
      registerSelector,
      unregisterSelector,
    }),
    [activeSelector, onPersonSelected, registerSelector, unregisterSelector]
  );

  return (
    <PersonSelectionContext.Provider value={value}>
      {children}
    </PersonSelectionContext.Provider>
  );
}

export function usePersonSelection() {
  const context = useContext(PersonSelectionContext);
  if (!context) {
    // Return a no-op version if not wrapped in provider
    return {
      activeSelector: null,
      setActiveSelector: () => {},
      onPersonSelected: null,
      registerSelector: () => {},
      unregisterSelector: () => {},
    };
  }
  return context;
}
