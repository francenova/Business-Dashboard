import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import { Visit } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

export function useCreateVisitAndPrescription() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { addToast } = useApp();

  return useMutation({
    // The full insert-visit / insert-prescription / deduct-stock-across-every-
    // pick-type / update-patient / log-activity sequence now runs server-side
    // in one request — see app/api/visits/route.ts. `medicines` no longer
    // needs to be passed in; the route reads current stock itself.
    mutationFn: async (data: { visitData: Omit<Visit, 'id' | 'displayId'>; medicines?: unknown[]; skipNavigation?: boolean }) => {
      const { visitData } = data;
      return apiFetch<{ insertedVisit: Record<string, unknown>; insertedRx: Record<string, unknown> }>('/api/visits', {
        method: 'POST',
        body: JSON.stringify({ visitData }),
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['medicines'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });

      addToast('Success', 'Visit and Prescription created successfully.', 'success');

      if (!variables.skipNavigation) {
        router.push(`/prescription/${data.insertedRx.id}`);
      }
    },
    onError: (error: Error) => {
      console.error(error);
      addToast('Error', error.message, 'error');
    },
  });
}
