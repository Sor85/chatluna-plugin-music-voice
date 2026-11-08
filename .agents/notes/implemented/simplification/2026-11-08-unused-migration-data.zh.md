# Agent Note: Remove unused migration data and result markers

Status: implemented

## Problem

迁移后仍保留无消费者的歌曲时长与候选结果数组，以及宿主不读取的 `replyEmitted` 结果对象。时长校验还会丢弃缺少无关元数据的有效歌曲。部分导出、开发依赖和网页分支也没有实际用途。

## Decision

- `Song` 仅保留当前搜索展示、直链解析和卡片发送需要的字段；网易云 `duration` 与 QQ `interval` 不再解析、校验或换算。候选结果不附带原始 `songs` 数组。
- 内部结束意图改名为 `MusicResult.endTurn`，由工具层调用原生 `call.end()`。所有工具调用统一返回文本，不再输出自定义 `replyEmitted` 对象；单曲卡片直发仍不结束循环。
- 网页兜底仅服务 QQ，使用 `qqSongPageUrl` 并删除不可达的网易云网页分支；保留 QQ mid/数字 id 回退，以及服务端数据边界的合法格式处理。
- 删除未直接使用且不承担 peer 补齐职责的 `@chatluna/message`、`@chatluna/satori` 开发依赖，移除无跨文件消费者的导出与单次使用的类型别名。测试宿主的 Chat 类型扩展使用 type-only 导入。
- 调试设置仅说明实际输出的请求命中信息，不再承诺不存在的取消日志。

## Alternatives considered

- 保留无人读取的数据和结果标记没有当前消费者，并增加理解成本；不为未来可能的用途保留。
- 删除外部服务格式容错、QQ 网页兜底或旧配置拒绝测试会改变当前功能边界，不属于清理旧版兼容代码。

## Consequences

- 搜索不再因缺失或异常的时长元数据丢弃可用歌曲；新增解析回归，真实 HTTP 与播放夹具也不再携带时长。
- 原生工具回归同时验证 `ends` 与文本结果，候选回归验证没有多余数组。配置、两种发送模式、原始链接和取消行为不变。
- 历史 Agent Notes 与旧配置拒绝用例保留为决策记录和守卫，不是运行时兼容层。
