import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class ImportQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  dry_run?: boolean;
}
