/**
 * api.js — Controle de Consumíveis · UTE Pernambuco III
 *
 * Substitui todas as chamadas JSONP por fetch() nativo.
 * Lê a URL do Apps Script de window.APP_CONFIG.APPS_SCRIPT_URL
 * (definida em config.js — já presente no projeto).
 *
 * Como usar no HTML:
 *   <script src="src/config.js"></script>
 *   <script src="src/api.js"></script>
 *   <script src="src/app.js"></script>   ← seu código principal
 */

(function (global) {
  'use strict';

  /* ── URL base ─────────────────────────────────────────── */
  function baseUrl() {
    var cfg = global.APP_CONFIG;
    if (!cfg || !cfg.APPS_SCRIPT_URL) {
      throw new Error('APP_CONFIG.APPS_SCRIPT_URL não definida. Verifique config.js.');
    }
    return cfg.APPS_SCRIPT_URL;
    // Valor atual:
    // https://script.google.com/macros/s/AKfycbzv49WTBEogaYEDccyWMKkcIsLLRjRo_T6agBNt9qX2ak1xUoSKHw1TXMaajMAt5OjX/exec
  }

  /* ── Helpers internos ─────────────────────────────────── */

  /**
   * GET — monta query string e usa fetch().
   * Nunca adiciona "callback=" (elimina o JSONP → elimina o CORB).
   */
  function gasGet(params) {
    var url = new URL(baseUrl());
    Object.keys(params).forEach(function (k) {
      if (params[k] !== undefined && params[k] !== null) {
        url.searchParams.set(k, params[k]);
      }
    });

    return fetch(url.toString())
      .then(function (res) {
        if (!res.ok) throw new Error('Erro HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok === false) throw new Error(data.message || 'Erro desconhecido.');
        return data;
      });
  }

  /**
   * POST — envia JSON no body.
   */
  function gasPost(payload) {
    return fetch(baseUrl(), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Erro HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.ok === false) throw new Error(data.message || 'Erro desconhecido.');
        return data;
      });
  }

  /* ── Gerador de moveId único ──────────────────────────── */
  function gerarMoveId(prefixo) {
    prefixo = prefixo || 'MOVE';
    return prefixo + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  /* ═══════════════════════════════════════════════════════
     API PÚBLICA — window.API
  ═══════════════════════════════════════════════════════ */
  var API = {

    /* ── Sistema ──────────────────────────────────────── */

    /** Verifica se o Apps Script está respondendo. */
    ping: function () {
      return gasGet({ action: 'ping' });
    },

    /* ── Autenticação ─────────────────────────────────── */

    /**
     * @param {string} usuario
     * @param {string} senha
     * @returns {Promise<{ok, usuario, nome, permissao}>}
     */
    login: function (usuario, senha) {
      return gasGet({ action: 'login', usuario: usuario, senha: senha });
    },

    /* ── Estoque ──────────────────────────────────────── */

    /**
     * Retorna um item pelo Cod. TOTVS.
     * @param {string} codTotvs
     */
    getItem: function (codTotvs) {
      return gasGet({ action: 'getItem', codTotvs: codTotvs });
    },

    /**
     * Retorna todos os itens do estoque.
     */
    listarEstoque: function () {
      return gasGet({ action: 'listStock' });
    },

    /* ── Movimentações ────────────────────────────────── */

    /**
     * Registra uma saída de material.
     * @param {string} usuario
     * @param {string} codTotvs
     * @param {number} quantidade
     * @param {string} osPts        — número da OS ou PTS
     * @param {string} [moveId]     — opcional; gerado automaticamente se omitido
     */
    registrarSaida: function (usuario, codTotvs, quantidade, osPts, moveId) {
      return gasPost({
        action:    'registrarSaida',
        moveId:    moveId || gerarMoveId('SAIDA'),
        usuario:   usuario,
        codTotvs:  codTotvs,
        quantidade: quantidade,
        osPts:     osPts
      });
    },

    /**
     * Registra uma entrada de material.
     * @param {object} dados  — todos os campos do payload de entrada
     * @param {string} [moveId]
     */
    registrarEntrada: function (dados, moveId) {
      return gasPost(Object.assign({}, dados, {
        action: 'registrarEntrada',
        moveId: moveId || gerarMoveId('ENTRADA')
      }));
    },

    /**
     * Ajusta o estoque de um item.
     * @param {string} usuario
     * @param {string} codTotvs
     * @param {number} quantidadeNova
     * @param {string} motivo
     * @param {string} [moveId]
     */
    ajustarEstoque: function (usuario, codTotvs, quantidadeNova, motivo, moveId) {
      return gasPost({
        action:         'ajustarEstoque',
        moveId:         moveId || gerarMoveId('AJUSTE'),
        usuario:        usuario,
        codTotvs:       codTotvs,
        quantidadeNova: quantidadeNova,
        motivo:         motivo
      });
    },

    /**
     * Consulta o status de uma movimentação pelo ID.
     * @param {string} moveId
     */
    statusMovimentacao: function (moveId) {
      return gasGet({ action: 'statusMovimentacao', moveId: moveId });
    },

    /* ── Relatórios ───────────────────────────────────── */

    /**
     * @param {string} tipo       — ver lista abaixo
     * @param {number} perfil     — 1 = operador, 2 = admin
     * @param {object} [extras]   — dataInicial, dataFinal, codTotvs (quando necessário)
     *
     * Tipos disponíveis:
     *   'saida_mes'              → saídas do mês atual          (perfil 1 e 2)
     *   'saidas_data'            → saídas por período           (perfil 2)
     *   'entradas_data'          → entradas por período         (perfil 2)
     *   'estoque'                → posição atual do estoque     (perfil 2)
     *   'estoque_minimo'         → itens em nível crítico       (perfil 2)
     *   'custo_saidas'           → custo de saídas por período  (perfil 2)
     *   'custo_entradas'         → custo de entradas por período(perfil 2)
     *   'ajustes'                → ajustes por período          (perfil 2)
     *   'movimentacoes_material' → histórico de um item         (perfil 2, requer codTotvs)
     */
    relatorio: function (tipo, perfil, extras) {
      return gasGet(Object.assign({ action: 'relatorio', tipo: tipo, perfil: perfil }, extras || {}));
    }
  };

  /* Expõe globalmente */
  global.API = API;

}(window));


