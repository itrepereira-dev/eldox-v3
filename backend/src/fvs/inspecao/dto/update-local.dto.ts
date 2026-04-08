import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateLocalDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(200)
  equipeResponsavel?: string | null;
}
