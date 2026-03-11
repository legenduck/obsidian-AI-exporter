# Obsidian Chat Sync

[日本語](README.ja.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | **Español** | [Français](README.fr.md) | [Deutsch](README.de.md)

Sincronización automática de conversaciones de IA desde Google Gemini, Claude AI, ChatGPT y Perplexity a tu bóveda de Obsidian.

> Based on [sho7650/obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Características

- **Sincronización automática**: Sincroniza conversaciones automáticamente a medida que aparecen nuevos mensajes mediante MutationObserver
- **Indicador de estado**: Punto con código de colores que muestra el estado de sincronización (inactivo / observando / sincronizando / sincronizado / error / excluido)
- **Multiplataforma**: Google Gemini, Claude AI, ChatGPT y Perplexity
- **Exportación de árbol JSON**: Guarda las ramas de conversación como árbol JSON con markdown optimizado para LLM
- **Exclusión de sesión**: Mantén presionado (2s) el indicador para excluir una sesión y eliminar sus archivos
- **Deep Research**: Exporta informes de Gemini Deep Research y Claude Extended Thinking
- **Soporte de Artifacts**: Extrae Claude Artifacts con citas en línea y fuentes
- **Contenido de herramientas**: Incluye opcionalmente los resultados de búsqueda web de Claude como callouts plegables
- **Modo de adición**: Solo se agregan mensajes nuevos a las notas existentes
- **Plantillas de ruta**: Usa `{platform}`, `{year}`, `{month}`, `{weekday}`, `{title}`, `{sessionId}` en la ruta de la bóveda
- **Múltiples salidas**: Guarda en Obsidian, descarga como archivo o copia al portapapeles
- **Callouts de Obsidian**: Formateados con callouts `[!QUESTION]` y `[!NOTE]` + frontmatter YAML

## Requisitos

- Google Chrome 88+ (o navegador basado en Chromium)
- [Obsidian](https://obsidian.md/)
- Plugin [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)

## Instalación

1. Clona este repositorio:
   ```bash
   git clone https://github.com/legenduck/obsidian-chat-sync.git
   cd obsidian-chat-sync
   ```

2. Instala las dependencias y compila:
   ```bash
   npm install
   npm run build
   ```

3. Carga en Chrome:
   - Navega a `chrome://extensions`
   - Activa el "Modo de desarrollador"
   - Haz clic en "Cargar descomprimida"
   - Selecciona la carpeta `dist/`

## Configuración

1. Instala el plugin [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) en Obsidian
2. Activa el plugin y copia tu clave API
3. Haz clic en el icono de la extensión en Chrome e introduce:
   - **Clave API**: Tu clave de Local REST API
   - **Puerto**: El predeterminado es `27123`
   - **Ruta de la bóveda**: Ruta de la carpeta en tu bóveda (ej., `AI/{platform}`)

## Uso

### Básico

1. Abre una conversación en cualquier plataforma compatible
2. Un pequeño punto de estado aparece en la esquina inferior derecha
3. Haz clic en el punto para sincronizar la conversación con Obsidian

### Sincronización automática

Cuando está habilitada en la configuración, las conversaciones se sincronizan automáticamente a medida que aparecen nuevos mensajes. No es necesario hacer clic manualmente.

### Exclusión de sesión

Mantén presionado el punto de estado durante 2 segundos para excluir una sesión:
- Parpadeo naranja mientras se eliminan archivos (md, árbol JSON, markdown LLM)
- Punto amarillo = excluido
- Haz clic en el punto amarillo para reanudar la sincronización

### Deep Research / Extended Thinking

Funciona con paneles de Gemini Deep Research y Claude Artifacts con citas en línea.

## Formato de salida

Las conversaciones se guardan como Markdown con frontmatter YAML y callouts de Obsidian:

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

## Arquitectura

```
Content Script (gemini.google.com, claude.ai, chatgpt.com, www.perplexity.ai)
    ↓ extrae conversación / Deep Research / Artifacts
Background Service Worker
    ↓ envía a Obsidian
Obsidian Local REST API (127.0.0.1:27123)
```

| Componente | Descripción |
|-----------|-------------|
| `src/content/` | Content script para extracción del DOM e interfaz |
| `src/content/auto-sync.ts` | Sincronización automática basada en MutationObserver |
| `src/content/extractors/` | Extractores específicos por plataforma (Gemini, Claude, ChatGPT, Perplexity) |
| `src/background/` | Service worker para comunicación con la API |
| `src/popup/` | Interfaz de configuración |
| `src/lib/tree-builder.ts` | Constructor de árbol de conversación (JSON que preserva ramas) |
| `src/lib/tree-to-markdown.ts` | Árbol a markdown indentado optimizado para LLM |

## Desarrollo

```bash
npm run dev          # Servidor de desarrollo con HMR
npm run build        # Compilación de producción
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Ejecutar pruebas
npm run test:coverage # Pruebas con cobertura
```

## Seguridad y privacidad

- La clave API se almacena localmente en `chrome.storage.local` (no se sincroniza)
- Solo se comunica con tu instancia local de Obsidian (127.0.0.1)
- Validación de entrada, protección contra path traversal, verificación del remitente
- Sin recopilación de datos ni transmisión externa

## Licencia

MIT — ver [LICENSE](LICENSE)

## Agradecimientos

Este proyecto está basado en [obsidian-AI-exporter](https://github.com/sho7650/obsidian-AI-exporter) por [sho7650](https://github.com/sho7650).
