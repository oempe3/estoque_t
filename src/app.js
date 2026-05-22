'use strict';

const API_URL = (window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL) || '';
const APP_NAME = (window.APP_CONFIG && window.APP_CONFIG.APP_NAME) || 'Controle de Consumíveis';
const UNIDADE = (window.APP_CONFIG && window.APP_CONFIG.UNIDADE) || 'UTE Pernambuco III';

const state = {
  usuario: null,
  nome: null,
  permissao: null,
  saidaItem: null,
  estoqueItem: null,
  relatorio: { headers: [], rows: [], titulo: '' },
  estoqueLista: []
};

const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  startClock();
  restoreSession();
});

function bindEvents() {
  $('loginForm').addEventListener('submit', onLogin);
  $('logoutBtn').addEventListener('click', logout);

  $$('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  $('saidaBuscar').addEventListener('click', consultarSaida);
  $('saidaCod').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      consultarSaida();
    }
  });
  $('saidaForm').addEventListener('submit', registrarSaida);

  $('entradaBuscar').addEventListener('click', consultarEntrada);
  $('entradaCod').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      consultarEntrada();
    }
  });
  $('entradaFoto').addEventListener('change', previewFotoEntrada);
  $('entradaForm').addEventListener('submit', registrarEntrada);

  $('estoqueBuscar').addEventListener('click', consultarEstoque);
  $('estoqueCod').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      consultarEstoque();
    }
  });
  $('estoqueListar').addEventListener('click', carregarEstoque);
  $('estoqueFiltro').addEventListener('input', renderEstoqueTabela);
  $('ajusteForm').addEventListener('submit', ajustarEstoque);

  $('relatorioForm').addEventListener('submit', gerarRelatorio);
  $('baixarCsv').addEventListener('click', baixarCsv);
  $('baixarPdf').addEventListener('click', baixarPdf);
}

function startClock() {
  const tick = () => {
    $('clock').textContent = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(new Date());
  };
  tick();
  setInterval(tick, 1000);
}

function restoreSession() {
  const raw = localStorage.getItem('peiii_session');
  if (!raw) return;
  try {
    const session = JSON.parse(raw);
    if (session && session.usuario && session.permissao) {
      state.usuario = session.usuario;
      state.nome = session.nome || session.usuario;
      state.permissao = Number(session.permissao);
      showApp();
    }
  } catch (_) {
    localStorage.removeItem('peiii_session');
  }
}

function assertApi() {
  if (!API_URL || API_URL.includes('COLE_AQUI')) {
    throw new Error('Configure a URL do Apps Script no arquivo src/config.js.');
  }
}

