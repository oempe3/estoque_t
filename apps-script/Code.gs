/**
 * Controle de Consumíveis — UTE Pernambuco III
 * Backend Google Apps Script
 *
 * Como usar:
 * 1) Cole este arquivo em Extensões > Apps Script.
 * 2) Preencha SPREADSHEET_ID e DRIVE_FOLDER_ID.
 * 3) Execute setupInicial().
 * 4) Implante como App da Web.
 */

const CONFIG = {
  SPREADSHEET_ID: 'COLE_AQUI_O_ID_DA_PLANILHA',
  DRIVE_FOLDER_ID: 'COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE',
  TIMEZONE: 'America/Recife',
  APP_NAME: 'Controle de Consumíveis',
  UNIDADE: 'UTE Pernambuco III'
};

const SHEETS = {
  ACESSO: 'Acesso',
  EMAIL: 'Email',
  ESTOQUE: 'Estoque',
  ENTRADAS: 'Entradas',
  SAIDAS: 'Saidas',
  AJUSTES: 'Ajustes',
  MOVIMENTACOES: 'Movimentacoes'
};

const HEADERS = {
  Acesso: ['Login', 'Senha', 'Permissao', 'Nome', 'Ativo'],
  Email: ['DestinatariosSaida', 'DestinatariosEntradaAjuste'],
  Estoque: ['CodTotvs', 'Descricao', 'Quantidade', 'Armazem', 'Endereco', 'TagNumber', 'ValorUnitario', 'FotoUrl', 'EstoqueMinimo', 'DataAtualizacao', 'UsuarioAtualizacao'],
  Entradas: ['IDMovimentacao', 'DataHora', 'Usuario', 'CodTotvs', 'Descricao', 'QuantidadeEntrada', 'EstoqueAnterior', 'EstoqueFinal', 'Armazem', 'Endereco', 'TagNumber', 'ValorUnitario', 'CustoTotal', 'FotoUrl', 'Status'],
  Saidas: ['IDMovimentacao', 'DataHora', 'Usuario', 'CodTotvs', 'Descricao', 'QuantidadeSaida', 'EstoqueAnterior', 'EstoqueFinal', 'OS_PTS', 'Armazem', 'Endereco', 'TagNumber', 'ValorUnitario', 'CustoTotal', 'Status'],
  Ajustes: ['IDMovimentacao', 'DataHora', 'Usuario', 'CodTotvs', 'Descricao', 'QuantidadeAnterior', 'QuantidadeNova', 'Diferenca', 'Motivo', 'ValorUnitario', 'ImpactoEstimado', 'Status'],
  Movimentacoes: ['IDMovimentacao', 'DataHora', 'Tipo', 'Usuario', 'CodTotvs', 'Status', 'Mensagem']
};

