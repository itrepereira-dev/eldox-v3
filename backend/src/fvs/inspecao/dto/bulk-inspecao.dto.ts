// backend/src/fvs/inspecao/dto/bulk-inspecao.dto.ts
import { IsNumber, IsEnum, IsOptional, IsString, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class BulkInspecaoDto {
  @IsNumber()
  servicoId: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsNumber({}, { each: true })
  localIds: number[];

  @IsEnum(['conforme', 'excecao'])
  status: 'conforme' | 'excecao';

  @IsOptional()
  @IsString()
  observacao?: string;
}