function jsonp(action, params = {}, timeoutMs = 18000) {
  assertApi();

  return new Promise((resolve, reject) => {
    const callbackName = `peiii_cb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('callback', callbackName);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const script = document.createElement('script');
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo limite excedido na comunicação com o Apps Script.'));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      if (data && data.ok === false) {
        reject(new Error(data.message || 'Operação não concluída.'));
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Falha ao conectar com o Apps Script.'));
    };

    script.src = url.toString();
    document.body.appendChild(script);
  });
}

async function postAction(action, payload) {
  assertApi();
  const body = JSON.stringify({ action, ...payload });
  await fetch(API_URL, {
    method: 'POST',
    mode: 'no-cors',
    body
  });
  return true;
}

async function aguardarStatus(moveId, tentativas = 8) {
  for (let i = 0; i < tentativas; i += 1) {
    await sleep(950);
    try {
      const res = await jsonp('statusMovimentacao', { moveId }, 9000);
      if (res && res.statusEncontrado) return res;
    } catch (_) {
      // tenta novamente
    }
  }
  return {
    ok: false,
    statusEncontrado: false,
    message: 'Envio realizado, mas não foi possível confirmar o processamento automaticamente. Verifique a planilha.'
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function onLogin(ev) {
  ev.preventDefault();
  const msg = $('loginMsg');
  setMsg(msg, 'Validando acesso...', 'warn');

  try {
    const usuario = $('loginUsuario').value.trim();
    const senha = $('loginSenha').value;

    const res = await jsonp('login', { usuario, senha });
    state.usuario = res.usuario;
    state.nome = res.nome || res.usuario;
    state.permissao = Number(res.permissao);

    localStorage.setItem('peiii_session', JSON.stringify({
      usuario: state.usuario,
      nome: state.nome,
      permissao: state.permissao
    }));

    setMsg(msg, 'Acesso liberado.', 'ok');
    showApp();
  } catch (err) {
    setMsg(msg, err.message, 'error');
  }
}

function showApp() {
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('perfilInfo').textContent = `${state.nome} · Perfil ${state.permissao}`;

  $$('.role-2').forEach((el) => {
    el.classList.toggle('hidden', state.permissao !== 2);
  });

  montarTiposRelatorio();

  if (state.permissao === 1) {
    navigate('saida');
  } else {
    navigate('saida');
  }

  setTimeout(() => $('saidaCod').focus(), 250);
}

function logout() {
  localStorage.removeItem('peiii_session');
  Object.assign(state, {
    usuario: null,
    nome: null,
    permissao: null,
    saidaItem: null,
    estoqueItem: null,
    relatorio: { headers: [], rows: [], titulo: '' },
    estoqueLista: []
  });

  $('appView').classList.add('hidden');
  $('loginView').classList.remove('hidden');
  $('loginSenha').value = '';
  $('loginUsuario').focus();
}

function navigate(page) {
  if (state.permissao !== 2 && !['saida', 'relatorios'].includes(page)) {
    toast('Seu perfil não possui acesso a esta página.');
    return;
  }

  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  $$('.page').forEach((p) => p.classList.remove('active-page'));
  $(`page-${page}`).classList.add('active-page');

  if (page === 'saida') setTimeout(() => $('saidaCod').focus(), 120);
}

async function consultarSaida() {
  const cod = $('saidaCod').value.trim();
  if (!cod) return toast('Passe ou digite o Cod. TOTVS.');

  const card = $('saidaItemCard');
  card.className = 'item-card empty';
  card.textContent = 'Consultando item...';

  try {
    const res = await jsonp('getItem', { codTotvs: cod });
    state.saidaItem = res.item;
    renderItemCard(card, state.saidaItem);
    $('saidaQtd').focus();
  } catch (err) {
    state.saidaItem = null;
    card.className = 'item-card empty';
    card.textContent = err.message;
  }
}

async function registrarSaida(ev) {
  ev.preventDefault();
  const msg = $('saidaMsg');
  setMsg(msg, '', '');

  if (!state.saidaItem) {
    setMsg(msg, 'Consulte o material antes de registrar a saída.', 'error');
    return;
  }

  const quantidade = Number($('saidaQtd').value);
  const osPts = $('saidaOsPts').value.trim();

  if (!quantidade || quantidade <= 0) {
    setMsg(msg, 'Informe uma quantidade válida.', 'error');
    return;
  }

  if (!osPts) {
    setMsg(msg, 'Informe a Ordem de Serviço / PTS.', 'error');
    return;
  }

  if (quantidade > Number(state.saidaItem.quantidade || 0)) {
    setMsg(msg, 'Quantidade de saída maior que o estoque atual.', 'error');
    return;
  }

  const moveId = makeMoveId('SAI');
  setMsg(msg, 'Enviando movimentação...', 'warn');

  try {
    await postAction('registrarSaida', {
      moveId,
      usuario: state.usuario,
      codTotvs: state.saidaItem.codTotvs,
      quantidade,
      osPts
    });

    const status = await aguardarStatus(moveId);
    if (status.ok) {
      setMsg(msg, status.message || 'Saída registrada com sucesso.', 'ok');
      toast('Saída registrada e estoque atualizado.');
      $('saidaQtd').value = '';
      $('saidaOsPts').value = '';
      await consultarSaida();
    } else {
      setMsg(msg, status.message, 'warn');
    }
  } catch (err) {
    setMsg(msg, err.message, 'error');
  }
}

async function consultarEntrada() {
  const cod = $('entradaCod').value.trim();
  if (!cod) return toast('Passe ou digite o Cod. TOTVS.');

  try {
    const res = await jsonp('getItem', { codTotvs: cod });
    const item = res.item;
    $('entradaDescricao').value = item.descricao || '';
    $('entradaArmazem').value = item.armazem || '';
    $('entradaEndereco').value = item.endereco || '';
    $('entradaTag').value = item.tagNumber || '';
    $('entradaValor').value = item.valorUnitario || '';
    $('entradaMinimo').value = item.estoqueMinimo || '';
    toast(`Item localizado. Estoque atual: ${fmtNumber(item.quantidade)}`);
  } catch (err) {
    toast('Item ainda não cadastrado. Preencha os dados para criar o cadastro.');
  }
}

async function registrarEntrada(ev) {
  ev.preventDefault();
  const msg = $('entradaMsg');
  setMsg(msg, 'Preparando dados...', 'warn');

  const fotoInput = $('entradaFoto');
  let foto = null;

  try {
    if (fotoInput.files && fotoInput.files[0]) {
      foto = await imagemParaBase64Compacta(fotoInput.files[0]);
    }

    const moveId = makeMoveId('ENT');
    const payload = {
      moveId,
      usuario: state.usuario,
      codTotvs: $('entradaCod').value.trim(),
      descricao: $('entradaDescricao').value.trim(),
      quantidade: Number($('entradaQtd').value),
      armazem: $('entradaArmazem').value.trim(),
      endereco: $('entradaEndereco').value.trim(),
      tagNumber: $('entradaTag').value.trim(),
      valorUnitario: Number($('entradaValor').value || 0),
      estoqueMinimo: Number($('entradaMinimo').value || 0),
      foto
    };

    if (!payload.codTotvs || !payload.descricao || !payload.quantidade || payload.quantidade <= 0) {
      setMsg(msg, 'Preencha Cod. TOTVS, descrição e quantidade válida.', 'error');
      return;
    }

    setMsg(msg, 'Enviando entrada...', 'warn');
    await postAction('registrarEntrada', payload);

    const status = await aguardarStatus(moveId);
    if (status.ok) {
      setMsg(msg, status.message || 'Entrada registrada com sucesso.', 'ok');
      toast('Entrada registrada e estoque atualizado.');
      $('entradaQtd').value = '';
      $('entradaFoto').value = '';
      $('entradaPreview').innerHTML = 'Foto não selecionada.';
    } else {
      setMsg(msg, status.message, 'warn');
    }
  } catch (err) {
    setMsg(msg, err.message, 'error');
  }
}

async function previewFotoEntrada() {
  const file = $('entradaFoto').files[0];
  if (!file) {
    $('entradaPreview').innerHTML = 'Foto não selecionada.';
    return;
  }
  const dataUrl = await fileToDataUrl(file);
  $('entradaPreview').innerHTML = `<img src="${escapeAttr(dataUrl)}" alt="Prévia da foto do material">`;
}

async function consultarEstoque() {
  const cod = $('estoqueCod').value.trim();
  if (!cod) return toast('Passe ou digite o Cod. TOTVS.');

  const card = $('estoqueItemCard');
  card.className = 'item-card empty';
  card.textContent = 'Consultando item...';

  try {
    const res = await jsonp('getItem', { codTotvs: cod });
    state.estoqueItem = res.item;
    renderItemCard(card, state.estoqueItem);
    $('ajusteForm').classList.remove('hidden');
    $('ajusteQtd').value = Number(state.estoqueItem.quantidade || 0);
    $('ajusteQtd').focus();
  } catch (err) {
    state.estoqueItem = null;
    $('ajusteForm').classList.add('hidden');
    card.className = 'item-card empty';
    card.textContent = err.message;
  }
}

async function carregarEstoque() {
  $('estoqueTabela').innerHTML = '<div class="empty-table">Carregando estoque...</div>';
  try {
    const res = await jsonp('listStock', {});
    state.estoqueLista = res.items || [];
    renderEstoqueTabela();
  } catch (err) {
    $('estoqueTabela').innerHTML = `<div class="empty-table">${escapeHtml(err.message)}</div>`;
  }
}

function renderEstoqueTabela() {
  const filtro = ($('estoqueFiltro').value || '').toLowerCase().trim();
  const items = state.estoqueLista.filter((item) => {
    if (!filtro) return true;
    return Object.values(item).join(' ').toLowerCase().includes(filtro);
  });

  if (!items.length) {
    $('estoqueTabela').innerHTML = '<div class="empty-table">Nenhum item para exibir.</div>';
    return;
  }

  const headers = ['Cod. TOTVS', 'Descrição', 'Quantidade', 'Mínimo', 'Armazém', 'Endereço', 'Tag', 'Valor unit.', 'Status'];
  const rows = items.map((i) => [
    i.codTotvs,
    i.descricao,
    fmtNumber(i.quantidade),
    fmtNumber(i.estoqueMinimo),
    i.armazem,
    i.endereco,
    i.tagNumber,
    fmtMoney(i.valorUnitario),
    statusEstoqueBadge(i)
  ]);

  $('estoqueTabela').innerHTML = tableHtml(headers, rows);
}

async function ajustarEstoque(ev) {
  ev.preventDefault();
  const msg = $('ajusteMsg');

  if (!state.estoqueItem) {
    setMsg(msg, 'Consulte um item antes do ajuste.', 'error');
    return;
  }

  const quantidadeNova = Number($('ajusteQtd').value);
  const motivo = $('ajusteMotivo').value.trim();

  if (quantidadeNova < 0 || Number.isNaN(quantidadeNova)) {
    setMsg(msg, 'Informe uma quantidade válida.', 'error');
    return;
  }

  if (!motivo) {
    setMsg(msg, 'Informe o motivo do ajuste.', 'error');
    return;
  }

  const moveId = makeMoveId('AJU');
  setMsg(msg, 'Enviando ajuste...', 'warn');

  try {
    await postAction('ajustarEstoque', {
      moveId,
      usuario: state.usuario,
      codTotvs: state.estoqueItem.codTotvs,
      quantidadeNova,
      motivo
    });

    const status = await aguardarStatus(moveId);
    if (status.ok) {
      setMsg(msg, status.message || 'Ajuste registrado com sucesso.', 'ok');
      toast('Ajuste registrado e e-mail enviado.');
      await consultarEstoque();
      await carregarEstoque();
    } else {
      setMsg(msg, status.message, 'warn');
    }
  } catch (err) {
    setMsg(msg, err.message, 'error');
  }
}

function montarTiposRelatorio() {
  const select = $('relatorioTipo');
  const relatoriosPerfil1 = [
    ['saida_mes', 'Saídas do mês']
  ];

  const relatoriosPerfil2 = [
    ['saida_mes', 'Saídas do mês'],
    ['saidas_data', 'Saídas por data'],
    ['entradas_data', 'Entradas por data'],
    ['estoque', 'Estoque atual'],
    ['estoque_minimo', 'Estoque mínimo/crítico'],
    ['custo_saidas', 'Custo de saídas por data'],
    ['custo_entradas', 'Custo de entradas por data'],
    ['ajustes', 'Ajustes de estoque'],
    ['movimentacoes_material', 'Movimentações por material']
  ];

  const lista = state.permissao === 2 ? relatoriosPerfil2 : relatoriosPerfil1;
  select.innerHTML = lista.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
}

async function gerarRelatorio(ev) {
  ev.preventDefault();
  const msg = $('relatorioMsg');
  setMsg(msg, 'Gerando relatório...', 'warn');

  const tipo = $('relatorioTipo').value;
  const dataInicial = $('relatorioInicio').value;
  const dataFinal = $('relatorioFim').value;
  const codTotvs = $('relatorioCod').value.trim();

  try {
    const res = await jsonp('relatorio', { tipo, dataInicial, dataFinal, codTotvs, perfil: state.permissao });
    state.relatorio = {
      headers: res.headers || [],
      rows: res.rows || [],
      titulo: res.titulo || 'Relatório'
    };
    $('relatorioTitulo').textContent = state.relatorio.titulo;
    $('relatorioResumo').textContent = `${state.relatorio.rows.length} registro(s) encontrado(s).`;
    $('relatorioTabela').innerHTML = tableHtml(state.relatorio.headers, state.relatorio.rows);
    setMsg(msg, 'Relatório gerado.', 'ok');
  } catch (err) {
    setMsg(msg, err.message, 'error');
    $('relatorioTabela').innerHTML = '';
  }
}

function baixarCsv() {
  const { headers, rows, titulo } = state.relatorio;
  if (!headers.length) return toast('Gere um relatório antes de baixar.');

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(';'))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(titulo)}_${dateStamp()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function baixarPdf() {
  const { headers, rows, titulo } = state.relatorio;
  if (!headers.length) return toast('Gere um relatório antes de baixar.');

  if (!window.jspdf || !window.jspdf.jsPDF) {
    toast('Biblioteca de PDF não carregada. Verifique a conexão com a internet.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(titulo, 40, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${UNIDADE} · ${APP_NAME}`, 40, 66);
  doc.text(`Gerado em ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date())}`, 40, 82);

  try {
    const logo = await imageUrlToDataUrl('assets/logo-peiii.png');
    doc.addImage(logo, 'PNG', 610, 26, 180, 68);
  } catch (_) {
    // PDF segue sem logo caso o navegador bloqueie a conversão.
  }

  doc.autoTable({
    startY: 104,
    head: [headers],
    body: rows,
    styles: {
      fontSize: 7,
      cellPadding: 4,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [18, 63, 118],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 250, 255]
    },
    margin: { left: 40, right: 40 }
  });

  doc.save(`${slug(titulo)}_${dateStamp()}.pdf`);
}

