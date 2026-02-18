import { Button } from '@/components/ui/Button';

function App() {
  return (
    <div className="min-h-screen bg-background text-text-primary font-sans">
      <header className="bg-crimson text-white p-4">
        <h1 className="text-xl font-bold">VLPRS</h1>
        <p className="text-sm opacity-80">Vehicle Loan Processing & Receivables System</p>
      </header>
      <main className="p-6 space-y-4">
        <p className="text-text-secondary">System initialising…</p>
        <div className="flex gap-3">
          <Button>Primary Action</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </main>
    </div>
  );
}

export default App;
