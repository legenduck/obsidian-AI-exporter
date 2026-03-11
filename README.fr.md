# Obsidian Chat Sync

[日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Español](README.es.md) | **Français** | [Deutsch](README.de.md)

Synchronisation automatique des conversations IA depuis Google Gemini, Claude AI, ChatGPT et Perplexity vers votre coffre Obsidian.

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Fonctionnalités

- **Synchronisation automatique** : Synchronise automatiquement les conversations lorsque de nouveaux messages apparaissent via MutationObserver
- **Indicateur d'état** : Point coloré indiquant l'état de synchronisation (inactif / surveillance / synchronisation / synchronisé / erreur / exclu)
- **Multiplateforme** : Google Gemini, Claude AI, ChatGPT et Perplexity
- **Export arbre JSON** : Sauvegarde les branches de conversation en arbre JSON avec markdown optimisé pour les LLM
- **Exclusion de session** : Appui long (2s) sur l'indicateur pour exclure une session et supprimer ses fichiers
- **Deep Research** : Exporte les rapports Gemini Deep Research et Claude Extended Thinking
- **Support des Artifacts** : Extrait les Claude Artifacts avec citations en ligne et sources
- **Contenu des outils** : Inclut optionnellement les résultats de recherche web de Claude sous forme de callouts repliables
- **Mode ajout** : Seuls les nouveaux messages sont ajoutés aux notes existantes
- **Modèles de chemin** : Utilisez `{platform}`, `{year}`, `{month}`, `{weekday}`, `{title}`, `{sessionId}` dans le chemin du coffre
- **Sorties multiples** : Sauvegarde dans Obsidian, téléchargement en fichier ou copie dans le presse-papiers
- **Callouts Obsidian** : Formatés avec les callouts `[!QUESTION]` et `[!NOTE]` + frontmatter YAML

## Prérequis

- Google Chrome 88+ (ou navigateur basé sur Chromium)
- [Obsidian](https://obsidian.md/)
- Plugin [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)

## Installation

1. Clonez ce dépôt :
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. Installez les dépendances et compilez :
   ```bash
   npm install
   npm run build
   ```

3. Chargez dans Chrome :
   - Accédez à `chrome://extensions`
   - Activez le « Mode développeur »
   - Cliquez sur « Charger l'extension non empaquetée »
   - Sélectionnez le dossier `dist/`

## Configuration

1. Installez le plugin [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) dans Obsidian
2. Activez le plugin et copiez votre clé API
3. Cliquez sur l'icône de l'extension dans Chrome et saisissez :
   - **Clé API** : Votre clé Local REST API
   - **Port** : Par défaut `27123`
   - **Chemin du coffre** : Chemin du dossier dans votre coffre (ex., `AI/{platform}`)

## Utilisation

### Basique

1. Ouvrez une conversation sur n'importe quelle plateforme prise en charge
2. Un petit point d'état apparaît dans le coin inférieur droit
3. Cliquez sur le point pour synchroniser la conversation avec Obsidian

### Synchronisation automatique

Lorsqu'elle est activée dans les paramètres, les conversations se synchronisent automatiquement à mesure que de nouveaux messages apparaissent. Aucun clic manuel nécessaire.

### Exclusion de session

Maintenez le point d'état enfoncé pendant 2 secondes pour exclure une session :
- Clignotement orange pendant la suppression des fichiers (md, arbre JSON, markdown LLM)
- Point jaune = exclu
- Cliquez sur le point jaune pour reprendre la synchronisation

### Deep Research / Extended Thinking

Fonctionne avec les panneaux Gemini Deep Research et les Claude Artifacts avec citations en ligne.

## Format de sortie

Les conversations sont sauvegardées en Markdown avec frontmatter YAML et callouts Obsidian :

```markdown
---
id: gemini_abc123
title: "How to implement authentication"
source: gemini
url: https://gemini.google.com/app/abc123
created: 2025-01-10T12:00:00Z
tags:
  - ai-conversation
  - gemini
message_count: 4
---

> [!QUESTION] User
> How do I implement JWT authentication?

> [!NOTE] Gemini
> To implement JWT authentication, you'll need to...
```

## Architecture

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ extrait la conversation / Deep Research / Artifacts
Background Service Worker
    ↓ envoie à Obsidian
Obsidian Local REST API (127.0.0.1:27123)
```

| Composant | Description |
|-----------|-------------|
| `src/content/` | Content script pour l'extraction du DOM et l'interface |
| `src/content/auto-sync.ts` | Synchronisation automatique basée sur MutationObserver |
| `src/content/extractors/` | Extracteurs spécifiques par plateforme (Gemini, Claude, ChatGPT, Perplexity) |
| `src/background/` | Service worker pour la communication avec l'API |
| `src/popup/` | Interface de paramétrage |
| `src/lib/tree-builder.ts` | Constructeur d'arbre de conversation (JSON préservant les branches) |
| `src/lib/tree-to-markdown.ts` | Arbre vers markdown indenté optimisé pour les LLM |

## Développement

```bash
npm run dev          # Serveur de développement avec HMR
npm run build        # Build de production
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Lancer les tests
npm run test:coverage # Tests avec couverture
```

## Sécurité et confidentialité

- La clé API est stockée localement dans `chrome.storage.local` (non synchronisée)
- Communique uniquement avec votre instance locale d'Obsidian (127.0.0.1)
- Validation des entrées, protection contre le path traversal, vérification de l'expéditeur
- Aucune collecte de données ni transmission externe

## Licence

MIT — voir [LICENSE](LICENSE)

## Remerciements

Ce projet est basé sur [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter) par [sho7650](https://github.com/sho7650).
