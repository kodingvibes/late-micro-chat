## [1.1.5](https://github.com/kodingvibes/late-micro-chat/compare/v1.1.4...v1.1.5) (2026-07-24)


### Bug Fixes

* restore window.ChatEngine compatibility handle and guard MutationObserver ([bfed6b3](https://github.com/kodingvibes/late-micro-chat/commit/bfed6b39b7b177c7715c1d006c7cafcb3c0c86b7))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-07-24

### Removed
- Dead code: `Layout`, `ChatEngine`, `lib/chat/domain/mappers`, duplicate `LinkPreview`, `useEstimatedHeight`, `useDocumentTitle`.
- Obsolete dependencies and shims: `lucide-react`, `marked`, `dompurify`, `@rollup/plugin-replace`.

### Changed
- Replaced `lucide-react` with inline SVG icons in `src/components/icons.tsx`.
- Replaced `marked` + `DOMPurify` with a minimal custom markdown parser.
- Simplified `unfurlStore` to a plain cache and moved per-URL state into `LinkPreviewList`.
- Reduced production debug instrumentation.
- Refactored `chat-client.ts` with generic update helpers.
- Simplified voice chain and removed the unused `off` preset path.
- Partial refactor of `IrcPage` into `useFloatingVideo` and `useToasts` hooks.
