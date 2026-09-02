import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { httpStatusOf, RESPONSE_CODES, type ResponseCode } from './response-code';

/**
 * A descrição do envelope na especificação OpenAPI (`ADR-0017` §1, §2).
 *
 * Existe porque o cliente **deriva os seus tipos da especificação** (§2) e é proibido de
 * declará-los à mão (§5): um envelope descrito como objeto anônimo produziria, do outro
 * lado, um tipo anônimo por endpoint, e a mudança do envelope não apareceria em lugar
 * nenhum como uma mudança só. Os modelos abaixo são nomeados por isso.
 */

export class ResponseStatusDto {
  @ApiProperty({
    enum: RESPONSE_CODES,
    description: 'Código estável do catálogo da URS §2.4. É por ele que o cliente decide.',
  })
  code!: ResponseCode;

  @ApiProperty({ enum: ['success', 'warning', 'error'] })
  severity!: 'success' | 'warning' | 'error';

  @ApiPropertyOptional({
    description:
      'Texto de reserva, exibido apenas quando o cliente não reconhece o código ' +
      '(ADR-0025 §10, §12). Omitido por toda esta vertical.',
  })
  message?: string;
}

export class FieldErrorDto {
  @ApiProperty({ description: 'O caminho do campo inválido no corpo submetido.' })
  field!: string;

  @ApiProperty({ description: 'O que há de errado com o campo. Traduzido no cliente.' })
  code!: string;

  @ApiPropertyOptional({
    description:
      'Valores a interpolar na mensagem traduzida (ADR-0026 §16). NUNCA o valor submetido.',
    type: 'object',
    additionalProperties: true,
  })
  meta?: Record<string, string | number | boolean>;
}

/** O envelope de falha: `data` nulo, e `errors` só na validação de campos. */
export class FailureEnvelopeDto {
  @ApiProperty({ type: 'object', nullable: true, additionalProperties: true, example: null })
  data!: null;

  @ApiProperty({ type: ResponseStatusDto })
  status!: ResponseStatusDto;

  @ApiPropertyOptional({ type: [FieldErrorDto] })
  errors?: FieldErrorDto[];
}

/**
 * Documenta a resposta de sucesso: o envelope, com `data` do tipo informado.
 *
 * `allOf` sobre o modelo nomeado do envelope é o que faz o gerador do cliente produzir
 * um tipo genérico, e não uma cópia do envelope por endpoint.
 */
export function ApiEnvelope(
  dataType: Type<unknown>,
  options: { readonly status?: number; readonly description?: string } = {},
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(ResponseStatusDto, dataType),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        type: 'object',
        required: ['data', 'status'],
        properties: {
          data: { $ref: getSchemaPath(dataType) },
          status: { $ref: getSchemaPath(ResponseStatusDto) },
        },
      },
    }),
  );
}

/**
 * Documenta as falhas que o endpoint pode devolver, uma resposta por status HTTP.
 *
 * Os códigos vêm do catálogo, e o status de cada um também: é o mesmo mapa que o tratador
 * global usa, de modo que a especificação não pode divergir do que o servidor faz.
 */
export function ApiFailures(...codes: readonly ResponseCode[]): MethodDecorator & ClassDecorator {
  const byStatus = new Map<number, ResponseCode[]>();

  for (const code of codes) {
    const status = httpStatusOf(code);
    byStatus.set(status, [...(byStatus.get(status) ?? []), code]);
  }

  return applyDecorators(
    ApiExtraModels(FailureEnvelopeDto),
    ...[...byStatus].map(([status, group]) =>
      ApiResponse({
        status,
        description: group.join(', '),
        type: FailureEnvelopeDto,
      }),
    ),
  );
}