function renderItemCard(target, item) {
  if (!item) {
    target.className = 'item-card empty';
    target.textContent = 'Item não localizado.';
    return;
  }

  target.className = 'item-card';
  const fotoHtml = item.fotoUrl
    ? `<img class="item-photo" src="${escapeAttr(item.fotoUrl)}" alt="Foto do material">`
    : `<div class="item-photo placeholder">📦</div>`;

  target.innerHTML = `
    ${fotoHtml}
    <div>
      <h3>${escapeHtml(item.descricao || 'Sem descrição')}</h3>
      <div class="item-info-grid">
        <div class="info-pill"><small>Cod. TOTVS</small><strong>${escapeHtml(item.codTotvs)}</strong></div>
        <div class="info-pill"><small>Estoque</small><strong>${fmtNumber(item.quantidade)}</strong></div>
        <div class="info-pill"><small>Armazém</small><strong>${escapeHtml(item.armazem || '-')}</strong></div>
        <div class="info-pill"><small>Endereço</small><strong>${escapeHtml(item.endereco || '-')}</strong></div>
        <div class="info-pill"><small>Tag number</small><strong>${escapeHtml(item.tagNumber || '-')}</strong></div>
        <div class="info-pill"><small>Valor unitário</small><strong>${fmtMoney(item.valorUnitario)}</strong></div>
        <div class="info-pill"><small>Estoque mínimo</small><strong>${fmtNumber(item.estoqueMinimo)}</strong></div>
        <div class="info-pill"><small>Status</small><strong>${statusEstoqueTexto(item)}</strong></div>
      </div>
    </div>
  `;
}

