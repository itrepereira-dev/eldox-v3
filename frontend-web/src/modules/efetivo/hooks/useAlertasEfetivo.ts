// frontend-web/src/modules/efetivo/hooks/useAlertasEfetivo.ts
import { useState, useEffect, useCallback } from 'react';
import { efetivoService, type AlertaEfetivo } from '../../../services/efetivo.service';

export function useAlertasEfetivo() {
  const [alertas, setAlertas] = useState<AlertaEfetivo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await efetivoService.getAlertas();
      setAlertas(result);
    } catch {
      // alertas não bloqueiam a UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const marcarLido = useCallback(async (id: number) => {
    await efetivoService.marcarAlertaLido(id);
    setAlertas(prev => prev.filter(a => a.id !== id));
  }, []);

  return { alertas, isLoading, marcarLido, refetch: fetch };
}
