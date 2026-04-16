import { PartialType } from '@nestjs/mapped-types';
import { CreateFornecedorDto } from './create-fornecedor.dto';
import { IsOptional, IsIn } from 'class-validator';

export class UpdateFornecedorDto extends PartialType(CreateFornecedorDto) {
  @IsOptional() @IsIn(['em_avaliacao', 'homologado', 'suspenso', 'desqualificado'])
  situacao?: string;
}
