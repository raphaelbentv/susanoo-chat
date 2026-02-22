# Hashirama Chat

Interface de chat moderne full-page (thème Gilded Emperor) avec bridge live vers Hashirama.

## 🚀 Quick Start

### Development Mode
```bash
npm install
npm run dev
```

### Production Mode
```bash
npm run build
npm start
```

Le serveur démarre sur `http://localhost:8090`

## 📦 Scripts

- `npm run dev` - Mode développement avec hot reload (tsx watch)
- `npm run build` - Compile backend + frontend
- `npm run build:backend` - Compile TypeScript → dist/
- `npm run build:frontend` - Bundle frontend avec esbuild
- `npm start` - Démarre le serveur compilé
- `npm run type-check` - Vérification des types

## 🏗️ Architecture

### Backend (TypeScript)
```
src/
├── server.ts          # Point d'entrée HTTP
├── config.ts          # Configuration centralisée
├── types/             # Définitions de types
├── modules/           # Logique métier (crypto, session, rbac, etc.)
├── routes/            # Handlers HTTP (login, admin, chat, health)
└── utils/             # Utilitaires HTTP et logging
```

### Frontend (TypeScript)
```
frontend/
├── script.ts          # Application frontend
└── types.ts           # Types frontend
```

## 🔐 Authentification

Endpoint unifié : `POST /api/login`

```json
{
  "identifier": "username",
  "password": "password"
}
```

Détection automatique admin/profile.

## 🎨 Fonctionnalités

- ✅ **Session management** - JWT-style tokens, 24h TTL
- ✅ **RBAC** - 4 rôles (readonly, user, manager, admin)
- ✅ **Rate limiting** - Protection anti-bruteforce
- ✅ **Audit logging** - Logs immuables JSONL
- ✅ **Encrypted backups** - AES-256-CBC, auto toutes les 6h
- ✅ **Password policy** - Complexité + rotation 90j
- ✅ **Bridge AI** - Intégration Docker vers Hashirama

## 📡 API Endpoints

### Public
- `GET /api/health` - État du serveur
- `GET /api/password-policy` - Politique de mot de passe
- `POST /api/login` - Connexion unifiée

### Authenticated
- `GET /api/session/info` - Infos session
- `POST /api/session/refresh` - Renouveler token
- `POST /api/chat` - Envoyer message
- `GET /api/history` - Historique conversation

### Admin
- `GET /api/admin/profiles` - Liste profils
- `POST /api/admin/role` - Changer rôle
- `GET /api/admin/audit` - Logs audit
- `POST /api/admin/backup` - Créer backup

## 🛠️ Tech Stack

- **Runtime**: Node.js (modules natifs uniquement)
- **Language**: TypeScript 5.9 (strict mode)
- **Dev**: tsx (hot reload)
- **Build**: tsc + esbuild
- **Zero runtime dependencies** - Légèreté maximale

## 📂 Data Storage

```
data/
├── profiles.json      # Comptes utilisateurs + mémoire
├── audit.jsonl        # Logs d'audit immuables
├── app.log            # Logs applicatifs
└── backups/           # Backups chiffrés AES-256
```

## 🔧 Configuration

Variables d'environnement optionnelles :
```bash
PORT=8090
SESSION_TTL_MS=86400000
LOGIN_MAX_ATTEMPTS=5
BACKUP_INTERVAL_MS=21600000
PIN_MAX_AGE_DAYS=90
```
