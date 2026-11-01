import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Visit, Patient } from '@/lib/types';

export function usePatientVisit(visitId: string) {
  return useQuery({
    queryKey: ['visit', visitId],
    queryFn: async (): Promise<{ visit: Visit; patient: Patient | null }> => apiFetch(`/api/visits/${visitId}`),
    enabled: !!visitId,
  });
}
