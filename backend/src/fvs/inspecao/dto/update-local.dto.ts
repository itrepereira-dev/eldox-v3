import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLocalDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  equipeResponsavel?: string | null;
}
