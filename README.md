# VARJÃO AI — assistente pessoal para iPhone

Este projeto cria uma aplicação web instalável (PWA), com interface futurista, chat com IA, leitura de respostas em voz alta e tentativa de reconhecimento de fala pelo navegador.

## Importante

- O projeto original J.A.R.V.I.S. usa Claude Code, Node.js e ferramentas MCP. Esta é uma adaptação independente, com interface própria e backend simples.
- Para respostas inteligentes, é necessário configurar uma chave de API da OpenAI no servidor. A chave nunca deve ser colocada no JavaScript do navegador.
- A aplicação precisa estar publicada em HTTPS para ser adicionada à tela inicial do iPhone.
- O iOS pode limitar o reconhecimento de voz em páginas web. Se o botão de microfone não funcionar no Safari, use o ditado do teclado do iPhone. A leitura em voz alta usa as vozes disponíveis no aparelho.
- Esta versão não controla outros aplicativos do iPhone nem fica ouvindo continuamente em segundo plano.

## Rodar em computador

Requer Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
```

Edite `.env` e coloque sua chave:
```
OPENAI_API_KEY=sua_chave
OPENAI_MODEL=gpt-4.1-mini
PORT=3000
```

Inicie:
```bash
npm start
```

Abra `http://localhost:3000`.

## Publicar para usar no iPhone

Publique este projeto em um serviço que aceite Node.js (por exemplo, Render ou Railway) e configure as variáveis de ambiente no painel do serviço:

- `OPENAI_API_KEY` — sua chave da API
- `OPENAI_MODEL` — opcional; padrão `gpt-4.1-mini`

Use a URL HTTPS fornecida pelo serviço.

## Instalar no iPhone

1. Abra a URL HTTPS no Safari.
2. Toque em Compartilhar.
3. Escolha **Adicionar à Tela de Início**.
4. Confirme o nome VARJÃO.
5. Abra pelo novo ícone.

## Segurança

Nunca publique o arquivo `.env`, nunca envie sua chave de API em mensagens e não coloque a chave em `public/app.js`. O `.gitignore` já exclui `.env`.
