-- Fixup: rename FK constraints that were not renamed in 20260416100000_rename_betonadas_to_concretagens

ALTER TABLE "laudos_laboratorio" RENAME CONSTRAINT "fk_laudo_betonada" TO "fk_laudo_concretagem";

ALTER TABLE "fornecedor_portal_tokens" RENAME CONSTRAINT "fornecedor_portal_tokens_betonada_id_fkey" TO "fornecedor_portal_tokens_concretagem_id_fkey";
