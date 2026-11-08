# Agent Note: Local npm publishing workflow

Status: implemented

## Problem

插件已建立公开 Git 仓库，但构建依赖仍来自私有 v2 workspace，需要与 onebot-sandbox 一致的本地 npm 发布入口。

## Decision

- 新增 `scripts/publish.mjs`，以 Node.js 内置模块实现同步、旧产物清理、宿主构建、类型检查、测试、Yarn 打包和解压目录发布。发布版本来自 package.json，不自动升级。
- 正式发布要求干净工作区、HEAD 与 origin 同名分支一致、无同版本 tag、npm 已登录；打包后再次确认工作区与提交。npm 成功后才标记已验证提交并推送 tag。
- 演练使用 `--dry-run`，允许未提交改动，不进行 Git 远端操作或 npm 登录检查。仍完整验证包内容，最终只执行 npm 的 dry-run。包内检查入口、声明、客户端、README 与 LICENSE。
- 拒绝错误参数和未知预发布标识；alpha/beta/rc/next 使用同名 dist-tag。支持 OTP，但子进程失败时不回显含验证码的命令参数。
- 不添加 npm publish 生命周期脚本，避免从解压目录发布时递归触发发布流程。命令与约束写入 scripts/AGENTS.md，并登记到根说明清单。

## Alternatives considered

- GitHub Actions 无法直接取得当前私有 v2 workspace，不作为现阶段发布路径。
- 直接发布 tgz 无法满足市场 README 元数据要求；npm pack 也不能替代 Yarn 对 workspace 依赖的改写。

## Consequences

- 测试用独立临时源目录和宿主，实际执行发布及同步脚本；外部发布命令由本地可执行夹具接管，不触碰 npm、Git 远端或用户工作区。
- 演练验证真实构建与包内容，不代表 npm 已发布。若 npm 成功但 tag 推送失败，只需补推 tag，不回滚 npm 包。
