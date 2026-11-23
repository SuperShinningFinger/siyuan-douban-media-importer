# 项目长期记忆 — 媒体导入思源笔记

## 项目定位

思源笔记插件，标识 `siyuan-media-importer`，版本 `0.1.0`。从豆瓣详情页提取书籍、电影、电视剧／动画、音乐信息，生成感想笔记并写入思源属性视图数据库。

## 技术架构

- Vite + Svelte 4 + TypeScript，入口 `src/index.ts`，主界面 `src/components/ImportPanel.svelte`。
- 使用 Electron `<webview>` 内嵌豆瓣，通过 `webview.executeJavaScript()` 执行 `src/utils/extractor.ts` 生成的提取脚本。
- 数据库写入在 `src/utils/database.ts`，**必须用思源官方 API**（不能直接改 AV JSON 文件，内核内存不会同步）：
  1. `/api/av/searchAttributeView` 或 SQL `type='av' AND markdown LIKE '%<avId>%'` 取数据库载体块 ID；
  2. `/api/av/addAttributeViewBlocks`：`{avID, blockID:载体块, srcs:[{id:docId, isDetached:false}]}` 绑定文档为行（不要传 content，否则会新建 detached 行）；
  3. `/api/av/getAttributeViewItemIDsByBoundIDs`：`{avID, blockIDs:[docId]}` 反查行 ID（itemID）；
  4. 逐字段 `/api/av/setAttributeViewBlockAttr`：`{avID, keyID, itemID, value}`。批量接口 `batchSetAttributeViewBlockAttrs` 对 number 类型不可靠（缺少 `isNotEmpty` 时内核判空重置为 0），故改为逐条写。**number 的 value 必须带 `isNotEmpty: content!==0, format:"", formattedContent`，否则内核判为空；date 要带 `isNotEmpty/hasEndDate/isNotTime`**。内核源码 `kernel/av/value.go` 用 `!value.Number.IsNotEmpty` 判空。
- 新建文档后通过 `/api/attr/setBlockAttrs` 设置 `custom-avs`；感想模板在 `src/utils/template.ts`。

## 默认目标（siyuan_dev_temp 工作空间）

- 工作空间：`D:/Temp/Siyuan_dev_temp`
- 笔记本 ID：`20261123202020-gb8iq5m`，名称“感想”
- 数据库映射（可在插件设置面板修改）：
  - 书籍：AV `20261123202021-cjsznts`，父路径 `/豆瓣读书`
  - 电影：AV `20261123202021-qnajmhm`，父路径 `/豆瓣电影`
  - 电视剧／动画：AV `20261123202021-juohgij`，父路径 `/豆瓣电视剧／动画`
  - 音乐：AV `20261123202021-twwcz34`，父路径 `/音乐笔记`
- 封面目录：`assets/媒体封面`

## 注意事项

- 原始 `siyuan-douban` 项目已清空，备份在 `D:/Projects/siyuan-douban-2.3.1_backup_20261123_2015`。
- 两个思源实例并存：`Siyuan_Temp` 在 6806 端口，`Siyuan_dev_temp` 在 **9047** 端口。调试 dev_temp 插件必须用 9047。
- 插件产物已复制到 `D:/Temp/Siyuan_dev_temp/data/plugins/siyuan-media-importer/`；修改代码后需重新构建、复制，并在思源里重载插件才生效。
- **豆瓣封面下载**：图片 CDN（img*.doubanio.com）有防盗链——无 Referer→HTTP 418，非豆瓣来源→403，带 douban.com Referer→200。改 UA 无效，关键在 Referer。webview 内 fetch/canvas 与渲染进程 fetch 都无法自定义 Referer，必须用思源后端 `/api/network/forwardProxy` 下载。**契约（见内核 `kernel/apicontract/network.go`）：`headers` 是 `[{Header名:值}]` 对象数组，不是 `[{name,value}]`；返回 `data={url,status,contentType,body(base64),bodyEncoding,headers,elapsed}`**。`fetchImageAsDataUrl()` 已按此实现。下载到 dataUrl 后由 `patchWebviewCover()` 注入 webview 替换裂图。
- 调试注意：Vite/esbuild 构建不做类型检查，每次改完必须跑 `npx tsc --noEmit`，否则导入遗漏等运行时错误发现不了。
- 评分不入库根因：number value 缺 `isNotEmpty` 被内核判空重置为 0；文档模板显示的是原始字符串所以不一致。已补全并改逐条写。
