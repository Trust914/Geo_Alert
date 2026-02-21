import { Toaster } from 'sonner';
import { AppProviders } from './AppProviders';
import AppRouter from './AppRouter';

function App() {
  return (
    <AppProviders>
      <AppRouter />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'white',
            color: '#1f2937',
            border: '1px solid #e5e7eb',
          },
        }}
      />
    </AppProviders>
  );
}

export default App;