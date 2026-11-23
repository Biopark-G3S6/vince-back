## Why

O projeto será apresentado com o sistema rodando, e um banco recém-criado só tem o administrador de
sistema. Montar à mão instituições, pessoas, eventos e artigos em cada estágio do ciclo leva tempo e
não se repete igual entre máquinas, como na do projetor, que roda Windows.

## What Changes

- Novo comando `pnpm run db:demo`, que monta pela API pública um cenário de demonstração:
  - as instituições de ensino superior de Toledo-PR, com cursos reais;
  - pessoas, turmas, eventos, equipes, artigos, notas e publicações fictícios.
- O comando executa a carga inicial (`seed-catalog`) e define a senha do administrador de sistema
  no primeiro uso.
- Ao reconhecer uma carga já feita, o comando só lista os acessos.
- Os prazos são relativos ao dia da carga, para que o cronograma tenha sempre etapas vencidas e a
  vencer.
- Os e-mails usam o domínio reservado `.test` e nunca são entregues.

Nenhum endpoint, regra ou tabela muda: a carga é cliente da API, e por isso a mudança declara
`skip_specs`.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

Nenhuma.

## Impact

- `src/app/bootstrap/demo/` (novo): cliente da API, conteúdo da carga e executor.
- `package.json`: script `db:demo`.
- `README.md`: o comando na tabela de comandos.
- Achado lateral: o processo do `seed-catalog` não termina sozinho depois de imprimir o relatório.
  A carga contorna o problema encerrando o processo; a correção do seed fica fora desta mudança.
