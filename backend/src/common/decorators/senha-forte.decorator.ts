import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';

/**
 * @SenhaForte — aplica validação de senha forte:
 *   - mínimo 10 caracteres
 *   - pelo menos 1 letra minúscula
 *   - pelo menos 1 letra maiúscula
 *   - pelo menos 1 número
 *   - pelo menos 1 caractere especial (não-alfanumérico)
 *
 * Uso:
 *   @SenhaForte()
 *   senha!: string;
 */
export function SenhaForte(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(10, { message: 'Senha deve ter no mínimo 10 caracteres' }),
    Matches(/[a-z]/, {
      message: 'Senha deve conter ao menos uma letra minúscula',
    }),
    Matches(/[A-Z]/, {
      message: 'Senha deve conter ao menos uma letra maiúscula',
    }),
    Matches(/\d/, { message: 'Senha deve conter ao menos um número' }),
    Matches(/[^A-Za-z0-9]/, {
      message: 'Senha deve conter ao menos um caractere especial',
    }),
  );
}

/**
 * Normaliza e-mail: lowercase + trim.
 * Nunca muda null/undefined.
 */
export function normalizarEmail(email: string | undefined | null): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}
