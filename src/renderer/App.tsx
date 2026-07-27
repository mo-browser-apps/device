import { ThemeProvider } from '@/components/theme-provider';

const isMac = navigator.userAgent.includes('Mac');

export default function App() {
  return (
    <ThemeProvider>
      {isMac && <div className="draggable" />}
      <main className="flex h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Devices appear here.</p>
      </main>
    </ThemeProvider>
  );
}
