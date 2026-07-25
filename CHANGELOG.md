## [1.8.1](https://github.com/kodingvibes/late-micro-chat/compare/v1.8.0...v1.8.1) (2026-07-25)


### Bug Fixes

* **theme:** chat irc.css blockquote/mentions follow accent, AudioWaveform reads accent-ring ([73d4bf4](https://github.com/kodingvibes/late-micro-chat/commit/73d4bf4b7d21045376984cdfdbf2f17527bff90d))

# [1.8.0](https://github.com/kodingvibes/late-micro-chat/compare/v1.7.5...v1.8.0) (2026-07-25)


### Features

* **theme:** consume shared @late/theme package ([9eba5e1](https://github.com/kodingvibes/late-micro-chat/commit/9eba5e1cd1cfb8a8ab32679913861fc87f9eca4c))

## [1.7.5](https://github.com/kodingvibes/late-micro-chat/compare/v1.7.4...v1.7.5) (2026-07-25)


### Bug Fixes

* **chat:** make the message area background strongly contrasting ([4522fa1](https://github.com/kodingvibes/late-micro-chat/commit/4522fa1f0e2424573f4546350cf154ee286c938b)), closes [#020617](https://github.com/kodingvibes/late-micro-chat/issues/020617) [#ffffff](https://github.com/kodingvibes/late-micro-chat/issues/ffffff)

## [1.7.4](https://github.com/kodingvibes/late-micro-chat/compare/v1.7.3...v1.7.4) (2026-07-25)


### Bug Fixes

* **chat:** make modals and side drawer translucent so the tinted body shows through ([e73f1c2](https://github.com/kodingvibes/late-micro-chat/commit/e73f1c23e35936e8e21136b379768ad763b1a857))

## [1.7.3](https://github.com/kodingvibes/late-micro-chat/compare/v1.7.2...v1.7.3) (2026-07-25)


### Bug Fixes

* **chat:** let the shell's tinted body show through the chat page ([f0a9420](https://github.com/kodingvibes/late-micro-chat/commit/f0a9420b2fd5576d61a2294fb3651d56d14a05a3)), closes [#0b1120](https://github.com/kodingvibes/late-micro-chat/issues/0b1120)

## [1.7.2](https://github.com/kodingvibes/late-micro-chat/compare/v1.7.1...v1.7.2) (2026-07-25)


### Bug Fixes

* **chat:** drop the in-Topbar user count, keep the Users button ([22ead74](https://github.com/kodingvibes/late-micro-chat/commit/22ead74454ca57a26f05ba697e972a971d3f972f))

## [1.7.1](https://github.com/kodingvibes/late-micro-chat/compare/v1.7.0...v1.7.1) (2026-07-25)


### Bug Fixes

* **chat:** ship --accent-glow-a / -b vars + .bg-accent-glow utility ([5ca6fb9](https://github.com/kodingvibes/late-micro-chat/commit/5ca6fb98d5d40a06af3743a50e656ef315180997))

# [1.7.0](https://github.com/kodingvibes/late-micro-chat/compare/v1.6.0...v1.7.0) (2026-07-25)


### Features

* **chat:** mirror the shell's light/dark mode and accent ([c88aa18](https://github.com/kodingvibes/late-micro-chat/commit/c88aa186c78e07d5bcb98a799fc48e181c214ffe))

# [1.6.0](https://github.com/kodingvibes/late-micro-chat/compare/v1.5.0...v1.6.0) (2026-07-25)


### Features

* **chat:** standardise menu animations at 1000ms ([07a4b91](https://github.com/kodingvibes/late-micro-chat/commit/07a4b913b265e946ddde990671d3e14c3b8c87e9))

# [1.5.0](https://github.com/kodingvibes/late-micro-chat/compare/v1.4.1...v1.5.0) (2026-07-25)


### Features

* **chat:** lean topbar, edit topic modal, shell integration ([1c9589f](https://github.com/kodingvibes/late-micro-chat/commit/1c9589f25e8dbf3720e25d818e775f04201b484d))

## [1.4.1](https://github.com/kodingvibes/late-micro-chat/compare/v1.4.0...v1.4.1) (2026-07-25)


### Bug Fixes

* **chat:** gate message context menu to the bubble, not the row ([86c6fe1](https://github.com/kodingvibes/late-micro-chat/commit/86c6fe19b2250aa7262ede0744270167557c406f))

# [1.4.0](https://github.com/kodingvibes/late-micro-chat/compare/v1.3.4...v1.4.0) (2026-07-25)


### Features

* **chat:** pre-position context menus offscreen + add entry animation ([6f7c2a5](https://github.com/kodingvibes/late-micro-chat/commit/6f7c2a5199028a0db46f4e5a954f83ead3bbbbef))

## [1.3.4](https://github.com/kodingvibes/late-micro-chat/compare/v1.3.3...v1.3.4) (2026-07-25)


### Bug Fixes

* **chat:** drop channel from local state on 'channel_deleted' WS event ([ef702e5](https://github.com/kodingvibes/late-micro-chat/commit/ef702e538c53e31f108b7e557c700279f570d38e))

## [1.3.3](https://github.com/kodingvibes/late-micro-chat/compare/v1.3.2...v1.3.3) (2026-07-25)


### Bug Fixes

* **chat:** add mobile long-press to channel and user context menus ([80e2caf](https://github.com/kodingvibes/late-micro-chat/commit/80e2cafa676d665dbd005a97a4d49d2f30b17202))

## [1.3.2](https://github.com/kodingvibes/late-micro-chat/compare/v1.3.1...v1.3.2) (2026-07-25)


### Bug Fixes

* **chat:** place top virtual gap at the top of the window slice ([9d66e63](https://github.com/kodingvibes/late-micro-chat/commit/9d66e6395b912b1042ab2ebf13c2d66c804e2819))

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
