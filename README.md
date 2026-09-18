# Live2D 模型查看器

在浏览器里查看 **Live2D（Cubism）模型**的纯前端工具。**不打包任何模型**——你把本地的模型文件夹拖进来，它在你的浏览器里渲染。

基于 Live2D 官方 [Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/) **5-r.5**。

## 为什么是「上传式」

Live2D 官方样例模型受 **Free Material License** 约束（部分角色另有个别条款），第三方皮套（VTuber 的模型）绝大多数由作者声明**禁止再分发**。把模型文件放进仓库再公开部署，等于向所有人再分发。

所以本项目**仓库与构建产物里一个模型文件都没有**（`dist/` 仅 ~576 KB）：模型数据全程留在你的浏览器内存中，用 `URL.createObjectURL` 挂成虚拟文件系统喂给官方渲染管线。

## 用法

1. 打开页面（GitHub Pages）。
2. 点「**选择模型文件夹**」，选中模型目录（该目录需含 `.model3.json`）。
   - 不支持文件夹选择的浏览器可点「选择文件（多选）」，把 `.model3.json` / `.moc3` / 贴图等**一起**选中。
   - 也可以直接把文件夹拖进左侧面板。
3. 模型即刻渲染。拖拽可动头部、点击可触发动作/表情。

## 支持的模型

- Cubism 3 / 4 / **5** 模型（`.moc3` 版本 3/4/5）。
- 需要模型目录含：`.model3.json`（入口）、`.moc3`（几何）、贴图（`texture_*.png`）。
- 可选：`physics3.json`（物理摆动）、`pose3.json`、`cdi3.json`、`*.exp3.json`（表情）、`*.motion3.json`（动作）、`*.userdata3.json`。
- 缺失可选文件不影响渲染，面板会列出已识别的文件以便排查。

## 本地开发

```sh
npm install
npm run start        # 开发服务器
npm run build:prod   # 构建到 dist/
npm run serve        # 预览构建产物
```

## 许可与致谢

- 渲染引擎：[Live2D Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/) 5-r.5，其 Framework 部分按 [Live2D Open Software License](https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html) 提供。
- `Core/live2dcubismcore.min.js` 属 **Live2D Proprietary Software License** 下的可再分发文件（见 `Core/RedistributableFiles.txt`）。
- 本仓库**不包含** Live2D 的任何样例模型（Sample Material）数据。若你想自行用官方样例模型测试，请到官方 SDK 获取并遵守 [Terms of Use for Live2D Cubism Sample Data](https://www.live2d.com/eula/live2d-sample-model-terms_en.html)（使用官方原创角色需附版权声明）。
- 你上传的模型版权归其作者所有，本工具不上传、不存储、不外发任何模型数据。
