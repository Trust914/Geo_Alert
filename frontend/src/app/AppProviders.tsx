import React from 'react';
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../lib/reactQuery';
// import { AuthProvider } from '../features/auth/context';
import { ENV } from '../config';
import { ThemeProvider } from '../context/ThemeContext';
import { BFFProvider } from '../features/bff_auth/context';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BFFProvider>
        {/* <AuthProvider> */}
          {children}
          {ENV.IS_DEV && <ReactQueryDevtools initialIsOpen={false} />}
        {/* </AuthProvider> */}
        </BFFProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}