function statusEstoqueTexto(item) {
  const q = Number(item.quantidade || 0);
  const m = Number(item.estoqueMinimo || 0);
  if (m > 0 && q <= 0) return 'Sem estoque';
  if (m > 0 && q <= m) return 'Crítico';
  return 'Normal';
}

function statusEstoqueBadge(item) {
  const txt = statusEstoqueTexto(item);
  const cls = txt === 'Normal' ? 'ok' : txt === 'Crítico' ? 'warn' : 'error';
  return `<span class="badge ${cls}">${txt}</span>`;
}

function tableHtml(headers, rows) {
  if (!headers.length) return '<div class="empty-table">Nenhum dado para exibir.</div>';
  if (!rows || !rows.length) {
    return `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody></tbody></table>`;
  }
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).includes('<span class="badge') ? cell : escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function setMsg(el, text, type) {
  el.textContent = text || '';
  el.className = `msg ${type || ''}`;
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 4200);
}

function makeMoveId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function fmtNumber(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(n);
}

function fmtMoney(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function csvCell(value) {
  const s = String(value ?? '').replace(/<[^>]+>/g, '').replace(/"/g, '""');
  return `"${s}"`;
}

function slug(text) {
  return String(text || 'relatorio')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function dateStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function imagemParaBase64Compacta(file) {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.');

  const dataUrl = await fileToDataUrl(file);
  const img = await loadImage(dataUrl);

  const maxSide = 1100;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const compactUrl = canvas.toDataURL('image/jpeg', 0.76);
  return {
    fileName: file.name.replace(/\.[^.]+$/, '') + '.jpg',
    mimeType: 'image/jpeg',
    base64: compactUrl.split(',')[1]
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível processar a imagem.'));
    img.src = src;
  });
}

async function imageUrlToDataUrl(url) {
  const img = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}