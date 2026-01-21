// src/context/ThemeContext.jsx
import { createContext, useState, type ReactNode } from 'react';

export const AppLayoutContext = createContext({
  pageTitle: '',
  setPageTitle: (_title: string) => {},
  isAuthenticated: false,
  setIsAuthenticated: (_auth: boolean) => {},
});

export function AppLayoutProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitle] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  return (
    <AppLayoutContext.Provider
      value={{ pageTitle, setPageTitle, isAuthenticated, setIsAuthenticated }}
    >
      {children}
    </AppLayoutContext.Provider>
  );
}
