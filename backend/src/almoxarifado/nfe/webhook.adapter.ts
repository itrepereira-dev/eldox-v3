// backend/src/almoxarifado/nfe/webhook.adapter.ts
//
// ════════════════════════════════════════════════════════════════════════════
// ADAPTER DE NF-e — Payload Externo → Formato Normalizado Eldox
// ════════════════════════════════════════════════════════════════════════════
//
// COMO INTEGRAR O QIVE (ou qualquer outro hub de NF-e):
//
//   1. Obtenha a documentação do webhook do Qive
//   2. Ajuste APENAS as funções `parseQivePayload` e `extractTenantId` abaixo
//   3. O NfeService, jobs, e toda a lógica de negócio NÃO precisam ser alterados
//
// CAMPOS ESPERADOS DO QIVE (a confirmar com documentação):
//   - Chave de acesso NF-e (44 chars) ......... TODO: mapear campo exato
//   - Número e série da NF ..................... TODO: mapear campo exato
//   - CNPJ e razão social do emitente ......... TODO: mapear campo exato
//   - Data de emissão ......................... TODO: mapear campo exato
//   - Valor total da nota ..................... TODO: mapear campo exato
//   - Array de itens:
//       - xProd (descrição do produto) ........ TODO: mapear campo exato
//       - NCM .................................. TODO: mapear campo exato
//       - CFOP ................................. TODO: mapear campo exato
//       - uCom (unidade comercial) ............ TODO: mapear campo exato
//       - qCom (quantidade) ................... TODO: mapear campo exato
//       - vUnCom (valor unitário) ............. TODO: mapear campo exato
//       - vProd (valor total do item) ......... TODO: mapear campo exato
//
// AUTENTICAÇÃO DO WEBHOOK:
//   - Atualmente: Bearer token via env WEBHOOK_NFE_SECRET
//   - Qive pode usar: HMAC-SHA256, IP whitelist, mTLS, ou token próprio
//   - TODO: ajustar WebhookGuard quando documentação chegar
//
// ════════════════════════════════════════════════════════════════════════════

export interface NfeNormalizada {
  chave_nfe: string; // 44 caracteres — identificador único da NF-e
  numero: string;
  serie: string;
  emitente_cnpj: string;
  emitente_nome: string;
  data_emissao: Date;
  valor_total: number;
  itens: NfeItemNormalizado[];
}

