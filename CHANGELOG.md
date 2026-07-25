## [1.3.1](https://github.com/kodingvibes/late-micro-chat/compare/v1.3.0...v1.3.1) (2026-07-25)


### Bug Fixes

* **chat:** read user from window.LateSession instead of GET /api/chat/me ([3214aad](https://github.com/kodingvibes/late-micro-chat/commit/3214aadbebcd463dbafa6f209c9a190e6eb01bfa))

# [1.3.0](https://github.com/kodingvibes/late-micro-chat/compare/v1.2.1...v1.3.0) (2026-07-25)


### Features

* **ui:** drop join/leave UI; every user is in every channel ([4789ac2](https://github.com/kodingvibes/late-micro-chat/commit/4789ac26c424d4f9d7ae9d326e9501ea4e94fab4))

## [1.2.1](https://github.com/kodingvibes/late-micro-chat/compare/v1.2.0...v1.2.1) (2026-07-25)


### Bug Fixes

* render chat window in chronological order ([8952ce4](https://github.com/kodingvibes/late-micro-chat/commit/8952ce4cbf1b10b9c15a7a2312429d6d0998616f))

# [1.2.0](https://github.com/kodingvibes/late-micro-chat/compare/v1.1.8...v1.2.0) (2026-07-25)


### Features

* bottom-anchored inverted chat scroll with state machine ([bef912e](https://github.com/kodingvibes/late-micro-chat/commit/bef912e91e43814548f172c5a392bfde04f88109))

## [1.1.8](https://github.com/kodingvibes/late-micro-chat/compare/v1.1.7...v1.1.8) (2026-07-24)


### Bug Fixes

* stabilize scroll against lazy content resize with mutation anchor ([5d1481a](https://github.com/kodingvibes/late-micro-chat/commit/5d1481abc940f57aac0861a1f2226d9695a65c13))

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
