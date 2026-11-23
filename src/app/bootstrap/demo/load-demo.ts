import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { ApiError, ApiSession, eventually } from './api-client';
import {
  DEMO_INSTITUTIONS,
  DEMO_PASSWORD,
  type ArticleText,
  type DemoEvent,
  type DemoInstitution,
  type DemoTemplate,
  type Person,
  type Team,
} from './demo-dataset';

/**
 * Carga de demonstração, acionada por `pnpm run db:demo` com a API no ar.
 *
 * Executa a carga inicial (`seed-catalog`), define a senha do administrador de sistema no
 * primeiro uso e monta, pela API pública, o cenário de `demo-dataset.ts`. Não é idempotente
 * por registro: se a primeira instituição já existir, a carga é dada como feita e só repete
 * a lista de acessos.
 */

const API_URL = process.env.DEMO_API_URL ?? 'http://localhost:3000/api/v1';
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? 'admin@vinceart.local';
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD ?? 'Vince#Admin2026';

const SYSTEM_ADMIN_NAME = 'Administração VinceArt';
const DAY = 24 * 60 * 60 * 1000;

type Account = { id: string; email: string; name: string; session?: ApiSession };

const log = (line: string) => process.stdout.write(`${line}\n`);

/** Prazo às 23h59 de Brasília, a `days` dias da carga. */
function deadline(days: number): string {
  const date = new Date(Date.now() + days * DAY);
  date.setUTCHours(26, 59, 0, 0);
  return date.toISOString();
}

function semester(): { term: string; startsAt: string; endsAt: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() < 6
    ? {
        term: `${year}/1`,
        startsAt: `${year}-02-16T03:00:00.000Z`,
        endsAt: `${year}-07-10T03:00:00.000Z`,
      }
    : {
        term: `${year}/2`,
        startsAt: `${year}-08-03T03:00:00.000Z`,
        endsAt: `${year}-12-18T03:00:00.000Z`,
      };
}

const text = (value: string) => ({ type: 'text', text: value });
const heading = (level: number, value: string) => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});
const paragraph = (value: string) => ({ type: 'paragraph', content: [text(value)] });

const FORMAT = {
  fontFamily: 'Times New Roman',
  fontSize: 12,
  lineHeight: 1.5,
  textAlign: 'justify',
};

function templateContent(sections: readonly string[]) {
  return {
    type: 'doc',
    attrs: { vinceFormat: FORMAT },
    content: [
      heading(1, 'Título do artigo'),
      paragraph('Autores e afiliação'),
      heading(2, 'Resumo'),
      paragraph('Resumo de 100 a 250 palavras, seguido de três a cinco palavras-chave.'),
      ...sections.flatMap((section) => [heading(2, section), paragraph('')]),
      heading(2, 'Referências'),
    ],
  };
}

