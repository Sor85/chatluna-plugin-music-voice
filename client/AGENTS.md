# client 说明

适用范围：`client/`。同时遵守根 `AGENTS.md`；配置契约见 `src/AGENTS.md`，测试见 `tests/AGENTS.md`。

- 只为 `music-voice:send-mode` 注册 union 渲染器，直接嵌入原插件设置页；不注册通用 union/radio 扩展，不添加独立保存接口。可选项限返回模型链接（默认）、音乐卡片两种，不映射旧值。
- 复用 `@chatluna/ui-kit` 的 Field/RadioGroup 与 `SchemaForm.extensionProps`；所有修改通过 onChange 交给宿主，保留默认值、撤销、JSON 编辑和验证。直接渲染两种模式和已保存值，不保留隐藏转换分支或旧值回显逻辑。
- 根容器显式设置基准字号和行高；不覆盖宿主滚动条、模态行为或鼠标指针。布局避免固定宽度。
- 文案放 `locales/zh.yml` 与 `locales/en.yml`，通过宿主 locale 注册和 useTranslate 使用。文案保持陈述式，模式说明不能删减仍支持功能的限制与信息；模型链接说明使用原始音源地址，不再提供本地短链。
- client 注册由 ctx.effect 释放，服务端可选注入 chatluna_webui。宿主流水线构建 `dist/client.js`，不自行打包 React 或平台 vendor。
