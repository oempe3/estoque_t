# Configuração rápida

## Ordem recomendada

1. Criar a planilha Google Sheets.
2. Criar as abas:
   - Acesso
   - Email
   - Estoque
   - Entradas
   - Saidas
   - Ajustes
   - Movimentacoes
3. Copiar os cabeçalhos dos CSVs da pasta `google-sheets-modelo`.
4. Criar a pasta no Google Drive para fotos.
5. Colar o `Code.gs` no Apps Script.
6. Preencher:
   - `SPREADSHEET_ID`
   - `DRIVE_FOLDER_ID`
7. Rodar `setupInicial()`.
8. Implantar como App da Web.
9. Copiar a URL `/exec`.
10. Colar a URL no arquivo `frontend/src/config.js`.
11. Publicar o frontend no GitHub Pages.

## Teste inicial

1. Login: `admin`
2. Senha: `1234`
3. Use o item exemplo `MAT001` para consultar estoque e registrar saída.