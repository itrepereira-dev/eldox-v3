// backend/src/almoxarifado/nfe/xml-parser.util.ts
//
// ════════════════════════════════════════════════════════════════════════════
// Parser de XML NF-e 4.0 (modelo 55) para formato normalizado Eldox.
// ════════════════════════════════════════════════════════════════════════════
//
// Recebe a string XML (normalmente o conteúdo bruto do arquivo .xml enviado
// pelo usuário via upload manual) e devolve um objeto JSON que o
// parseWebhookPayload() existente já sabe processar.
//
// Formatos suportados:
//   • nfeProc > NFe > infNFe (envelope completo assinado — mais comum)
//   • NFe > infNFe           (sem assinatura)
//   • Raiz <NFe>             (forma simplificada)
//
// O parseWebhookPayload() em webhook.adapter.ts tenta todas as estruturas
// via fallback, então qualquer uma delas funciona aqui.
//
// Fora do escopo deste parser:
//   • NFC-e modelo 65 (e-commerce) — estrutura similar, mas não exercitado
//   • NFS-e municipal — schema completamente diferente por município
//   • Eventos NF-e (cancelamento 110111, CCE 110110) — tratamento à parte
//   • Validação de assinatura digital XMLDSig
//
// ════════════════════════════════════════════════════════════════════════════

import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // NF-e usa arrays naturais em <det> (um por item) mas fast-xml-parser
  // só transforma em array quando tem 2+ elementos. Forçamos det como array.
  isArray: (name) => ['det'].includes(name),
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

/**
 * Parseia string XML de NF-e 4.0 em objeto JSON.
 * Lança Error se o XML for malformado.
 */
export function parseNfeXmlToJson(xml: string): Record<string, unknown> {
  if (!xml || typeof xml !== 'string') {
    throw new Error('XML vazio ou inválido');
  }

  const trimmed = xml.trim();
  if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
    throw new Error('Arquivo não parece ser XML (não começa com "<")');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(trimmed) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Erro ao parsear XML: ${msg}`);
  }

  // Valida estrutura mínima antes de entregar — falha rápido com erro claro.
  const hasNfe =
    !!(parsed['nfeProc'] as Record<string, unknown>)?.['NFe'] ||
    !!parsed['NFe'] ||
    !!parsed['infNFe'];

  if (!hasNfe) {
    throw new Error(
      'XML não parece ser uma NF-e (não foi encontrado elemento <NFe>, ' +
        '<nfeProc> ou <infNFe> na raiz). Confira se o arquivo não é uma ' +
        'NFS-e, carta de correção ou evento de cancelamento.',
    );
  }

  return parsed;
}
