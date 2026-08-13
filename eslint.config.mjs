// Enforcement automatizado das fronteiras entre módulos (ADR-0007).
// Violação é erro, nunca aviso (ADR-0007 §6). O comando de verificação reprova o build.
//
// Regras de fronteira que esta configuração impõe:
//   ADR-0003 §5  domain/ não importa application/, infrastructure/ nem presentation/
//   ADR-0003 §6  application/ não importa infrastructure/ nem presentation/
//   ADR-0003 §7  presentation/ não acessa infrastructure/ nem domain/ diretamente
//   ADR-0005 §1  entre módulos, apenas contracts/
//   ADR-0009 §7  shared/ não importa de modules/

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const sameModule = (type) => [type, { module: '${from.module}' }];

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'docs/**', 'coverage/**', 'generated/**'] },

  eslint.configs.recommended,

  // Arquivos de configuração na raiz: fora do projeto TypeScript, sem análise
  // baseada em tipos e fora das regras de fronteira.
  {
    files: ['*.mjs', '*.js', '*.config.ts', 'test-setup.ts'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },

  {
    files: ['src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Prefixo com sublinhado marca parâmetro deliberadamente não usado.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      // Sem o resolvedor de TypeScript, importações relativas para arquivos .ts
      // não são resolvidas e o plugin as classifica como desconhecidas.
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
      },
      'boundaries/include': ['src/**/*.ts'],
      'boundaries/elements': [
        { type: 'main', pattern: 'src/main.ts', mode: 'file' },
        { type: 'app', pattern: 'src/app/**/*', mode: 'file' },
        { type: 'shared', pattern: 'src/shared/**/*', mode: 'file' },
        {
          type: 'module-root',
          pattern: 'src/modules/*/*.module.ts',
          mode: 'file',
          capture: ['module'],
        },
        {
          type: 'contracts',
          pattern: 'src/modules/*/contracts/**/*',
          mode: 'file',
          capture: ['module'],
        },
        {
          type: 'domain',
          pattern: 'src/modules/*/domain/**/*',
          mode: 'file',
          capture: ['module'],
        },
        {
          type: 'application',
          pattern: 'src/modules/*/application/**/*',
          mode: 'file',
          capture: ['module'],
        },
        {
          type: 'infrastructure',
          pattern: 'src/modules/*/infrastructure/**/*',
          mode: 'file',
          capture: ['module'],
        },
        {
          type: 'presentation',
          pattern: 'src/modules/*/presentation/**/*',
          mode: 'file',
          capture: ['module'],
        },
      ],
    },
    rules: {
      'boundaries/no-unknown': 'error',
      'boundaries/no-unknown-files': 'error',
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message: '${file.type} não pode importar de ${dependency.type} (ver ADR-0003 e ADR-0005)',
          rules: [
            // Ponto de entrada: só monta a aplicação.
            { from: 'main', allow: ['app', 'shared'] },

            // Composition root: conhece os módulos por seu registro e seus contratos.
            { from: 'app', allow: ['app', 'shared', 'module-root', 'contracts'] },

            // Kernel compartilhado: nunca aponta para módulos (ADR-0009 §7).
            { from: 'shared', allow: ['shared'] },

            // Registro do módulo: monta o próprio módulo e consome contratos alheios.
            {
              from: 'module-root',
              allow: [
                'shared',
                'contracts',
                sameModule('domain'),
                sameModule('application'),
                sameModule('infrastructure'),
                sameModule('presentation'),
              ],
            },

            // Superfície pública: sem dependência de implementação (ADR-0004 §8).
            { from: 'contracts', allow: ['shared', sameModule('contracts')] },

            // Domínio: não conhece camada alguma acima dele (ADR-0003 §5).
            { from: 'domain', allow: ['shared', sameModule('domain')] },

            // Aplicação: domínio próprio e contratos — próprios e alheios (ADR-0003 §6).
            {
              from: 'application',
              allow: ['shared', 'contracts', sameModule('domain'), sameModule('application')],
            },

            // Infraestrutura: implementa os ports do domínio próprio.
            {
              from: 'infrastructure',
              allow: [
                'shared',
                'contracts',
                sameModule('domain'),
                sameModule('application'),
                sameModule('infrastructure'),
              ],
            },

            // Apresentação: invoca casos de uso, nunca repositório ou entidade (ADR-0003 §7).
            {
              from: 'presentation',
              allow: ['shared', 'contracts', sameModule('application'), sameModule('presentation')],
            },
          ],
        },
      ],
      // Importação relativa não pode atravessar a raiz de um módulo (ADR-0007 §9).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../modules/*', '../../../*'],
              message:
                'Importação relativa atravessando módulo. Use @modules/<modulo>/contracts (ADR-0007 §8, §9).',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
