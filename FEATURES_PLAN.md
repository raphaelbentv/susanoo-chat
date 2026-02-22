# Plan d'Implémentation - Fonctionnalités Avancées

## 📋 Vue d'ensemble

Implémentation de 7 fonctionnalités majeures pour transformer Hashirama en une interface de chat professionnelle complète.

## 🎯 Fonctionnalités Cibles

| ID | Fonctionnalité | Priorité | Complexité | Durée estimée |
|----|----------------|----------|------------|---------------|
| **F1** | Historique conversations | Haute | Moyenne | 4-6h |
| **F2** | Export conversation | Moyenne | Faible | 2-3h |
| **F3** | Recherche dans l'historique | Haute | Moyenne | 3-4h |
| **F4** | Statistiques détaillées | Moyenne | Moyenne | 3-4h |
| **F5** | Raccourcis clavier | Faible | Faible | 2h |
| **F6** | Mode hors-ligne | Haute | Élevée | 5-7h |
| **F7** | Notifications | Faible | Faible | 2h |

**Total estimé : 21-30h de développement**

---

## 🏗️ Architecture - Modifications Structurelles

### État Actuel
```typescript
interface Database {
  profiles: Record<string, Profile>;
  memory: Record<string, MemoryEntry[]>;  // ❌ Une seule conversation par profil
  admin?: AdminConfig;
}

interface MemoryEntry {
  role: 'user' | 'ai';
  text: string;
  time: string;  // ❌ Format texte "14h32"
}
```

### Nouvelle Architecture
```typescript
interface Database {
  profiles: Record<string, Profile>;
  conversations: Record<string, Conversation[]>;  // ✅ Multiple conversations
  statistics: Record<string, UserStatistics>;     // ✅ Stats par profil
  admin?: AdminConfig;
}

interface Conversation {
  id: string;                    // UUID
  profile: string;               // Propriétaire
  title: string;                 // Auto-généré ou custom
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  messages: Message[];           // Messages complets
  metadata: ConversationMetadata;
  pinned: boolean;
  archived: boolean;
  tags: string[];
}

interface Message {
  id: string;                    // UUID
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
  metadata: {
    model?: string;
    tokensUsed?: number;
    temperature?: number;
    contexts?: string[];
    connectors?: string[];
  };
}

interface ConversationMetadata {
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  lastModel: string;
  contexts: string[];
}

interface UserStatistics {
  profile: string;
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  modelUsage: Record<string, number>;      // Nombre de messages par modèle
  dailyUsage: Record<string, DailyStats>;  // Stats par jour (YYYY-MM-DD)
  firstUse: number;
  lastUse: number;
}

interface DailyStats {
  date: string;         // YYYY-MM-DD
  messages: number;
  tokens: number;
  cost: number;
  conversations: number;
}
```

---

## 📦 Plan d'Exécution par Sprints

### Sprint 1 : Système de Conversations Multiples (4-6h)

**Objectif** : Migrer du système mono-conversation vers multi-conversations

#### Backend
1. **Types & Interfaces**
   - Créer `src/types/conversation.types.ts`
   - Définir `Conversation`, `Message`, `ConversationMetadata`
   - Étendre `Database` avec `conversations` field

2. **Migration de données**
   - Script `src/scripts/migrate-conversations.ts`
   - Convertir `memory` → `conversations`
   - Backup automatique avant migration

3. **Nouveaux endpoints**
   ```typescript
   GET    /api/conversations              // Liste conversations
   POST   /api/conversations              // Nouvelle conversation
   GET    /api/conversations/:id          // Détails conversation
   PUT    /api/conversations/:id          // Renommer/mettre à jour
   DELETE /api/conversations/:id          // Supprimer
   POST   /api/conversations/:id/archive  // Archiver
   POST   /api/conversations/:id/pin      // Épingler
   POST   /api/conversations/:id/message  // Ajouter message
   ```

4. **Module conversations**
   - `src/modules/conversations.ts`
   - Fonctions CRUD complètes
   - Auto-génération de titres (premiers mots du 1er message)
   - Gestion des tags

#### Frontend
1. **State management**
   ```typescript
   let conversations = [];        // Liste complète
   let activeConversationId = ''; // UUID actuel
   let currentMessages = [];      // Messages de la conv active
   ```

2. **UI Sidebar**
   - Remplacer `CONVS` mock par vraies données
   - Groupes: "Épinglées", "Aujourd'hui", "Cette semaine", "Plus ancien", "Archivées"
   - Bouton "+" pour nouvelle conversation
   - Actions par conversation: Renommer, Archiver, Supprimer

