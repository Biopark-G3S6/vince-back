# Módulos

Cada diretório aqui é um módulo — a fronteira de consistência transacional e de propriedade de
dados (`ADR-0003 §1`). Um módulo é de **negócio**, quando corresponde a uma capacidade de negócio,
ou de **plataforma**, quando é capacidade técnica transversal que exige dados próprios.

**Não** crie diretórios por camada técnica neste nível (`ADR-0003 §2`). A camada vem dentro do
módulo, não acima dele.

## Módulos existentes

| Módulo                        | Natureza   | Capacidade                                         | ADR      |
| :---------------------------- | :--------- | :------------------------------------------------- | :------- |
| [`access/`](access/README.md) | Negócio    | Identidade e autorização — papel, permissão, conta | ADR-0027 |
| `observabilidade/`            | Plataforma | Registro de erros agregado por assinatura          | ADR-0022 |

## Estrutura obrigatória

```
<modulo>/
  contracts/          superfície pública — fachada abstrata, DTOs, eventos publicados
  domain/             entidades, value objects, regras, ports
  application/        casos de uso — um método público de execução por classe
  infrastructure/     repositórios, adapters, consumidores, clientes externos
  presentation/       controllers, rotas, validação de entrada
  <modulo>.module.ts  composition root do módulo
```

## As regras que o lint impõe

| Regra                                                                                            | Origem                   |
| :----------------------------------------------------------------------------------------------- | :----------------------- |
| `contracts/` é a única superfície pública; o `exports` do módulo contém apenas a fachada         | ADR-0004 §1, §4          |
| A fachada é `abstract class`, nunca interface — interface some em runtime e não serve como token | ADR-0004 §2, §3          |
| `domain/` não importa `application/`, `infrastructure/` nem `presentation/`                      | ADR-0003 §5              |
| `application/` não importa `infrastructure/` nem `presentation/`                                 | ADR-0003 §6              |
| `presentation/` não acessa `infrastructure/` nem `domain/` diretamente                           | ADR-0003 §7              |
| Entre módulos, só `contracts/`                                                                   | ADR-0005 §1              |
| Nenhum módulo lê tabela ou fila de outro                                                         | ADR-0006 §2, ADR-0020 §7 |

## Antes de criar um módulo

A criação exige ADR próprio declarando sua capacidade e as tabelas sob sua propriedade
(`ADR-0003 §12`). Módulo de plataforma exige também justificar por que os dados não podem
viver em `shared/` (`ADR-0003 §15`).
