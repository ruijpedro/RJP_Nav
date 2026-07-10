# Correção V3.0.6 — Android Geolocation

Foi removida a dependência nativa `@capacitor/geolocation`, que estava a criar o projeto Gradle `:capacitor-geolocation` sem variantes Android válidas no runner.

A localização passa a usar a API padrão `navigator.geolocation` dentro do WebView do Capacitor. O workflow continua a inserir no `AndroidManifest.xml` as permissões:

- `ACCESS_FINE_LOCATION`
- `ACCESS_COARSE_LOCATION`

Ao tocar em **Atualizar GPS**, o Android apresenta o pedido de localização.
