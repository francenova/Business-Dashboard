'use client';

import { useParams } from 'next/navigation';
import { SupplierDetailsPage } from '@/components/dashboard/pages/SupplierDetailsPage';

export default function SupplierDetailsRoute() {
  const params = useParams();
  const supplierId = params.supplierId as string;

  return <SupplierDetailsPage id={supplierId} />;
}
