# Agent Note: Music voice migration to ChatLuna v2

Status: implemented

## Problem

旧插件 0.0.10 依赖 Koishi 版 ChatLuna、LangChain StructuredTool 与 Zod，无法直接进入 Cordis 4 的工具、配置和消息生命周期。

## Decision

- 独立源码单向同步到 v2 external/music-voice。使用 @chatluna/schema、原生 Tools、可信入站 Session 和 httpFetch(ctx.http)。
- 保留网易/QQ 搜索、平台顺序、重新搜索选歌和 AI 临时切换。发送方式已[精简为两种](../simplification/2026-11-08-model-owned-audio-delivery.zh.md)，默认模型链接；音乐卡片保留，音频发送交给 ChatLuna。原 302 短链已[移除](../simplification/2026-11-08-original-audio-links.zh.md)。工具名称与描述已[交由 v2 管理](../simplification/2026-11-08-tool-metadata-ownership.zh.md)。
- 卡片选歌直发成功以 call.end() 替代旧 LangChain 静默结果；单曲卡片、候选及模型链接保留文本返回。
- 卡片发送通过 ctx.chat.send；插件不再下载或转码音频。ui-kit 发送模式字段嵌入原 SchemaForm，采用纵向字段布局，避免桌面标签被宽选项挤窄。
- 修复旧实现的部分失败互相拖累、空结果抢赢竞速、QQ 坏条目破坏整批解析。Meting 显式设置平台，模型链接并行解析，网络传播取消与卸载信号并限制响应正文大小。
- 初次迁移的语音验收促成独立沙箱的 SILK 修复：保留原始语音与内容 ID，只为浏览器附加 WAV preview。该历史验证不意味着当前插件仍然直接发送语音。

## Alternatives considered

- 保留旧 Koishi/LangChain 兼容层会绕过 v2 工具权限和生命周期，拒绝采用。
- 新建独立配置页会重复宿主保存与校验，采用原 SchemaForm 扩展。
- 初次语音验收没有为适配沙箱而改变 OneBot 生产格式，而是在用户授权后修复沙箱。

## Consequences

- 外部接口不受插件控制，搜索和链接解析成功不保证后续音频一定可发送。初次迁移记录中的 CDN 下载失败属于已移除的插件直发路径，当前发送限制由宿主与适配器负责。
- 候选不做缓存，保留二次搜索语义，序号可能随平台结果变化。
- tests 覆盖原生工具、配置、解析、HTTP、生命周期和真实 UI 控件；初次隔离 OneBot/SILK 矩阵及浏览器证据保留为历史验收记录，当前模式及默认值以新回归为准。
