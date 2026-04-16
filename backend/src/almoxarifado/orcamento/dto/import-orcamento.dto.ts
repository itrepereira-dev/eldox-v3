// backend/src/almoxarifado/orcamento/dto/import-orcamento.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class ImportOrcamentoDto {
  @IsString()
  @IsOptional()
  nome?: string;

  // O arquivo .xlsx chega via multipart (Multer) como req.file
  // Não há campos adicionais obrigatórios no body
}
