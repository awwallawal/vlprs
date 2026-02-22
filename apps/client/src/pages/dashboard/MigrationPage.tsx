import { Navigate } from 'react-router';

export function MigrationPage() {
  return <Navigate to="/dashboard/operations" replace />;
}

export { MigrationPage as Component };