function setupInicial() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  Object.keys(HEADERS).forEach(function(nomeAba) {
    let sh = ss.getSheetByName(nomeAba);
    if (!sh) sh = ss.insertSheet(nomeAba);

    const headers = HEADERS[nomeAba];
    const current = sh.getRange(1, 1, 1, headers.length).getValues()[0];

    const precisaCabecalho = current.join('').trim() === '' || current[0] !== headers[0];
    if (precisaCabecalho) {
      sh.clear();
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.autoResizeColumns(1, headers.length);
      sh.getRange(1, 1, 1, headers.length)
        .setBackground('#123f76')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
    }
  });

  const acesso = ss.getSheetByName(SHEETS.ACESSO);
  if (acesso.getLastRow() === 1) {
    acesso.appendRow(['operador', '1234', 1, 'Operador', 1]);
    acesso.appendRow(['admin', '1234', 2, 'Administrador', 1]);
  }

  const email = ss.getSheetByName(SHEETS.EMAIL);
  if (email.getLastRow() === 1) {
    email.appendRow(['email.saida@empresa.com.br', 'email.entrada@empresa.com.br']);
  }

  return 'Setup inicial concluído.';
}

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const action = p.action || '';
    let result;

    switch (action) {
      case 'login':
        result = login(p.usuario, p.senha);
        break;
      case 'getItem':
        result = { ok: true, item: getItemByCod(p.codTotvs) };
        break;
      case 'listStock':
        result = { ok: true, items: listStock() };
        break;
      case 'relatorio':
        result = relatorio(p);
        break;
      case 'statusMovimentacao':
        result = statusMovimentacao(p.moveId);
        break;
      case 'ping':
        result = { ok: true, message: 'Apps Script operacional.', now: nowStr() };
        break;
      default:
        result = { ok: false, message: 'Ação GET inválida.' };
    }

    return outputJsonp(result, p.callback);
  } catch (err) {
    return outputJsonp({ ok: false, message: err.message }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  let payload = {};
  try {
    payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = payload.action || '';
    let result;

    switch (action) {
      case 'registrarSaida':
        result = registrarSaida(payload);
        break;
      case 'registrarEntrada':
        result = registrarEntrada(payload);
        break;
      case 'ajustarEstoque':
        result = ajustarEstoque(payload);
        break;
      default:
        result = { ok: false, message: 'Ação POST inválida.' };
    }

    return outputJson(result);
  } catch (err) {
    if (payload && payload.moveId) {
      registrarMovimentacao(payload.moveId, payload.action || 'ERRO', payload.usuario || '', payload.codTotvs || '', 'ERRO', err.message);
    }
    return outputJson({ ok: false, message: err.message });
  }
}

function outputJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function outputJsonp(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    const safeCallback = String(callback).replace(/[^\w$.]/g, '');
    return ContentService
      .createTextOutput(safeCallback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return outputJson(obj);
}

function ss() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function sheet(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('Aba não encontrada: ' + name);
  return sh;
}

function nowStr() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
}

function login(usuario, senha) {
  usuario = String(usuario || '').trim();
  senha = String(senha || '');

  if (!usuario || !senha) throw new Error('Informe login e senha.');

  const sh = sheet(SHEETS.ACESSO);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const loginPlanilha = String(row[0] || '').trim();
    const senhaPlanilha = String(row[1] || '');
    const permissao = Number(row[2] || 0);
    const nome = String(row[3] || loginPlanilha);
    const ativo = Number(row[4] || 0);

    if (loginPlanilha === usuario && senhaPlanilha === senha) {
      if (ativo !== 1) throw new Error('Usuário bloqueado. Verifique a aba Acesso.');
      if (![1, 2].includes(permissao)) throw new Error('Permissão inválida na aba Acesso.');
      return { ok: true, usuario: loginPlanilha, nome: nome, permissao: permissao };
    }
  }

  throw new Error('Login ou senha inválidos.');
}

function getItemByCod(codTotvs) {
  codTotvs = String(codTotvs || '').trim();
  if (!codTotvs) throw new Error('Cod. TOTVS não informado.');

  const result = findEstoqueRow(codTotvs);
  if (!result) throw new Error('Item não localizado no estoque: ' + codTotvs);

  return estoqueRowToObject(result.values, result.row);
}

function listStock() {
  const sh = sheet(SHEETS.ESTOQUE);
  const values = sh.getDataRange().getValues();
  const items = [];

  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    items.push(estoqueRowToObject(values[i], i + 1));
  }

  return items;
}

function findEstoqueRow(codTotvs) {
  codTotvs = String(codTotvs || '').trim();
  const sh = sheet(SHEETS.ESTOQUE);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === codTotvs) {
      return { sheet: sh, row: i + 1, values: values[i] };
    }
  }

  return null;
}

function estoqueRowToObject(row, rowNumber) {
  return {
    rowNumber: rowNumber,
    codTotvs: String(row[0] || ''),
    descricao: String(row[1] || ''),
    quantidade: Number(row[2] || 0),
    armazem: String(row[3] || ''),
    endereco: String(row[4] || ''),
    tagNumber: String(row[5] || ''),
    valorUnitario: Number(row[6] || 0),
    fotoUrl: String(row[7] || ''),
    estoqueMinimo: Number(row[8] || 0),
    dataAtualizacao: String(row[9] || ''),
    usuarioAtualizacao: String(row[10] || '')
  };
}

