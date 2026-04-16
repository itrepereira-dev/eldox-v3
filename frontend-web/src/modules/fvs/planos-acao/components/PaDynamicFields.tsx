// frontend-web/src/modules/fvs/planos-acao/components/PaDynamicFields.tsx
import type { PaConfigCampo } from '../../../../services/planos-acao.service';

interface PaDynamicFieldsProps {
  campos: PaConfigCampo[];
  values: Record<string, unknown>;
  onChange: (chave: string, value: unknown) => void;
  readOnly?: boolean;
}

export function PaDynamicFields({ campos, values, onChange, readOnly }: PaDynamicFieldsProps) {
  if (!campos.length) return null;

  return (
    <div className="flex flex-col gap-4">
      {campos.map((campo) => (
        <div key={campo.id} className="flex flex-col gap-1">
          <label className="text-[12px] font-medium text-[var(--text-medium)]">
            {campo.nome}
            {campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}
          </label>

          {campo.tipo === 'texto' && (
            <textarea
              className="input-base min-h-[72px] resize-y text-[13px]"
              value={(values[campo.chave] as string) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.value)}
              disabled={readOnly}
              placeholder={`Informe ${campo.nome.toLowerCase()}`}
            />
          )}

          {campo.tipo === 'numero' && (
            <input
              type="number"
              className="input-base text-[13px]"
              value={(values[campo.chave] as number) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.valueAsNumber)}
              disabled={readOnly}
            />
          )}

          {campo.tipo === 'data' && (
            <input
              type="date"
              className="input-base text-[13px]"
              value={(values[campo.chave] as string) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.value)}
              disabled={readOnly}
            />
          )}

          {campo.tipo === 'select' && campo.opcoes && (
            <select
              className="input-base text-[13px]"
              value={(values[campo.chave] as string) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.value)}
              disabled={readOnly}
            >
              <option value="">Selecione…</option>
              {campo.opcoes.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {campo.tipo === 'usuario' && (
            <input
              type="number"
              className="input-base text-[13px]"
              value={(values[campo.chave] as number) ?? ''}
              onChange={(e) => onChange(campo.chave, e.target.valueAsNumber)}
              disabled={readOnly}
              placeholder="ID do usuário"
            />
          )}

          {campo.tipo === 'arquivo' && !readOnly && (
            <input
              type="file"
              className="input-base text-[13px]"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(campo.chave, file.name);
              }}
            />
          )}

          {campo.tipo === 'arquivo' && readOnly && values[campo.chave] && (
            <span className="text-[12px] text-[var(--accent)] underline cursor-pointer">
              {values[campo.chave] as string}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
