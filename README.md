# Live2D 模型查看器

在浏览器里查看 **Live2D（Cubism）模型**的纯前端工具。内置 7 个 Live2D 官方样例模型可直接看，也可以把**你自己**的模型文件夹拖进来渲染。

基于 Live2D 官方 [Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/) **5-r.5**。

## 两种用法

**内置模型（打开即看）**：页面启动时自动加载官方样例模型，点「**切换内置模型**」在 7 个之间轮换。

**自己的模型（上传渲染）**：
1. 点「**选择模型文件夹**」，选中模型目录（该目录需含 `.model3.json`）。
   - 不支持文件夹选择的浏览器可点「选择文件（多选）」，把 `.model3.json` / `.moc3` / 贴图等**一起**选中。
   - 也可以直接把文件夹拖进左侧面板。
2. 模型即刻渲染。拖拽可动头部、点击可触发动作/表情。

## 内置了哪 7 个（以及为什么只有 7 个）

Haru · Hiyori · Mao · Mark · Rice · Ren · Wanko

这些是 **Live2D オリジナルキャラクター**，在 Live2D 原创角色许可下，一般用户可営利/非営利使用、改変、Distribute。**没有内置 Jin Natori**：它属「協力キャラクター」，一般用户仅限非営利，且改変・配布受限。

## 为什么模型不放进仓库

Free Material License Agreement **§4.1.1 禁止再配布（No Redistribution）**，且 §1.10 把「把 Material 的副本放进可通过互联网访问的服务器」明确算作再配布。把官方样例模型提交进本仓库并由 GitHub Pages 对外提供，正落在这一条上。

所以本项目的做法是：**仓库与构建产物里一个模型文件都没有**（`dist/` 仅约 576 KB），内置模型改为**从 Live2D 官方仓库经 CDN 直接读取**（`raw.githubusercontent.com/Live2D/CubismWebSamples`，带 `access-control-allow-origin: *`）。**副本始终由官方源提供，本仓库不代发。**

第三方皮套（VTuber 的模型）绝大多数由作者声明禁止再分发，因此只走上传路径——数据全程留在你的浏览器内存里。

> ⚠️ 内置模型需要联网才能加载（文件来自官方 CDN）。上传自己的模型则不需要联网。

## 本地开发

```sh
npm install
npm run start        # 开发服务器
npm run build:prod   # 构建到 dist/
npm run serve        # 预览构建产物
```

## 许可与致谢

- 渲染引擎：[Live2D Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/) 5-r.5，Framework 部分按 [Live2D Open Software License](https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html) 提供。
- `Core/live2dcubismcore.min.js` 属 **Live2D Proprietary Software License** 下的可再分发文件（见 `Core/RedistributableFiles.txt`）。
- 内置的 Live2D 原创角色依 [Free Material License Agreement](https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html) 与 [Live2D Cubism Sample Data 使用条款](https://www.live2d.com/eula/live2d-sample-model-terms_en.html) 使用，版权归 Live2D Inc.；按 §2.1.5 要求已在界面上标注：

  > This content uses sample data owned and copyrighted by Live2D Inc. The sample data are utilized in accordance with terms and conditions set by Live2D Inc. This content itself is created at the author's sole discretion.

- 本仓库**不包含**任何 Live2D 样例模型（Sample Material）文件。
- 你上传的模型版权归其作者所有，本工具不上传、不存储、不外发任何模型数据。
