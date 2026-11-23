# Carga de demonstração

Dados de ilustração para apresentar o sistema. As instituições são as de ensino superior de
Toledo-PR (Faculdade Biopark, UTFPR, Unioeste e PUCPR), com cursos que elas oferecem. **Pessoas,
turmas, eventos, artigos, notas e publicações são fictícios.** Os e-mails usam o domínio reservado
`.test`, que nunca é entregue.

A carga passa pela API pública, como a interface faz: cada dado obedece às regras de negócio e
cada módulo grava só o que é dele. Não use em produção.

## Como rodar

Com o banco migrado e a API no ar (`pnpm run start:dev`), em outro terminal:

```bash
pnpm run db:demo
```

O comando compila o projeto, executa a carga inicial (`db:seed`), define a senha do
administrador de sistema no primeiro uso e monta o cenário. Ele leva poucos segundos. Rodar de
novo no mesmo banco não duplica nada: a carga reconhece que já foi feita e só lista os acessos.

| Variável              | Padrão                         |
| :-------------------- | :----------------------------- |
| `DEMO_API_URL`        | `http://localhost:3000/api/v1` |
| `DEMO_ADMIN_EMAIL`    | `admin@vinceart.local`         |
| `DEMO_ADMIN_PASSWORD` | `Vince#Admin2026`              |

Se a senha do administrador de sistema já tiver sido definida antes, informe-a em
`DEMO_ADMIN_PASSWORD`.

## Acessos

Senha de todas as contas da carga: `VinceArt@2026`.

| Papel                                    | E-mail                             |
| :--------------------------------------- | :--------------------------------- |
| Administrador de sistema                 | `admin@vinceart.local`             |
| Administradora — Faculdade Biopark       | `mariana.kowalski@biopark.test`    |
| Administrador — UTFPR Câmpus Toledo      | `sergio.venturini@utfpr.test`      |
| Administradora — Unioeste Campus Toledo  | `claudia.mertz@unioeste.test`      |
| Administradora — PUCPR Câmpus Toledo     | `renata.galvao@pucpr.test`         |
| Coordenador de Engenharia de Software    | `rafael.bortolini@biopark.test`    |
| Professor orientador                     | `thiago.hoffmann@biopark.test`     |
| Aluno, artigo devolvido com apontamentos | `lucas.zimmermann@biopark.test`    |
| Aluna, artigo concluído e publicado      | `fernanda.lorenzetti@biopark.test` |

Todas as contas estão em [`demo-dataset.ts`](demo-dataset.ts): o e-mail é a chave da pessoa
seguida do domínio da instituição.

## O que a carga monta

- 4 instituições, 10 cursos, 7 turmas, 21 administradores e professores e 41 alunos.
- Na Biopark, três modelos de artigo: o institucional (com duas versões), o do curso de
  Engenharia de Software e um desativado.
- 7 eventos nos três escopos (instituição, curso e turma). Os cronogramas têm etapas vencidas e
  etapas a vencer, contadas a partir do dia da carga.
- 14 equipes, cada artigo num ponto do ciclo:
  - iniciado;
  - em escrita, com conteúdo e referências;
  - entregue e aguardando correção;
  - devolvido com apontamentos e discussão;
  - concluído, com nota, notas individuais e publicação externa.
