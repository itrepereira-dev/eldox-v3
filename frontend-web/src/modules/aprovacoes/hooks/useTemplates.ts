import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aprovacoesService, type WorkflowTemplate } from '../../../services/aprovacoes.service';

export function useTemplates(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['aprovacoes', 'templates', params],
    queryFn: () => aprovacoesService.listarTemplates(params),
  });
}

export function useTemplate(id: number) {
  return useQuery({
    queryKey: ['aprovacoes', 'templates', 'detalhe', id],
    queryFn: () => aprovacoesService.buscarTemplate(id),
    enabled: !!id,
  });
}

export function useCriarTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<WorkflowTemplate>) => aprovacoesService.criarTemplate(dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aprovacoes', 'templates'] }),
  });
}

export function useAtualizarTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<WorkflowTemplate> }) =>
      aprovacoesService.atualizarTemplate(id, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aprovacoes', 'templates'] }),
  });
}

export function useDesativarTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => aprovacoesService.desativarTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aprovacoes', 'templates'] }),
  });
}
