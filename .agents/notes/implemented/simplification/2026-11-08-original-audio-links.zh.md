# Agent Note: Original audio links

Status: implemented

## Problem

本地 302 短链会替换工具返回的原始音频地址，使模型无法直接提供原始地址，并增加服务器可达性和映射生命周期的限制。

## Decision

删除短链配置、路由、映射、常量和 MusicPlayer 短链回调。候选与单曲结果直接使用 MusicClient.resolve 的返回值，不改写签名参数或增加本地重定向。插件不注入 server，开发依赖仅用于生命周期测试。界面和 README 只描述原始音源链接。

## Alternatives considered

隐藏设置仍保留改写路径，同时提供短链与原链接会保留不必要的路由和映射，因此彻底移除该功能。

## Consequences

模型收到原始音源 URL，后续发送交给 ChatLuna，不改变外部音源自身的重定向行为。测试验证无路由注册、URL 参数原样返回、无直接发送以及模型循环继续。不维护未发布版本的旧配置兼容契约。
