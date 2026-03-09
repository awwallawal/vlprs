import { useParams, useNavigate } from 'react-router';
import { StaffProfilePanel } from './components/StaffProfilePanel';

export function PersonDetailPage() {
  const { personKey } = useParams<{ personKey: string }>();
  const navigate = useNavigate();
  const decodedKey = personKey ? decodeURIComponent(personKey) : '';

  if (!decodedKey) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">Invalid person key</p>
      </div>
    );
  }

  return (
    <StaffProfilePanel
      personKey={decodedKey}
      onBack={() => navigate('/dashboard/migration')}
    />
  );
}

export const Component = PersonDetailPage;
