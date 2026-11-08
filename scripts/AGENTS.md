# scripts 说明

适用范围：`scripts/`。同时遵守根 `AGENTS.md`；发布回归见 `tests/AGENTS.md`。

- 脚本只使用 Node.js 内置模块，直接通过 `node scripts/<脚本>.mjs` 运行；源码目录不安装依赖。同步与发布共用 `CHATLUNA_V2_ROOT`，默认宿主为 `../../chatluna-v2-mirror`，目标为 `external/music-voice`。
- npm 发布参考 onebot-sandbox 的本地流程，不配置依赖私有 v2 仓库的 CI，也不注册 npm 的 `publish` 生命周期脚本，避免从打包目录发布时递归调用。
- `node scripts/publish.mjs --dry-run` 允许工作区有未提交改动，只执行同步、清理、构建、类型检查、测试、打包与 `npm publish --dry-run`；不登录、不 fetch、不创建或推送 tag。
- 正式发布使用 `node scripts/publish.mjs`，有两步验证时传 `--otp=<验证码>`。必须先提交并推送当前版本：工作区干净、非 detached HEAD、HEAD 与 `origin` 同名分支一致、`v<版本>` tag 不存在，且 `npm whoami` 成功。构建后再次检查工作区与 HEAD，防止包和 tag 对不上。
- 发布必须清空副本 `lib`、`dist` 和 `tsconfig.tsbuildinfo` 后重建；使用 `yarn pack` 改写 workspace 依赖，再从解压目录执行 `npm publish --access public`，保留市场使用的 README 元数据。包内必须有主入口、声明、客户端、README 和 LICENSE。
- `alpha`、`beta`、`rc`、`next` 预发布使用同名 npm dist-tag，不写入 `latest`；其他预发布标识直接拒绝。脚本不自动升版本，稳定版使用 package.json 中的版本。
- 只有 npm 发布成功后才给验证过的提交打 tag 并推送。若 tag 推送失败，不回滚已发布的 npm 包；修复 Git 推送即可。命令异常不回显参数中的 OTP，打包临时目录保留供核对。
