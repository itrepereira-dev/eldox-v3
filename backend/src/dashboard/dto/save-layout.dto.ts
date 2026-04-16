import { IsArray, IsString, IsNumber, IsObject, ValidateNested, IsOptional, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class WidgetInstanceDto {
  @IsString()
  instanceId: string;

  @IsString()
  widgetId: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsNumber()
  w: number;

  @IsNumber()
  h: number;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class SaveLayoutDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => WidgetInstanceDto)
  layout: WidgetInstanceDto[];
}
