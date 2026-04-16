// frontend-web/src/modules/fvm/relatorios/excel/scoreCalculator.ts
import type { FvmPerformanceFornecedor } from '@/services/fvm.service';

/**
 * Compute performance score for a single supplier.
 * Score = (taxa_aprovacao × 0.5)
 *       + ((1 − ncs_criticas / total_lotes) × 100 × 0.3)
 *       + ((1 − ensaios_reprovados / total_ensaios) × 100 × 0.2)
 * Clamped to [0, 100].
 *
 * Edge cases:
 * - total_lotes === 0: supplier omitted upstream (never called)
 * - total_ensaios === 0: third term treated as 100 (no failed ensaios = perfect)
 */
export function calcularScore(f: Omit<FvmPerformanceFornecedor, 'score'>): number {
  const component1 = f.taxa_aprovacao * 0.5;

  const ratioCriticas = f.total_lotes > 0 ? f.ncs_criticas / f.total_lotes : 0;
  const component2    = (1 - ratioCriticas) * 100 * 0.3;

  const ratioEnsaios = f.total_ensaios > 0 ? f.ensaios_reprovados / f.total_ensaios : 0;
  const component3   = (1 - ratioEnsaios) * 100 * 0.2;

  const raw = component1 + component2 + component3;
  return Math.min(100, Math.max(0, raw));
}
