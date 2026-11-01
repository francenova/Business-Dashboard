'use client';

import { useSearchParams } from 'next/navigation';
import { PatientVisitPage } from '@/components/dashboard/pages/PatientVisitPage';

export default function NewVisitRoute() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');

  return <PatientVisitPage patientId={patientId || undefined} />;
}
