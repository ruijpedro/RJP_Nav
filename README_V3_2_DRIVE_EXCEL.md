# RJP Navigator V3.2 — Drive/Excel

Novos módulos em aberto:
- Obras de Arte
- Órgãos Drenantes
- Geotecnia e Contenções

## Importar folhas do Drive

1. Abra o separador **Drive/Excel**.
2. Cole a ligação de uma folha Google Sheets em cada módulo.
3. A folha deve estar publicada/partilhada para leitura ou ser fornecida por um endpoint Apps Script com CORS.
4. Carregue em **Sincronizar folha**.

Cabeçalhos reconhecidos automaticamente:
- Km ou PK
- Km final ou PK final
- Nome ou Designação
- Tipo ou Tipologia
- Lado
- Estado
- Risco
- Prioridade
- Latitude
- Longitude
- Observações

Os dados importados ficam guardados localmente no dispositivo. Para navegação Maps/Waze, a linha deve incluir Latitude e Longitude, ou a localização deve ser confirmada no terreno com o botão **Guardar neste ativo**.
