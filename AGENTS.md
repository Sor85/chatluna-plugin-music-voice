# AGENTS.md — chatluna-plugin-music-voice

ChatLuna v2 音乐搜索与发送插件。独立源码目录是唯一编辑入口，宿主 `external/music-voice` 是单向同步的构建/运行副本。

## 开发与验证

- `@chatluna/*` 依赖来自 v2 workspace；源码目录不安装依赖、不生成锁文件。同步使用 `node scripts/sync-to-v2.mjs --once`，不加 `--once` 持续监听；宿主默认 `../../chatluna-v2-mirror`，可用 `CHATLUNA_V2_ROOT` 覆盖。
- 首次同步或依赖变化后，在宿主执行 `yarn install`；构建执行 `yarn yakumo build music-voice`。在宿主 `external/music-voice` 执行 `yarn typecheck` 和 `yarn test`。
- 新增 Tailwind 类后完整停止并重启宿主 launcher/worker，再进行浏览器验证。源码不得直接写入运行副本。
- 不覆盖用户配置、数据和已有工作区变更；测试使用独立沙箱空间或临时宿主。测试凭据只通过环境变量传入，不写源码、报告或日志。
- 不自行创建分支、提交或发布。协议 MIT。

## 通用约定

- 使用 Cordis 4 生命周期、`@chatluna/schema`、v2 原生工具和 Satori 消息，不引入 Koishi v1 插件依赖、LangChain 或 Zod。
- 插件尚未公开发布，不为已移除功能保留旧配置转换、别名或客户端回显兼容层；不支持的模式交由 Schema 拒绝。
- 配置通过 `Config` 进入 `apply`；资源注册绑定当前 fiber，网络请求同时响应调用取消和卸载取消。
- README 面向插件用户，只说明功能、使用方法、配置和实际限制；不写未发布阶段的旧配置、兼容策略、删除记录或迁移过程，这些内容放在 Agent Notes。
- 迁移决策见 `.agents/notes/implemented/feature/2026-11-08-music-voice-v2.{zh,en}.md`。

## 子目录说明

- `src/AGENTS.md`：配置、搜索/选歌、消息发送与原始音频链接边界。
- `client/AGENTS.md`：宿主 SchemaForm 扩展、ui-kit 与语言文案。
- `tests/AGENTS.md`：回归测试、真实 HTTP 与沙箱验收要求。
