# late-micro-chat

Microfront del chat. Bundle ESM que el shell carga vía `<script type="module">`. Publica `window.ChatEngine` y monta la UI en `<div id="micro-chat-root">`.

## Build local

```bash
npm install
npm run build
# dist/entry.js + dist/style.css → rsync a /var/www/html/micro/chat/vX.Y.Z/
```

## Contrato

`window.ChatEngine.getState() / subscribe()`. El micro es dueño de voice rooms (consume `window.RadioEngine.getAnalyser()` opcionalmente para visualizadores).
