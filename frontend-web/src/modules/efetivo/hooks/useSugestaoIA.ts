// frontend-web/src/modules/efetivo/hooks/useSugestaoIA.ts
import { useState, useEffect } from 'react';
import { efetivoService, type SugestaoIA } from '../../../services/efetivo.service';

export function useSugestaoIA(obraId: number | undefined) {
  const [sugestao, setSugestao] = useState<SugestaoIA | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obraId) return;
    setIsLoading(true);
    setError(null);
    efetivoService.getSugestaoIA(obraId)
      .then(setSugestao)
      .catch(() => setError('Sugestão IA indisponível'))
      .finally(() => setIsLoading(false));
  }, [obraId]);

  return { sugestao, isLoading, error };
}