/* ═══════════════════════════════════════════════════════════
   EXEMPLOS DE USO (remova ou mova para app.js)
═══════════════════════════════════════════════════════════

// 1. Verificar conectividade
API.ping().then(console.log);

// 2. Login
API.login('admin', '1234')
  .then(function (r) { console.log('Logado como', r.nome, '— permissão', r.permissao); })
  .catch(function (e) { console.error('Falha no login:', e.message); });

// 3. Buscar item
API.getItem('12345')
  .then(function (r) { console.log(r.item); });

// 4. Listar estoque
API.listarEstoque()
  .then(function (r) { console.table(r.items); });

// 5. Registrar saída
API.registrarSaida('operador', '12345', 2, 'OS-99999')
  .then(function (r) { alert(r.message); })
  .catch(function (e) { alert('Erro: ' + e.message); });

// 6. Registrar entrada
API.registrarEntrada({
  usuario:       'admin',
  codTotvs:      '12345',
  descricao:     'Filtro de óleo',
  quantidade:    10,
  valorUnitario: 45.90,
  armazem:       'AZ-01',
  endereco:      'A-01-01',
  tagNumber:     'TAG-001',
  estoqueMinimo: 2
}).then(function (r) { console.log(r.message); });

// 7. Ajustar estoque
API.ajustarEstoque('admin', '12345', 50, 'Contagem física')
  .then(function (r) { console.log(r.message); });

// 8. Relatório de saídas do mês (perfil 1 ou 2)
API.relatorio('saida_mes', 1)
  .then(function (r) { console.table(r.rows); });

// 9. Custo de saídas por período (perfil 2)
API.relatorio('custo_saidas', 2, { dataInicial: '2026-05-01', dataFinal: '2026-05-31' })
  .then(function (r) { console.table(r.rows); });

// 10. Histórico de um material
API.relatorio('movimentacoes_material', 2, { codTotvs: '12345' })
  .then(function (r) { console.table(r.rows); });

*/