function articleContent(title: string, body: ArticleText) {
  return {
    type: 'doc',
    attrs: { vinceFormat: FORMAT },
    content: [
      heading(1, title),
      heading(2, 'Resumo'),
      paragraph(body.abstract),
      paragraph(`Palavras-chave: ${body.keywords.join('; ')}.`),
      ...body.sections.flatMap((section) => [
        heading(2, section.heading),
        ...section.paragraphs.map(paragraph),
      ]),
    ],
  };
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

const inAMonth = () => new Date(Date.now() + 30 * DAY).toISOString();

class DemoLoader {
  private readonly people = new Map<string, Account>();
  private readonly courses = new Map<string, string>();
  private readonly cohorts = new Map<string, string>();
  private readonly templates = new Map<string, string>();
  private institutionId = '';
  /** Turma → coordenador do curso: quem nomeia o orientador responsável (RF-EQP-005). */
  private readonly cohortCoordinators = new Map<string, string>();

  constructor(
    private readonly admin: ApiSession,
    private readonly institution: DemoInstitution,
  ) {}

  private email(key: string) {
    return `${key}@${this.institution.emailDomain}`;
  }

  private account(key: string): Account {
    const account = this.people.get(key);
    if (account === undefined) throw new Error(`pessoa desconhecida na carga: ${key}`);
    return account;
  }

  private async as(key: string): Promise<ApiSession> {
    const account = this.account(key);
    account.session ??= await ApiSession.login(API_URL, account.email, DEMO_PASSWORD);
    return account.session;
  }

  private async accept(url: string, name: string, email?: string): Promise<string> {
    const token = url.split('/').pop() ?? '';
    const accepted = await ApiSession.anonymous(API_URL).post<{ userId: string }>(
      `/invitations/${token}/acceptance`,
      { name, ...(email === undefined ? {} : { email }), password: DEMO_PASSWORD },
    );
    return accepted.userId;
  }

  private async invite(actor: ApiSession, institutionId: string, roleCode: string, person: Person) {
    const email = this.email(person.key);
    const issued = await actor.post<{ url: string }>(`/institutions/${institutionId}/invitations`, {
      roleCode,
      targetEmail: email,
      expiresAt: inAMonth(),
    });
    const id = await this.accept(issued.url, person.name);
    this.people.set(person.key, { id, email, name: person.name });

    if (person.expertise !== undefined) {
      await (await this.as(person.key)).patch('/profile', { expertiseArea: person.expertise });
    }
  }

  async run(): Promise<void> {
    const data = this.institution;
    const created = await this.admin.post<{ id: string }>('/institutions', {
      name: data.name,
      code: data.code,
      website: data.website,
      city: data.city,
      state: data.state,
    });
    this.institutionId = created.id;
    log(`\n${data.name}`);

    await this.invite(this.admin, created.id, 'INSTITUTION_ADMIN', data.admin);
    const institutionAdmin = await this.as(data.admin.key);

    for (const professor of data.professors) {
      await this.invite(institutionAdmin, created.id, 'PROFESSOR', professor);
    }
    log(`  ${data.professors.length + 1} contas de gestão e docência`);

    const { term, startsAt, endsAt } = semester();
    let students = 0;

    for (const course of data.courses) {
      const { id: courseId } = await institutionAdmin.post<{ id: string }>('/courses', {
        name: course.name,
        identification: course.identification,
      });
      this.courses.set(course.identification, courseId);
      await institutionAdmin.post(`/courses/${courseId}/coordinator`, {
        userId: this.account(course.coordinator).id,
      });
      const coordinator = await this.as(course.coordinator);

      for (const cohort of course.cohorts) {
        const { id: cohortId } = await coordinator.post<{ id: string }>(
          `/courses/${courseId}/cohorts`,
          { identification: cohort.identification, term, startsAt, endsAt },
        );
        this.cohorts.set(cohort.identification, cohortId);
        this.cohortCoordinators.set(cohort.identification, course.coordinator);

        for (const professor of cohort.professors) {
          await coordinator.post(`/cohorts/${cohortId}/professors/${this.account(professor).id}`);
        }

        const teacher = await this.as(cohort.professors[0] ?? course.coordinator);

        for (const student of cohort.students) {
          const issued = await teacher.post<{ url: string }>(`/cohorts/${cohortId}/invitations`, {
            expiresAt: inAMonth(),
          });
          const email = this.email(student.key);
          const id = await this.accept(issued.url, student.name, email);
          this.people.set(student.key, { id, email, name: student.name });
          students += 1;
        }
      }
    }
    log(
      `  ${count(data.courses.length, 'curso')}, ${count(this.cohorts.size, 'turma')}, ` +
        `${count(students, 'aluno')}`,
    );

    for (const template of data.templates) {
      await this.template(template);
    }

    for (const event of data.events) {
      await this.event(event);
    }
  }

  private async template(template: DemoTemplate) {
    const owner = await this.as(template.owner);
    const courseId = template.course === undefined ? null : this.courses.get(template.course);
    const { id } = await owner.post<{ id: string }>('/article-templates', {
      name: template.name,
      description: template.description,
      courseId,
      content: templateContent(template.sections),
    });
    this.templates.set(template.name, id);

    if (template.revisedSections !== undefined) {
      await owner.patch(`/article-templates/${id}`, {
        content: templateContent(template.revisedSections),
      });
    }

    if (template.deactivated === true) {
      await owner.post(`/article-templates/${id}/deactivation`);
    }

    log(`  modelo: ${template.name}`);
  }

  private scopeOf(event: DemoEvent): { scopeType: string; scopeId: string } {
    switch (event.scope.type) {
      case 'INSTITUTION':
        return { scopeType: 'INSTITUTION', scopeId: this.institutionId };
      case 'COURSE':
        return { scopeType: 'COURSE', scopeId: this.courses.get(event.scope.course) ?? '' };
      case 'COHORT':
        return { scopeType: 'COHORT', scopeId: this.cohorts.get(event.scope.cohort) ?? '' };
    }
  }

  private async event(event: DemoEvent) {
    const owner = await this.as(event.owner);
    const scope = this.scopeOf(event);
    const { id: eventId } = await owner.post<{ id: string }>('/events', {
      ...scope,
      title: event.title,
      theme: event.theme,
      researchProblem: event.researchProblem,
      objectives: event.objectives,
      maxTeams: event.maxTeams,
      maxTeamSize: event.maxTeamSize,
    });

    for (const [index, milestone] of event.milestones.entries()) {
      await owner.post(`/events/${eventId}/milestones`, {
        name: milestone.name,
        order: index + 1,
        dueAt: deadline(milestone.days),
      });
    }

    if (event.template !== undefined) {
      await owner.post('/article-template-selections', {
        eventId,
        templateId: this.templates.get(event.template),
      });
    }

    for (const advisor of event.advisors) {
      await owner.post(`/events/${eventId}/advisors/${this.account(advisor).id}`);
    }

    log(`  evento: ${event.title}`);

    // Nomear o orientador responsável é do dono do escopo com a permissão de gestão: num
    // evento de turma, o coordenador do curso, e não o professor que criou o evento.
    const nominator =
      event.scope.type === 'COHORT'
        ? await this.as(this.cohortCoordinators.get(event.scope.cohort) ?? event.owner)
        : owner;

    for (const team of event.teams) {
      await this.team(eventId, nominator, team);
    }
  }

  private async team(eventId: string, nominator: ApiSession, team: Team) {
    const advisorAccount = this.account(team.advisor);
    const advisor = await this.as(team.advisor);
    const { id: teamId } = await advisor.post<{ id: string }>(`/events/${eventId}/teams`, {
      identification: team.identification,
      articleTitle: team.articleTitle,
    });

    for (const [index, member] of team.members.entries()) {
      const memberId = this.account(member).id;
      await advisor.post(`/teams/${teamId}/members/${memberId}`);
      await advisor.patch(`/teams/${teamId}/members/${memberId}`, {
        role: index === 0 ? 'LEADER' : 'AUTHOR',
      });
    }

    await nominator.post(`/teams/${teamId}/advisor/${advisorAccount.id}`);

    const memberIds = team.members.map((member) => this.account(member).id);
    const [summary] = await eventually(
      () => advisor.get<Array<{ id: string }>>(`/articles?teamId=${teamId}`),
      (list) => list.length > 0,
      `artigo da equipe ${team.identification}`,
    );
    const articleId = summary?.id ?? '';
    await eventually(
      () =>
        advisor.get<{ advisorId: string | null; memberIds: string[] }>(`/articles/${articleId}`),
      (article) =>
        article.advisorId === advisorAccount.id &&
        memberIds.every((id) => article.memberIds.includes(id)),
      `integrantes e orientador do artigo de ${team.identification}`,
    );

    await this.article(articleId, team, advisor);
    log(`    equipe ${team.identification} — ${team.stage}`);
  }

  private async article(articleId: string, team: Team, advisor: ApiSession) {
    if (team.stage === 'started' || team.text === undefined) return;

    const leader = await this.as(team.members[0] ?? '');
    const base = `/articles/${articleId}`;

    await leader.put(`${base}/content`, { content: articleContent(team.articleTitle, team.text) });

    for (const reference of team.text.references) {
      await leader.post(`${base}/references`, reference);
    }

    if (team.stage === 'writing') return;

    const submission = await leader.post<{ id: string }>(`${base}/submissions`);

    if (team.stage === 'submitted') return;

    const remarkIds: string[] = [];

    for (const remark of team.remarks ?? []) {
      const created = await advisor.post<{ id: string }>(
        `${base}/submissions/${submission.id}/remarks`,
        {
          anchor: { path: 'corpo', quote: remark.quote },
          originalText: remark.quote,
          body: remark.body,
        },
      );
      remarkIds.push(created.id);
    }

    if (team.stage === 'returned') {
      await advisor.post(`${base}/return`);

      if (remarkIds[0] !== undefined) {
        await leader.post(`${base}/remarks/${remarkIds[0]}/addressing`);
      }

      for (const [index, message] of (team.discussion ?? []).entries()) {
        const author = await this.as(message.author);
        await author.post(`${base}/discussion/messages`, {
          body: message.body,
          ...(index === 0 && remarkIds[0] !== undefined ? { remarkId: remarkIds[0] } : {}),
        });
      }
      return;
    }

    for (const remarkId of remarkIds) {
      await advisor.post(`${base}/remarks/${remarkId}/decision`, {
        decision: 'RESOLVED',
        reason: 'Ajuste conferido na entrega.',
      });
    }

    await advisor.post(`${base}/conclusion`);

    if (team.grade !== undefined) {
      await advisor.post(`${base}/assessments`, {
        score: team.grade.score,
        feedback: team.grade.feedback,
      });

      for (const [index, score] of team.grade.members.entries()) {
        await advisor.post(`${base}/member-assessments`, {
          score,
          memberId: this.account(team.members[index] ?? '').id,
        });
      }
    }

    if (team.publication !== undefined) {
      await advisor.post(`${base}/publications`, {
        venueName: team.publication.venueName,
        kind: team.publication.kind,
        publicationDate: new Date(Date.now() - team.publication.daysAgo * DAY).toISOString(),
        url: `https://doi.org/10.5555/${team.publication.doiSuffix}`,
      });
    }
  }
}

/**
 * Executa o `seed-catalog` compilado e devolve o que ele imprimiu.
 *
 * O processo do seed não termina sozinho depois de imprimir o relatório (alguma conexão
 * permanece aberta ao fechar o contexto). A carga não depende disso: espera a linha da
 * conta inicial, dá um instante para a linha do meio de definição de senha e encerra o
 * processo.
 */
function runSeed(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(__dirname, '..', 'seed-catalog.js')], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let output = '';
    let timer: NodeJS.Timeout | undefined;
    const finish = () => {
      clearTimeout(timer);
      child.kill();
      resolve(output);
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      output += chunk;
      if (/password\/reset\?token=\S+\n/.test(output)) finish();
      else if (output.includes('conta inicial') && timer === undefined) {
        timer = setTimeout(finish, 2000);
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (timer === undefined && !output.includes('conta inicial')) {
        reject(new Error(`a carga inicial (seed-catalog) falhou com código ${code}`));
      } else {
        finish();
      }
    });
  });
}

