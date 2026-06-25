# Cloudflare Chat

Salon de clavardage temps réel propulsé par **Cloudflare Workers**, **Durable Objects** (SQLite intégré), **Static Assets** et **Tailwind CSS**.

## Fonctionnalités

- Salons indépendants via URL `/r/:slug`
- Communication temps réel par WebSocket
- Persistance des messages dans **SQLite par Durable Object** (une base par salon)
- Historique des 50 derniers messages à la connexion
- Indicateur de frappe (« X est en train d'écrire… »)
- Nombre d'utilisateurs connectés
- Reconnexion automatique avec backoff exponentiel
- Interface responsive

## Stack

| Couche | Technologie |
|--------|-------------|
| Backend | Cloudflare Workers + Hono |
| Temps réel | Durable Objects (WebSocket Hibernation API) |
| Persistance | SQLite intégré au Durable Object (`ctx.storage.sql`) |
| Frontend | React 19 + Vite 6 + Tailwind CSS 4 (Static Assets) |
| Langage | TypeScript strict |

## Structure du projet

```
cloudflare-chat/
├── src/                    # Worker Hono + Durable Object
│   └── durable-objects/    # ChatRoom + schéma SQLite
├── shared/                 # Types et protocole WS partagés
├── frontend/               # Application React
├── wrangler.toml           # Configuration Cloudflare
└── package.json
```

## Prérequis

- Node.js 20+
- Compte [GitHub](https://github.com/) et [Cloudflare](https://cloudflare.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) authentifié (`npx wrangler login`)

## Installation

```bash
git clone https://github.com/LAMAS38/cloudflare-chat.git
cd cloudflare-chat

npm install
npm install --prefix frontend
```

## Développement local

```bash
npm run dev
```

Ouvrez [http://localhost:8787/r/general](http://localhost:8787/r/general), saisissez un pseudo et testez le chat.

```bash
curl http://localhost:8787/health
# {"status":"ok"}
```

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Build frontend + `wrangler dev` |
| `npm run deploy` | Build frontend + déploiement Cloudflare |
| `npm run build:frontend` | Build React → `frontend/dist` |
| `npm run typecheck` | Vérification TypeScript (root + frontend) |

## Déploiement sur Cloudflare

```bash
npx wrangler login
npm run deploy
```

URL de production : `https://cloudflare-chat.<votre-subdomaine>.workers.dev/r/<slug>`

> Chaque salon (`slug`) correspond à un Durable Object unique avec sa propre base SQLite. Aucune configuration D1 externe n'est requise.

## Protocole WebSocket

Endpoint : `GET /r/:slug/ws?username=<pseudo>`

**Client → Serveur :**

```json
{ "type": "message", "content": "Bonjour !" }
{ "type": "typing", "isTyping": true }
```

**Serveur → Client :**

```json
{ "type": "history", "messages": [...] }
{ "type": "message", "message": { "id": 1, "roomSlug": "general", "username": "Alice", "content": "...", "createdAt": "..." } }
{ "type": "join", "username": "Alice", "userCount": 3 }
{ "type": "leave", "username": "Alice", "userCount": 2 }
{ "type": "typing", "username": "Alice", "isTyping": true }
{ "type": "users", "count": 3, "usernames": ["Alice", "Bob"] }
{ "type": "error", "code": "invalid_message", "message": "..." }
```

## Validation

- **Slug** : 3–32 caractères, `[a-z0-9-]`
- **Pseudo** : 2–24 caractères, lettres/chiffres/espaces/tirets

## Architecture

```
Client (React) ──HTTP──► Worker (Hono) ──► Static Assets (SPA)
                      └──WS /r/:slug/ws──► Durable Object (ChatRoom)
                                              │
                                              ├── WebSockets (broadcast)
                                              └── SQLite embarqué (messages)
```

Chaque salon (`slug`) correspond à une instance unique de Durable Object via `idFromName(slug)`, avec sa propre base SQLite embarquée.

## Licence

MIT
