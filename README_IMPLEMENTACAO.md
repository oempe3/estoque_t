# Controle de Consumíveis — UTE Pernambuco III

Projeto inicial para controle de consumíveis com:

- **Frontend estático** para publicação no **GitHub Pages**
- **Google Apps Script** como backend
- **Google Sheets** como banco de dados
- **Google Drive** para armazenamento das fotos dos materiais
- Controle por perfil:
  - Perfil **1**: saída de materiais e relatório de saídas do mês
  - Perfil **2**: saída, entrada, estoque, ajustes e relatórios completos

---

## 1. Estrutura do pacote

```text
controle-consumiveis-peiii/
├── frontend/
│   ├── index.html
│   ├── assets/
│   │   └── logo-peiii.png
│   └── src/
│       ├── config.js
│       ├── styles.css
│       └── app.js
├── apps-script/
│   └── Code.gs
└── google-sheets-modelo/
    ├── Acesso.csv
    ├── Email.csv
    ├── Estoque.csv
    ├── Entradas.csv
    ├── Saidas.csv
    ├── Ajustes.csv
    └── Movimentacoes.csv
```

---

## 2. Criar a planilha no Google Sheets

Crie uma planilha no Google Drive com as abas abaixo, exatamente com estes nomes:

- `Acesso`
- `Email`
- `Estoque`
- `Entradas`
- `Saidas`
- `Ajustes`
- `Movimentacoes`

Você pode abrir os arquivos `.csv` da pasta `google-sheets-modelo` e copiar os cabeçalhos para cada aba.

### Aba Acesso

| Login | Senha | Permissao | Nome | Ativo |
|---|---|---:|---|---:|
| operador | 1234 | 1 | Operador | 1 |
| admin | 1234 | 2 | Administrador | 1 |

Regras:
- `Permissao = 1`: acesso à saída de materiais e relatório de saídas do mês.
- `Permissao = 2`: acesso completo.
- `Ativo = 1`: usuário liberado.
- `Ativo = 0`: usuário bloqueado.

### Aba Email

| DestinatariosSaida | DestinatariosEntradaAjuste |
|---|---|
| email.saida@empresa.com.br | email.entrada@empresa.com.br |

Você pode cadastrar vários e-mails, um por linha.

---

## 3. Configurar o Google Drive

Crie uma pasta no Google Drive para armazenar as fotos dos materiais.

Copie o ID da pasta. Exemplo:

```text
https://drive.google.com/drive/folders/1ABCDEF123456789
```

O ID é:

```text
1ABCDEF123456789
```

---

## 4. Configurar o Apps Script

1. Abra a planilha do Google Sheets.
2. Vá em **Extensões > Apps Script**.
3. Apague o conteúdo padrão.
4. Cole todo o conteúdo do arquivo:

```text
apps-script/Code.gs
```

5. No início do script, preencha:

```javascript
SPREADSHEET_ID: 'COLE_AQUI_O_ID_DA_PLANILHA',
DRIVE_FOLDER_ID: 'COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE',
```

6. Execute uma vez a função:

```javascript
setupInicial()
```

7. Autorize o acesso solicitado pelo Google.
8. Clique em **Implantar > Nova implantação**.
9. Tipo: **App da Web**.
10. Executar como: **Eu**.
11. Quem pode acessar: **Qualquer pessoa com o link**.
12. Copie a URL final terminada em `/exec`.

---

## 5. Configurar o GitHub Pages

1. Crie um repositório no GitHub.
2. Envie a pasta `frontend`.
3. Abra o arquivo:

```text
frontend/src/config.js
```

4. Substitua:

```javascript
APPS_SCRIPT_URL: 'COLE_AQUI_A_URL_DO_APPS_SCRIPT_EXEC'
```

pela URL `/exec` do Apps Script.

5. Publique no GitHub Pages em:

```text
Settings > Pages > Deploy from branch
```

---

## 6. Uso com leitor de código de barras

O leitor deve trabalhar no modo **keyboard wedge**, ou seja, como se fosse um teclado.

Configuração recomendada do leitor:

- Ler o código e enviar **ENTER** no final
- Código da etiqueta = `CodTotvs`
- Evitar digitação manual sempre que possível

Fluxo recomendado:

1. Operador faz login.
2. Clica em **Saída**.
3. Passa o código de barras.
4. O sistema consulta o item no estoque.
5. Operador informa quantidade e OS/PTS.
6. Clica em enviar.
7. O Apps Script:
   - baixa o estoque;
   - registra a saída;
   - grava data e hora;
   - envia e-mail para a coluna A da aba `Email`.

---

## 7. Relatórios implementados

- Saídas do mês
- Saídas por período
- Entradas por período
- Estoque atual
- Estoque mínimo/crítico
- Custo de saídas por período
- Custo de entradas por período
- Ajustes de estoque
- Movimentações por material

O frontend permite:

- Filtrar por data inicial e data final
- Visualizar resultado em tabela
- Baixar CSV
- Baixar PDF com layout moderno

---

## 8. Observação importante sobre segurança

Este modelo foi construído para uso interno e MVP operacional com GitHub Pages + Apps Script.

Como o GitHub Pages é público por natureza, não coloque informações altamente sensíveis no frontend. Para uma versão corporativa mais segura, recomenda-se uma das opções abaixo:

- hospedar todo o sistema dentro do próprio Google Apps Script;
- usar Google Identity / OAuth;
- usar backend dedicado com autenticação real;
- restringir o acesso por VPN ou rede interna.

---

## 9. Próximas melhorias recomendadas

- Leitura por câmera do celular usando biblioteca de barcode scanner.
- Tela de dashboard com estoque crítico e consumo mensal.
- Cadastro de colaboradores/solicitantes.
- Campo de centro de custo.
- Campo de equipamento atendido.
- Relatório de consumo por OS/PTS.
- Aprovação eletrônica para ajustes de estoque.
- Inventário cíclico mensal.
- Exportação direta para Excel `.xlsx`.
- Histórico por item com gráfico de consumo.
- Alerta automático de estoque mínimo por e-mail diário.