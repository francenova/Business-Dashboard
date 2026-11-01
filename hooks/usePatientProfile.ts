import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Patient, Visit, Prescription } from '@/lib/types';

export function usePatientProfile(patientId: string) {
  return useQuery({
    queryKey: ['patient', patientId],
    queryFn: async (): Promise<{ patient: Patient; visits: Visit[]; prescriptions: Prescription[] }> =>
      apiFetch(`/api/patients/${patientId}`),
    enabled: !!patientId,
  });
}