3. **Rendering**
   - `renderConversations()` - fetch API et affichage
   - `createConversation(title?)` - nouvelle conv
   - `switchConversation(id)` - changer de conv active
   - Auto-switch vers nouvelle conv après création

---

### Sprint 2 : Export de Conversations (2-3h)

**Objectif** : Permettre l'export en PDF, Markdown, JSON

#### Backend
1. **Endpoint export**
   ```typescript
   GET /api/conversations/:id/export?format=pdf|markdown|json
   ```

2. **Modules d'export**
   - `src/modules/export/markdown.ts` - Simple template
   - `src/modules/export/json.ts` - Sérialisation complète
   - `src/modules/export/pdf.ts` - Utiliser une lib légère (ou déléguer au client)

3. **Format Markdown**
   ```markdown
   # Conversation: [Title]
   **Créée le** : [Date]
   **Messages** : [Count]

   ---

   ## 👤 User (14:32)
   Message content...

   ## 🤖 Hashirama (14:32) · Sonnet 4 · 245 tokens
   Response content...
   ```

4. **Format JSON**
   ```json
   {
     "conversation": {
       "id": "uuid",
       "title": "...",
       "createdAt": 1234567890,
       "messages": [...]
     },
     "metadata": {...},
     "exportedAt": 1234567890,
     "exportedBy": "profile-name"
   }
   ```

#### Frontend
1. **Menu export**
   - Bouton dans navbar ou conversation header
   - Dropdown : PDF | Markdown | JSON
   - Download automatique

2. **Export côté client**
   - Markdown/JSON : simple download du blob
   - PDF : utiliser jsPDF ou print-to-PDF natif

---

### Sprint 3 : Recherche dans l'Historique (3-4h)

**Objectif** : Recherche full-text dans toutes les conversations

#### Backend
1. **Endpoint recherche**
   ```typescript
   POST /api/search
   {
     "query": "search terms",
     "filters": {
       "dateFrom": timestamp,
       "dateTo": timestamp,
       "tags": ["tag1"],
       "archived": false
     },
     "limit": 50
   }
   ```

2. **Recherche simple**
   - Recherche case-insensitive dans message.content
   - Recherche dans conversation.title
   - Retour: array de résultats avec highlighting

3. **Résultat**
   ```typescript
   interface SearchResult {
     conversationId: string;
     conversationTitle: string;
     messageId: string;
     messageRole: 'user' | 'ai';
     snippet: string;           // Extrait avec highlight
     timestamp: number;
     matchScore: number;        // Pertinence
   }
   ```

#### Frontend
1. **Search bar**
   - Champ dans sidebar header
   - Placeholder: "🔍 Rechercher..."
   - Search on Enter ou auto-complete

2. **Résultats**
   - Affichage modal ou panel dédié
   - Highlight des termes trouvés
   - Clic → ouvre conversation + scroll vers message

3. **Filtres avancés**
   - Date range picker
   - Tags selector
   - Inclure/exclure archivées

---

### Sprint 4 : Statistiques Détaillées (3-4h)

**Objectif** : Dashboard avec graphiques d'utilisation

#### Backend
1. **Module statistics**
   - `src/modules/statistics.ts`
   - Calcul à la volée ou pré-calculé
   - Mise à jour incrémentale à chaque message

2. **Endpoint**
   ```typescript
   GET /api/statistics?period=7d|30d|90d|all
   ```

3. **Métriques calculées**
   - Messages par jour (graphique ligne)
   - Tokens par jour (graphique aire)
   - Coût cumulé (courbe)
   - Répartition par modèle (pie chart)
   - Contextes les plus utilisés (bar chart)
   - Temps moyen de réponse
   - Conversations créées par jour

#### Frontend
1. **Nouvelle section accordion**
   - "Statistiques" dans right panel
   - Ou modal dédié

2. **Graphiques légers**
   - Option 1: Chart.js (35KB)
   - Option 2: Recharts (plus lourd)
   - Option 3: CSS pur pour graphiques simples

3. **Widgets**
   - Cartes de métriques clés
   - Graphiques interactifs
   - Export stats en CSV

---

### Sprint 5 : Raccourcis Clavier (2h)

**Objectif** : Navigation rapide par clavier

#### Raccourcis Globaux
```
⌘/Ctrl + K     → Palette de commandes
⌘/Ctrl + N     → Nouvelle conversation
⌘/Ctrl + F     → Focus recherche
⌘/Ctrl + B     → Toggle sidebar
⌘/Ctrl + E     → Export conversation
⌘/Ctrl + ,     → Ouvrir paramètres
⌘/Ctrl + /     → Afficher raccourcis
Échap           → Fermer modals
⌘/Ctrl + ↑/↓   → Navigation conversations
```