function registrarSaida(payload) {
  validarCampos(payload, ['moveId', 'usuario', 'codTotvs', 'quantidade', 'osPts']);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const quantidade = Number(payload.quantidade);
    if (!quantidade || quantidade <= 0) throw new Error('Quantidade inválida.');

    const found = findEstoqueRow(payload.codTotvs);
    if (!found) throw new Error('Item não encontrado no estoque.');

    const item = estoqueRowToObject(found.values, found.row);
    const estoqueAnterior = Number(item.quantidade || 0);

    if (quantidade > estoqueAnterior) {
      throw new Error('Estoque insuficiente. Atual: ' + estoqueAnterior + ', saída: ' + quantidade);
    }

    const estoqueFinal = estoqueAnterior - quantidade;
    found.sheet.getRange(found.row, 3).setValue(estoqueFinal);
    found.sheet.getRange(found.row, 10).setValue(nowStr());
    found.sheet.getRange(found.row, 11).setValue(payload.usuario);

    const custoTotal = quantidade * Number(item.valorUnitario || 0);
    const row = [
      payload.moveId,
      nowStr(),
      payload.usuario,
      item.codTotvs,
      item.descricao,
      quantidade,
      estoqueAnterior,
      estoqueFinal,
      payload.osPts,
      item.armazem,
      item.endereco,
      item.tagNumber,
      item.valorUnitario,
      custoTotal,
      'REGISTRADO'
    ];

    sheet(SHEETS.SAIDAS).appendRow(row);
    registrarMovimentacao(payload.moveId, 'SAIDA', payload.usuario, item.codTotvs, 'OK', 'Saída registrada com sucesso.');

    enviarEmailSaida(item, quantidade, estoqueAnterior, estoqueFinal, payload.osPts, payload.usuario, custoTotal);

    return { ok: true, message: 'Saída registrada com sucesso.' };
  } catch (err) {
    registrarMovimentacao(payload.moveId, 'SAIDA', payload.usuario || '', payload.codTotvs || '', 'ERRO', err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function registrarEntrada(payload) {
  validarCampos(payload, ['moveId', 'usuario', 'codTotvs', 'descricao', 'quantidade']);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const quantidade = Number(payload.quantidade);
    if (!quantidade || quantidade <= 0) throw new Error('Quantidade inválida.');

    let fotoUrl = '';
    if (payload.foto && payload.foto.base64) {
      fotoUrl = salvarFotoDrive(payload.foto, payload.codTotvs);
    }

    const found = findEstoqueRow(payload.codTotvs);
    let estoqueAnterior = 0;
    let estoqueFinal = quantidade;
    const valorUnitario = Number(payload.valorUnitario || 0);

    if (found) {
      const itemAtual = estoqueRowToObject(found.values, found.row);
      estoqueAnterior = Number(itemAtual.quantidade || 0);
      estoqueFinal = estoqueAnterior + quantidade;

      const fotoFinal = fotoUrl || itemAtual.fotoUrl || '';
      found.sheet.getRange(found.row, 2, 1, 10).setValues([[
        payload.descricao,
        estoqueFinal,
        payload.armazem || itemAtual.armazem,
        payload.endereco || itemAtual.endereco,
        payload.tagNumber || itemAtual.tagNumber,
        valorUnitario || itemAtual.valorUnitario,
        fotoFinal,
        Number(payload.estoqueMinimo || itemAtual.estoqueMinimo || 0),
        nowStr(),
        payload.usuario
      ]]);

      fotoUrl = fotoFinal;
    } else {
      sheet(SHEETS.ESTOQUE).appendRow([
        payload.codTotvs,
        payload.descricao,
        estoqueFinal,
        payload.armazem || '',
        payload.endereco || '',
        payload.tagNumber || '',
        valorUnitario,
        fotoUrl,
        Number(payload.estoqueMinimo || 0),
        nowStr(),
        payload.usuario
      ]);
    }

    const custoTotal = quantidade * valorUnitario;
    sheet(SHEETS.ENTRADAS).appendRow([
      payload.moveId,
      nowStr(),
      payload.usuario,
      payload.codTotvs,
      payload.descricao,
      quantidade,
      estoqueAnterior,
      estoqueFinal,
      payload.armazem || '',
      payload.endereco || '',
      payload.tagNumber || '',
      valorUnitario,
      custoTotal,
      fotoUrl,
      'REGISTRADO'
    ]);

    registrarMovimentacao(payload.moveId, 'ENTRADA', payload.usuario, payload.codTotvs, 'OK', 'Entrada registrada com sucesso.');
    enviarEmailEntrada(payload, quantidade, estoqueAnterior, estoqueFinal, custoTotal, fotoUrl);

    return { ok: true, message: 'Entrada registrada com sucesso.' };
  } catch (err) {
    registrarMovimentacao(payload.moveId, 'ENTRADA', payload.usuario || '', payload.codTotvs || '', 'ERRO', err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function ajustarEstoque(payload) {
  validarCampos(payload, ['moveId', 'usuario', 'codTotvs', 'quantidadeNova', 'motivo']);

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const quantidadeNova = Number(payload.quantidadeNova);
    if (quantidadeNova < 0 || Number.isNaN(quantidadeNova)) throw new Error('Quantidade ajustada inválida.');

    const found = findEstoqueRow(payload.codTotvs);
    if (!found) throw new Error('Item não encontrado no estoque.');

    const item = estoqueRowToObject(found.values, found.row);
    const quantidadeAnterior = Number(item.quantidade || 0);
    const diferenca = quantidadeNova - quantidadeAnterior;
    const impacto = diferenca * Number(item.valorUnitario || 0);

    found.sheet.getRange(found.row, 3).setValue(quantidadeNova);
    found.sheet.getRange(found.row, 10).setValue(nowStr());
    found.sheet.getRange(found.row, 11).setValue(payload.usuario);

    sheet(SHEETS.AJUSTES).appendRow([
      payload.moveId,
      nowStr(),
      payload.usuario,
      item.codTotvs,
      item.descricao,
      quantidadeAnterior,
      quantidadeNova,
      diferenca,
      payload.motivo,
      item.valorUnitario,
      impacto,
      'REGISTRADO'
    ]);

    registrarMovimentacao(payload.moveId, 'AJUSTE', payload.usuario, item.codTotvs, 'OK', 'Ajuste registrado com sucesso.');
    enviarEmailAjuste(item, quantidadeAnterior, quantidadeNova, diferenca, payload.motivo, payload.usuario, impacto);

    return { ok: true, message: 'Ajuste registrado com sucesso.' };
  } catch (err) {
    registrarMovimentacao(payload.moveId, 'AJUSTE', payload.usuario || '', payload.codTotvs || '', 'ERRO', err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function validarCampos(obj, campos) {
  campos.forEach(function(campo) {
    if (obj[campo] === undefined || obj[campo] === null || String(obj[campo]).trim() === '') {
      throw new Error('Campo obrigatório ausente: ' + campo);
    }
  });
}

function salvarFotoDrive(foto, codTotvs) {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const bytes = Utilities.base64Decode(foto.base64);
  const nomeSeguro = String(codTotvs).replace(/[^\w.-]/g, '_') + '_' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd_HHmmss') + '.jpg';
  const blob = Utilities.newBlob(bytes, foto.mimeType || 'image/jpeg', nomeSeguro);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function registrarMovimentacao(moveId, tipo, usuario, codTotvs, status, mensagem) {
  try {
    sheet(SHEETS.MOVIMENTACOES).appendRow([
      moveId,
      nowStr(),
      tipo,
      usuario,
      codTotvs,
      status,
      mensagem
    ]);
  } catch (err) {
    // Evita quebrar a operação principal caso a aba de log tenha problema.
  }
}

function statusMovimentacao(moveId) {
  moveId = String(moveId || '').trim();
  if (!moveId) throw new Error('ID da movimentação não informado.');

  const sh = sheet(SHEETS.MOVIMENTACOES);
  const values = sh.getDataRange().getValues();

  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0] || '') === moveId) {
      return {
        ok: String(values[i][5] || '') === 'OK',
        statusEncontrado: true,
        moveId: moveId,
        tipo: values[i][2],
        status: values[i][5],
        message: values[i][6] || ''
      };
    }
  }

  return {
    ok: false,
    statusEncontrado: false,
    moveId: moveId,
    message: 'Movimentação ainda não localizada.'
  };
}

function relatorio(p) {
  const tipo = String(p.tipo || '');
  const perfil = Number(p.perfil || 0);

  if (perfil === 1 && tipo !== 'saida_mes') {
    throw new Error('Seu perfil permite apenas relatório de saídas do mês.');
  }

  switch (tipo) {
    case 'saida_mes':
      return relatorioSaidasMes();
    case 'saidas_data':
      return relatorioPorData(SHEETS.SAIDAS, HEADERS.Saidas, p.dataInicial, p.dataFinal, 'Saídas por data');
    case 'entradas_data':
      return relatorioPorData(SHEETS.ENTRADAS, HEADERS.Entradas, p.dataInicial, p.dataFinal, 'Entradas por data');
    case 'estoque':
      return relatorioEstoque(false);
    case 'estoque_minimo':
      return relatorioEstoque(true);
    case 'custo_saidas':
      return relatorioCusto(SHEETS.SAIDAS, HEADERS.Saidas, p.dataInicial, p.dataFinal, 'Custo de saídas por data');
    case 'custo_entradas':
      return relatorioCusto(SHEETS.ENTRADAS, HEADERS.Entradas, p.dataInicial, p.dataFinal, 'Custo de entradas por data');
    case 'ajustes':
      return relatorioPorData(SHEETS.AJUSTES, HEADERS.Ajustes, p.dataInicial, p.dataFinal, 'Ajustes de estoque');
    case 'movimentacoes_material':
      return relatorioMovimentacoesMaterial(p.codTotvs);
    default:
      throw new Error('Tipo de relatório inválido.');
  }
}

function relatorioSaidasMes() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return relatorioPorData(SHEETS.SAIDAS, HEADERS.Saidas, toIsoDate(inicio), toIsoDate(fim), 'Saídas do mês');
}

function relatorioPorData(sheetName, headers, dataInicial, dataFinal, titulo) {
  const sh = sheet(sheetName);
  const values = sh.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    const dt = parseBrDateTime(values[i][1]);
    if (!dateInRange(dt, dataInicial, dataFinal)) continue;
    rows.push(values[i].map(formatCell));
  }

  return { ok: true, titulo: titulo, headers: headers, rows: rows };
}

function relatorioEstoque(apenasCritico) {
  const items = listStock();
  const rows = [];
  items.forEach(function(item) {
    const critico = Number(item.estoqueMinimo || 0) > 0 && Number(item.quantidade || 0) <= Number(item.estoqueMinimo || 0);
    if (apenasCritico && !critico) return;

    rows.push([
      item.codTotvs,
      item.descricao,
      item.quantidade,
      item.estoqueMinimo,
      item.armazem,
      item.endereco,
      item.tagNumber,
      item.valorUnitario,
      Number(item.quantidade || 0) * Number(item.valorUnitario || 0),
      critico ? 'CRÍTICO' : 'NORMAL',
      item.dataAtualizacao
    ]);
  });

  return {
    ok: true,
    titulo: apenasCritico ? 'Estoque mínimo/crítico' : 'Estoque atual',
    headers: ['Cod. TOTVS', 'Descrição', 'Quantidade', 'Estoque mínimo', 'Armazém', 'Endereço', 'Tag', 'Valor unitário', 'Valor em estoque', 'Status', 'Atualização'],
    rows: rows.map(function(row) { return row.map(formatCell); })
  };
}

function relatorioCusto(sheetName, headers, dataInicial, dataFinal, titulo) {
  const base = relatorioPorData(sheetName, headers, dataInicial, dataFinal, titulo);
  let totalQuantidade = 0;
  let totalCusto = 0;

  base.rows.forEach(function(row) {
    if (sheetName === SHEETS.SAIDAS) {
      totalQuantidade += parseLocaleNumber(row[5]);
      totalCusto += parseLocaleMoney(row[13]);
    } else {
      totalQuantidade += parseLocaleNumber(row[5]);
      totalCusto += parseLocaleMoney(row[12]);
    }
  });

  base.rows.push([]);
  base.rows.push(['TOTAL', '', '', '', '', formatNumber(totalQuantidade), '', '', '', '', '', '', '', formatMoney(totalCusto), '']);
  return base;
}

function relatorioMovimentacoesMaterial(codTotvs) {
  codTotvs = String(codTotvs || '').trim();
  if (!codTotvs) throw new Error('Informe o Cod. TOTVS para este relatório.');

  const rows = [];
  const saidas = sheet(SHEETS.SAIDAS).getDataRange().getValues();
  const entradas = sheet(SHEETS.ENTRADAS).getDataRange().getValues();
  const ajustes = sheet(SHEETS.AJUSTES).getDataRange().getValues();

  for (let i = 1; i < entradas.length; i++) {
    if (String(entradas[i][3] || '') === codTotvs) {
      rows.push(['ENTRADA', entradas[i][1], entradas[i][2], entradas[i][3], entradas[i][4], entradas[i][5], entradas[i][7], entradas[i][12], entradas[i][14]]);
    }
  }

  for (let i = 1; i < saidas.length; i++) {
    if (String(saidas[i][3] || '') === codTotvs) {
      rows.push(['SAÍDA', saidas[i][1], saidas[i][2], saidas[i][3], saidas[i][4], saidas[i][5], saidas[i][7], saidas[i][13], saidas[i][14]]);
    }
  }

  for (let i = 1; i < ajustes.length; i++) {
    if (String(ajustes[i][3] || '') === codTotvs) {
      rows.push(['AJUSTE', ajustes[i][1], ajustes[i][2], ajustes[i][3], ajustes[i][4], ajustes[i][7], ajustes[i][6], ajustes[i][10], ajustes[i][11]]);
    }
  }

  rows.sort(function(a, b) {
    return parseBrDateTime(a[1]).getTime() - parseBrDateTime(b[1]).getTime();
  });

  return {
    ok: true,
    titulo: 'Movimentações por material',
    headers: ['Tipo', 'Data/Hora', 'Usuário', 'Cod. TOTVS', 'Descrição', 'Quantidade/Diferença', 'Estoque final/Novo', 'Custo/Impacto', 'Status'],
    rows: rows.map(function(row) { return row.map(formatCell); })
  };
}

function dateInRange(date, dataInicial, dataFinal) {
  if (!date || isNaN(date.getTime())) return true;

  if (dataInicial) {
    const ini = new Date(dataInicial + 'T00:00:00');
    if (date < ini) return false;
  }

  if (dataFinal) {
    const fim = new Date(dataFinal + 'T23:59:59');
    if (date > fim) return false;
  }

  return true;
}

function parseBrDateTime(value) {
  if (value instanceof Date) return value;
  const s = String(value || '');
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date(s);
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6]));
}

