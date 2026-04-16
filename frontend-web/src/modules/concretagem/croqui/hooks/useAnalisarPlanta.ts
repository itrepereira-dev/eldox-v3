// frontend-web/src/modules/concretagem/croqui/hooks/useAnalisarPlanta.ts
// Hook para análise IA de planta estrutural — SPEC 7

import { useMutation } from '@tanstack/react-query';
import {
  concretagemService,
  type AnalisarPlantaPayload,
} from '@/services/concretagem.service';

export function useAnalisarPlanta(obraId: number) {
  return useMutation({
    mutationFn: (payload: AnalisarPlantaPayload) =>
      concretagemService.analisarPlanta(obraId, payload),
  });
}

// ── Utilidade: converte File → base64 ─────────────────────────────────────────

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:image/...;base64,"
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
