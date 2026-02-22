# Plan d'Implémentation - Système de Thèmes Hashirama

## 📋 Vue d'ensemble

Implémentation d'un système de thèmes sélectionnables permettant aux utilisateurs de basculer entre 6 designs visuels distincts.

## 🎨 Thèmes Disponibles

| ID | Nom | Palette | Ambiance | Statue |
|----|-----|---------|----------|--------|
| **T1** | Obsidian Sentinel | Dark + Red (#bb1e00) | Ultra sombre, japonais | Silhouette noire, yeux rouges |
| **T2** | Electric Ronin | Cyan (#00d2ff) | Cyberpunk, néon | Robot futuriste, visor cyan |
| **T3** | Gilded Emperor | Gold (#c8a020) | Art déco, impérial | **Actuel** - Empereur doré |
| **T4** | White Ghost | Light (#eeecea) | Minimaliste, pierre | Statue blanche, brume |
| **T5** | Storm Deity | Indigo (#8840ff) | Orage, mystique | Ailé, cornes, lightning |
| **T6** | Brutalist Oracle | B&W (#fff) | Terminal, brut | Monolithe noir, œil blanc |

---

## 🏗️ Architecture Technique

### Phase 1 : Structure CSS Modulaire

**Objectif** : Extraire les thèmes en modules CSS réutilisables

#### 1.1 Organisation des fichiers
```
styles/
├── base.css           # Reset, layout, structure commune
├── themes/
│   ├── obsidian.css   # T1 - Variables + overrides
│   ├── cyber.css      # T2 - Variables + overrides
│   ├── emperor.css    # T3 - Variables + overrides (actuel)
│   ├── ghost.css      # T4 - Variables + overrides
│   ├── storm.css      # T5 - Variables + overrides
│   └── brutal.css     # T6 - Variables + overrides
└── components.css     # Components partagés
```

#### 1.2 Système de variables CSS par thème
Chaque thème définit :
```css
[data-theme="obsidian"] {
  /* Colors */
  --primary: #bb1e00;
  --bg: #030303;
  --surface: rgba(4,4,4,0.93);
  --text: rgba(255,255,255,0.82);
  --border: rgba(255,255,255,0.05);

  /* Typography */
  --font-display: 'Cinzel', serif;
  --font-body: 'Noto Serif JP', serif;

  /* Effects */
  --glow-primary: 0 0 8px 3px rgba(190,30,0,0.9);
  --shadow-main: 0 40px 120px rgba(0,0,0,1);
}
```

#### 1.3 Components adaptatifs
```css
/* Base component */
.chat-bubble {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}

/* Theme-specific adjustments */
[data-theme="brutal"] .chat-bubble {
  border-width: 2px;
  box-shadow: 7px 7px 0 rgba(255,255,255,0.1);
}
```

---

### Phase 2 : Backend - Gestion des Préférences

#### 2.1 Type definitions
```typescript
// src/types/profile.types.ts
export type ThemeId = 'obsidian' | 'cyber' | 'emperor' | 'ghost' | 'storm' | 'brutal';

export interface Profile {
  // ... existing fields
  preferences?: {
    theme: ThemeId;
    fontSize?: 'small' | 'medium' | 'large';
  };
}
```

#### 2.2 Nouvel endpoint API
```typescript
// src/routes/profile.ts
export async function handleUpdatePreferences(req, res) {
  const session = getSession(req.headers.authorization);
  if (!session) return json(res, 401, { error: 'unauthorized' });

  const { theme } = JSON.parse(await parseBody(req));

  const db = dbRead();
  db.profiles[session.profile].preferences = {
    ...db.profiles[session.profile].preferences,
    theme,
  };
  dbWrite(db);

  return json(res, 200, { ok: true, theme });
}
```

#### 2.3 Récupération au login
```typescript
// Dans handleUnifiedLogin
return json(res, 200, {
  token,
  identifier,
  role,
  type: 'profile',
  preferences: profile.preferences || { theme: 'emperor' }, // Default
});
```

---

### Phase 3 : Frontend - UI de Sélection

#### 3.1 Composant ThemeSelector

**Localisation** : Panel de droite (right-panel), nouvelle section accordion

```typescript
interface ThemeOption {
  id: ThemeId;
  name: string;
  preview: {
    primary: string;    // Couleur principale
    bg: string;         // Background
    accent: string;     // Accent
  };
  icon: string;         // Emoji ou symbole
}

const THEMES: ThemeOption[] = [
  {
    id: 'obsidian',
    name: 'Obsidian Sentinel',
    preview: { primary: '#bb1e00', bg: '#030303', accent: '#ff0000' },
    icon: '🗡️'
  },
  {
    id: 'cyber',
    name: 'Electric Ronin',
    preview: { primary: '#00d2ff', bg: '#00050c', accent: '#00ffe0' },
    icon: '⚡'
  },
  {
    id: 'emperor',
    name: 'Gilded Emperor',
    preview: { primary: '#c8a020', bg: '#050408', accent: '#ffd700' },
    icon: '👑'
  },
  {
    id: 'ghost',
    name: 'White Ghost',
    preview: { primary: '#1a1a1a', bg: '#eeecea', accent: '#fff' },
    icon: '👻'
  },
  {
    id: 'storm',
    name: 'Storm Deity',
    preview: { primary: '#8840ff', bg: '#040310', accent: '#9055ff' },
    icon: '⚡'
  },
  {
    id: 'brutal',
    name: 'Brutalist Oracle',
    preview: { primary: '#fff', bg: '#090909', accent: '#000' },
    icon: '▪️'
  }
];
```

#### 3.2 UI HTML
```html
<!-- Dans right-panel -->
<div class="acc-section">
  <div class="acc-header">
    <span>Thème Visuel</span>
    <span class="acc-arrow">▼</span>
  </div>
  <div class="acc-body" id="accThemeBody">
    <div class="theme-grid">
      <!-- Généré dynamiquement -->
    </div>
  </div>
</div>
```

#### 3.3 Style du sélecteur
```css
.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.theme-card {
  padding: 12px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.theme-card.active {
  border-color: var(--gold);
  background: var(--gold-faint);
}

.theme-preview {
  display: flex;
  gap: 4px;
  height: 24px;
  margin-bottom: 8px;
}

.theme-color {
  flex: 1;
  border-radius: 2px;
}

.theme-name {
  font-size: 10px;
  color: var(--text-dim);
  text-align: center;
}
```

---

### Phase 4 : Application du Thème

#### 4.1 Fonction de switch
```typescript
function applyTheme(themeId: ThemeId) {
  // 1. Mettre à jour l'attribut HTML
  document.documentElement.setAttribute('data-theme', themeId);

  // 2. Charger le CSS du thème si nécessaire
  loadThemeCSS(themeId);

  // 3. Sauvegarder en localStorage
  localStorage.setItem('hashirama_theme', themeId);

  // 4. Sauvegarder sur le serveur
  if (token) {
    api('/api/preferences', { theme: themeId });
  }

  // 5. Animation de transition
  document.body.classList.add('theme-transitioning');
  setTimeout(() => {
    document.body.classList.remove('theme-transitioning');
  }, 300);
}
```

#### 4.2 Chargement dynamique CSS
```typescript
const loadedThemes = new Set<ThemeId>();

function loadThemeCSS(themeId: ThemeId) {
  if (loadedThemes.has(themeId)) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/styles/themes/${themeId}.css`;
  link.id = `theme-${themeId}`;
  document.head.appendChild(link);

  loadedThemes.add(themeId);
}
```

#### 4.3 Initialisation au chargement
```typescript
async function initTheme() {
  // Priorité : DB > localStorage > default
  const savedTheme = localStorage.getItem('hashirama_theme') || 'emperor';

  // Charger le thème de base immédiatement
  applyTheme(savedTheme as ThemeId);

  // Si connecté, sync avec le serveur
  if (token) {
    try {
      const { preferences } = await api('/api/session/info');
      if (preferences?.theme && preferences.theme !== savedTheme) {
        applyTheme(preferences.theme);
      }
    } catch {}
  }
}
```

---

### Phase 5 : Extraction des Statues/Backgrounds

#### 5.1 Composants de statue par thème

Chaque thème peut avoir sa propre "statue" en background. Options :

**Option A : CSS pur (actuel)**
- Shapes via clip-path
- Léger mais limité visuellement

**Option B : SVG inline**
- Plus de détails possibles
- Meilleur contrôle

**Option C : Images PNG avec transparence**
- Meilleur rendu
- Charge réseau

**Recommandation** : Option A pour MVP, Option B pour v2

#### 5.2 Structure HTML commune
```html
<div id="app">
  <div class="app-background">
    <div class="bg-statue" data-theme-statue></div>
    <div class="bg-effects"></div>
    <div class="bg-vignette"></div>
  </div>

  <div class="app-content">
    <!-- Interface actuelle -->
  </div>
</div>
```

---

### Phase 6 : Animations de Transition

#### 6.1 Smooth transitions
```css
/* Transition globale */
.theme-transitioning * {
  transition: background-color 0.3s ease,
              border-color 0.3s ease,
              color 0.3s ease,
              box-shadow 0.3s ease !important;
}

/* Statue fade */
.bg-statue {
  opacity: 0;
  animation: fadeInStatue 0.6s ease forwards;
}

@keyframes fadeInStatue {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

### Phase 7 : Optimisations

#### 7.1 Performance
- **Lazy load** : Charger CSS des thèmes à la demande
- **Preconnect fonts** : Charger polices en avance
- **CSS containment** : Isoler le repaint aux zones changées

#### 7.2 Persistence
- **localStorage** : Cache client
- **Database** : Préférences serveur
- **Sync** : Reconciliation au login

#### 7.3 Fallbacks
```typescript
// Si le thème n'existe pas, fallback vers emperor
const FALLBACK_THEME: ThemeId = 'emperor';

function getValidTheme(themeId: string): ThemeId {
  const validThemes = ['obsidian', 'cyber', 'emperor', 'ghost', 'storm', 'brutal'];
  return validThemes.includes(themeId) ? themeId as ThemeId : FALLBACK_THEME;
}
```

---

## 📦 Plan d'Exécution

### Sprint 1 : Foundation (2-3h)
1. ✅ Créer structure de dossiers `styles/themes/`
2. ✅ Extraire variables CSS du thème Emperor actuel
3. ✅ Créer `base.css` avec styles communs
4. ✅ Ajouter type `ThemeId` et `preferences` au backend

### Sprint 2 : Thèmes CSS (4-6h)
1. ✅ Convertir chaque design concept en fichier CSS
2. ✅ Tester chaque thème individuellement
3. ✅ Ajuster les variables pour cohérence
4. ✅ Créer les statues/backgrounds en CSS

### Sprint 3 : Backend API (1-2h)
1. ✅ Endpoint `POST /api/preferences` (update theme)
2. ✅ Modifier response de `/api/login` (include preferences)
3. ✅ Migrations pour ajouter `preferences` aux profils existants

### Sprint 4 : Frontend UI (2-3h)
1. ✅ Component ThemeSelector dans right panel
2. ✅ Fonction `applyTheme()`
3. ✅ Event listeners pour switch
4. ✅ LocalStorage persistence

### Sprint 5 : Polish & Testing (2h)
1. ✅ Animations de transition
2. ✅ Tests sur chaque thème
3. ✅ Responsive adjustments
4. ✅ Documentation utilisateur

---

## 🎯 Résultat Attendu

### Expérience Utilisateur
1. L'utilisateur clique sur "Thème Visuel" dans le panneau de droite
2. Une grille de 6 thèmes s'affiche avec aperçu couleur + nom + icône
3. Clic sur un thème → transition fluide (300ms)
4. Le thème est sauvegardé automatiquement
5. Au prochain login, le thème persiste

### Technique
- **0 dépendances** supplémentaires
- **~15KB** de CSS additionnel par thème (lazy loaded)
- **<100ms** de temps de switch
- **100%** compatible mobile/desktop
- **Backward compatible** : thème par défaut = Emperor

---

## 🔄 Évolutions Futures (Hors Scope Initial)

- [ ] Thème auto (suit l'heure : sombre la nuit, clair le jour)
- [ ] Custom theme builder (utilisateur crée son thème)
- [ ] Import/export de thèmes
- [ ] Thèmes saisonniers (Halloween, Noël, etc.)
- [ ] Statue animée (SVG avec animations)
- [ ] Son au switch de thème (optionnel)
- [ ] Preview mode (tester sans sauvegarder)

---

## 📊 Metrics de Succès

- ✅ 6 thèmes fonctionnels et distincts
- ✅ Switch instantané (<300ms perceived)
- ✅ Persistence serveur + client
- ✅ Aucune régression visuelle
- ✅ Mobile-friendly
- ✅ Accessible (contraste WCAG AA minimum)

---

## 🚀 Prêt pour Implémentation

Ce plan est prêt à être exécuté. Estimation totale : **12-16h** de développement.

Recommandation : Commencer par Sprint 1 pour valider l'architecture avant de créer tous les thèmes.