function toIsoDate(date) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function formatCell(value) {
  if (value instanceof Date) return Utilities.formatDate(value, CONFIG.TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
  if (typeof value === 'number') return value;
  return String(value || '');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseLocaleNumber(value) {
  if (typeof value === 'number') return value;
  const s = String(value || '0').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Number(s || 0);
}

function parseLocaleMoney(value) {
  return parseLocaleNumber(value);
}

function getEmails(tipo) {
  const sh = sheet(SHEETS.EMAIL);
  const values = sh.getDataRange().getValues();
  const col = tipo === 'saida' ? 0 : 1;
  const emails = [];

  for (let i = 1; i < values.length; i++) {
    const email = String(values[i][col] || '').trim();
    if (email && email.indexOf('@') > -1) emails.push(email);
  }

  return emails;
}

function enviarEmailSaida(item, quantidade, estoqueAnterior, estoqueFinal, osPts, usuario, custoTotal) {
  const emails = getEmails('saida');
  if (!emails.length) return;

  const subject = '[Saída de material] ' + item.codTotvs + ' - ' + item.descricao;
  const html = emailLayout('Saída de Material', [
    ['Data/Hora', nowStr()],
    ['Usuário', usuario],
    ['Cod. TOTVS', item.codTotvs],
    ['Descrição', item.descricao],
    ['Quantidade saída', quantidade],
    ['Estoque anterior', estoqueAnterior],
    ['Estoque final', estoqueFinal],
    ['OS/PTS', osPts],
    ['Armazém', item.armazem],
    ['Endereço', item.endereco],
    ['Tag number', item.tagNumber],
    ['Valor unitário', formatMoney(item.valorUnitario)],
    ['Custo estimado', formatMoney(custoTotal)]
  ]);

  MailApp.sendEmail({
    to: emails.join(','),
    subject: subject,
    htmlBody: html
  });
}

function enviarEmailEntrada(payload, quantidade, estoqueAnterior, estoqueFinal, custoTotal, fotoUrl) {
  const emails = getEmails('entrada');
  if (!emails.length) return;

  const subject = '[Entrada de material] ' + payload.codTotvs + ' - ' + payload.descricao;
  const html = emailLayout('Entrada de Material', [
    ['Data/Hora', nowStr()],
    ['Usuário', payload.usuario],
    ['Cod. TOTVS', payload.codTotvs],
    ['Descrição', payload.descricao],
    ['Quantidade entrada', quantidade],
    ['Estoque anterior', estoqueAnterior],
    ['Estoque final', estoqueFinal],
    ['Armazém', payload.armazem || ''],
    ['Endereço', payload.endereco || ''],
    ['Tag number', payload.tagNumber || ''],
    ['Valor unitário', formatMoney(payload.valorUnitario || 0)],
    ['Custo estimado', formatMoney(custoTotal)],
    ['Foto', fotoUrl || 'Não enviada']
  ]);

  MailApp.sendEmail({
    to: emails.join(','),
    subject: subject,
    htmlBody: html
  });
}

function enviarEmailAjuste(item, quantidadeAnterior, quantidadeNova, diferenca, motivo, usuario, impacto) {
  const emails = getEmails('entrada');
  if (!emails.length) return;

  const subject = '[Ajuste de estoque] ' + item.codTotvs + ' - ' + item.descricao;
  const html = emailLayout('Ajuste de Estoque', [
    ['Data/Hora', nowStr()],
    ['Usuário', usuario],
    ['Cod. TOTVS', item.codTotvs],
    ['Descrição', item.descricao],
    ['Quantidade anterior', quantidadeAnterior],
    ['Quantidade ajustada', quantidadeNova],
    ['Diferença', diferenca],
    ['Motivo', motivo],
    ['Valor unitário', formatMoney(item.valorUnitario || 0)],
    ['Impacto estimado', formatMoney(impacto)]
  ]);

  MailApp.sendEmail({
    to: emails.join(','),
    subject: subject,
    htmlBody: html
  });
}

function emailLayout(titulo, linhas) {
  const rows = linhas.map(function(l) {
    return '<tr>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #dde6f2;color:#637083;font-weight:700;width:220px;">' + escapeHtml(l[0]) + '</td>' +
      '<td style="padding:10px 12px;border-bottom:1px solid #dde6f2;color:#132033;font-weight:800;">' + escapeHtml(l[1]) + '</td>' +
      '</tr>';
  }).join('');

  return '' +
    '<div style="font-family:Segoe UI,Arial,sans-serif;background:#f4f7fb;padding:24px;">' +
      '<div style="max-width:760px;margin:auto;background:#ffffff;border:1px solid #dde6f2;border-radius:22px;overflow:hidden;box-shadow:0 12px 32px rgba(18,63,118,.12);">' +
        '<div style="background:linear-gradient(135deg,#123f76,#007a3d);padding:22px 26px;color:white;">' +
          '<div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:800;">' + escapeHtml(CONFIG.UNIDADE) + '</div>' +
          '<h2 style="margin:8px 0 0;font-size:24px;">' + escapeHtml(titulo) + '</h2>' +
        '</div>' +
        '<div style="padding:18px 26px;">' +
          '<table style="width:100%;border-collapse:collapse;">' + rows + '</table>' +
          '<p style="margin:18px 0 0;color:#637083;font-size:12px;">Mensagem automática · ' + escapeHtml(CONFIG.APP_NAME) + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}