import { Outlet } from 'react-router';
import { PublicNavBar } from '@/components/public/PublicNavBar';
import { PublicFooter } from '@/components/public/PublicFooter';
import { SkipLink } from '@/components/public/SkipLink';

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SkipLink />
      <PublicNavBar />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
