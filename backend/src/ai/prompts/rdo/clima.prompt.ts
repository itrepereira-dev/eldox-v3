// /backend/src/ai/prompts/rdo/clima.prompt.ts
// AGENTE-CLIMA não usa LLM — este arquivo documenta o mapeamento de weathercodes
// e expõe helpers de classificação usados pelo agente.

export interface ClimaCtx {
  data: string;          // ISO 8601
  latitude: number;
  longitude: number;
  tenant_id: number;
  obra_nome: string;
}

export interface CondPeriodo {
  periodo: 'manha' | 'tarde' | 'noite';
  condicao: 'claro' | 'nublado' | 'chuvoso';
  praticavel: boolean;
  mm_chuva: number;
}

/**
 * Mapeia WMO Weather Interpretation Code → condicao legível.
 * Referência: https://open-meteo.com/en/docs#weathervariables
 */
export function mapearWeatherCode(code: number): 'claro' | 'nublado' | 'chuvoso' {
  if (code === 0 || code === 1) return 'claro';
  if (code >= 2 && code <= 49) return 'nublado';
  // 51–99: precipitação (drizzle, rain, snow, thunderstorm)
  return 'chuvoso';
}

/**
 * Decide se o período é praticável para trabalho externo em obra.
 * Limiar: precipitação acumulada no período > 2 mm/h
 */
export function calcularPraticavel(mmChuva: number): boolean {
  return mmChuva < 2.0;
}

/**
 * Agrupa horas do dia em períodos.
 * Manhã: 06–11h | Tarde: 12–17h | Noite: 18–23h
 */
export function horaParaPeriodo(hora: number): 'manha' | 'tarde' | 'noite' | null {
  if (hora >= 6 && hora <= 11) return 'manha';
  if (hora >= 12 && hora <= 17) return 'tarde';
  if (hora >= 18 && hora <= 23) return 'noite';
  return null; // madrugada — ignorar para fins de RDO
}

/**
 * Agrega arrays horários em condição por período.
 * @param precipitacoes  Array de 24 valores (mm/h) para o dia
 * @param weatherCodes   Array de 24 weathercodes para o dia
 */
export function agregarPorPeriodo(
  precipitacoes: number[],
  weatherCodes: number[],
): CondPeriodo[] {
  const periodos: Array<'manha' | 'tarde' | 'noite'> = ['manha', 'tarde', 'noite'];
  const faixas: Record<string, number[]> = { manha: [], tarde: [], noite: [] };

  for (let h = 0; h < 24; h++) {
    const periodo = horaParaPeriodo(h);
    if (!periodo) continue;
    faixas[periodo].push(h);
  }

  return periodos.map((periodo) => {
    const horas = faixas[periodo];
    const mmTotal = horas.reduce((acc, h) => acc + (precipitacoes[h] ?? 0), 0);
    const mmMax = Math.max(...horas.map((h) => precipitacoes[h] ?? 0));
    // Condição dominante: usa o weathercode mais severo do período
    const codeDominante = horas.reduce(
      (prev, h) => (weatherCodes[h] > prev ? weatherCodes[h] : prev),
      0,
    );
    return {
      periodo,
      condicao: mapearWeatherCode(codeDominante),
      praticavel: calcularPraticavel(mmMax),
      mm_chuva: Math.round(mmTotal * 10) / 10,
    };
  });
}
