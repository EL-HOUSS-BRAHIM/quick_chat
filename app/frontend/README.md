# Quick Chat Frontend (2025+ Modular Architecture)

This directory contains the reorganized, modern ES6 module-based frontend for Quick Chat. All new features, enhancements, and refactors should be implemented here, following the structure below:

- `components/` — UI components (ChatWindow, MessageList, etc.)
- `services/` — API clients, WebSocket managers, etc.
- `state/` — Centralized state management
- `utils/` — Utility/helper functions
- `i18n/` — Internationalization files
- `assets/` — Static assets (images, fonts, etc.)
- `tests/` — Unit and integration tests

## Migration Plan
- New code and refactors go here.
- Legacy code is preserved in `/backups/js_deprecated_*`.
- Gradually migrate stable modules from `assets/js/` to this structure.
- Update build system to use this as the main entry point.

See `TODO.md` for roadmap and priorities.
