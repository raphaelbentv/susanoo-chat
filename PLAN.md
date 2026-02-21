# Plan d'action — Susanoo Chat

## Phase 1 : Architecture & Backend

- [ ] **1. Créer un backend Node.js/Express** — serveur API avec les routes `/api/chat`, `/api/history`, `/api/profile/login`, `/api/memory/*`, `/api/admin/*`
- [ ] **2. Intégrer l'API Claude** — connecter `/api/chat` à l'API Anthropic (claude-sonnet-4-6) avec streaming
- [ ] **3. Système de persistence** — SQLite ou JSON-file pour les profils, conversations, mémoire
- [ ] **4. Auth JWT** — sécuriser les endpoints avec des tokens JWT au lieu de tokens simples

## Phase 2 : Features Frontend

- [ ] **5. Streaming des réponses** — afficher le texte token par token avec le curseur `.cursor`
- [ ] **6. Rendu Markdown** — parser les réponses AI avec support code blocks, listes, gras/italique
- [ ] **7. Sidebar conversations** — implémenter la liste de conversations (déjà stylée) avec multi-sessions
- [ ] **8. Command Palette (Ctrl+K)** — recherche rapide dans les conversations et actions

## Phase 3 : UX & Polish

- [ ] **9. Système de toasts** — notifications live pour connexion, erreurs, limites
- [ ] **10. Settings panel** — page paramètres fonctionnelle (modèle, température, streaming on/off)
- [ ] **11. Export multi-format** — JSON + Markdown
- [ ] **12. PWA & Favicon** — manifest, service worker, icône Susanoo

## Phase 4 : Déploiement

- [ ] **13. Dockerfile** — conteneuriser le projet
- [ ] **14. Déployer sur le VPS** (87.106.22.224) — remplacer le frontend actuel de susanoo.app
- [ ] **15. CI/CD** — GitHub Actions pour auto-deploy au push
