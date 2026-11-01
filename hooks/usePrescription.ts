import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Prescription } from '@/lib/types';

export function usePrescription(prescriptionId: string) {
  return useQuery({
    queryKey: ['prescription', prescriptionId],
    queryFn: async (): Promise<Prescription> => apiFetch(`/api/prescriptions/${prescriptionId}`),
    enabled: !!prescriptionId,
  });
}