/**
 * Garante a senha do administrador de sistema: na primeira carga, o `seed-catalog`
 * imprime o meio de definição de senha, que esta carga consome em seguida.
 */
async function systemAdmin(): Promise<ApiSession> {
  const output = await runSeed();
  const url = /\/password\/reset\?token=([^\s]+)/.exec(output);

  if (url?.[1] !== undefined) {
    await ApiSession.anonymous(API_URL).post('/password/reset', {
      token: decodeURIComponent(url[1]),
      password: ADMIN_PASSWORD,
    });
    log(`senha do administrador de sistema definida (${ADMIN_EMAIL})`);
  }

  const admin = await ApiSession.login(API_URL, ADMIN_EMAIL, ADMIN_PASSWORD);

  // O seed nomeia a conta em inglês; na apresentação ela aparece no cabeçalho.
  await admin.patch('/profile', { name: SYSTEM_ADMIN_NAME });

  return admin;
}

function printAccess() {
  const [first] = DEMO_INSTITUTIONS;
  const rows: Array<[string, string]> = [['Administrador de sistema', ADMIN_EMAIL]];

  for (const institution of DEMO_INSTITUTIONS) {
    rows.push([
      `Administração — ${institution.code}`,
      `${institution.admin.key}@${institution.emailDomain}`,
    ]);
  }

  if (first !== undefined) {
    const at = (key: string) => `${key}@${first.emailDomain}`;
    rows.push(
      ['Coordenador (Eng. de Software)', at('rafael.bortolini')],
      ['Professor orientador', at('thiago.hoffmann')],
      ['Aluno (artigo devolvido)', at('lucas.zimmermann')],
      ['Aluna (artigo concluído)', at('fernanda.lorenzetti')],
    );
  }

  log('\nAcessos para a apresentação');
  for (const [role, email] of rows) log(`  ${role.padEnd(34)} ${email}`);
  log(`\n  Senha de todas as contas da carga: ${DEMO_PASSWORD}`);
  log(`  Senha do administrador de sistema: ${ADMIN_PASSWORD}`);
}

async function main(): Promise<void> {
  try {
    await fetch(`${API_URL}/identity`);
  } catch {
    throw new Error(`a API não respondeu em ${API_URL}; suba-a antes com "pnpm run start:dev"`);
  }

  const admin = await systemAdmin();
  const existing = await admin.get<Array<{ code: string }>>('/institutions?pageSize=100');

  if (existing.some((institution) => institution.code === DEMO_INSTITUTIONS[0]?.code)) {
    log('a carga de demonstração já foi feita neste banco; nada a fazer.');
    printAccess();
    return;
  }

  for (const institution of DEMO_INSTITUTIONS) {
    await new DemoLoader(admin, institution).run();
  }

  printAccess();
}

main().catch((error: unknown) => {
  const detail = error instanceof ApiError ? ` (${error.code ?? error.httpStatus})` : '';
  process.stderr.write(
    `falha na carga de demonstração: ${error instanceof Error ? error.message : String(error)}${detail}\n`,
  );
  process.exitCode = 1;
});
