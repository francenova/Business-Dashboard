'use client';

import { useParams } from 'next/navigation';
import { PatientProfilePage } from '@/components/dashboard/pages/PatientProfilePage';

export default function PatientProfileRoute() {
  const params = useParams();
  const patientId = params.patientId as string;

  return <PatientProfilePage id={patientId} />;
}