export interface NfeItemNormalizado {
  xprod: string; // descrição original do produto na NF-e
  ncm: string | null;
  cfop: string | null;
  unidade_nfe: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

// ─── Parser Principal ─────────────────────────────────────────────────────────

/**
 * Converte o payload bruto recebido no webhook para o formato normalizado Eldox.
 *
 * TODO: Implementar quando a documentação do Qive estiver disponível.
 * Por enquanto, tenta um mapeamento genérico baseado em campos comuns de NF-e XML/JSON.
 */
export function parseWebhookPayload(
  raw: Record<string, unknown>,
): NfeNormalizada {
  // ── Tentativa de mapeamento genérico ─────────────────────────────────────
  // Suporta formatos comuns de XML-NF-e convertido para JSON (ex: xml2js, fast-xml-parser)
  // Ajustar para o formato exato do Qive quando disponível

  // Tenta diferentes estruturas conhecidas
  const nfe =
    (raw['nfeProc'] as any)?.['NFe']?.['infNFe'] ??
    (raw['NFe'] as any)?.['infNFe'] ??
    raw;
  const ide = nfe['ide'] ?? {};
  const emit = nfe['emit'] ?? {};
  const total = nfe['total'] ?? {};
  const det = nfe['det'] ?? [];

  const chave = extractChave(raw);
  if (!chave) {
    throw new Error(
      'Payload de NF-e inválido: chave de acesso (44 chars) não encontrada. ' +
        'Verifique o mapeamento em webhook.adapter.ts',
    );
  }

  const itens: NfeItemNormalizado[] = (Array.isArray(det) ? det : [det])
    .map((d: any) => {
      const prod = d['prod'] ?? d;
      return {
        xprod: String(prod['xProd'] ?? prod['descricao'] ?? prod['nome'] ?? ''),
        ncm: String(prod['NCM'] ?? prod['ncm'] ?? '') || null,
        cfop: String(prod['CFOP'] ?? prod['cfop'] ?? '') || null,
        unidade_nfe: String(
          prod['uCom'] ?? prod['unidade'] ?? prod['un'] ?? 'un',
        ),
        quantidade: Number(
          prod['qCom'] ?? prod['quantidade'] ?? prod['qtd'] ?? 0,
        ),
        valor_unitario: Number(
          prod['vUnCom'] ?? prod['valorUnitario'] ?? prod['preco'] ?? 0,
        ),
        valor_total: Number(prod['vProd'] ?? prod['valorTotal'] ?? 0),
      };
    })
    .filter((i) => i.xprod);

  return {
    chave_nfe: chave,
    numero: String(ide['nNF'] ?? ide['numero'] ?? raw['numero'] ?? ''),
    serie: String(ide['serie'] ?? raw['serie'] ?? '1'),
    emitente_cnpj: String(
      emit['CNPJ'] ?? emit['cnpj'] ?? raw['emitente_cnpj'] ?? '',
    ).replace(/\D/g, ''),
    emitente_nome: String(
      emit['xNome'] ??
        emit['razaoSocial'] ??
        emit['nome'] ??
        raw['emitente_nome'] ??
        '',
    ),
    data_emissao: parseDate(
      ide['dhEmi'] ?? ide['dEmi'] ?? raw['data_emissao'] ?? new Date(),
    ),
    valor_total: Number(
      total['ICMSTot']?.['vNF'] ?? total['vNF'] ?? raw['valor_total'] ?? 0,
    ),
    itens,
  };
}

/**
 * Extrai o tenant_id do payload do webhook.
 *
 * TODO: O Qive provavelmente envia um identificador do cliente (ex: CNPJ do destinatário).
 * Mapear para tenant_id consultando a tabela de empresas/tenants.
 *
 * Por enquanto, retorna null — o NfeService tratará como NF-e sem tenant vinculado,
 * que precisará ser triado manualmente.
 */
export function extractTenantIdFromPayload(
  _raw: Record<string, unknown>,
): number | null {
  // TODO: implementar lookup de tenant pelo CNPJ do destinatário
  // Exemplo: const destCnpj = raw?.NFe?.infNFe?.dest?.CNPJ
  // return await tenantRepo.findByCnpj(destCnpj)?.id ?? null;
  return null;
}

// ─── Helpers privados ────────────────────────────────────────────────────────

function extractChave(raw: Record<string, unknown>): string | null {
  // Atributo `Id` do elemento <infNFe> vem com prefixo "NFe" (ex: "NFe35260512...")
  // e é onde a chave fica em XML NF-e ainda não autorizado pelo SEFAZ (emissões
  // em teste, uploads manuais antes da transmissão). O fast-xml-parser expõe
  // atributos com prefixo "@_".
  const infNFeId =
    (raw['nfeProc'] as any)?.['NFe']?.['infNFe']?.['@_Id'] ??
    (raw['NFe'] as any)?.['infNFe']?.['@_Id'] ??
    (raw['infNFe'] as any)?.['@_Id'];

  // Tenta vários campos onde a chave pode estar
  const candidates = [
    raw['chave_nfe'],
    raw['chNFe'],
    raw['chave'],
    // Em NF-e autorizada, a chave aparece sem prefixo dentro do protocolo
    (raw['nfeProc'] as any)?.['protNFe']?.['infProt']?.['chNFe'],
    (raw['protNFe'] as any)?.['infProt']?.['chNFe'],
    // Fallback: Id do infNFe (sempre presente, mesmo em NF-e não autorizada)
    infNFeId ? String(infNFeId).replace(/^NFe/i, '') : null,
  ];

  for (const c of candidates) {
    const s = String(c ?? '').replace(/\D/g, '');
    if (s.length === 44) return s;
  }
  return null;
}

function parseDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? new Date() : d;
}
