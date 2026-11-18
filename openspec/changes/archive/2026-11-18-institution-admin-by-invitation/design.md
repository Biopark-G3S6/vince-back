## Decisions

- **Fato em todo aceite.** `access` não conhece `institution` (`ADR-0027` §9); o vínculo nasce no
  `institution`, por evento (`ADR-0005`). Publicar sempre mantém o `access` sem regra de quem
  consome; cada consumidor filtra o que lhe cabe.
- **Vínculo idempotente.** `InstitutionAdminRepository.link` já é idempotente (`RF-INS-002` E1):
  a entrega repetida pelo barramento e pela outbox não duplica.
- **O papel não é reatribuído.** A conta já nasce com `INSTITUTION_ADMIN` pelo convite; o consumidor
  só cria o vínculo.
- **Sem retroativo.** Não há migração que cruze os schemas `access` e `institution`
  (`ADR-0018` §13): as contas antigas se resolvem pela designação, que é idempotente no papel.
