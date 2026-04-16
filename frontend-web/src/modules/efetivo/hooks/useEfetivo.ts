// frontend-web/src/modules/efetivo/hooks/useEfetivo.ts
import { useState, useEffect, useCallback } from 'react';
import { efetivoService, type ListagemEfetivo, type QueryEfetivoParams } from '../../../services/efetivo.service';

export function useRegistros(obraId: number | undefined, params?: QueryEfetivoParams) {
  const [data, setData] = useState<ListagemEfetivo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!obraId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await efetivoService.getRegistros(obraId, params);
      setData(result);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao carregar registros');
    } finally {
      setIsLoading(false);
    }
  }, [obraId, JSON.stringify(params)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

export function useCreateRegistro(obraId: number) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(async (payload: Parameters<typeof efetivoService.createRegistro>[1]) => {
    setIsLoading(true);
    setError(null);
    try {
      return await efetivoService.createRegistro(obraId, payload);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao criar registro';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [obraId]);

  return { create, isLoading, error };
}

export function useFecharRegistro(obraId: number) {
  const [isLoading, setIsLoading] = useState(false);

  const fechar = useCallback(async (registroId: number) => {
    setIsLoading(true);
    try {
      return await efetivoService.fecharRegistro(obraId, registroId);
    } finally {
      setIsLoading(false);
    }
  }, [obraId]);

  return { fechar, isLoading };
}

export function useReabrirRegistro(obraId: number) {
  const [isLoading, setIsLoading] = useState(false);

  const reabrir = useCallback(async (registroId: number) => {
    setIsLoading(true);
    try {
      return await efetivoService.reabrirRegistro(obraId, registroId);
    } finally {
      setIsLoading(false);
    }
  }, [obraId]);

  return { reabrir, isLoading };
}
