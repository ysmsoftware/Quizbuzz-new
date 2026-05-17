import { Suspense } from 'react';
import RegistrationSuccessClient from './RegistrationSuccessClient';

export default function RegistrationSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-4">Loading...</div>}>
      <RegistrationSuccessClient />
    </Suspense>
  );
}
