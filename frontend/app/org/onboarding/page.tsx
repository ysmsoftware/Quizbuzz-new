'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/org');
  }, [router]);

  return null;
}
