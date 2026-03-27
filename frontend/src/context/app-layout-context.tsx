// Global layout context: page title, auth state, and scroll behaviour.
import { createContext, useState, type ReactNode } from 'react';

// Default values; will be overridden by AppLayoutProvider
export const AppLayoutContext = createContext({
  pageTitle: '',
  setPageTitle: (_title: string) => {},
  isAuthenticated: false,
  setIsAuthenticated: (_auth: boolean) => {},
  scroll: true,
  setScroll: (_scroll: boolean) => {},
});

export function AppLayoutProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitle] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [scroll, setScroll] = useState<boolean>(true);

  return (
    <AppLayoutContext.Provider
      value={{
        pageTitle,
        setPageTitle,
        isAuthenticated,
        setIsAuthenticated,
        scroll,
        setScroll,
      }}
    >
      {children}
    </AppLayoutContext.Provider>
  );
}
