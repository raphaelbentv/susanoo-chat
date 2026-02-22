# PLAN — Susanoo Chat (Roadmap produit)

## Principes d'exécution

- Priorité: **fiabilité > sécurité > valeur métier > confort UX**
- Livraison incrémentale avec feature flags
- Chaque item inclut effort: **S** (1-2j), **M** (3-5j), **L** (1-2 sem)

---

## P0 — Indispensable (fiabilité + sécurité) ✅

- [x] Gestion session robuste (refresh token, expiry visible, re-login clean) — **M**
  - Session TTL 24h, `/api/session/info`, `/api/session/refresh`, auto-cleanup, frontend countdown + auto-refresh
- [x] RBAC réel (admin, manager, user, readonly) + permissions par action — **L**
  - 4 rôles, matrice 12 permissions, middleware `hasPermission()`, endpoints admin (role, disable, delete)
- [x] Audit log admin (qui a créé/modifié quel compte, quand) — **M**
  - Journal JSONL immutable (`data/audit.jsonl`), `GET /api/admin/audit`, events: login/create/modify/delete/pin
- [x] Rate limiting + anti-bruteforce sur login — **S**
  - IP + profil, fenêtre 15min, blocage auto
- [x] Politique mot de passe (complexité + rotation + reset admin) — **M**
  - Min 8 car., 1 maj., 1 min., 1 chiffre, expiration 90j, `POST /api/profile/change-pin`, `POST /api/admin/reset-pin`
- [x] Sauvegarde chiffrée des profils/mémoires (backup auto) — **M**
  - AES-256-CBC, auto toutes les 6h, rétention 10 backups, `POST /api/admin/backup`, `GET /api/admin/backups`
- [x] Observabilité (logs applicatifs + erreurs frontend + health endpoint) — **M**
  - Logger structuré JSON (`data/app.log`), `POST /api/log/error`, health enrichi (version, sessions, memory, db size)
- [x] Health endpoint `/api/health` — **S**
  - v0.2.0: status, uptime, profileCount, activeSessionCount, dbSizeBytes, memoryMB

---

## P1 — Très forte valeur usage

- [ ] Gestion comptes complète (édition profil, désactivation, reset mdp, suppression) — **L**
  - CRUD complet avec permissions RBAC
- [ ] Profils enrichis (nom, rôle, équipe, tags) — **M**
  - Métadonnées utilisateur, affichage sidebar + panneau droit
- [ ] Recherche conversation full-text — **M**
  - Indexation messages, recherche < 300ms, highlight résultats
- [ ] Favoris / pin messages importants — **S**
  - Épingler messages clés, section favoris dédiée
- [ ] Templates de prompts (business, debug, contenu, juridique, etc.) — **S**
  - Bibliothèque versionnée, insertion en 1 clic
- [ ] Pièces jointes (upload docs/images) + résumé automatique — **L**
  - Upload sécurisé, parsing, résumé IA auto
- [ ] Réponses streamées plus fluides (stop génération, retry, continue) — **M**
  - SSE/streaming, boutons stop/retry/continue dans UI
- [ ] Export avancé (PDF/Markdown/JSON avec métadonnées) — **M**
  - Formats multiples, métadonnées (profil, date, modèle, tokens)

---

## P2 — Expérience premium

- [ ] Multi-workspaces (Venio / Creatio / Decisio séparés) — **L**
  - Isolation stricte des données par workspace
- [ ] Context packs (injecter contexte projet en 1 clic) — **M**
  - Packs pré-configurés, injection dans prompt système
- [ ] Vue "projets" avec mémoire par projet + timeline — **M**
  - Timeline visuelle, mémoire persistante par projet
- [ ] Personas assistants (Hashirama Ops, Hashirama Content, Hashirama Legal) — **M**
  - Persona sélectionnable par contexte, prompt système dédié
- [ ] Command palette complète (Ctrl+K: actions, navigation, snippets) — **M**
  - Recherche fuzzy, actions rapides, navigation conversations
- [ ] Thèmes switchables (Gilded, Neon, Minimal) — **S**
  - 3 thèmes, switch instantané, persistance préférence
- [ ] Raccourcis clavier exhaustifs — **S**
  - Mappings complets, aide contextuelle, personnalisation

---

## P3 — Niveau "produit mature"

- [ ] Collaboration multi-utilisateurs (présence live, handoff) — **L**
  - Indicateurs présence, transfert conversation entre utilisateurs
- [ ] Commentaires internes sur messages/réponses — **M**
  - Annotations privées, visibles uniquement par l'équipe
- [ ] Versioning des réponses (comparaison A/B) — **M**
  - Régénération avec diff, sélection meilleure version
- [ ] Workflows automatisés (si X alors créer tâche Y) — **L**
  - Triggers configurables, actions chaînées
- [ ] Intégration calendrier/email/CRM (actions directes depuis chat) — **L**
  - Connecteurs API, actions en 1 clic depuis le chat
- [ ] Mobile PWA offline partiel + sync différée — **L**
  - Service worker, cache conversations, sync au retour réseau

---

## Bonus IA (différenciateur)

- [ ] Mémoire hiérarchique (session / projet / global / persona) — **L**
  - 4 niveaux de mémoire, priorisation contextuelle
- [ ] Score de confiance réponse + sources internes affichées — **M**
  - Indicateur fiabilité, références aux données utilisées
- [ ] Détection ambiguïté + clarification proactive avant action — **M**
  - IA demande précisions avant d'agir si requête floue
- [ ] Mode "plan d'action exécutable" en 1 clic (avec checklist) — **M**
  - Génération plan structuré, cases cochables, suivi progression
- [ ] Auto-résumé quotidien des conversations + TODO extraits — **M**
  - Résumé généré automatiquement, extraction tâches en suspens

---

## Ordre optimal recommandé

1. **P0** — Sécurité/session/RBAC (fondations obligatoires)
2. **P1** — Valeur métier immédiate (comptes, recherche, templates, export)
3. **P2** — Expérience premium (workspaces, personas, command palette)
4. **P3** — Collaboration/intégrations lourdes (multi-users, workflows, PWA)
5. **Bonus IA** — En parallèle par modules indépendants
