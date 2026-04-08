import { IsInt, IsString, Min, Max } from 'class-validator';

export class UpsertNivelConfigDto {
  @IsInt()
  @Min(1)
  @Max(6)
  nivel: number;

  @IsString()
  labelSingular: string;

  @IsString()
  labelPlural: string;
}