#### Dans Conversation
```
⌘/Ctrl + R     → Régénérer dernière réponse
⌘/Ctrl + L     → Clear conversation
⌘/Ctrl + S     → Sauvegarder/Renommer
Enter          → Envoyer message
Shift + Enter  → Nouvelle ligne
```

#### Implémentation
1. **Event listener global**
   ```typescript
   document.addEventListener('keydown', handleGlobalShortcuts);
   ```

2. **Palette de commandes**
   - Modal avec liste filtrée
   - Actions rapides
   - Fuzzy search

3. **Hints visuels**
   - Tooltips avec raccourcis
   - Section "Raccourcis" mise à jour

---

### Sprint 6 : Mode Hors-ligne (5-7h)

**Objectif** : Cache local + sync automatique

#### Architecture
1. **IndexedDB**
   - Stockage local conversations
   - Stockage préférences
   - Queue de sync

2. **Service Worker** (optionnel)
   - Cache assets statiques
   - Offline fallback

#### Backend
1. **Endpoint sync**
   ```typescript
   POST /api/sync
   {
     "lastSyncTimestamp": 1234567890,
     "clientChanges": [...],
     "conflicts": [...]
   }
   ```

2. **Conflict resolution**
   - Timestamp wins
   - Ou merge intelligent

#### Frontend
1. **IndexedDB wrapper**
   ```typescript
   class LocalDB {
     async saveConversation(conv);
     async getConversations();
     async queueChange(change);
     async sync();
   }
   ```

2. **Auto-sync**
   - Sync toutes les 30s si online
   - Sync au focus de la fenêtre
   - Indicateur état sync

3. **Offline UI**
   - Badge "Hors ligne"
   - Messages en queue affichés différemment
   - Retry automatique

---

### Sprint 7 : Notifications (2h)

**Objectif** : Alertes pour événements importants

#### Types de Notifications
1. **Session**
   - Session expire dans 10min
   - Pin expiré
   - Nouveau backup créé

2. **Conversations**
   - Message trop long (warning)
   - Quota dépassé
   - Erreur API

3. **Système**
   - Nouvelle version disponible
   - Maintenance planifiée

#### Implémentation
1. **Module notifications**
   ```typescript
   interface Notification {
     id: string;
     type: 'info' | 'warning' | 'error' | 'success';
     title: string;
     message: string;
     timestamp: number;
     persistent: boolean;
     actions?: NotificationAction[];
   }
   ```

2. **UI Toast**
   - Toast top-right
   - Auto-dismiss (5s) ou persistent
   - Stack multiple notifications

3. **Centre de notifications**
   - Icon dans navbar avec badge count
   - Modal avec historique
   - Mark as read

---

## 🔄 Ordre d'Implémentation Recommandé

1. **Sprint 1** (Conversations) - **CRITIQUE** : base pour tout le reste
2. **Sprint 3** (Recherche) - Haute valeur utilisateur
3. **Sprint 6** (Hors-ligne) - Complexe, mieux de l'avoir tôt
4. **Sprint 2** (Export) - Rapide, bonne UX
5. **Sprint 4** (Statistiques) - Feature "nice to have"
6. **Sprint 5** (Raccourcis) - Polish UX
7. **Sprint 7** (Notifications) - Polish final

---

## 📊 Métriques de Succès

### Fonctionnalité
- ✅ Création/suppression conversations instantanée
- ✅ Recherche retourne résultats en <500ms
- ✅ Export génère fichier en <2s
- ✅ Stats chargent en <1s
- ✅ Raccourcis répondent en <50ms
- ✅ Offline mode sync en <5s au retour online
- ✅ Notifications affichées en <100ms

### Performance
- ✅ Support 1000+ conversations par profil
- ✅ Support 10000+ messages par conversation
- ✅ IndexedDB <50MB par profil
- ✅ Pas de ralentissement UI avec grosse DB

### UX
- ✅ 0 perte de données
- ✅ Sync transparent
- ✅ Feedback visuel pour chaque action
- ✅ Mobile-friendly

---

## 🚀 Prêt pour l'Implémentation

Estimation totale : **21-30h** répartis sur **7 sprints**

Recommandation : Commencer par **Sprint 1 (Conversations)** qui pose les fondations pour toutes les autres features.

Valider l'architecture avant de continuer vers les sprints suivants.
