import { IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Nova versão herda título/pasta/categoria do documento pai — só informamos
// o arquivo e metadados próprios desta revisão (número, disciplina, workflow).
export class CriarVersaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  numeroRevisao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  disciplina?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  workflowTemplateId?: number;
}
