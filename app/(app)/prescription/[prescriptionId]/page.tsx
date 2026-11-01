'use client';

import { useParams } from 'next/navigation';
import { PrescriptionPage } from '@/components/dashboard/pages/PrescriptionPage';

export default function PrescriptionRoute() {
  const params = useParams();
  const prescriptionId = params.prescriptionId as string;

  return <PrescriptionPage id={prescriptionId} />;
}
