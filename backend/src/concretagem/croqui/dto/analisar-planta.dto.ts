// backend/src/concretagem/croqui/dto/analisar-planta.dto.ts
import {
  IsBase64,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// ceil(25MB * 4/3)
const MAX_BASE64_LENGTH = 34_952_534;

export class AnalisarPlantaDto {
  @IsBase64()
  @MaxLength(MAX_BASE64_LENGTH, { message: 'Arquivo excede o limite de 25 MB' })
  arquivo_base64!: string;

  @IsIn(['image/jpeg', 'image/png', 'application/pdf'], {
    message: 'Formato não suportado. Use JPEG, PNG ou PDF',
  })
  mime_type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contexto?: string; // ex: "Laje P3 – Bloco A"
}
