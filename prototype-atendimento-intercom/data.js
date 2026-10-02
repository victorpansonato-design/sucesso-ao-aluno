/* ==========================================================================
   data.js — a operação simulada
   --------------------------------------------------------------------------
   Dados fictícios, mas com a forma dos dados reais do atendimento: RA, curso,
   modalidade, unidade, turno, DPs, saldo devedor, fila, canal, SLA, tags.
   Tudo ancorado em NOW no carregamento, para a fila nunca parecer velha.
   ========================================================================== */
(function () {
  'use strict';

  var NOW = Date.now();
  /** minutos atrás → timestamp */
  function ago(min) {
    return NOW - min * 60000;
  }
  /** minutos à frente → timestamp */
  function ahead(min) {
    return NOW + min * 60000;
  }
  /** n dias úteis à frente, no fim do expediente — prazo de Ouvidoria. */
  function aheadBusiness(n) {
    var d = new Date(NOW);
    while (n > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) n--;
    }
    d.setHours(18, 0, 0, 0);
    return d.getTime();
  }

  /* ======================================================================
     Equipe
     ====================================================================== */

  var ME = {
    id: 'a-amanda',
    name: 'Amanda Dutra',
    initials: 'AD',
    role: 'Relacionamento com o aluno',
    team: 'Secretaria',
    presence: 'online',
  };

  var AGENTS = [
    ME,
    { id: 'a-marcos', name: 'Marcos Vinícius Leão', initials: 'ML', role: 'Secretaria acadêmica', team: 'Secretaria', presence: 'online', open: 7, capacity: 10, frt: 4.2 },
    { id: 'a-renata', name: 'Renata Coelho Braga', initials: 'RB', role: 'Estágios e carreiras', team: 'Estágios', presence: 'online', open: 5, capacity: 8, frt: 6.8 },
    { id: 'a-ana', name: 'Ana Paula Siqueira', initials: 'AS', role: 'Financeiro do aluno', team: 'Financeiro', presence: 'ocupado', open: 9, capacity: 9, frt: 11.4 },
    { id: 'a-carla', name: 'Carla Benites Rocha', initials: 'CR', role: 'Secretaria acadêmica', team: 'Secretaria', presence: 'online', open: 4, capacity: 10, frt: 3.1 },
    { id: 'a-thiago', name: 'Thiago Nunes Prado', initials: 'TP', role: 'Suporte digital', team: 'Suporte', presence: 'ausente', open: 3, capacity: 8, frt: 5.6 },
    { id: 'a-juliane', name: 'Juliane Okamoto', initials: 'JO', role: 'Pós-graduação e EAD', team: 'Pós & EAD', presence: 'online', open: 6, capacity: 8, frt: 7.9 },
    { id: 'a-rafael', name: 'Rafael Antunes Lima', initials: 'RL', role: 'Coordenação de curso', team: 'Coordenação', presence: 'offline', open: 2, capacity: 6, frt: 18.3 },
    { id: 'a-helena', name: 'Helena Martins Castro', initials: 'HC', role: 'Ouvidoria', team: 'Ouvidoria', presence: 'online', open: 4, capacity: 8, frt: 9.2 },
  ];
  ME.open = 6;
  ME.capacity = 10;
  ME.frt = 3.8;

  var BOT = { id: 'bot', name: 'Assistente UniAnchieta', initials: 'IA', role: 'Bot de triagem' };

  /* ======================================================================
     Filas, tags, macros
     ====================================================================== */

  var QUEUES = [
    { id: 'secretaria', name: 'Secretaria', icon: 'fileText' },
    { id: 'financeiro', name: 'Financeiro', icon: 'banknote' },
    { id: 'estagios', name: 'Estágios', icon: 'building' },
    { id: 'pos-ead', name: 'Pós & EAD', icon: 'bookOpen' },
    { id: 'coordenacao', name: 'Coordenação', icon: 'graduationCap' },
    { id: 'suporte', name: 'Suporte digital', icon: 'smartphone' },
    { id: 'ouvidoria', name: 'Ouvidoria', icon: 'megaphone' },
  ];

  /* Etapas de uma manifestação de ouvidoria — a régua que o atendente mostra
     ao aluno quando ele pergunta "em que pé está?". */
  var OUV_STAGES = ['Registrada', 'Em análise no setor', 'Resposta ao manifestante', 'Concluída'];

  var CHANNELS = [
    { id: 'app', name: 'App do aluno', icon: 'smartphone' },
    { id: 'portal', name: 'Portal', icon: 'globe' },
    { id: 'whatsapp', name: 'WhatsApp', icon: 'messageCircle' },
    { id: 'email', name: 'E-mail', icon: 'mail' },
  ];

  var TAGS = [
    'Boleto', 'Rematrícula', 'Equivalência', 'Transferência', 'Documentos',
    'Estágio', 'DP/ADAP', 'EAD', 'Híbrido', 'Notas', 'Calendário', 'Acesso',
    'Bolsa', 'Negociação', 'Colação', 'Trancamento', 'Reclamação', 'Retenção',
    'Ouvidoria', 'Estorno', 'Acessibilidade', 'TCC', 'Elogio',
  ];

  var MACROS = [
    {
      id: 'm-boleto',
      shortcut: 'boleto',
      title: 'Segunda via de boleto',
      category: 'Financeiro',
      body:
        'Consegui localizar sua mensalidade aqui. Você pode emitir a segunda via direto pelo Portal do Aluno, em Financeiro > Boletos > Emitir segunda via — o boleto atualiza o vencimento automaticamente.\n\nSe preferir, eu envio o PDF por aqui mesmo. Quer que eu envie?',
    },
    {
      id: 'm-prazo',
      shortcut: 'prazo',
      title: 'Prazo de análise da Secretaria',
      category: 'Secretaria',
      body:
        'Sua solicitação foi registrada e encaminhada para a Secretaria Acadêmica. O prazo de análise é de até 5 dias úteis, e você recebe o retorno por aqui e também no e-mail cadastrado.\n\nSe passar desse prazo sem resposta, me chama que eu acompanho internamente.',
    },
    {
      id: 'm-documento',
      shortcut: 'documento',
      title: 'Solicitação de documento',
      category: 'Secretaria',
      body:
        'Para dar andamento, preciso que você anexe aqui:\n\n• RG e CPF (frente e verso)\n• Comprovante de endereço atualizado\n• Histórico escolar da instituição de origem\n\nAssim que chegarem, eu abro o protocolo e te passo o número.',
    },
    {
      id: 'm-transferencia',
      shortcut: 'transferir',
      title: 'Transferência para a Secretaria',
      category: 'Secretaria',
      body:
        'Esse assunto é analisado pela Secretaria Acadêmica. Vou transferir seu atendimento agora — a equipe assume ainda hoje e você continua nesta mesma conversa, não precisa recomeçar.',
    },
    {
      id: 'm-calendario',
      shortcut: 'calendario',
      title: 'Orientação sobre calendário',
      category: 'Coordenação',
      body:
        'O calendário acadêmico do seu curso está disponível no Portal do Aluno, em Acadêmico > Calendário, e também no site da UniAnchieta.\n\nAs datas de prova do seu período já estão publicadas lá. Quer que eu confira alguma data específica com você?',
    },
    {
      id: 'm-rematricula',
      shortcut: 'rematricula',
      title: 'Rematrícula do próximo semestre',
      category: 'Secretaria',
      body:
        'A rematrícula é feita pelo Portal do Aluno, em Acadêmico > Rematrícula. São três passos: confirmação de dados, escolha das disciplinas e aceite do contrato.\n\nImportante: o botão só libera se não houver pendência financeira nem documental. Quer que eu verifique se está tudo liberado no seu cadastro?',
    },
    {
      id: 'm-equivalencia',
      shortcut: 'equivalencia',
      title: 'Aproveitamento de disciplinas',
      category: 'Secretaria',
      body:
        'Para o aproveitamento de estudos preciso do histórico escolar e das ementas das disciplinas cursadas na instituição de origem, ambos com carimbo e assinatura.\n\nA análise é feita pela coordenação do curso e leva até 15 dias úteis. Enquanto isso, você segue cursando normalmente.',
    },
    {
      id: 'm-encerramento',
      shortcut: 'encerrar',
      title: 'Encerramento cordial',
      category: 'Geral',
      body:
        'Fico à disposição! Se surgir qualquer outra dúvida, é só chamar por aqui mesmo que eu retomo do ponto onde paramos.\n\nBons estudos. :)',
    },
    {
      id: 'm-ouvidoria',
      shortcut: 'ouvidoria',
      title: 'Retorno de manifestação da Ouvidoria',
      category: 'Ouvidoria',
      body:
        'Oi, {nome}! Estou acompanhando o seu protocolo junto à Ouvidoria e quero te dar uma posição concreta.\n\nO setor responsável já analisou o seu caso e eu te passo aqui as datas e o próximo passo. Se algo não ficar claro, me chama por aqui mesmo — a manifestação só é concluída quando você confirmar que o assunto foi resolvido.',
    },
  ];

  /* ======================================================================
     Alunos
     ====================================================================== */

  function s(o) {
    o.initials = o.name
      .split(' ')
      .filter(function (w) {
        return w.length > 2;
      })
      .slice(0, 2)
      .map(function (w) {
        return w[0];
      })
      .join('')
      .toUpperCase();
    return o;
  }

  var STUDENTS = [
    s({ id: 'e01', name: 'Larissa Fontoura Ribeiro', ra: '2518844', cpf: '428.913.518-77', phone: '(11) 98116-3705', email: 'larissa.ribeiro@aluno.anchieta.br', course: 'Bacharelado em Direito', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Noturno', period: 6, dps: 0, balance: 1284.9, financial: 'inadimplente', academic: 'regular', firstContact: ago(60 * 24 * 320), tags: ['Boleto', 'Negociação'] }),
    s({ id: 'e02', name: 'Bruno Tadeu Miranda', ra: '2402177', cpf: '317.442.980-05', phone: '(11) 97733-2190', email: 'bruno.miranda@aluno.anchieta.br', course: 'Bacharelado em Psicologia', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Noturno', period: 3, dps: 1, balance: 0, financial: 'adimplente', academic: 'transferido', firstContact: ago(60 * 24 * 140), tags: ['Equivalência', 'Transferência'] }),
    s({ id: 'e03', name: 'Camila Nogueira Prado', ra: '2609431', cpf: '502.118.340-61', phone: '(11) 99442-8810', email: 'camila.prado@aluno.anchieta.br', course: 'Licenciatura em Pedagogia', type: 'Graduação', modality: 'EAD', unit: 'Graduação EAD', shift: 'EAD', period: 2, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 95), tags: ['EAD', 'Acesso'] }),
    s({ id: 'e04', name: 'Vinícius Arantes Lopes', ra: '2311260', cpf: '221.907.415-30', phone: '(11) 98270-4412', email: 'vinicius.lopes@aluno.anchieta.br', course: 'Bacharelado em Ciência da Computação', type: 'Graduação', modality: 'Híbrido', unit: 'Campus Jundiaí — Anchieta', shift: 'Noturno', period: 7, dps: 2, balance: 642.0, financial: 'negociação', academic: 'dp', firstContact: ago(60 * 24 * 510), tags: ['Rematrícula', 'DP/ADAP'] }),
    s({ id: 'e05', name: 'Thaís Menezes Carvalho', ra: '2517902', cpf: '390.774.226-18', phone: '(11) 99015-7723', email: 'thais.carvalho@aluno.anchieta.br', course: 'Bacharelado em Enfermagem', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Diurno', period: 5, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 270), tags: ['Estágio', 'Documentos'] }),
    s({ id: 'e06', name: 'Rodrigo Serrano Alves', ra: '2208514', cpf: '155.620.883-49', phone: '(11) 98844-2077', email: 'rodrigo.alves@aluno.anchieta.br', course: 'Bacharelado em Engenharia Elétrica', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Noturno', period: 8, dps: 2, balance: 0, financial: 'adimplente', academic: 'dp', firstContact: ago(60 * 24 * 760), tags: ['DP/ADAP'] }),
    s({ id: 'e07', name: 'Juliana Peixoto Barros', ra: '2620055', cpf: '478.331.902-24', phone: '(11) 97121-9908', email: 'juliana.barros@aluno.anchieta.br', course: 'Bacharelado em Psicologia', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Noturno', period: 1, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 42), tags: ['Notas'] }),
    s({ id: 'e08', name: 'Felipe Andrade Tavares', ra: '2413677', cpf: '284.559.113-06', phone: '(11) 99677-1245', email: 'felipe.tavares@aluno.anchieta.br', course: 'Bacharelado em Administração', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Noturno', period: 6, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 430), tags: ['Estágio'] }),
    s({ id: 'e09', name: 'Patrícia Lemos Figueiredo', ra: '2502318', cpf: '609.223.741-90', phone: '(11) 98338-6612', email: 'patricia.figueiredo@aluno.anchieta.br', course: 'Bacharelado em Arquitetura e Urbanismo', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Diurno', period: 4, dps: 0, balance: 2340.0, financial: 'inadimplente', academic: 'risco', firstContact: ago(60 * 24 * 300), tags: ['Trancamento', 'Retenção'] }),
    s({ id: 'e10', name: 'Gustavo Henrique Prado', ra: '2604190', cpf: '731.885.402-13', phone: '(11) 99204-3388', email: 'gustavo.prado@aluno.anchieta.br', course: 'Bacharelado em Biomedicina', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Diurno', period: 2, dps: 0, balance: 0, financial: 'bolsista', academic: 'regular', firstContact: ago(60 * 24 * 88), tags: ['Bolsa'] }),
    s({ id: 'e11', name: 'Marina Castilho Duarte', ra: '2299013', cpf: '118.446.207-55', phone: '(11) 98705-1130', email: 'marina.duarte@aluno.anchieta.br', course: 'Bacharelado em Fonoaudiologia', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Diurno', period: 8, dps: 0, balance: 0, financial: 'adimplente', academic: 'formando', firstContact: ago(60 * 24 * 1180), tags: ['Colação', 'Documentos'] }),
    s({ id: 'e12', name: 'Eduardo Simões Bentivegna', ra: '2515540', cpf: '546.902.318-72', phone: '(11) 99811-7742', email: 'eduardo.bentivegna@aluno.anchieta.br', course: 'Especialização em Gestão Escolar', type: 'Pós-graduação', modality: 'EAD', unit: 'Graduação EAD', shift: 'EAD', period: 1, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 60), tags: ['EAD'] }),
    s({ id: 'e13', name: 'Ana Beatriz Coutinho Maia', ra: '2618702', cpf: '860.117.443-28', phone: '(11) 97449-0021', email: 'ana.maia@aluno.anchieta.br', course: 'Bacharelado em Publicidade e Propaganda', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Noturno', period: 2, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 70), tags: ['Documentos'] }),
    s({ id: 'e14', name: 'Sérgio Kazuo Tanaka', ra: '2405981', cpf: '204.778.615-41', phone: '(11) 98922-5507', email: 'sergio.tanaka@aluno.anchieta.br', course: 'Superior de Tecnologia em Gestão Financeira', type: 'Tecnólogo', modality: 'Híbrido', unit: 'Polo Várzea Paulista', shift: 'Noturno', period: 4, dps: 1, balance: 4870.5, financial: 'inadimplente', academic: 'risco', firstContact: ago(60 * 24 * 620), tags: ['Negociação', 'Retenção'] }),
    s({ id: 'e15', name: 'Letícia Vasconcelos Pires', ra: '2612344', cpf: '672.014.998-36', phone: '(11) 99330-8814', email: 'leticia.pires@aluno.anchieta.br', course: 'Bacharelado em Nutrição', type: 'Graduação', modality: 'Híbrido', unit: 'Campus Jundiaí — Anchieta', shift: 'Híbrido', period: 3, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 110), tags: ['Calendário', 'Híbrido'] }),
    s({ id: 'e16', name: 'Otávio Mendes Rosário', ra: '2310988', cpf: '445.660.271-83', phone: '(11) 98177-4460', email: 'otavio.rosario@aluno.anchieta.br', course: 'Bacharelado em Direito', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Noturno', period: 9, dps: 0, balance: 0, financial: 'adimplente', academic: 'formando', firstContact: ago(60 * 24 * 940), tags: ['Documentos'] }),
    s({ id: 'e17', name: 'Bianca Ferraz Nogueira', ra: '2621180', cpf: '939.205.144-70', phone: '(11) 99588-2013', email: 'bianca.nogueira@aluno.anchieta.br', course: 'Bacharelado em Odontologia', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Diurno', period: 1, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 26), tags: [] }),
    s({ id: 'e18', name: 'Kauê dos Santos Ferrari', ra: '2519077', cpf: '733.881.026-19', phone: '(11) 98044-7712', email: 'kaue.ferrari@aluno.anchieta.br', course: 'Superior de Tecnologia em Segurança da Informação', type: 'Tecnólogo', modality: 'EAD', unit: 'Graduação EAD', shift: 'EAD', period: 5, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 390), tags: ['Documentos', 'EAD'] }),
    s({ id: 'e19', name: 'Natália Brito Xavier', ra: '2607719', cpf: '158.773.940-27', phone: '(11) 97066-9931', email: 'natalia.xavier@aluno.anchieta.br', course: 'Bacharelado em Enfermagem', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Diurno', period: 2, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 76), tags: ['Notas'] }),
    s({ id: 'e20', name: 'Diego Marques Anhaia', ra: '2404652', cpf: '312.556.789-04', phone: '(11) 99112-6650', email: 'diego.anhaia@aluno.anchieta.br', course: 'Bacharelado em Educação Física', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Noturno', period: 6, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 450), tags: ['Estágio'] }),
    s({ id: 'e21', name: 'Isabela Moraes Guedes', ra: '2622401', cpf: '820.441.375-62', phone: '(11) 98366-1177', email: 'isabela.guedes@aluno.anchieta.br', course: 'Bacharelado em Medicina Veterinária', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Diurno', period: 1, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 18), tags: [] }),
    s({ id: 'e22', name: 'Henrique Sampaio Ottoni', ra: '2307744', cpf: '607.229.118-53', phone: '(11) 99744-3302', email: 'henrique.ottoni@aluno.anchieta.br', course: 'Bacharelado em Ciência da Computação', type: 'Graduação', modality: 'Híbrido', unit: 'Campus Jundiaí — Anchieta', shift: 'Noturno', period: 7, dps: 1, balance: 0, financial: 'adimplente', academic: 'dp', firstContact: ago(60 * 24 * 690), tags: ['DP/ADAP'] }),
    s({ id: 'e23', name: 'Priscila Damasceno Reis', ra: '2510983', cpf: '491.038.226-70', phone: '(11) 98255-9041', email: 'priscila.reis@aluno.anchieta.br', course: 'Licenciatura em Pedagogia', type: 'Graduação', modality: 'EAD', unit: 'Graduação EAD', shift: 'EAD', period: 4, dps: 0, balance: 318.4, financial: 'inadimplente', academic: 'regular', firstContact: ago(60 * 24 * 340), tags: ['Boleto'] }),
    s({ id: 'e24', name: 'Lucas Ferrarezi Bueno', ra: '2618033', cpf: '175.904.663-11', phone: '(11) 97829-4408', email: 'lucas.bueno@aluno.anchieta.br', course: 'Superior de Tecnologia em Big Data e Inteligência Analítica', type: 'Tecnólogo', modality: 'EAD', unit: 'Graduação EAD', shift: 'EAD', period: 3, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 130), tags: ['EAD'] }),
    s({ id: 'e25', name: 'Renan Kobayashi Muniz', ra: '2401556', cpf: '338.712.005-88', phone: '(11) 99461-7730', email: 'renan.muniz@aluno.anchieta.br', course: 'Bacharelado em Engenharia Elétrica', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Noturno', period: 8, dps: 0, balance: 0, financial: 'adimplente', academic: 'formando', firstContact: ago(60 * 24 * 820), tags: ['Colação'] }),
    s({ id: 'e26', name: 'Aline Peçanha Torres', ra: '2513670', cpf: '250.997.314-46', phone: '(11) 98613-2298', email: 'aline.torres@aluno.anchieta.br', course: 'Bacharelado em Administração', type: 'Graduação', modality: 'Híbrido', unit: 'Polo Várzea Paulista', shift: 'Híbrido', period: 5, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 260), tags: ['Rematrícula'] }),
    /* Alunos com manifestação aberta na Ouvidoria */
    s({ id: 'e27', name: 'Mariana Albuquerque Siqueira', ra: '2408815', cpf: '512.330.871-09', phone: '(11) 98450-3317', email: 'mariana.siqueira@aluno.anchieta.br', course: 'Bacharelado em Farmácia', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Noturno', period: 5, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 480), tags: ['Ouvidoria', 'Estorno'] }),
    s({ id: 'e28', name: 'Carlos Eduardo Fagundes', ra: '2209447', cpf: '284.117.650-32', phone: '(11) 99208-6641', email: 'carlos.fagundes@aluno.anchieta.br', course: 'Bacharelado em Engenharia Civil', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Dr. Cavalcanti', shift: 'Noturno', period: 10, dps: 0, balance: 0, financial: 'adimplente', academic: 'formando', firstContact: ago(60 * 24 * 1300), tags: ['Ouvidoria', 'TCC'] }),
    s({ id: 'e29', name: 'Beatriz Lacerda Monteiro', ra: '2511362', cpf: '603.428.115-74', phone: '(11) 97314-5520', email: 'beatriz.monteiro@aluno.anchieta.br', course: 'Bacharelado em Design Gráfico', type: 'Graduação', modality: 'Presencial', unit: 'Campus Jundiaí — Anchieta', shift: 'Diurno', period: 3, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 230), tags: ['Ouvidoria', 'Acessibilidade'] }),
    s({ id: 'e30', name: 'Fernando Rocha Quintana', ra: '2615209', cpf: '177.902.348-61', phone: '(11) 98821-0476', email: 'fernando.quintana@aluno.anchieta.br', course: 'Superior de Tecnologia em Gestão de Recursos Humanos', type: 'Tecnólogo', modality: 'EAD', unit: 'Graduação EAD', shift: 'EAD', period: 2, dps: 0, balance: 0, financial: 'adimplente', academic: 'regular', firstContact: ago(60 * 24 * 150), tags: ['Ouvidoria', 'Elogio'] }),
  ];

  /* Foto de perfil, como o desk real puxa do WhatsApp. Alguns alunos ficam sem
     foto de propósito — no canal de verdade muita gente não tem, e a interface
     precisa ficar bonita com as iniciais também. Se a imagem não carregar
     (sem internet, por exemplo), o avatar volta sozinho para as iniciais. */
  var PHOTOS = {
    e01: 'women/44', e02: 'men/32', e03: 'women/65', e04: 'men/46', e05: 'women/68',
    e07: 'women/17', e08: 'men/75', e09: 'women/90', e10: 'men/21', e11: 'women/50',
    e12: 'men/52', e14: 'men/64', e15: 'women/29', e16: 'men/41', e17: 'women/12',
    e19: 'women/57', e20: 'men/18', e21: 'women/33', e23: 'women/79', e24: 'men/85',
    e26: 'women/8', e27: 'women/24', e28: 'men/36', e29: 'women/91', e30: 'men/11',
  };
  STUDENTS.forEach(function (st) {
    st.photo = PHOTOS[st.id] ? 'https://randomuser.me/api/portraits/' + PHOTOS[st.id] + '.jpg' : null;
  });

  /* Matrículas e observações internas — só onde agregam ao atendimento. */
  var EXTRA = {
    e04: {
      enrollments: [
        'Bacharelado em Ciência da Computação — período 7 (RA 2311260)',
        'Extensão: Arquitetura de Dados — período 1 (RA 2311261)',
      ],
      notes: [
        { author: 'a-marcos', at: ago(60 * 26), text: 'Aluno já ligou duas vezes sobre a rematrícula. Bloqueio é documental (RG vencido), não financeiro. @Amanda Dutra se ele voltar, peça o documento novo antes de escalar.' },
      ],
      alerts: [{ tone: 'warn', text: '2 DPs em aberto — rematrícula exige aceite do plano de recuperação.' }],
    },
    e09: {
      notes: [
        { author: 'a-ana', at: ago(60 * 50), text: 'Aluna mencionou dificuldade financeira. Antes de processar trancamento, ofertar renegociação — é caso de retenção.' },
      ],
      alerts: [
        { tone: 'crit', text: 'Pedido de trancamento em aberto. Retenção prioritária.' },
        { tone: 'warn', text: 'R$ 2.340,00 em aberto (2 mensalidades).' },
      ],
    },
    e14: {
      notes: [
        { author: 'a-ana', at: ago(60 * 72), text: 'Terceira tentativa de contato sem retorno. Próximo passo é ligação da equipe de negociação.' },
      ],
      alerts: [
        { tone: 'crit', text: 'R$ 4.870,50 em aberto (4 mensalidades) — matrícula suspensa em 12 dias.' },
      ],
    },
    e11: {
      alerts: [{ tone: 'warn', text: 'Formanda — pendência documental bloqueia a colação.' }],
    },
    e01: {
      alerts: [{ tone: 'warn', text: 'Mensalidade de setembro vencida há 6 dias.' }],
    },
    e27: {
      notes: [
        { author: 'a-ana', at: ago(60 * 24 * 7), text: 'Aluna já veio duas vezes pelo estorno da taxa de rematrícula. Os comprovantes estão no protocolo FIN-7712 — não pedir de novo.' },
      ],
      alerts: [{ tone: 'warn', text: 'Ouvidoria OUV-2026-0412 aberta — terceiro contato sobre o mesmo assunto.' }],
    },
    e28: {
      alerts: [{ tone: 'crit', text: 'Formando: nota de TCC divergente bloqueia a colação de dezembro.' }],
    },
    e29: {
      notes: [
        { author: 'a-carla', at: ago(60 * 24 * 21), text: 'Aluna com deficiência auditiva. Comunicação sempre por texto — não oferecer ligação. Ela prefere mensagens objetivas, com datas.' },
      ],
      alerts: [{ tone: 'warn', text: 'Atendimento prioritário (acessibilidade). Ouvidoria OUV-2026-0398 em andamento.' }],
    },
  };

  STUDENTS.forEach(function (st) {
    var ex = EXTRA[st.id] || {};
    st.enrollments = ex.enrollments || [st.course + ' — período ' + st.period + ' (RA ' + st.ra + ')'];
    st.notes = ex.notes || [];
    st.alerts = ex.alerts || [];
    st.syncedAt = ago(12 + Math.floor(Math.random() * 40));
  });

  /* ======================================================================
     Conversas abertas — a fila viva
     ====================================================================== */

  function msg(from, author, text, minAgo, extra) {
    var m = { from: from, authorId: author, text: text, at: ago(minAgo) };
    if (extra) Object.keys(extra).forEach(function (k) { m[k] = extra[k]; });
    return m;
  }

  var CONVERSATIONS = [
    {
      id: 'c01', studentId: 'e01', subject: 'Segunda via do boleto de setembro',
      channel: 'app', queue: 'financeiro', status: 'aberto', assignee: null,
      priority: 'alta', tags: ['Boleto', 'Negociação'], unread: 2, starred: false, mentioned: false,
      slaDue: ahead(11), firstResponseAt: null, botHandled: true,
      aiIntent: 'Segunda via de boleto vencido',
      aiSummary: 'A aluna tentou emitir a segunda via pelo portal e recebeu erro de "título não localizado". A mensalidade de setembro venceu há 6 dias e há multa aplicada. Ela pergunta se consegue o boleto com o vencimento reprogramado.',
      messages: [
        msg('bot', 'bot', 'Olá, Larissa! Sou a assistente virtual da UniAnchieta. Como posso te ajudar hoje?', 26),
        msg('aluno', 'e01', 'oi, preciso do boleto de setembro', 25),
        msg('bot', 'bot', 'Você pode emitir a segunda via pelo Portal do Aluno, em Financeiro > Boletos. Quer que eu te envie o link?', 25),
        msg('aluno', 'e01', 'ja tentei por ali, da erro "título não localizado"', 24),
        msg('aluno', 'e01', 'e o vencimento ja passou, vai ter multa? consigo com a data reprogramada?', 23),
        msg('bot', 'bot', 'Entendi. Vou encaminhar para um atendente do Financeiro, tudo bem? Ele assume esta mesma conversa.', 23, { handoff: true }),
      ],
    },
    {
      id: 'c02', studentId: 'e02', subject: 'Aproveitamento de disciplinas da outra faculdade',
      channel: 'portal', queue: 'secretaria', status: 'aberto', assignee: null,
      priority: 'alta', tags: ['Equivalência', 'Transferência'], unread: 1, starred: false, mentioned: false,
      slaDue: ago(9), firstResponseAt: null, botHandled: true,
      aiIntent: 'Aproveitamento de estudos / equivalência',
      aiSummary: 'Aluno transferido no 3º período. As ementas das disciplinas do 1º e 2º períodos aparecem como adaptação na grade dele, e ele não entende por quê. Já possui as ementas da instituição de origem e pede as ementas da UniAnchieta para comparar.',
      messages: [
        msg('aluno', 'e02', 'bom dia! na minha grade aparecem disciplinas que eu não cursei como se fossem adaptação', 190),
        msg('bot', 'bot', 'Bom dia, Bruno! A grade mostra todas as disciplinas da matriz do seu curso. Como você entrou por transferência, as disciplinas dos períodos anteriores aparecem como adaptação até a análise de aproveitamento ser concluída.', 189),
        msg('aluno', 'e02', 'ah entendi. e pq eu precisava da ementa de psicologia social e comunitária', 188),
        msg('aluno', 'e02', 'eu preciso da ementa da unianchieta, a da outra instituição eu já tenho', 61),
      ],
    },
    {
      id: 'c03', studentId: 'e03', subject: 'Sem acesso ao AVA desde ontem',
      channel: 'app', queue: 'suporte', status: 'aberto', assignee: 'a-amanda',
      priority: 'normal', tags: ['EAD', 'Acesso'], unread: 0, starred: false, mentioned: false,
      slaDue: ahead(38), firstResponseAt: ago(96), botHandled: false,
      aiIntent: 'Falha de acesso ao ambiente virtual',
      aiSummary: 'Aluna EAD não consegue entrar no AVA desde ontem à noite — a tela volta para o login. Senha já foi redefinida uma vez sem sucesso. Prazo de entrega de atividade é amanhã, o que aumenta a urgência percebida.',
      messages: [
        msg('aluno', 'e03', 'boa tarde, não estou conseguindo entrar no AVA desde ontem à noite', 128),
        msg('aluno', 'e03', 'coloco a senha e a tela volta pro login de novo', 127),
        msg('agente', 'a-amanda', 'Boa tarde, Camila! Vamos resolver isso. Você chegou a redefinir a senha pelo "Esqueci minha senha"?', 96),
        msg('aluno', 'e03', 'sim, redefini e continua igual', 94),
        msg('agente', 'a-amanda', 'Certo. Vou abrir um chamado com o time de sistemas para liberar seu acesso. Uma pergunta: você está tentando pelo app ou pelo navegador?', 90),
        msg('aluno', 'e03', 'pelos dois, mesma coisa', 88),
        msg('nota', 'a-amanda', 'Chamado #SIS-4471 aberto no sistema. @Thiago Nunes Prado consegue olhar o cadastro dela no AVA? A matrícula está ativa, parece problema de sincronização de perfil.', 86),
        msg('agente', 'a-amanda', 'Camila, chamado aberto com o time técnico. Assim que o acesso for liberado eu te aviso por aqui — a previsão é de até 4 horas úteis.', 84),
        msg('aluno', 'e03', 'obrigada! só que a atividade vence amanhã, dá pra prorrogar?', 52),
      ],
    },
    {
      id: 'c04', studentId: 'e04', subject: 'Rematrícula 2026/1 travando no passo 3',
      channel: 'app', queue: 'secretaria', status: 'aberto', assignee: 'a-amanda',
      priority: 'alta', tags: ['Rematrícula', 'DP/ADAP'], unread: 1, starred: false, mentioned: false,
      slaDue: ahead(22), firstResponseAt: ago(240), botHandled: false,
      aiIntent: 'Bloqueio na rematrícula',
      aiSummary: 'Aluno do 7º período não consegue concluir a rematrícula: o botão de aceite do contrato não habilita. Há duas DPs em aberto e um documento vencido no cadastro (RG). O bloqueio é documental, não financeiro.',
      messages: [
        msg('aluno', 'e04', 'fala! to tentando fazer a rematricula e trava no passo 3, o botão de aceitar contrato não habilita', 265),
        msg('agente', 'a-amanda', 'Oi, Vinícius! Já vou verificar. Você chegou a selecionar as disciplinas no passo 2 e salvar?', 240),
        msg('aluno', 'e04', 'sim, salvei e apareceu o resumo certinho', 236),
        msg('nota', 'a-marcos', 'Conferi no acadêmico: o bloqueio é documental (RG vencido em 08/2026), não financeiro. @Amanda Dutra é só pedir o documento novo.', 210),
        msg('agente', 'a-amanda', 'Achei aqui: o que está bloqueando não é a parte financeira, é um documento vencido no cadastro — o seu RG. Se você anexar uma foto do documento atualizado por aqui, eu libero hoje mesmo.', 205),
        msg('aluno', 'e04', 'ah tá, e as DPs interferem?', 34),
      ],
    },
    {
      id: 'c05', studentId: 'e05', subject: 'Declaração de matrícula para o estágio',
      channel: 'whatsapp', queue: 'estagios', status: 'pendente', assignee: 'a-amanda',
      priority: 'normal', tags: ['Estágio', 'Documentos'], unread: 0, starred: false, mentioned: false,
      slaDue: ahead(168), firstResponseAt: ago(300), botHandled: false,
      aiIntent: 'Emissão de declaração de matrícula',
      aiSummary: 'Aluna precisa da declaração de matrícula com carga horária para entregar no hospital onde fará estágio. Documento solicitado e protocolado; aguarda emissão pela Secretaria.',
      messages: [
        msg('aluno', 'e05', 'Oi! O hospital pediu uma declaração de matrícula com a carga horária do curso. Consigo por aqui?', 320),
        msg('agente', 'a-amanda', 'Oi, Thaís! Consegue sim. Vou abrir a solicitação agora — preciso só confirmar: a declaração é para o campo de estágio obrigatório do 5º período, certo?', 300),
        msg('aluno', 'e05', 'isso mesmo', 296),
        msg('agente', 'a-amanda', 'Perfeito. Protocolo aberto: #DEC-8823. A Secretaria emite em até 3 dias úteis e eu te envio o PDF assinado por aqui.', 292),
        msg('aluno', 'e05', 'combinado, obrigada!', 290),
      ],
    },
    {
      id: 'c06', studentId: 'e06', subject: 'DP de Cálculo II — quando abre a matrícula?',
      channel: 'app', queue: 'coordenacao', status: 'aberto', assignee: null,
      priority: 'normal', tags: ['DP/ADAP', 'Calendário'], unread: 1, starred: false, mentioned: false,
      slaDue: ahead(95), firstResponseAt: null, botHandled: true,
      aiIntent: 'Matrícula em dependência',
      aiSummary: 'Aluno do 8º período quer saber quando abre a matrícula em DP de Cálculo II e se a disciplina será ofertada no noturno.',
      messages: [
        msg('aluno', 'e06', 'boa noite, quando abre a matricula em DP de calculo 2?', 44),
        msg('bot', 'bot', 'Boa noite, Rodrigo! A matrícula em dependência abre junto com a rematrícula do semestre. Quer que eu chame um atendente da Coordenação para confirmar a oferta da disciplina?', 44),
        msg('aluno', 'e06', 'sim pf, e queria saber se vai ter no noturno', 43),
      ],
    },
    {
      id: 'c07', studentId: 'e07', subject: 'Nota de Psicologia Social não apareceu no portal',
      channel: 'portal', queue: 'coordenacao', status: 'aberto', assignee: 'a-marcos',
      priority: 'normal', tags: ['Notas'], unread: 0, starred: false, mentioned: false,
      slaDue: ahead(64), firstResponseAt: ago(110), botHandled: false,
      aiIntent: 'Nota não lançada',
      aiSummary: 'Aluna do 1º período não encontra a nota da P1 de Psicologia Social no portal. Coordenação já foi acionada e o professor tem até sexta para lançar.',
      messages: [
        msg('aluno', 'e07', 'Boa tarde! A nota da P1 de Psicologia Social não aparece no meu portal, as outras já estão lá.', 130),
        msg('agente', 'a-marcos', 'Boa tarde, Juliana! Verifiquei aqui: a nota ainda não foi lançada pelo professor. Já acionei a coordenação do curso.', 110),
        msg('aluno', 'e07', 'tem prazo pra sair?', 106),
        msg('agente', 'a-marcos', 'O prazo de lançamento vai até sexta-feira. Se não aparecer até lá, me chama que eu escalo direto para a coordenação.', 100),
      ],
    },
    {
      id: 'c08', studentId: 'e08', subject: 'Convênio de estágio com a prefeitura',
      channel: 'email', queue: 'estagios', status: 'aberto', assignee: 'a-renata',
      priority: 'normal', tags: ['Estágio'], unread: 0, starred: false, mentioned: false,
      slaDue: ahead(210), firstResponseAt: ago(420), botHandled: false,
      aiIntent: 'Novo convênio de estágio',
      aiSummary: 'Aluno conseguiu vaga na Prefeitura de Jundiaí e precisa que a UniAnchieta assine o convênio antes do TCE. Documentação enviada, aguardando jurídico.',
      messages: [
        msg('aluno', 'e08', 'Boa tarde. Passei no processo seletivo da Prefeitura de Jundiaí e eles pediram o convênio assinado pela faculdade antes do TCE. Como faço?', 460),
        msg('agente', 'a-renata', 'Boa tarde, Felipe! Parabéns pela vaga. Preciso do CNPJ da concedente e do nome do responsável que assina. Com isso eu abro o convênio no jurídico.', 420),
        msg('aluno', 'e08', 'Segue: CNPJ 45.780.103/0001-50, responsável Sr. Almir Ribeiro, RH.', 410),
        msg('agente', 'a-renata', 'Recebido. Convênio protocolado no jurídico hoje. O prazo médio é de 7 dias úteis e eu te aviso assim que voltar assinado.', 400),
      ],
    },
    {
      id: 'c09', studentId: 'e09', subject: 'Trancamento de matrícula — qual o prazo?',
      channel: 'app', queue: 'secretaria', status: 'aberto', assignee: null,
      priority: 'urgente', tags: ['Trancamento', 'Retenção'], unread: 3, starred: true, mentioned: false,
      slaDue: ahead(5), firstResponseAt: null, botHandled: true,
      aiIntent: 'Intenção de trancamento — risco de evasão',
      aiSummary: 'Aluna do 4º período pede o procedimento de trancamento citando dificuldade para pagar as mensalidades. Há R$ 2.340,00 em aberto. O caso é de retenção: antes do trancamento, cabe oferta de renegociação e bolsa.',
      messages: [
        msg('aluno', 'e09', 'oi, como faço pra trancar a matricula?', 16),
        msg('bot', 'bot', 'Olá, Patrícia! O trancamento é solicitado pela Secretaria Acadêmica. Posso chamar um atendente para te orientar?', 16),
        msg('aluno', 'e09', 'pode', 15),
        msg('aluno', 'e09', 'é que esse semestre ficou pesado pra pagar, ai prefiro trancar do que ficar devendo', 14),
        msg('aluno', 'e09', 'tem algum prazo? nao quero perder a data', 12),
      ],
    },
    {
      id: 'c10', studentId: 'e10', subject: 'Renovação semestral do PROUNI',
      channel: 'app', queue: 'financeiro', status: 'aberto', assignee: 'a-ana',
      priority: 'normal', tags: ['Bolsa'], unread: 0, starred: false, mentioned: false,
      slaDue: ahead(300), firstResponseAt: ago(1400), botHandled: false,
      aiIntent: 'Renovação de bolsa',
      aiSummary: 'Bolsista PROUNI pergunta sobre a renovação semestral e quais documentos precisa reenviar. Já orientado; aguarda abertura do período no sistema do MEC.',
      messages: [
        msg('aluno', 'e10', 'Oi! Preciso renovar o PROUNI esse semestre? Alguém me falou que é automático.', 1440),
        msg('agente', 'a-ana', 'Oi, Gustavo! A renovação não é automática: você confirma no sistema do MEC a cada semestre, e a instituição valida em seguida.', 1400),
        msg('aluno', 'e10', 'entendi, e quando abre?', 1380),
        msg('agente', 'a-ana', 'O período costuma abrir na segunda quinzena do mês. Assim que abrir, a coordenação de bolsas dispara um aviso no app — e eu te aviso por aqui também.', 1370),
      ],
    },
    {
      id: 'c11', studentId: 'e11', subject: 'Colação de grau — documentos pendentes',
      channel: 'portal', queue: 'secretaria', status: 'aberto', assignee: 'a-amanda',
      priority: 'alta', tags: ['Colação', 'Documentos'], unread: 0, starred: true, mentioned: false,
      slaDue: ahead(28), firstResponseAt: ago(180), botHandled: false,
      aiIntent: 'Pendência documental para colação',
      aiSummary: 'Formanda de Fonoaudiologia tem duas pendências documentais que bloqueiam a colação: certidão de nascimento autenticada e diploma do ensino médio. Prazo da cerimônia é em 18 dias.',
      messages: [
        msg('aluno', 'e11', 'Boa tarde! Recebi um e-mail dizendo que tenho pendência documental para colar grau, mas não diz qual.', 200),
        msg('agente', 'a-amanda', 'Boa tarde, Marina! Vou conferir agora no seu cadastro.', 180),
        msg('agente', 'a-amanda', 'São duas pendências: certidão de nascimento autenticada e o diploma do ensino médio (a cópia que temos está ilegível). Se você trouxer na Secretaria até o dia 30, dá tempo tranquilo para a cerimônia.', 176),
        msg('nota', 'a-amanda', 'Formanda com cerimônia em 18 dias. Se não entregar até dia 30, avisar a coordenação do curso para não entrar na lista.', 175),
        msg('aluno', 'e11', 'Perfeito, consigo levar na quinta. Preciso agendar horário?', 170),
      ],
    },
    {
      id: 'c12', studentId: 'e12', subject: 'Pós EAD: liberar disciplina optativa',
      channel: 'app', queue: 'pos-ead', status: 'aberto', assignee: null,
      priority: 'normal', tags: ['EAD'], unread: 1, starred: false, mentioned: false,
      slaDue: ahead(140), firstResponseAt: null, botHandled: true,
      aiIntent: 'Liberação de disciplina optativa',
      aiSummary: 'Aluno da especialização escolheu a optativa no portal mas a disciplina não apareceu no AVA. Pergunta se precisa fazer algo a mais.',
      messages: [
        msg('aluno', 'e12', 'Boa noite. Escolhi a optativa pelo portal semana passada e ela não apareceu no AVA até agora.', 80),
        msg('bot', 'bot', 'Boa noite, Eduardo! A liberação no AVA acontece em até 48h após a escolha. Como já passou desse prazo, vou encaminhar para a equipe de Pós & EAD.', 80, { handoff: true }),
        msg('aluno', 'e12', 'obrigado', 78),
      ],
    },
    {
      id: 'c13', studentId: 'e13', subject: 'Carteirinha do estudante não chegou',
      channel: 'app', queue: 'suporte', status: 'aberto', assignee: null,
      priority: 'baixa', tags: ['Documentos'], unread: 1, starred: false, mentioned: false,
      slaDue: ahead(400), firstResponseAt: null, botHandled: true,
      aiIntent: 'Emissão de carteirinha',
      aiSummary: 'Aluna do 2º período aguarda a carteirinha digital há três semanas. Solicitação consta no sistema como "aguardando foto".',
      messages: [
        msg('aluno', 'e13', 'oii, faz 3 semanas que pedi a carteirinha e nao chegou nada', 150),
        msg('bot', 'bot', 'Oi, Ana Beatriz! Vou verificar. A sua solicitação está como "aguardando foto" — você chegou a enviar a foto 3x4 pelo app?', 150),
        msg('aluno', 'e13', 'nao sabia que precisava 😅', 148),
      ],
    },
    {
      id: 'c14', studentId: 'e14', subject: 'Renegociação de mensalidades atrasadas',
      channel: 'whatsapp', queue: 'financeiro', status: 'aberto', assignee: null,
      priority: 'urgente', tags: ['Negociação', 'Retenção'], unread: 2, starred: false, mentioned: false,
      slaDue: ago(24), firstResponseAt: null, botHandled: true,
      aiIntent: 'Renegociação de débito — risco de suspensão',
      aiSummary: 'Aluno com R$ 4.870,50 em aberto (4 mensalidades) procura acordo. A matrícula é suspensa automaticamente em 12 dias. Já houve três tentativas de contato sem retorno antes desta mensagem.',
      messages: [
        msg('aluno', 'e14', 'boa tarde, recebi a mensagem dizendo que minha matricula vai ser suspensa', 40),
        msg('aluno', 'e14', 'tem como parcelar o que ta atrasado? perdi o emprego em agosto e to me recolocando agora', 39),
        msg('bot', 'bot', 'Boa tarde, Sérgio. Sinto muito pela situação. Vou encaminhar seu caso para a equipe do Financeiro com prioridade.', 38, { handoff: true }),
      ],
    },
    {
      id: 'c15', studentId: 'e15', subject: 'Calendário de provas do híbrido',
      channel: 'app', queue: 'coordenacao', status: 'aberto', assignee: 'a-rafael',
      priority: 'normal', tags: ['Calendário', 'Híbrido'], unread: 0, starred: false, mentioned: true,
      slaDue: ahead(75), firstResponseAt: ago(70), botHandled: false,
      aiIntent: 'Datas de prova do modelo híbrido',
      aiSummary: 'Aluna do híbrido pergunta se as provas presenciais do 3º período caem no sábado. O calendário do híbrido difere do presencial e ela quer se organizar com o trabalho.',
      messages: [
        msg('aluno', 'e15', 'Oi! As provas do híbrido do 3º período caem no sábado? Preciso avisar no trabalho com antecedência.', 88),
        msg('agente', 'a-rafael', 'Oi, Letícia! As avaliações presenciais do híbrido acontecem aos sábados, sim. As datas do seu período estão no calendário acadêmico dos cursos híbridos.', 70),
        msg('nota', 'a-rafael', '@Amanda Dutra o calendário do híbrido publicado no site ainda é o da versão anterior. Consegue confirmar com a Secretaria qual é o vigente antes de eu mandar o PDF?', 66),
      ],
    },
    {
      id: 'c16', studentId: 'e16', subject: 'Histórico escolar com carimbo',
      channel: 'portal', queue: 'secretaria', status: 'aberto', assignee: 'a-carla',
      priority: 'normal', tags: ['Documentos'], unread: 0, starred: false, mentioned: false,
      slaDue: ahead(260), firstResponseAt: ago(520), botHandled: false,
      aiIntent: 'Emissão de histórico escolar',
      aiSummary: 'Aluno do 9º período de Direito precisa do histórico com carimbo e assinatura para inscrição na OAB. Protocolo aberto, aguardando retirada.',
      messages: [
        msg('aluno', 'e16', 'Preciso do histórico escolar com carimbo e assinatura para a inscrição na OAB.', 540),
        msg('agente', 'a-carla', 'Olá, Otávio! Protocolo aberto (#HIS-2290). O documento fica pronto em 3 dias úteis e pode ser retirado na Secretaria ou enviado digitalmente com assinatura eletrônica. Qual você prefere?', 520),
        msg('aluno', 'e16', 'Pode ser digital, é mais rápido.', 500),
      ],
    },
    {
      id: 'c17', studentId: 'e17', subject: 'Mudança de turno: noturno para diurno',
      channel: 'app', queue: 'secretaria', status: 'aberto', assignee: null,
      priority: 'normal', tags: [], unread: 1, starred: false, mentioned: false,
      slaDue: ahead(52), firstResponseAt: null, botHandled: true,
      aiIntent: 'Mudança de turno',
      aiSummary: 'Calourinha de Odontologia quer migrar do diurno para o noturno por causa de um novo emprego. Precisa saber se há vaga e se a mudança altera a mensalidade.',
      messages: [
        msg('aluno', 'e17', 'oi! comecei agora no diurno mas consegui um emprego, tem como mudar pro noturno?', 58),
        msg('bot', 'bot', 'Oi, Bianca! A mudança de turno depende de vaga na turma de destino e é analisada pela Secretaria. Quer que eu encaminhe?', 58),
        msg('aluno', 'e17', 'quero sim, e queria saber se muda o valor da mensalidade', 57),
      ],
    },
    {
      id: 'c18', studentId: 'e20', subject: 'Estágio obrigatório: horas mínimas',
      channel: 'app', queue: 'estagios', status: 'snoozed', assignee: 'a-renata',
      priority: 'normal', tags: ['Estágio'], unread: 0, starred: false, mentioned: false,
      snoozedUntil: ahead(60 * 16), slaDue: ahead(60 * 20), firstResponseAt: ago(1500), botHandled: false,
      aiIntent: 'Carga horária de estágio obrigatório',
      aiSummary: 'Aluno de Educação Física perguntou quantas horas de estágio faltam. Aguardando o relatório da coordenação, retomar amanhã de manhã.',
      messages: [
        msg('aluno', 'e20', 'Boa tarde! Quantas horas de estágio obrigatório ainda faltam pra mim?', 1520),
        msg('agente', 'a-renata', 'Boa tarde, Diego! Vou levantar com a coordenação o total validado até aqui e te respondo amanhã cedo.', 1500),
        msg('nota', 'a-renata', 'Relatório de horas sai só amanhã de manhã. Adiado para as 8h.', 1498),
      ],
    },
    {
      id: 'c19', studentId: 'e18', subject: 'Comprovante de matrícula para o exército',
      channel: 'app', queue: 'secretaria', status: 'encerrado', assignee: 'a-amanda',
      priority: 'normal', tags: ['Documentos'], unread: 0, starred: false, mentioned: false,
      slaDue: ago(60 * 4), firstResponseAt: ago(60 * 7), closedAt: ago(200), rating: 10,
      aiIntent: 'Comprovante de matrícula',
      aiSummary: 'Comprovante de matrícula emitido e enviado em PDF. Atendimento encerrado com nota 10.',
      messages: [
        msg('aluno', 'e18', 'Bom dia, preciso de um comprovante de matrícula para apresentar no serviço militar.', 430),
        msg('agente', 'a-amanda', 'Bom dia, Kauê! Já emiti aqui. Vou anexar o PDF com assinatura digital.', 420),
        msg('agente', 'a-amanda', 'Segue o comprovante. Ele tem validade de 90 dias e o QR code confirma a autenticidade.', 418, { attachment: 'comprovante-matricula-2519077.pdf' }),
        msg('aluno', 'e18', 'Perfeito, muito obrigado!', 410),
        msg('agente', 'a-amanda', 'Por nada! Qualquer coisa é só chamar. Bons estudos.', 405),
      ],
    },
    {
      id: 'c20', studentId: 'e19', subject: 'Segunda chamada de prova',
      channel: 'app', queue: 'coordenacao', status: 'encerrado', assignee: 'a-amanda',
      priority: 'normal', tags: ['Calendário', 'Notas'], unread: 0, starred: false, mentioned: false,
      slaDue: ago(60 * 9), firstResponseAt: ago(60 * 11), closedAt: ago(320), rating: 9,
      aiIntent: 'Solicitação de segunda chamada',
      aiSummary: 'Aluna faltou à P1 por atestado médico. Requerimento de segunda chamada aberto e deferido; prova reagendada.',
      messages: [
        msg('aluno', 'e19', 'Oi! Faltei na P1 de Anatomia por atestado, consigo segunda chamada?', 700),
        msg('agente', 'a-amanda', 'Oi, Natália! Consegue sim. Preciso que você anexe o atestado aqui e eu abro o requerimento — o prazo é de 3 dias úteis após a falta, então estamos dentro.', 680),
        msg('aluno', 'e19', 'segue o atestado', 660, { attachment: 'atestado-medico.jpg' }),
        msg('agente', 'a-amanda', 'Recebido! Requerimento aberto e deferido pela coordenação. Sua segunda chamada ficou para o dia 28, às 19h, na sala 204.', 340),
        msg('aluno', 'e19', 'maravilha, muito obrigada!!', 325),
      ],
    },

    /* -- Ouvidoria: manifestações que chegaram ao canal de atendimento ----
       Cada uma carrega o protocolo e a linha do tempo completa, em ordem
       cronológica: os contatos anteriores do aluno, o registro na Ouvidoria,
       a triagem, o retorno do setor. É isso que o Copilot resume. */
    {
      id: 'c21', studentId: 'e27', subject: 'Ouvidoria: estorno da taxa de rematrícula paga em duplicidade',
      channel: 'whatsapp', queue: 'ouvidoria', status: 'aberto', assignee: 'a-amanda',
      priority: 'alta', tags: ['Ouvidoria', 'Reclamação', 'Estorno'], unread: 2, starred: false, mentioned: false,
      slaDue: ahead(14), firstResponseAt: null, botHandled: false,
      aiIntent: 'Cobrança de posição sobre estorno — manifestação de ouvidoria',
      aiSummary: 'A aluna pagou a taxa de rematrícula (R$ 389,00) duas vezes — boleto e cartão no portal — e espera o estorno desde 15/09. Foi ao Financeiro duas vezes sem solução e registrou ouvidoria em 26/09. O Financeiro confirmou a duplicidade ontem: o estorno entra no lote bancário de sexta (03/10) e cai em até 2 dias úteis.',
      ouvidoria: {
        protocol: 'OUV-2026-0412', type: 'Reclamação', sector: 'Financeiro', stage: 2,
        origin: 'Formulário da Ouvidoria (site)', openedAt: ago(60 * 24 * 5), deadline: aheadBusiness(5),
        deadlineRule: '10 dias úteis a partir do registro',
        events: [
          { at: ago(60 * 24 * 16), kind: 'contato', title: 'Primeiro contato com o Financeiro', ref: 'h11', text: 'Aluna informa pagamento em duplicidade da taxa de rematrícula. Protocolo FIN-7712 aberto; prometido estorno em até 5 dias úteis.' },
          { at: ago(60 * 24 * 7), kind: 'contato', title: 'Segundo contato — estorno não caiu', ref: 'h12', text: 'Financeiro responde que o estorno está "em processamento", sem data. Aluna demonstra insatisfação.' },
          { at: ago(60 * 24 * 5), kind: 'ouvidoria', title: 'Manifestação registrada na Ouvidoria', text: 'Reclamação: "Paguei duas vezes e ninguém me dá uma data para devolver o dinheiro."' },
          { at: ago(60 * 24 * 4), kind: 'setor', title: 'Triagem da Ouvidoria', text: 'Encaminhada ao Financeiro com prazo interno de 5 dias úteis. Responsável: Helena Martins Castro.' },
          { at: ago(60 * 24 * 1), kind: 'setor', title: 'Financeiro confirma a duplicidade', text: 'Estorno de R$ 389,00 aprovado. Entra no lote bancário de 03/10; crédito em até 2 dias úteis na conta de origem.' },
          { at: ago(40), kind: 'aluno', title: 'Aluna cobra posição no canal', text: 'Terceira vez que ela fala sobre o assunto. Pede uma resposta concreta.' },
        ],
      },
      messages: [
        msg('nota', 'a-helena', 'Financeiro confirmou a duplicidade. Estorno de R$ 389,00 aprovado, entra no lote bancário de sexta (03/10) e cai em até 2 dias úteis na conta de origem. Pode passar essas datas para a aluna e me avisar quando ela confirmar o recebimento — aí eu concluo a manifestação.', 60 * 20),
        msg('aluno', 'e27', 'Boa tarde. Abri uma ouvidoria semana passada (protocolo OUV-2026-0412) porque paguei a taxa de rematrícula duas vezes e até agora não recebi o estorno. Já é a terceira vez que falo com vocês sobre isso.', 40),
        msg('aluno', 'e27', 'Preciso desse dinheiro, é quase 400 reais. Alguém pode me dar uma resposta concreta?', 38),
      ],
    },
    {
      id: 'c22', studentId: 'e29', subject: 'Ouvidoria: intérprete de Libras e reposição de aulas práticas',
      channel: 'whatsapp', queue: 'ouvidoria', status: 'aberto', assignee: 'a-amanda',
      priority: 'alta', tags: ['Ouvidoria', 'Acessibilidade'], unread: 1, starred: false, mentioned: false,
      slaDue: ahead(26), firstResponseAt: ago(170), botHandled: false,
      aiIntent: 'Acessibilidade — reposição de aulas sem intérprete',
      aiSummary: 'Aluna com deficiência auditiva pediu intérprete de Libras em 25/08 e ficou sem acompanhamento nas aulas práticas. O intérprete começa em 06/10, mas a reposição das aulas perdidas ainda não foi formalizada. A coordenação propôs 3 sábados a partir de 11/10 e deve confirmar por escrito até amanhã.',
      ouvidoria: {
        protocol: 'OUV-2026-0398', type: 'Reclamação', sector: 'Núcleo de Acessibilidade · Coordenação de Design', stage: 2,
        origin: 'E-mail para a Ouvidoria', openedAt: ago(60 * 24 * 9), deadline: aheadBusiness(3),
        deadlineRule: '10 dias úteis a partir do registro',
        events: [
          { at: ago(60 * 24 * 37), kind: 'contato', title: 'Pedido de intérprete à Secretaria', ref: 'h13', text: 'Aluna solicita intérprete de Libras para as aulas práticas de Tipografia e Ateliê. Encaminhado ao Núcleo de Acessibilidade.' },
          { at: ago(60 * 24 * 21), kind: 'contato', title: 'Reiteração do pedido', ref: 'h14', text: 'Sem intérprete até aqui. Núcleo informa que o processo de contratação está "em análise".' },
          { at: ago(60 * 24 * 9), kind: 'ouvidoria', title: 'Manifestação registrada na Ouvidoria', text: 'Reclamação de acessibilidade, marcada como prioritária pela Ouvidoria.' },
          { at: ago(60 * 24 * 8), kind: 'setor', title: 'Encaminhada a dois setores', text: 'Núcleo de Acessibilidade (intérprete) e Coordenação de Design (reposição das aulas), prazo interno de 5 dias úteis.' },
          { at: ago(60 * 24 * 3), kind: 'setor', title: 'Intérprete contratado', text: 'Núcleo confirma intérprete a partir de 06/10, em todas as aulas práticas.' },
          { at: ago(60 * 24 * 1), kind: 'prazo', title: 'Prazo interno vencido', text: 'Coordenação de Design não respondeu sobre a reposição das aulas perdidas.' },
          { at: ago(60 * 2), kind: 'setor', title: 'Coordenação propõe reposição', text: '3 encontros aos sábados com intérprete, a partir de 11/10. Confirmação por escrito até amanhã.' },
        ],
      },
      messages: [
        msg('aluno', 'e29', 'Oi. Recebi o e-mail da ouvidoria dizendo que o intérprete começa dia 06. Mas e as aulas práticas que eu já perdi? Ninguém me respondeu sobre reposição.', 180),
        msg('agente', 'a-amanda', 'Oi, Beatriz! Obrigada por escrever. Estou com o seu protocolo aberto aqui e vou confirmar com a coordenação como fica a reposição das aulas práticas. Te retorno ainda hoje.', 170),
        msg('nota', 'a-amanda', 'Coordenação de Design ainda não respondeu sobre a reposição. @Helena Martins Castro consegue reforçar pelo canal da ouvidoria? O prazo final vence em 3 dias úteis.', 165),
        msg('nota', 'a-helena', 'Reforcei com a coordenadora (Profa. Cristina). Ela propôs 3 encontros de reposição aos sábados, com intérprete, a partir de 11/10. Confirma por escrito até amanhã.', 120),
        msg('aluno', 'e29', 'Alguma novidade? Preciso me organizar com o trabalho se tiver aula extra.', 25),
      ],
    },
    {
      id: 'c23', studentId: 'e28', subject: 'Ouvidoria: nota do TCC lançada errada no portal',
      channel: 'app', queue: 'ouvidoria', status: 'aberto', assignee: null,
      priority: 'urgente', tags: ['Ouvidoria', 'Reclamação', 'TCC'], unread: 2, starred: false, mentioned: false,
      slaDue: ahead(9), firstResponseAt: null, botHandled: true,
      aiIntent: 'Divergência de nota de TCC — risco à colação',
      aiSummary: 'Formando de Engenharia Civil: a banca atribuiu 8,5 ao TCC, mas o portal mostra 5,8 — o que o reprova e bloqueia a colação de dezembro. Ele enviou a ata da banca à coordenação há 6 dias sem resposta e registrou ouvidoria hoje.',
      ouvidoria: {
        protocol: 'OUV-2026-0431', type: 'Reclamação', sector: 'Coordenação de Engenharia Civil', stage: 1,
        origin: 'Formulário da Ouvidoria (app)', openedAt: ago(60 * 3), deadline: aheadBusiness(10),
        deadlineRule: '10 dias úteis a partir do registro',
        events: [
          { at: ago(60 * 24 * 12), kind: 'contato', title: 'Defesa do TCC', text: 'Ata da banca registra nota final 8,5 — aprovado.' },
          { at: ago(60 * 24 * 6), kind: 'contato', title: 'E-mail à coordenação', text: 'Aluno percebe a nota 5,8 no portal e envia a ata assinada à coordenação. Sem resposta.' },
          { at: ago(60 * 24 * 2), kind: 'contato', title: 'Contato no canal de atendimento', ref: 'h15', text: 'Orientado a aguardar o retorno da coordenação.' },
          { at: ago(60 * 3), kind: 'ouvidoria', title: 'Manifestação registrada na Ouvidoria', text: 'Reclamação: nota divergente, risco de não colar grau em dezembro.' },
        ],
      },
      messages: [
        msg('aluno', 'e28', 'Boa noite. Registrei uma ouvidoria hoje (OUV-2026-0431). Minha nota do TCC está errada no portal: a banca me deu 8,5 e aparece 5,8. Isso me reprova e eu colo grau em dezembro.', 50),
        msg('bot', 'bot', 'Entendi, Carlos. Como existe uma manifestação de ouvidoria aberta, vou encaminhar você para um atendente que acompanha o seu protocolo.', 50, { handoff: true }),
        msg('aluno', 'e28', 'Já mandei a ata da banca para a coordenação semana passada e ninguém respondeu.', 47),
      ],
    },
    {
      id: 'c24', studentId: 'e30', subject: 'Ouvidoria: elogio à tutora do EAD',
      channel: 'app', queue: 'ouvidoria', status: 'aberto', assignee: 'a-amanda',
      priority: 'baixa', tags: ['Ouvidoria', 'Elogio'], unread: 0, starred: false, mentioned: false,
      slaDue: ahead(190), firstResponseAt: null, botHandled: false,
      aiIntent: 'Elogio — confirmação de recebimento',
      aiSummary: 'O aluno registrou um elogio à tutora Simone, que o ajudou a não desistir do curso. A Ouvidoria já encaminhou o elogio à coordenação EAD; falta agradecer o aluno e concluir a manifestação.',
      ouvidoria: {
        protocol: 'OUV-2026-0420', type: 'Elogio', sector: 'Coordenação EAD', stage: 3,
        origin: 'Formulário da Ouvidoria (site)', openedAt: ago(60 * 24 * 2), deadline: aheadBusiness(8),
        deadlineRule: '10 dias úteis a partir do registro',
        events: [
          { at: ago(60 * 24 * 2), kind: 'ouvidoria', title: 'Elogio registrado na Ouvidoria', text: '"A tutora Simone me ajudou demais a não desistir do curso."' },
          { at: ago(60 * 24 * 1), kind: 'setor', title: 'Encaminhado à coordenação EAD', text: 'Elogio repassado à coordenação e à tutora.' },
          { at: ago(60 * 26), kind: 'aluno', title: 'Aluno pergunta se o elogio chegou', text: 'Mensagem no app.' },
        ],
      },
      messages: [
        msg('aluno', 'e30', 'Olá! Mandei um elogio pela ouvidoria pra tutora Simone, ela me ajudou demais a não desistir do curso. Queria saber se chegou pra ela 🙂', 60 * 26),
        msg('nota', 'a-helena', 'Elogio encaminhado à coordenação EAD e à tutora. Pode agradecer o aluno e encerrar — eu concluo a manifestação quando você fechar.', 60 * 22),
      ],
    },
  ];

  /* ======================================================================
     Histórico — conversas já encerradas, por aluno (somente leitura)
     ====================================================================== */

  var HISTORY = [
    {
      id: 'h01', studentId: 'e01', subject: 'Dúvida sobre desconto de pontualidade',
      channel: 'app', queue: 'financeiro', agent: 'a-ana', openedAt: ago(60 * 24 * 31),
      closedAt: ago(60 * 24 * 31 - 46), durationMin: 46, waitMin: 3, frtMin: 3, rating: 9,
      tags: ['Boleto'],
      summary: 'Aluna perguntou até quando vale o desconto de pontualidade. Explicado que o desconto cai no boleto pago até o vencimento; encerrado sem pendência.',
      messages: [
        msg('aluno', 'e01', 'o desconto de pontualidade vale até que dia?', 60 * 24 * 31),
        msg('agente', 'a-ana', 'Oi, Larissa! O desconto é aplicado automaticamente no boleto pago até a data de vencimento. Depois disso, o sistema reemite o título sem o desconto.', 60 * 24 * 31 - 4),
        msg('aluno', 'e01', 'entendi, obrigada!', 60 * 24 * 31 - 44),
      ],
    },
    {
      id: 'h02', studentId: 'e01', subject: 'Atualização de dados cadastrais',
      channel: 'portal', queue: 'secretaria', agent: 'a-carla', openedAt: ago(60 * 24 * 90),
      closedAt: ago(60 * 24 * 90 - 120), durationMin: 120, waitMin: 12, frtMin: 12, rating: null,
      tags: ['Documentos'],
      summary: 'Atualização de endereço e telefone no cadastro, concluída no mesmo dia.',
      messages: [
        msg('aluno', 'e01', 'mudei de endereço, como atualizo?', 60 * 24 * 90),
        msg('agente', 'a-carla', 'Você atualiza direto no Portal do Aluno, em Meus dados > Endereço. Precisa anexar um comprovante recente no nome de um familiar ou seu.', 60 * 24 * 90 - 12),
        msg('aluno', 'e01', 'consegui, valeu', 60 * 24 * 90 - 118),
      ],
    },
    {
      id: 'h03', studentId: 'e02', subject: 'Primeiro acesso ao Portal do Aluno',
      channel: 'app', queue: 'suporte', agent: 'bot', openedAt: ago(60 * 24 * 120),
      closedAt: ago(60 * 24 * 120 - 8), durationMin: 8, waitMin: 0, frtMin: 0, rating: 10,
      tags: ['Acesso'], resolvedByBot: true,
      summary: 'Bot orientou o primeiro acesso e a criação de senha. Resolvido sem atendente.',
      messages: [
        msg('aluno', 'e02', 'não consigo entrar no portal, é meu primeiro acesso', 60 * 24 * 120),
        msg('bot', 'bot', 'Olá, Bruno! No primeiro acesso o usuário é o seu RA e a senha inicial são os seis primeiros dígitos do CPF. O sistema pede a troca de senha em seguida.', 60 * 24 * 120),
        msg('aluno', 'e02', 'funcionou, obrigado', 60 * 24 * 120 - 8),
      ],
    },
    {
      id: 'h04', studentId: 'e04', subject: 'Plano de recuperação das DPs',
      channel: 'app', queue: 'coordenacao', agent: 'a-rafael', openedAt: ago(60 * 24 * 14),
      closedAt: ago(60 * 24 * 14 - 260), durationMin: 260, waitMin: 22, frtMin: 22, rating: 8,
      tags: ['DP/ADAP'],
      summary: 'Coordenação apresentou o plano de recuperação das duas DPs e o aluno aceitou cursar uma por semestre.',
      messages: [
        msg('aluno', 'e04', 'to com 2 DPs, consigo fazer as duas no mesmo semestre?', 60 * 24 * 14),
        msg('agente', 'a-rafael', 'Consegue, desde que os horários não conflitem com as disciplinas do período regular. No seu caso, Cálculo II e Estrutura de Dados batem na terça. O plano recomendado é uma por semestre.', 60 * 24 * 14 - 22),
        msg('aluno', 'e04', 'beleza, vou de uma por vez então', 60 * 24 * 14 - 255),
      ],
    },
    {
      id: 'h05', studentId: 'e09', subject: 'Boleto de agosto em aberto',
      channel: 'whatsapp', queue: 'financeiro', agent: 'a-ana', openedAt: ago(60 * 24 * 21),
      closedAt: ago(60 * 24 * 21 - 90), durationMin: 90, waitMin: 35, frtMin: 35, rating: 6,
      tags: ['Boleto', 'Negociação'],
      summary: 'Aluna informou dificuldade para pagar agosto. Ofertado parcelamento em 3x; não houve aceite no atendimento.',
      messages: [
        msg('aluno', 'e09', 'consigo um prazo maior pro boleto de agosto?', 60 * 24 * 21),
        msg('agente', 'a-ana', 'Consigo abrir um parcelamento em até 3x com entrada. Quer que eu simule?', 60 * 24 * 21 - 35),
        msg('aluno', 'e09', 'deixa eu ver aqui e te falo', 60 * 24 * 21 - 88),
      ],
    },
    {
      id: 'h06', studentId: 'e11', subject: 'Convite da cerimônia de colação',
      channel: 'portal', queue: 'secretaria', agent: 'a-carla', openedAt: ago(60 * 24 * 9),
      closedAt: ago(60 * 24 * 9 - 30), durationMin: 30, waitMin: 5, frtMin: 5, rating: 10,
      tags: ['Colação'],
      summary: 'Informado o número de convites por formando e o prazo de retirada.',
      messages: [
        msg('aluno', 'e11', 'quantos convites cada formando tem direito?', 60 * 24 * 9),
        msg('agente', 'a-carla', 'São 4 convites por formando, retirados na Secretaria a partir do dia 10. Convites extras dependem da lotação do auditório.', 60 * 24 * 9 - 5),
        msg('aluno', 'e11', 'perfeito, obrigada!', 60 * 24 * 9 - 28),
      ],
    },
    {
      id: 'h07', studentId: 'e14', subject: 'Tentativa de contato — cobrança',
      channel: 'whatsapp', queue: 'financeiro', agent: 'a-ana', openedAt: ago(60 * 24 * 6),
      closedAt: ago(60 * 24 * 6 - 1440), durationMin: 1440, waitMin: 0, frtMin: 0, rating: null,
      tags: ['Negociação'], noReply: true,
      summary: 'Terceira tentativa de contato sobre o débito. Aluno não respondeu; conversa encerrada por inatividade.',
      messages: [
        msg('agente', 'a-ana', 'Olá, Sérgio! Aqui é a Ana, do Financeiro da UniAnchieta. Consegue falar sobre as mensalidades em aberto? Temos condições de parcelamento.', 60 * 24 * 6),
        msg('agente', 'a-ana', 'Sérgio, passando para saber se você viu minha mensagem. Estou à disposição.', 60 * 24 * 6 - 700),
      ],
    },
    {
      id: 'h08', studentId: 'e03', subject: 'Como funciona a prova do EAD',
      channel: 'app', queue: 'pos-ead', agent: 'a-juliane', openedAt: ago(60 * 24 * 40),
      closedAt: ago(60 * 24 * 40 - 55), durationMin: 55, waitMin: 8, frtMin: 8, rating: 10,
      tags: ['EAD'],
      summary: 'Explicado o formato das avaliações do EAD: atividades online e prova presencial no polo.',
      messages: [
        msg('aluno', 'e03', 'as provas do EAD são online mesmo?', 60 * 24 * 40),
        msg('agente', 'a-juliane', 'As atividades avaliativas são online, mas a prova final de cada disciplina é presencial no polo, com agendamento pelo AVA.', 60 * 24 * 40 - 8),
        msg('aluno', 'e03', 'ahh entendi, obrigada!', 60 * 24 * 40 - 53),
      ],
    },
    {
      id: 'h09', studentId: 'e05', subject: 'Uniforme e materiais do estágio',
      channel: 'app', queue: 'estagios', agent: 'a-renata', openedAt: ago(60 * 24 * 17),
      closedAt: ago(60 * 24 * 17 - 70), durationMin: 70, waitMin: 14, frtMin: 14, rating: 9,
      tags: ['Estágio'],
      summary: 'Lista de materiais obrigatórios do campo de estágio enviada à aluna.',
      messages: [
        msg('aluno', 'e05', 'o que preciso levar no primeiro dia de estágio?', 60 * 24 * 17),
        msg('agente', 'a-renata', 'Jaleco branco com o brasão, crachá do RA, estetoscópio e o caderno de campo. O hospital exige também o cartão de vacina atualizado.', 60 * 24 * 17 - 14),
        msg('aluno', 'e05', 'anotado, valeu!', 60 * 24 * 17 - 68),
      ],
    },
    {
      id: 'h10', studentId: 'e15', subject: 'Como funciona o modelo híbrido',
      channel: 'app', queue: 'coordenacao', agent: 'bot', openedAt: ago(60 * 24 * 55),
      closedAt: ago(60 * 24 * 55 - 6), durationMin: 6, waitMin: 0, frtMin: 0, rating: 8,
      tags: ['Híbrido'], resolvedByBot: true,
      summary: 'Bot explicou a divisão entre encontros presenciais quinzenais e atividades online.',
      messages: [
        msg('aluno', 'e15', 'quantos dias por semana eu vou na faculdade no hibrido?', 60 * 24 * 55),
        msg('bot', 'bot', 'No modelo híbrido são encontros presenciais quinzenais aos sábados, e o restante das atividades acontece no ambiente virtual, com prazos semanais.', 60 * 24 * 55),
        msg('aluno', 'e15', 'show, obrigada', 60 * 24 * 55 - 6),
      ],
    },
    {
      id: 'h11', studentId: 'e27', subject: 'Taxa de rematrícula paga duas vezes',
      channel: 'whatsapp', queue: 'financeiro', agent: 'a-ana', openedAt: ago(60 * 24 * 16),
      closedAt: ago(60 * 24 * 16 - 38), durationMin: 38, waitMin: 6, frtMin: 6, rating: 7,
      tags: ['Estorno'],
      summary: 'Aluna pagou a taxa de rematrícula por boleto e por cartão. Protocolo FIN-7712 aberto; prometido estorno em até 5 dias úteis.',
      messages: [
        msg('aluno', 'e27', 'oi, paguei a taxa de rematrícula duas vezes sem querer, no boleto e no cartão. como faço pra receber de volta?', 60 * 24 * 16),
        msg('agente', 'a-ana', 'Oi, Mariana! Localizei os dois pagamentos. Abri o protocolo FIN-7712 para o estorno do pagamento no cartão — o prazo é de até 5 dias úteis.', 60 * 24 * 16 - 6),
        msg('aluno', 'e27', 'ok, obrigada', 60 * 24 * 16 - 36),
      ],
    },
    {
      id: 'h12', studentId: 'e27', subject: 'Estorno ainda não caiu',
      channel: 'whatsapp', queue: 'financeiro', agent: 'a-ana', openedAt: ago(60 * 24 * 7),
      closedAt: ago(60 * 24 * 7 - 25), durationMin: 25, waitMin: 41, frtMin: 41, rating: 3,
      tags: ['Estorno', 'Reclamação'],
      summary: 'Estorno "em processamento", sem data. Aluna insatisfeita, nota 3. Três dias depois ela registrou a ouvidoria.',
      messages: [
        msg('aluno', 'e27', 'já passou o prazo e o estorno não caiu', 60 * 24 * 7),
        msg('agente', 'a-ana', 'Mariana, o estorno está em processamento com o banco. Assim que for liberado você recebe automaticamente.', 60 * 24 * 7 - 41),
        msg('aluno', 'e27', 'mas quando? ninguém me dá uma data', 60 * 24 * 7 - 30),
      ],
    },
    {
      id: 'h13', studentId: 'e29', subject: 'Pedido de intérprete de Libras',
      channel: 'portal', queue: 'secretaria', agent: 'a-carla', openedAt: ago(60 * 24 * 37),
      closedAt: ago(60 * 24 * 37 - 90), durationMin: 90, waitMin: 18, frtMin: 18, rating: 8,
      tags: ['Acessibilidade'],
      summary: 'Solicitação de intérprete de Libras para as aulas práticas, encaminhada ao Núcleo de Acessibilidade.',
      messages: [
        msg('aluno', 'e29', 'Olá. Sou surda e preciso de intérprete de Libras nas aulas práticas de Tipografia e Ateliê. Como solicito?', 60 * 24 * 37),
        msg('agente', 'a-carla', 'Oi, Beatriz! Registrei o seu pedido e encaminhei ao Núcleo de Acessibilidade, que organiza os intérpretes. Eles entram em contato por aqui.', 60 * 24 * 37 - 18),
      ],
    },
    {
      id: 'h14', studentId: 'e29', subject: 'Reiteração: ainda sem intérprete',
      channel: 'whatsapp', queue: 'secretaria', agent: 'a-carla', openedAt: ago(60 * 24 * 21),
      closedAt: ago(60 * 24 * 21 - 60), durationMin: 60, waitMin: 22, frtMin: 22, rating: 5,
      tags: ['Acessibilidade', 'Reclamação'],
      summary: 'Sem intérprete após 16 dias. Núcleo informa contratação "em análise". Aluna relata prejuízo nas aulas práticas.',
      messages: [
        msg('aluno', 'e29', 'Já faz duas semanas e continuo sem intérprete. Estou perdendo as aulas práticas.', 60 * 24 * 21),
        msg('agente', 'a-carla', 'Entendo, Beatriz, e sinto muito. Cobrei o Núcleo agora: a contratação está em análise. Vou deixar registrado no seu cadastro que a comunicação é sempre por texto.', 60 * 24 * 21 - 22),
      ],
    },
    {
      id: 'h15', studentId: 'e28', subject: 'Nota do TCC divergente',
      channel: 'app', queue: 'coordenacao', agent: 'a-marcos', openedAt: ago(60 * 24 * 2),
      closedAt: ago(60 * 24 * 2 - 30), durationMin: 30, waitMin: 9, frtMin: 9, rating: 4,
      tags: ['TCC', 'Notas'],
      summary: 'Aluno relatou nota 5,8 no portal contra 8,5 da ata da banca. Orientado a aguardar retorno da coordenação.',
      messages: [
        msg('aluno', 'e28', 'minha nota do TCC está errada no portal, a banca deu 8,5', 60 * 24 * 2),
        msg('agente', 'a-marcos', 'Carlos, a correção de nota é feita pela coordenação do curso. Já reforcei o seu caso por lá — o retorno costuma levar alguns dias.', 60 * 24 * 2 - 9),
      ],
    },
  ];

  /* ======================================================================
     Copilot — o que o atendente precisa saber em 10 segundos
     ----------------------------------------------------------------------
     Para cada conversa: o que o aluno precisa (uma frase), como ele está,
     o que falta fazer e o ponto de atenção. Em produção isto sai do modelo
     lendo conversa + cadastro + histórico; aqui é escrito à mão, com o mesmo
     formato.
     ====================================================================== */

  var COPILOT = {
    c01: { need: 'Um boleto de setembro que funcione, com o vencimento reprogramado e sem surpresa de multa.', sentiment: 'ansioso', todo: ['Emitir 2ª via atualizada', 'Explicar a multa aplicada', 'Oferecer parcelamento do valor em aberto'], watch: 'R$ 1.284,90 em aberto — inadimplência recente.' },
    c02: { need: 'A ementa da UniAnchieta de Psicologia Social e Comunitária para comparar e pedir aproveitamento.', sentiment: 'calmo', todo: ['Enviar a ementa oficial', 'Explicar o prazo de análise (15 dias úteis)'], watch: 'SLA estourado e sem primeira resposta humana.' },
    c03: { need: 'Voltar a acessar o AVA e não perder a atividade que vence amanhã.', sentiment: 'ansioso', todo: ['Cobrar o chamado #SIS-4471', 'Registrar a falha para prorrogar a entrega', 'Avisar a aluna quando liberar'], watch: 'Entrega de atividade amanhã.' },
    c04: { need: 'Destravar a rematrícula — e entender se as DPs atrapalham.', sentiment: 'calmo', todo: ['Receber o RG atualizado', 'Explicar o aceite do plano de recuperação das DPs', 'Liberar o passo 3'], watch: '2 DPs em aberto.' },
    c05: { need: 'A declaração de matrícula com carga horária para o hospital do estágio.', sentiment: 'satisfeito', todo: ['Acompanhar o protocolo #DEC-8823', 'Enviar o PDF assinado'], watch: null },
    c06: { need: 'Saber quando abre a matrícula em DP de Cálculo II e se há turma no noturno.', sentiment: 'calmo', todo: ['Confirmar a oferta no noturno com a coordenação'], watch: null },
    c09: { need: 'Diz que quer trancar, mas o problema real é conseguir pagar o semestre.', sentiment: 'frustrado', todo: ['Oferecer renegociação antes do trancamento', 'Apresentar bolsa ou desconto disponível', 'Só então explicar o trancamento'], watch: 'Risco de evasão · R$ 2.340,00 em aberto.' },
    c11: { need: 'Resolver as duas pendências documentais a tempo da colação.', sentiment: 'calmo', todo: ['Confirmar se precisa agendar a entrega', 'Lembrar o prazo do dia 30'], watch: 'Cerimônia em 18 dias.' },
    c12: { need: 'Que a optativa escolhida apareça no AVA.', sentiment: 'calmo', todo: ['Pedir sincronização manual ao time de Pós & EAD'], watch: null },
    c13: { need: 'Saber como enviar a foto para a carteirinha sair.', sentiment: 'calmo', todo: ['Explicar o envio da foto 3x4 pelo app'], watch: null },
    c14: { need: 'Um acordo que caiba no orçamento antes da suspensão da matrícula.', sentiment: 'frustrado', todo: ['Simular parcelamento sem entrada alta', 'Registrar a perda de emprego para a análise', 'Confirmar a data da suspensão'], watch: 'Suspensão automática em 12 dias.' },
    c17: { need: 'Mudar para o noturno por causa do emprego e saber se a mensalidade muda.', sentiment: 'calmo', todo: ['Verificar vaga no noturno', 'Informar diferença de valor, se houver'], watch: null },
    c21: { need: 'Uma data concreta para o estorno de R$ 389,00 — ela não aceita mais "em processamento".', sentiment: 'frustrado', todo: ['Pedir desculpas pela demora, sem rodeios', 'Informar: lote bancário em 03/10, crédito em até 2 dias úteis', 'Combinar a confirmação do recebimento', 'Avisar a Ouvidoria para concluir'], watch: 'Terceiro contato sobre o mesmo assunto. Última avaliação: nota 3.' },
    c22: { need: 'Saber quando e como vai repor as aulas práticas perdidas, para se organizar com o trabalho.', sentiment: 'ansioso', todo: ['Passar a proposta: 3 sábados a partir de 11/10, com intérprete', 'Confirmar que a proposta será formalizada até amanhã', 'Responder por texto, com datas objetivas'], watch: 'Prazo final da ouvidoria em 3 dias úteis. Acessibilidade: comunicação só por texto.' },
    c23: { need: 'Corrigir a nota do TCC (8,5, não 5,8) a tempo de colar grau em dezembro.', sentiment: 'urgente', todo: ['Assumir e responder já', 'Pedir a ata da banca por aqui, se ele tiver', 'Acionar a coordenação com a Ouvidoria em cópia', 'Dar um prazo de retorno'], watch: 'Formando · colação em risco · sem resposta há 6 dias.' },
    c24: { need: 'Saber que o elogio chegou à tutora.', sentiment: 'satisfeito', todo: ['Agradecer e confirmar o encaminhamento', 'Encerrar a conversa'], watch: null },
  };

  /* ======================================================================
     Desempenho — a visão do atendente
     ----------------------------------------------------------------------
     O atendente vê os PRÓPRIOS números ao lado do agregado da equipe. A
     equipe aparece como total e como média por atendente, nunca com nomes:
     a ideia é ele se situar, não se comparar com o colega da mesa ao lado.
     Tempos em minutos.
     ====================================================================== */

  var TEAM_SIZE = 8;

  function seq(n, base, amp, seed) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var w = Math.sin((i + seed) * 1.7) * 0.5 + Math.cos((i + seed) * 0.6) * 0.5;
      out.push(Math.max(1, Math.round(base + amp * w)));
    }
    return out;
  }
  function series(keys, abertos, finalizados, eu) {
    return keys.map(function (k, i) {
      return { k: k, abertos: abertos[i], finalizados: finalizados[i], eu: eu[i] };
    });
  }

  var HOURS = ['08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19'];

  var DASHBOARD = {
    teamSize: TEAM_SIZE,
    periods: {
      hoje: {
        label: 'Hoje', unit: 'hora',
        me: { abertos: 14, finalizados: 11, transferidos: 2, tma: 18.4, tmr: 3.4, csat: 9.3 },
        mePrev: { abertos: 12, finalizados: 10, transferidos: 3, tma: 20.1, tmr: 3.9, csat: 9.1 },
        team: { abertos: 126, finalizados: 104, transferidos: 15, tma: 22.6, tmr: 4.7, csat: 8.9, sla: 91 },
        teamPrev: { abertos: 118, finalizados: 101, transferidos: 17, tma: 23.9, tmr: 5.2, csat: 8.8, sla: 89 },
        series: series(HOURS, [9, 14, 17, 15, 7, 10, 16, 18, 12, 4, 2, 2], [5, 10, 14, 15, 9, 8, 13, 15, 11, 3, 1, 0], [1, 2, 1, 2, 0, 1, 2, 2, 0, 0, 0, 0]),
      },
      ontem: {
        label: 'Ontem', unit: 'hora',
        me: { abertos: 16, finalizados: 15, transferidos: 1, tma: 17.6, tmr: 3.1, csat: 9.5 },
        mePrev: { abertos: 15, finalizados: 13, transferidos: 2, tma: 19.0, tmr: 3.6, csat: 9.2 },
        team: { abertos: 138, finalizados: 129, transferidos: 18, tma: 21.8, tmr: 4.4, csat: 9.0, sla: 93 },
        teamPrev: { abertos: 131, finalizados: 120, transferidos: 16, tma: 22.7, tmr: 4.9, csat: 8.9, sla: 90 },
        series: series(HOURS, [8, 13, 18, 17, 9, 11, 17, 16, 13, 9, 5, 2], [6, 11, 15, 16, 10, 9, 15, 16, 12, 10, 6, 3], [1, 2, 2, 2, 1, 1, 2, 2, 1, 1, 0, 0]),
      },
      '7d': {
        label: '7 dias', unit: 'dia',
        me: { abertos: 86, finalizados: 79, transferidos: 9, tma: 19.2, tmr: 3.8, csat: 9.2 },
        mePrev: { abertos: 81, finalizados: 72, transferidos: 11, tma: 20.6, tmr: 4.3, csat: 9.0 },
        team: { abertos: 812, finalizados: 754, transferidos: 97, tma: 23.4, tmr: 5.1, csat: 8.8, sla: 89 },
        teamPrev: { abertos: 790, finalizados: 731, transferidos: 104, tma: 24.2, tmr: 5.5, csat: 8.7, sla: 87 },
        series: null,
      },
      '30d': {
        label: '30 dias', unit: 'dia',
        me: { abertos: 352, finalizados: 331, transferidos: 41, tma: 19.8, tmr: 4.0, csat: 9.1 },
        mePrev: { abertos: 337, finalizados: 309, transferidos: 46, tma: 21.1, tmr: 4.4, csat: 8.9 },
        team: { abertos: 3390, finalizados: 3170, transferidos: 402, tma: 24.1, tmr: 5.4, csat: 8.7, sla: 87 },
        teamPrev: { abertos: 3302, finalizados: 3051, transferidos: 431, tma: 24.8, tmr: 5.8, csat: 8.6, sla: 85 },
        series: null,
      },
    },
    /* Séries diárias geradas — determinísticas, para o gráfico não mudar a
       cada recarga. As chaves viram datas na tela. */
    daily7: { abertos: seq(7, 116, 22, 1), finalizados: seq(7, 108, 20, 2), eu: seq(7, 12, 3, 3) },
    daily30: { abertos: seq(30, 113, 26, 4), finalizados: seq(30, 106, 24, 5), eu: seq(30, 11, 4, 6) },
    bySubject: [
      { label: 'Financeiro e boletos', value: 61 },
      { label: 'Documentos e declarações', value: 48 },
      { label: 'Rematrícula', value: 39 },
      { label: 'Estágios', value: 31 },
      { label: 'Ouvidoria', value: 26 },
      { label: 'Notas e frequência', value: 24 },
      { label: 'Acesso e senha', value: 22 },
      { label: 'Equivalência e transferência', value: 17 },
    ],
    byQueue: [
      { label: 'Secretaria', value: 89 },
      { label: 'Financeiro', value: 74 },
      { label: 'Coordenação', value: 43 },
      { label: 'Ouvidoria', value: 31 },
      { label: 'Estágios', value: 27 },
      { label: 'Suporte digital', value: 14 },
      { label: 'Pós & EAD', value: 8 },
    ],
    transferTargets: [
      { label: 'Financeiro', value: 34 },
      { label: 'Secretaria', value: 27 },
      { label: 'Coordenação', value: 19 },
      { label: 'Ouvidoria', value: 11 },
      { label: 'Suporte digital', value: 6 },
    ],
  };

  window.DATA = {
    NOW: NOW,
    ME: ME,
    BOT: BOT,
    AGENTS: AGENTS,
    QUEUES: QUEUES,
    OUV_STAGES: OUV_STAGES,
    CHANNELS: CHANNELS,
    TAGS: TAGS,
    MACROS: MACROS,
    STUDENTS: STUDENTS,
    CONVERSATIONS: CONVERSATIONS,
    HISTORY: HISTORY,
    COPILOT: COPILOT,
    DASHBOARD: DASHBOARD,
  };
})();
