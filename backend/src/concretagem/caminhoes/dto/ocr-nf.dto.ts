import { IsString, IsEnum } from 'class-validator';

export class OcrNfDto {
  @IsString()
  image_base64!: string;

  @IsEnum(['image/jpeg', 'image/png', 'image/webp'])
  media_type!: 'image/jpeg' | 'image/png' | 'image/webp';
}
