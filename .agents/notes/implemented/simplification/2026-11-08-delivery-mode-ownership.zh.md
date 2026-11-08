# Agent Note: Delivery mode ownership

Status: implemented

## Problem

插件的下载直发语音、直接发送音频链接和远程文件模式重复了 ChatLuna 的发送能力。

## Decision

- 只保留模型链接（默认）与音乐卡片，音频发送由 [ChatLuna 统一处理](2026-11-08-model-owned-audio-delivery.zh.md)。
- 插件尚未发布，不保留旧模式别名、隐藏转换分支或客户端回显映射；配置和工具参数直接拒绝已移除模式。
- 客户端直接渲染当前选项和保存值，不自动修正未知值。README 仅说明用户功能与使用方式，开发过程和兼容策略不进入用户文档。

## Alternatives considered

只隐藏选项仍保留旧执行路径；为未发布版本维护兼容层则增加无须承担的维护成本，因此都不采用。

## Consequences

回归覆盖两个模式、无隐藏分支、未知模式校验失败、默认值、恢复默认与语言切换。模型链接不直接发送，不设置 ends；ChatLuna 后续发送不属于插件内部模式。
