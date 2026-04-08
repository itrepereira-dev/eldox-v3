import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge, StatusDot } from '@/components/ui/Badge'
import { KpiCard, KpiGrid } from '@/components/ui/KpiCard'
import { Field, Input, Select } from '@/components/ui/Input'
import {
  Plus, Download, Layers, ClipboardList, AlertTriangle,
  FlaskConical, Users, CheckCircle,
} from 'lucide-react'

export function TestShellPage() {
  return (
    <AppShell
      breadcrumb={[
        { label: 'Dashboard' },
      ]}
      primaryAction={{ label: 'Nova Obra', onClick: () => {} }}
    >
      {/* ── KPIs ─────────────────────────────────────── */}
      <KpiGrid cols={4} className="mb-6">
        <KpiCard
          label="Obras Ativas"
          value={12}
          sub="3 em PBQP-H"
          variant="run"
          icon={<Layers size={16} />}
          trend={{ value: 8, label: 'vs mês anterior' }}
        />
        <KpiCard
          label="FVS Pendentes"
          value={47}
          sub="18 aguardando aprovação"
          variant="warn"
          icon={<ClipboardList size={16} />}
          trend={{ value: -3, label: 'vs semana anterior' }}
        />
        <KpiCard
          label="Não Conformidades"
          value={9}
          sub="2 críticas em aberto"
          variant="nc"
          icon={<AlertTriangle size={16} />}
        />
        <KpiCard
          label="Betonadas este mês"
          value={34}
          sub="1.820 m³ lançados"
          variant="ok"
          icon={<FlaskConical size={16} />}
          trend={{ value: 12, label: 'vs mês anterior' }}
        />
      </KpiGrid>

      {/* ── Obras recentes ────────────────────────────── */}
      <div className="mb-6">
        <PageHeader
          title="Obras recentes"
          subtitle="Acompanhamento das obras com atividade nas últimas 48h"
          actions={
            <>
              <Button variant="ghost" size="sm" icon={<Download size={13} />}>
                Exportar
              </Button>
              <Button size="sm" icon={<Plus size={13} />}>
                Nova Obra
              </Button>
            </>
          }
        />

        <div className="table-wrap">
          <table className="eldox-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Obra</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>FVS</th>
                <th>NCs</th>
                <th>Modo</th>
              </tr>
            </thead>
            <tbody>
              {OBRAS_MOCK.map(obra => (
                <tr key={obra.codigo} className="cursor-pointer">
                  <td>
                    <span className="font-mono text-xs text-text-faint">{obra.codigo}</span>
                  </td>
                  <td>
                    <span className="font-medium text-text-high">{obra.nome}</span>
                  </td>
                  <td>
                    <span className="text-text-low">{obra.tipo}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <StatusDot variant={obra.statusVariant} />
                      <span className="text-xs">{obra.status}</span>
                    </div>
                  </td>
                  <td>
                    <Badge variant={obra.fvsVariant}>{obra.fvs} pendentes</Badge>
                  </td>
                  <td>
                    {obra.ncs > 0
                      ? <Badge variant="nc">{obra.ncs} abertas</Badge>
                      : <Badge variant="ok">0</Badge>
                    }
                  </td>
                  <td>
                    {obra.pbqph
                      ? <Badge variant="run">PBQP-H</Badge>
                      : <span className="text-xs text-text-faint">Simples</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Componentes UI ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Botões */}
        <div className="bg-bg-surface border border-border-dim rounded-sm p-5">
          <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Botões</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm">Aprovar FVS</Button>
            <Button variant="ghost" size="sm">Cancelar</Button>
            <Button variant="gray" size="sm">Ver mais</Button>
            <Button variant="ok" size="sm" icon={<CheckCircle size={13} />}>Concluído</Button>
            <Button variant="nc" size="sm">Reprovar</Button>
            <Button variant="outline-accent" size="sm">EldoX IA</Button>
            <Button variant="primary" size="sm" loading>Salvando...</Button>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-bg-surface border border-border-dim rounded-sm p-5">
          <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Status Badges</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="ok">Aprovado</Badge>
            <Badge variant="run">Em execução</Badge>
            <Badge variant="warn">Pendente</Badge>
            <Badge variant="nc">Não Conforme</Badge>
            <Badge variant="off">Inativo</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5"><StatusDot variant="ok" /><span className="text-xs text-text-low">OK</span></div>
            <div className="flex items-center gap-1.5"><StatusDot variant="run" /><span className="text-xs text-text-low">Em andamento</span></div>
            <div className="flex items-center gap-1.5"><StatusDot variant="warn" /><span className="text-xs text-text-low">Atenção</span></div>
            <div className="flex items-center gap-1.5"><StatusDot variant="nc" /><span className="text-xs text-text-low">NC</span></div>
          </div>
        </div>

        {/* Formulário */}
        <div className="bg-bg-surface border border-border-dim rounded-sm p-5">
          <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Formulário</p>
          <Field label="Nome da Obra" required>
            <Input placeholder="Ex: Residencial Aurora" />
          </Field>
          <Field label="Tipo de Obra">
            <Select>
              <option>Residencial Vertical</option>
              <option>Galpão Industrial</option>
              <option>Hospitalar</option>
            </Select>
          </Field>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="ghost" size="sm">Cancelar</Button>
            <Button size="sm">Salvar</Button>
          </div>
        </div>

        {/* Efetivo resumo */}
        <div className="bg-bg-surface border border-border-dim rounded-sm p-5">
          <p className="text-xs font-mono text-text-faint uppercase tracking-wider mb-4">Efetivo hoje</p>
          <div className="space-y-3">
            {EFETIVO_MOCK.map(e => (
              <div key={e.nome} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-dim flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
                  {e.iniciais}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-high">{e.nome}</p>
                  <p className="text-xs text-text-faint">{e.funcao}</p>
                </div>
                <Badge variant={e.presente ? 'ok' : 'off'}>{e.presente ? 'Presente' : 'Ausente'}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Aviso sobre tema ─────────────────────────── */}
      <div className="bg-run-bg border border-run-border rounded-sm p-4 flex items-start gap-3">
        <Users size={16} className="text-run mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-text-high mb-0.5">Página de teste — design system integrado</p>
          <p className="text-xs text-text-low">
            Use o botão Sol/Lua no rodapé da sidebar para alternar entre dark e light mode.
            Todos os tokens se adaptam automaticamente.
          </p>
        </div>
      </div>
    </AppShell>
  )
}

const OBRAS_MOCK = [
  { codigo: 'OBR-2026-001', nome: 'Residencial Aurora — Torre A', tipo: 'Residencial Vertical', status: 'Em Execução', statusVariant: 'run' as const, fvs: 12, fvsVariant: 'warn' as const, ncs: 2, pbqph: true },
  { codigo: 'OBR-2026-002', nome: 'Galpão Logístico Norte', tipo: 'Galpão Industrial', status: 'Em Execução', statusVariant: 'run' as const, fvs: 3, fvsVariant: 'run' as const, ncs: 0, pbqph: false },
  { codigo: 'OBR-2026-003', nome: 'Clínica São Lucas', tipo: 'Hospitalar', status: 'Planejamento', statusVariant: 'off' as const, fvs: 0, fvsVariant: 'off' as const, ncs: 0, pbqph: true },
  { codigo: 'OBR-2026-004', nome: 'Condomínio Verde Ville', tipo: 'Residencial Horizontal', status: 'Em Execução', statusVariant: 'run' as const, fvs: 8, fvsVariant: 'warn' as const, ncs: 3, pbqph: false },
]

const EFETIVO_MOCK = [
  { iniciais: 'CP', nome: 'Carlos Pereira', funcao: 'Engenheiro de Qualidade', presente: true },
  { iniciais: 'MS', nome: 'Marina Silva', funcao: 'Técnica de Obras', presente: true },
  { iniciais: 'JO', nome: 'João Oliveira', funcao: 'Mestre de Obras', presente: false },
  { iniciais: 'AL', nome: 'Ana Lima', funcao: 'Laboratorista', presente: true },
]
