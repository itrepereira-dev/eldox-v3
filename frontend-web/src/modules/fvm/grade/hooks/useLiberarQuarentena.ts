// frontend-web/src/modules/fvm/grade/hooks/useLiberarQuarentena.ts
// Mutation para liberar quarentena de um lote FVM com decisão fundamentada

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export interface LiberarQuarentenaPayload {
  decisao: 'aprovado' | 'aprovado_com_ressalva' | 'reprovado';
  observacao: string;
  evidencia_id?: number;
}

export function useLiberarQuarentena(loteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LiberarQuarentenaPayload) =>
      api.post(`/fvm/lotes/${loteId}/liberar-quarentena`, payload).then(r => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fvm-lote', loteId] });
      qc.invalidateQueries({ queryKey: ['fvm-lote-preview', loteId] });
      qc.invalidateQueries({ queryKey: ['fvm-grade'] });
    },
  });
}
