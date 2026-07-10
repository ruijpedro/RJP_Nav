# Correção Yarn 3.0.5

O GitHub Actions falhava com `YN0028` porque o repositório ainda não tinha `yarn.lock` e o Yarn 4 usa instalação imutável em CI.

Os workflows passam a usar:

```bash
yarn install --no-immutable
```

Na primeira execução o Yarn cria o `yarn.lock`. Depois de o ficheiro ser adicionado ao repositório, pode voltar-se a usar `yarn install --immutable`.
