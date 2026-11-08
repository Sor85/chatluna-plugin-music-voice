# Agent Note: Tool metadata ownership

Status: implemented

## Problem

迁移时保留的 toolName 与 toolDescription 重复提供了 v2 原生工具管理的职责。

## Decision

删除 Config 类型、Schema 和执行路径中的两个配置项。插件通过固定 music_voice 标识和内置说明注册工具，元数据管理交由 v2，不添加插件侧元数据迁移机制。

## Alternatives considered

只隐藏配置但继续读取旧值会保留两套元数据来源，因此不采用。

## Consequences

插件设置页不显示这两个字段。测试检查 Schema 不暴露字段，以及原生工具按固定标识和内置说明注册；不维护未发布配置的兼容测试。
