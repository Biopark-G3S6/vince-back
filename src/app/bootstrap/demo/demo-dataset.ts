/**
 * O conteúdo da carga de demonstração (apresentação do projeto).
 *
 * As instituições são as de ensino superior de Toledo-PR, com os cursos que de fato
 * oferecem. **Todas as pessoas, turmas, eventos, artigos, notas e publicações são
 * fictícios.** Os e-mails usam o domínio reservado `.test` (RFC 2606), que nunca é
 * entregue: nenhuma notificação chega a uma caixa real, ainda que o envio seja ligado.
 *
 * Os prazos são relativos ao instante da carga (`days`), para que o cronograma tenha
 * sempre etapas vencidas e a vencer, qualquer que seja o dia da apresentação.
 */

export type Person = { readonly key: string; readonly name: string; readonly expertise?: string };

export type ArticleText = {
  readonly keywords: readonly string[];
  readonly abstract: string;
  readonly sections: ReadonlyArray<{ readonly heading: string; readonly paragraphs: string[] }>;
  readonly references: ReadonlyArray<{
    readonly type: 'article' | 'book' | 'website';
    readonly authors: readonly string[];
    readonly title: string;
    readonly year: number;
    readonly vehicle?: string;
    readonly place?: string;
    readonly publisher?: string;
    readonly url?: string;
  }>;
};

/**
 * Em que ponto do ciclo o artigo da equipe fica:
 * - `started`: recém-criado, só com o modelo;
 * - `writing`: a equipe escreve;
 * - `submitted`: entregue na etapa corrente, aguardando a correção;
 * - `returned`: corrigido e devolvido com apontamentos, um deles já atendido;
 * - `finished`: concluído, com nota, notas individuais e publicação.
 */
export type Stage = 'started' | 'writing' | 'submitted' | 'returned' | 'finished';

export type Team = {
  readonly identification: string;
  readonly articleTitle: string;
  /** O primeiro é o líder. */
  readonly members: readonly string[];
  readonly advisor: string;
  readonly stage: Stage;
  readonly text?: ArticleText;
  readonly remarks?: ReadonlyArray<{ readonly quote: string; readonly body: string }>;
  readonly discussion?: ReadonlyArray<{ readonly author: string; readonly body: string }>;
  readonly grade?: {
    readonly score: number;
    readonly feedback: string;
    readonly members: readonly number[];
  };
  readonly publication?: {
    readonly venueName: string;
    readonly kind: 'CONFERENCE' | 'JOURNAL' | 'OTHER';
    readonly daysAgo: number;
    readonly doiSuffix: string;
  };
};

export type DemoEvent = {
  readonly title: string;
  readonly scope:
    | { readonly type: 'INSTITUTION' }
    | { readonly type: 'COURSE'; readonly course: string }
    | { readonly type: 'COHORT'; readonly cohort: string };
  readonly owner: string;
  readonly theme: string;
  readonly researchProblem: string;
  readonly objectives: string;
  readonly maxTeams: number;
  readonly maxTeamSize: number;
  readonly milestones: ReadonlyArray<{ readonly name: string; readonly days: number }>;
  readonly template?: string;
  readonly advisors: readonly string[];
  readonly teams: readonly Team[];
};

export type DemoTemplate = {
  readonly name: string;
  readonly description: string;
  readonly owner: string;
  /** Identificação do curso; ausente, o modelo vale para toda a instituição. */
  readonly course?: string;
  readonly sections: readonly string[];
  /** Uma segunda versão, para a tela mostrar o histórico (RF-TPL-001 RN4). */
  readonly revisedSections?: readonly string[];
  readonly deactivated?: boolean;
};

export type DemoInstitution = {
  readonly name: string;
  readonly code: string;
  readonly website: string;
  readonly city: string;
  readonly state: string;
  readonly emailDomain: string;
  readonly admin: Person;
  readonly professors: readonly Person[];
  readonly courses: ReadonlyArray<{
    readonly name: string;
    readonly identification: string;
    readonly coordinator: string;
    readonly cohorts: ReadonlyArray<{
      readonly identification: string;
      readonly professors: readonly string[];
      readonly students: readonly Person[];
    }>;
  }>;
  readonly templates: readonly DemoTemplate[];
  readonly events: readonly DemoEvent[];
};

