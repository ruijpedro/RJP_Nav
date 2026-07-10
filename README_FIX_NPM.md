# Correção NPM/Vite — V3.0.2

O workflow deixou de executar:

- `npm install -g npm@10.9.2`
- `npm cache clean --force`
- `rm -rf node_modules`

Esses comandos estavam a provocar o erro interno `Exit handler never called` no GitHub Actions.

A instalação passa a ser feita diretamente com:

```bash
npm ci --include=dev --no-audit --no-fund
```

O Vite é verificado em `node_modules/.bin/vite` antes do build.
