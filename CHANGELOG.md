## [1.1.7](https://github.com/kodingvibes/late-micro-chat/compare/v1.1.6...v1.1.7) (2026-07-24)


### Bug Fixes

* revert MeasuredLazyMount to prevent oversized placeholders ([9e0edb3](https://github.com/kodingvibes/late-micro-chat/commit/9e0edb3348acb413c6fc03bb2a76f1e642d9a4b6))

## [1.1.6](https://github.com/kodingvibes/late-micro-chat/compare/v1.1.5...v1.1.6) (2026-07-24)


### Bug Fixes

* measure lazy content offscreen to prevent scroll jitter ([ac66ec3](https://github.com/kodingvibes/late-micro-chat/commit/ac66ec3e56dc0012fc63030274987b59339e7584))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-07-24

### Fixed
- Restored `window.ChatEngine` compatibility handle and guarded `MutationObserver` against missing `document.body`.

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