const p = (key: string, name: string, expertise?: string): Person => ({ key, name, expertise });
const s = (key: string, name: string): Person => ({ key, name });

const ABNT_SECTIONS = [
  'Introdução',
  'Referencial teórico',
  'Metodologia',
  'Resultados e discussão',
];

export const DEMO_PASSWORD = 'VinceArt@2026';

export const DEMO_INSTITUTIONS: readonly DemoInstitution[] = [
  {
    name: 'Faculdade Biopark',
    code: 'BIOPARK',
    website: 'https://bioparkeducacao.com.br',
    city: 'Toledo',
    state: 'PR',
    emailDomain: 'biopark.test',
    admin: p('mariana.kowalski', 'Mariana Kowalski', 'Gestão acadêmica'),
    professors: [
      p('rafael.bortolini', 'Rafael Bortolini', 'Engenharia de software e métodos ágeis'),
      p('camila.weber', 'Camila Weber', 'Banco de dados e ciência de dados'),
      p('eduardo.zanella', 'Eduardo Zanella', 'Gestão da inovação e cooperativismo'),
      p('luciana.schmitt', 'Luciana Schmitt', 'Farmacologia clínica'),
      p('thiago.hoffmann', 'Thiago Hoffmann', 'Inteligência artificial aplicada'),
      p('patricia.lunardi', 'Patrícia Lunardi', 'Interação humano-computador'),
      p('gustavo.rech', 'Gustavo Rech', 'Finanças corporativas'),
      p('juliana.kunz', 'Juliana Kunz', 'Controle de qualidade de medicamentos'),
    ],
    courses: [
      {
        name: 'Engenharia de Software',
        identification: 'ENG-SOFT',
        coordinator: 'rafael.bortolini',
        cohorts: [
          {
            identification: 'ES-7A',
            professors: ['rafael.bortolini', 'thiago.hoffmann', 'patricia.lunardi'],
            students: [
              s('lucas.zimmermann', 'Lucas Zimmermann'),
              s('ana.fontana', 'Ana Beatriz Fontana'),
              s('gabriel.dallacosta', 'Gabriel Dalla Costa'),
              s('isabela.gnoatto', 'Isabela Gnoatto'),
              s('matheus.pereira', 'Matheus Pereira'),
              s('larissa.becker', 'Larissa Becker'),
              s('pedro.sartori', 'Pedro Henrique Sartori'),
              s('julia.menegatti', 'Júlia Menegatti'),
              s('vinicius.lazzari', 'Vinícius Lazzari'),
              s('amanda.rossetto', 'Amanda Rossetto'),
              s('felipe.kraemer', 'Felipe Kraemer'),
              s('beatriz.tonello', 'Beatriz Tonello'),
            ],
          },
        ],
      },
      {
        name: 'Análise e Desenvolvimento de Sistemas',
        identification: 'ADS',
        coordinator: 'camila.weber',
        cohorts: [
          {
            identification: 'ADS-3N',
            professors: ['camila.weber', 'patricia.lunardi'],
            students: [
              s('rodrigo.mattei', 'Rodrigo Mattei'),
              s('natalia.bernardi', 'Natália Bernardi'),
              s('bruno.casagrande', 'Bruno Casagrande'),
              s('leticia.stein', 'Letícia Stein'),
              s('caio.fabris', 'Caio Fabris'),
              s('yasmin.ribeiro', 'Yasmin Ribeiro'),
            ],
          },
        ],
      },
      {
        name: 'Administração',
        identification: 'ADM',
        coordinator: 'eduardo.zanella',
        cohorts: [
          {
            identification: 'ADM-5N',
            professors: ['eduardo.zanella', 'gustavo.rech'],
            students: [
              s('fernanda.lorenzetti', 'Fernanda Lorenzetti'),
              s('diego.wolff', 'Diego Wolff'),
              s('carolina.dalpra', 'Carolina Dal Prá'),
              s('henrique.bauer', 'Henrique Bauer'),
              s('gabriela.cericato', 'Gabriela Cericato'),
              s('leonardo.basso', 'Leonardo Basso'),
            ],
          },
        ],
      },
      {
        name: 'Farmácia',
        identification: 'FARM',
        coordinator: 'luciana.schmitt',
        cohorts: [
          {
            identification: 'FARM-6A',
            professors: ['luciana.schmitt', 'juliana.kunz'],
            students: [
              s('mariana.fritzen', 'Mariana Fritzen'),
              s('joao.spohr', 'João Victor Spohr'),
              s('bianca.zuchi', 'Bianca Zuchi'),
              s('eduarda.klein', 'Eduarda Klein'),
            ],
          },
        ],
      },
    ],
    templates: [
      {
        name: 'Artigo científico — Padrão Biopark',
        description: 'Estrutura ABNT (NBR 6022) adotada nos eventos institucionais.',
        owner: 'mariana.kowalski',
        sections: ['Introdução', 'Metodologia', 'Resultados', 'Conclusão'],
        revisedSections: [...ABNT_SECTIONS, 'Considerações finais'],
      },
      {
        name: 'Artigo técnico — Engenharia de Software',
        description: 'Artigo curto para mostras de projeto: problema, solução e avaliação.',
        owner: 'rafael.bortolini',
        course: 'ENG-SOFT',
        sections: [
          'Introdução',
          'Trabalhos relacionados',
          'Solução proposta',
          'Avaliação',
          'Conclusão',
        ],
      },
      {
        name: 'Resumo simples — Jornada 2025',
        description: 'Modelo da edição anterior, substituído pelo padrão institucional.',
        owner: 'mariana.kowalski',
        sections: ['Resumo'],
        deactivated: true,
      },
    ],
    events: [
      {
        title: 'Mostra de Projetos de Engenharia de Software 2026',
        scope: { type: 'COURSE', course: 'ENG-SOFT' },
        owner: 'rafael.bortolini',
        theme: 'Software para o agronegócio do Oeste do Paraná',
        researchProblem:
          'Como soluções de software de baixo custo podem apoiar produtores e cooperativas da região?',
        objectives:
          'Desenvolver e avaliar um protótipo funcional e relatar o resultado em artigo técnico.',
        maxTeams: 5,
        maxTeamSize: 3,
        milestones: [
          { name: 'Proposta do projeto', days: -45 },
          { name: 'Revisão de literatura', days: -15 },
          { name: 'Versão parcial do artigo', days: 10 },
          { name: 'Artigo final', days: 35 },
        ],
        template: 'Artigo técnico — Engenharia de Software',
        advisors: ['rafael.bortolini', 'thiago.hoffmann', 'patricia.lunardi'],
        teams: [
          {
            identification: 'AgroSense',
            articleTitle: 'Monitoramento de silos de grãos com sensores IoT de baixo custo',
            members: ['lucas.zimmermann', 'ana.fontana', 'gabriel.dallacosta'],
            advisor: 'thiago.hoffmann',
            stage: 'returned',
            text: {
              keywords: ['Internet das Coisas', 'armazenagem de grãos', 'agricultura de precisão'],
              abstract:
                'A perda de grãos por aquecimento e umidade em silos ainda é significativa em pequenas propriedades. Este trabalho apresenta um sistema de monitoramento com sensores de temperatura e umidade conectados por rede LoRa, com custo inferior a R$ 400 por silo, avaliado em duas propriedades rurais de Toledo-PR.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'O Oeste do Paraná concentra parte expressiva da produção de soja e milho do estado, e boa parte dela é armazenada em silos de pequeno porte. Sem monitoramento contínuo, focos de aquecimento só são percebidos quando a perda já ocorreu.',
                  ],
                },
                {
                  heading: 'Solução proposta',
                  paragraphs: [
                    'O protótipo usa microcontroladores ESP32 com sensores DHT22 distribuídos em cabos termométricos, transmitindo as leituras a cada quinze minutos para um painel web que emite alertas por mensagem.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Puzzi, Domingos'],
                  title: 'Abastecimento e armazenagem de grãos',
                  year: 2000,
                  place: 'Campinas',
                  publisher: 'Instituto Campineiro de Ensino Agrícola',
                },
                {
                  type: 'article',
                  authors: ['Augustin, Jean-Paul', 'Moreira, Lívia'],
                  title: 'Redes LoRa em ambientes rurais: alcance e consumo de energia',
                  year: 2023,
                  vehicle: 'Revista de Sistemas Embarcados',
                },
              ],
            },
            remarks: [
              {
                quote: 'boa parte dela é armazenada em silos de pequeno porte',
                body: 'Indiquem a fonte desse dado (Conab ou IBGE) e o ano de referência.',
              },
              {
                quote: 'custo inferior a R$ 400 por silo',
                body: 'Detalhem a composição do custo em uma tabela na seção de avaliação.',
              },
              {
                quote: 'transmitindo as leituras a cada quinze minutos',
                body: 'Justifiquem o intervalo escolhido considerando o consumo da bateria.',
              },
            ],
            discussion: [
              {
                author: 'lucas.zimmermann',
                body: 'Professor, o dado de armazenagem pode vir da série histórica da Conab de 2024?',
              },
              {
                author: 'thiago.hoffmann',
                body: 'Pode sim. Citem a tabela específica e deixem o link nas referências.',
              },
              {
                author: 'ana.fontana',
                body: 'Já incluí a tabela de custos; falta só revisar a formatação.',
              },
            ],
          },
          {
            identification: 'Rastro Suíno',
            articleTitle: 'Rastreabilidade da cadeia suinícola com registro distribuído',
            members: ['isabela.gnoatto', 'matheus.pereira', 'larissa.becker'],
            advisor: 'rafael.bortolini',
            stage: 'submitted',
            text: {
              keywords: ['rastreabilidade', 'suinocultura', 'registro distribuído'],
              abstract:
                'Toledo é um dos maiores polos de suinocultura do país. O artigo propõe um registro distribuído permissionado para rastrear lotes desde a granja até o frigorífico e compara o tempo de consulta com o processo atual, baseado em planilhas.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'Exigências sanitárias de mercados importadores tornam a rastreabilidade de lotes um requisito comercial, e não apenas regulatório.',
                  ],
                },
              ],
              references: [
                {
                  type: 'website',
                  authors: ['Associação Brasileira de Proteína Animal'],
                  title: 'Relatório anual 2025',
                  year: 2025,
                  url: 'https://abpa-br.org',
                },
              ],
            },
          },
          {
            identification: 'Coop+',
            articleTitle: 'Aplicativo de autoatendimento para cooperados: um estudo de usabilidade',
            members: ['pedro.sartori', 'julia.menegatti', 'vinicius.lazzari'],
            advisor: 'patricia.lunardi',
            stage: 'writing',
            text: {
              keywords: ['usabilidade', 'cooperativismo', 'aplicativos móveis'],
              abstract:
                'O estudo avalia, com o questionário SUS e testes moderados, um aplicativo de autoatendimento para cooperados de uma cooperativa agroindustrial do Oeste paranaense.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'Cooperados de diferentes faixas etárias precisam consultar entregas, saldo e assistência técnica sem depender do atendimento presencial.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Nielsen, Jakob'],
                  title: 'Usability engineering',
                  year: 1993,
                  place: 'San Diego',
                  publisher: 'Academic Press',
                },
              ],
            },
          },
          {
            identification: 'Clima Lavoura',
            articleTitle: 'Previsão de geada por aprendizado de máquina em Toledo-PR',
            members: ['amanda.rossetto', 'felipe.kraemer'],
            advisor: 'thiago.hoffmann',
            stage: 'submitted',
            text: {
              keywords: ['aprendizado de máquina', 'agrometeorologia', 'geada'],
              abstract:
                'Com dados horários de estações meteorológicas da região entre 2010 e 2025, o trabalho compara florestas aleatórias e redes LSTM na previsão de geada com doze horas de antecedência.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'Geadas tardias comprometem a safrinha de milho, e o aviso antecipado permite ao produtor decidir sobre irrigação e colheita.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Géron, Aurélien'],
                  title: 'Mãos à obra: aprendizado de máquina com Scikit-Learn, Keras e TensorFlow',
                  year: 2021,
                  place: 'Rio de Janeiro',
                  publisher: 'Alta Books',
                },
              ],
            },
          },
        ],
      },
      {
        title: 'Jornada Científica Biopark 2026',
        scope: { type: 'INSTITUTION' },
        owner: 'mariana.kowalski',
        theme: 'Ciência, tecnologia e desenvolvimento regional',
        researchProblem:
          'Que contribuições a pesquisa de graduação oferece aos desafios produtivos e sociais da região de Toledo?',
        objectives:
          'Reunir artigos dos cursos da faculdade e publicar os melhores trabalhos nos anais da Jornada.',
        maxTeams: 6,
        maxTeamSize: 4,
        milestones: [
          { name: 'Resumo expandido', days: -20 },
          { name: 'Artigo completo', days: 4 },
        ],
        template: 'Artigo científico — Padrão Biopark',
        advisors: ['eduardo.zanella', 'juliana.kunz', 'camila.weber'],
        teams: [
          {
            identification: 'Gestão Cooperativa',
            articleTitle: 'Governança em cooperativas agroindustriais do Oeste paranaense',
            members: ['fernanda.lorenzetti', 'diego.wolff', 'carolina.dalpra'],
            advisor: 'eduardo.zanella',
            stage: 'finished',
            text: {
              keywords: ['governança', 'cooperativismo', 'agroindústria'],
              abstract:
                'A pesquisa analisa práticas de governança em três cooperativas agroindustriais da região, a partir de entrevistas com conselheiros e de relatórios anuais publicados entre 2020 e 2025.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'O cooperativismo é um dos pilares econômicos do Oeste do Paraná, e o crescimento das cooperativas impõe estruturas de governança mais profissionais.',
                  ],
                },
                {
                  heading: 'Metodologia',
                  paragraphs: [
                    'Estudo de casos múltiplos, com roteiro semiestruturado aplicado a nove conselheiros e análise de conteúdo dos relatórios de gestão.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Yin, Robert K.'],
                  title: 'Estudo de caso: planejamento e métodos',
                  year: 2015,
                  place: 'Porto Alegre',
                  publisher: 'Bookman',
                },
              ],
            },
            remarks: [
              {
                quote: 'entrevistas com conselheiros',
                body: 'Informem o número de entrevistas e o período em que foram realizadas.',
              },
            ],
            grade: {
              score: 9.2,
              feedback:
                'Trabalho consistente, com metodologia bem descrita e boa articulação com a realidade regional.',
              members: [9.5, 9, 9],
            },
            publication: {
              venueName: 'Anais da Jornada Científica Biopark 2026',
              kind: 'CONFERENCE',
              daysAgo: 2,
              doiSuffix: 'jcb2026.014',
            },
          },
          {
            identification: 'Fitoterápicos',
            articleTitle: 'Controle de qualidade de fitoterápicos manipulados em Toledo-PR',
            members: ['mariana.fritzen', 'joao.spohr', 'bianca.zuchi'],
            advisor: 'juliana.kunz',
            stage: 'finished',
            text: {
              keywords: ['fitoterápicos', 'controle de qualidade', 'farmácia magistral'],
              abstract:
                'Foram analisadas quinze amostras de cápsulas de fitoterápicos adquiridas em farmácias magistrais do município, quanto a peso médio, desintegração e teor de umidade.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'O uso de fitoterápicos cresce no país, e a qualidade das preparações magistrais depende de controles nem sempre documentados.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Brasil. Agência Nacional de Vigilância Sanitária'],
                  title: 'Farmacopeia brasileira',
                  year: 2019,
                  place: 'Brasília',
                  publisher: 'Anvisa',
                },
              ],
            },
            grade: {
              score: 8.7,
              feedback: 'Bons resultados experimentais; a discussão pode comparar mais estudos.',
              members: [9, 8.5, 8.5],
            },
            publication: {
              venueName: 'Revista de Ciências Farmacêuticas do Oeste',
              kind: 'JOURNAL',
              daysAgo: 1,
              doiSuffix: 'rcfo.2026.0087',
            },
          },
          {
            identification: 'Dados Abertos',
            articleTitle: 'Painel de dados abertos da saúde municipal de Toledo',
            members: ['rodrigo.mattei', 'natalia.bernardi', 'bruno.casagrande'],
            advisor: 'camila.weber',
            stage: 'submitted',
            text: {
              keywords: ['dados abertos', 'saúde pública', 'visualização de dados'],
              abstract:
                'O trabalho constrói um painel com indicadores de atenção básica a partir de bases públicas do DataSUS, com foco na transparência para o cidadão.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'A Lei de Acesso à Informação ampliou a publicação de dados, mas o formato das bases ainda dificulta a leitura pelo cidadão.',
                  ],
                },
              ],
              references: [
                {
                  type: 'website',
                  authors: ['Brasil. Ministério da Saúde'],
                  title: 'DATASUS: informações de saúde (TABNET)',
                  year: 2025,
                  url: 'https://datasus.saude.gov.br',
                },
              ],
            },
          },
        ],
      },
      {
        title: 'Seminário de Banco de Dados — ADS 3º período',
        scope: { type: 'COHORT', cohort: 'ADS-3N' },
        owner: 'camila.weber',
        theme: 'Modelagem de dados para pequenos negócios',
        researchProblem:
          'Como modelar dados de um negócio local garantindo integridade e consulta?',
        objectives: 'Entregar modelo conceitual, lógico e um artigo relatando as decisões.',
        maxTeams: 3,
        maxTeamSize: 3,
        milestones: [
          { name: 'Modelo conceitual', days: 7 },
          { name: 'Artigo', days: 28 },
        ],
        advisors: ['camila.weber', 'patricia.lunardi'],
        teams: [
          {
            identification: 'Consulta Rápida',
            articleTitle: 'Modelagem de dados para agendamento em clínicas veterinárias',
            members: ['leticia.stein', 'caio.fabris', 'yasmin.ribeiro'],
            advisor: 'patricia.lunardi',
            stage: 'started',
          },
        ],
      },
      {
        title: 'Semana Acadêmica de Administração',
        scope: { type: 'COHORT', cohort: 'ADM-5N' },
        owner: 'gustavo.rech',
        theme: 'Empreendedorismo e turismo rural',
        researchProblem: 'Quais modelos de negócio tornam o agroturismo viável no Oeste do Paraná?',
        objectives: 'Elaborar plano de negócio e artigo de análise de viabilidade.',
        maxTeams: 4,
        maxTeamSize: 3,
        milestones: [
          { name: 'Plano de negócio', days: -10 },
          { name: 'Artigo de viabilidade', days: 21 },
        ],
        advisors: ['gustavo.rech'],
        teams: [
          {
            identification: 'Rota Colonial',
            articleTitle: 'Viabilidade do agroturismo na rota colonial de Toledo',
            members: ['henrique.bauer', 'gabriela.cericato', 'leonardo.basso'],
            advisor: 'gustavo.rech',
            stage: 'writing',
            text: {
              keywords: ['agroturismo', 'plano de negócio', 'viabilidade econômica'],
              abstract:
                'Analisa a viabilidade de um roteiro de agroturismo com propriedades de imigração alemã e italiana, estimando investimento, demanda e retorno.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'O turismo rural diversifica a renda da propriedade familiar e valoriza a cultura dos imigrantes que colonizaram a região.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Dornelas, José'],
                  title: 'Plano de negócios: seu guia definitivo',
                  year: 2016,
                  place: 'São Paulo',
                  publisher: 'Empreende',
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    name: 'UTFPR — Câmpus Toledo',
    code: 'UTFPR-TD',
    website: 'https://www.utfpr.edu.br/campus/toledo',
    city: 'Toledo',
    state: 'PR',
    emailDomain: 'utfpr.test',
    admin: p('sergio.venturini', 'Sérgio Venturini', 'Gestão do ensino de graduação'),
    professors: [
      p('daniela.moretto', 'Daniela Moretto', 'Sistemas embarcados'),
      p('andre.gallina', 'André Gallina', 'Desenvolvimento web'),
      p('fabio.lermen', 'Fábio Lermen', 'Visão computacional'),
    ],
    courses: [
      {
        name: 'Engenharia de Computação',
        identification: 'ENG-COMP',
        coordinator: 'daniela.moretto',
        cohorts: [
          {
            identification: 'EC-8',
            professors: ['daniela.moretto', 'fabio.lermen'],
            students: [
              s('rafaela.hendges', 'Rafaela Hendges'),
              s('murilo.sehnem', 'Murilo Sehnem'),
              s('thais.weirich', 'Thaís Weirich'),
              s('otavio.bonetti', 'Otávio Bonetti'),
              s('luana.petry', 'Luana Petry'),
            ],
          },
        ],
      },
      {
        name: 'Tecnologia em Sistemas para Internet',
        identification: 'TSI',
        coordinator: 'andre.gallina',
        cohorts: [],
      },
    ],
    templates: [],
    events: [
      {
        title: 'Seminário de TCC — Engenharia de Computação',
        scope: { type: 'COHORT', cohort: 'EC-8' },
        owner: 'fabio.lermen',
        theme: 'Computação aplicada ao campo',
        researchProblem: 'Que soluções computacionais embarcadas atendem a propriedades rurais?',
        objectives: 'Apresentar o projeto de TCC em formato de artigo científico.',
        maxTeams: 3,
        maxTeamSize: 2,
        milestones: [
          { name: 'Projeto de TCC', days: -30 },
          { name: 'Qualificação', days: 12 },
          { name: 'Defesa', days: 40 },
        ],
        advisors: ['fabio.lermen', 'daniela.moretto'],
        teams: [
          {
            identification: 'Visão Agro',
            articleTitle: 'Detecção de pragas na soja com redes neurais convolucionais embarcadas',
            members: ['rafaela.hendges', 'murilo.sehnem'],
            advisor: 'fabio.lermen',
            stage: 'writing',
            text: {
              keywords: ['visão computacional', 'redes neurais', 'soja'],
              abstract:
                'Propõe um modelo leve de classificação de imagens executado em placa embarcada para identificar lagartas na soja ainda no campo, sem conexão com a internet.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'O monitoramento de pragas por amostragem manual é lento e depende de técnico em campo.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Goodfellow, Ian', 'Bengio, Yoshua', 'Courville, Aaron'],
                  title: 'Deep learning',
                  year: 2016,
                  place: 'Cambridge',
                  publisher: 'MIT Press',
                },
              ],
            },
          },
          {
            identification: 'Rede Rural',
            articleTitle: 'Conectividade LoRaWAN para propriedades rurais do Oeste paranaense',
            members: ['thais.weirich', 'otavio.bonetti'],
            advisor: 'daniela.moretto',
            stage: 'started',
          },
        ],
      },
    ],
  },
  {
    name: 'Unioeste — Campus de Toledo',
    code: 'UNIOESTE-TOL',
    website: 'https://www.unioeste.br',
    city: 'Toledo',
    state: 'PR',
    emailDomain: 'unioeste.test',
    admin: p('claudia.mertz', 'Cláudia Mertz', 'Secretaria acadêmica'),
    professors: [
      p('roberto.feiden', 'Roberto Feiden', 'Processos de separação'),
      p('sandra.giacomini', 'Sandra Giacomini', 'Economia regional'),
      p('alexandre.tonial', 'Alexandre Tonial', 'Biocombustíveis'),
    ],
    courses: [
      {
        name: 'Engenharia Química',
        identification: 'ENG-QUIM',
        coordinator: 'roberto.feiden',
        cohorts: [
          {
            identification: 'EQ-4',
            professors: ['roberto.feiden', 'alexandre.tonial'],
            students: [
              s('vitoria.scheffer', 'Vitória Scheffer'),
              s('arthur.dallagnol', 'Arthur Dallagnol'),
              s('helena.baumgartner', 'Helena Baumgartner'),
              s('samuel.kehl', 'Samuel Kehl'),
            ],
          },
        ],
      },
      {
        name: 'Ciências Econômicas',
        identification: 'ECO',
        coordinator: 'sandra.giacomini',
        cohorts: [],
      },
    ],
    templates: [],
    events: [
      {
        title: 'Encontro de Engenharia Química do Oeste',
        scope: { type: 'COURSE', course: 'ENG-QUIM' },
        owner: 'roberto.feiden',
        theme: 'Aproveitamento de resíduos agroindustriais',
        researchProblem:
          'Como transformar resíduos da agroindústria regional em produtos de valor?',
        objectives: 'Apresentar resultados experimentais em formato de artigo.',
        maxTeams: 4,
        maxTeamSize: 2,
        milestones: [
          { name: 'Plano experimental', days: -25 },
          { name: 'Artigo', days: 15 },
        ],
        advisors: ['alexandre.tonial', 'roberto.feiden'],
        teams: [
          {
            identification: 'Biodiesel',
            articleTitle: 'Produção de biodiesel a partir de gordura suína residual',
            members: ['vitoria.scheffer', 'arthur.dallagnol'],
            advisor: 'alexandre.tonial',
            stage: 'submitted',
            text: {
              keywords: ['biodiesel', 'transesterificação', 'resíduos agroindustriais'],
              abstract:
                'Avalia o rendimento da transesterificação metílica da gordura suína residual de frigoríficos, variando razão molar e temperatura.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'Frigoríficos da região geram volumes expressivos de gordura residual, hoje destinada a usos de baixo valor.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Knothe, Gerhard', 'Van Gerpen, Jon', 'Krahl, Jürgen'],
                  title: 'Manual de biodiesel',
                  year: 2006,
                  place: 'São Paulo',
                  publisher: 'Edgard Blücher',
                },
              ],
            },
          },
          {
            identification: 'Bioadsorventes',
            articleTitle: 'Casca de soja como bioadsorvente no tratamento de efluentes',
            members: ['helena.baumgartner', 'samuel.kehl'],
            advisor: 'roberto.feiden',
            stage: 'started',
          },
        ],
      },
    ],
  },
  {
    name: 'PUCPR — Câmpus Toledo',
    code: 'PUCPR-TOL',
    website: 'https://www.pucpr.br',
    city: 'Toledo',
    state: 'PR',
    emailDomain: 'pucpr.test',
    admin: p('renata.galvao', 'Renata Galvão', 'Coordenação acadêmica'),
    professors: [
      p('marcelo.fachin', 'Marcelo Fachin', 'Direito agrário'),
      p('aline.seibert', 'Aline Seibert', 'Psicologia organizacional'),
      p('cristiano.lago', 'Cristiano Lago', 'Proteção de dados pessoais'),
    ],
    courses: [
      {
        name: 'Direito',
        identification: 'DIR',
        coordinator: 'marcelo.fachin',
        cohorts: [
          {
            identification: 'DIR-9N',
            professors: ['marcelo.fachin', 'cristiano.lago'],
            students: [
              s('gabriel.hubner', 'Gabriel Hübner'),
              s('manuela.sartor', 'Manuela Sartor'),
              s('lorenzo.bervian', 'Lorenzo Bervian'),
              s('alice.dreyer', 'Alice Dreyer'),
            ],
          },
        ],
      },
      {
        name: 'Psicologia',
        identification: 'PSI',
        coordinator: 'aline.seibert',
        cohorts: [],
      },
    ],
    templates: [],
    events: [
      {
        title: 'Jornada de Direito Agrário e Digital',
        scope: { type: 'COHORT', cohort: 'DIR-9N' },
        owner: 'cristiano.lago',
        theme: 'Novas tecnologias no campo e seus efeitos jurídicos',
        researchProblem:
          'Como a legislação de proteção de dados alcança as cooperativas e produtores rurais?',
        objectives: 'Produzir artigo científico para apresentação na jornada do curso.',
        maxTeams: 3,
        maxTeamSize: 2,
        milestones: [
          { name: 'Projeto de pesquisa', days: -18 },
          { name: 'Artigo', days: 20 },
        ],
        advisors: ['cristiano.lago', 'marcelo.fachin'],
        teams: [
          {
            identification: 'LGPD no Campo',
            articleTitle: 'Proteção de dados pessoais em cooperativas agrícolas sob a LGPD',
            members: ['manuela.sartor', 'lorenzo.bervian'],
            advisor: 'cristiano.lago',
            stage: 'writing',
            text: {
              keywords: ['LGPD', 'cooperativas', 'direito agrário'],
              abstract:
                'Examina como cooperativas agrícolas tratam dados de cooperados e quais adequações a Lei nº 13.709/2018 exige nesse contexto.',
              sections: [
                {
                  heading: 'Introdução',
                  paragraphs: [
                    'A digitalização da gestão cooperativa ampliou a coleta de dados pessoais e produtivos dos cooperados.',
                  ],
                },
              ],
              references: [
                {
                  type: 'book',
                  authors: ['Doneda, Danilo'],
                  title: 'Da privacidade à proteção de dados pessoais',
                  year: 2019,
                  place: 'São Paulo',
                  publisher: 'Revista dos Tribunais',
                },
              ],
            },
          },
        ],
      },
    ],
  },
];
