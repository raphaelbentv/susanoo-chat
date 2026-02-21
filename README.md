# Hashirama Chat Susanoo

Interface de chat moderne full-page (thème Susanoo) + bridge live vers Hashirama.

## Run

```bash
cd /workspace/hashirama-chat-susanoo
node server.js
```

Puis ouvrir: `http://<IP_VPS>:8090`

## API

POST `/api/chat`
```json
{ "message": "..." }
```

Réponse:
```json
{ "reply": "..." }
```
