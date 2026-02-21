import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero section */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 bg-surface">
        <div className="max-w-2xl w-full text-center space-y-8">
          <img
            src="/oyo-crest.svg"
            alt="Oyo State Government Crest"
            className="h-24 w-24 mx-auto"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-text-primary">
              VLPRS
            </h1>
            <p className="text-lg text-text-secondary">
              Vehicle Loan Processing & Receivables System
            </p>
            <p className="text-text-secondary max-w-md mx-auto">
              A secure platform for managing vehicle loan processing, repayment
              tracking, and receivables for the Oyo State Government.
            </p>
          </div>

          <Link to="/login">
            <Button size="lg" className="h-12 px-8 text-base min-h-[44px]">
              Staff Login
            </Button>
          </Link>
        </div>
      </main>

      {/* Beneficiary Portal placeholder */}
      <section className="bg-background border-t border-border px-4 py-12">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <h2 className="text-xl font-semibold text-text-secondary">
            Beneficiary Portal
          </h2>
          <p className="text-text-muted">
            Coming Soon (Phase 2)
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-surface border-t border-border px-4 py-6">
        <p className="text-center text-sm text-text-muted">
          Oyo State Accountant General&apos;s Office
        </p>
      </footer>
    </div>
  );
}
