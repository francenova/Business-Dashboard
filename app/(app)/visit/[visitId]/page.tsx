'use client';

import { useParams } from 'next/navigation';
import { PatientVisitPage } from '@/components/dashboard/pages/PatientVisitPage';

export default function EditVisitRoute() {
  const params = useParams();
  const visitId = params.visitId as string;

  return <PatientVisitPage visitId={visitId} />;
}
