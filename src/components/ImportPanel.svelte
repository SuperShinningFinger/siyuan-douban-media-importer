<script lang="ts">
    import { onMount } from "svelte";
    import { showMessage } from "siyuan";
    import {
        DEFAULT_SETTINGS,
        DOUBAN_HOME,
        MEDIA_LABELS,
        type MediaInfo,
        type MediaSettings,
        type MediaType,
    } from "../types";
    import { buildExtractor } from "../utils/extractor";
    import {
        fetchImageAsDataUrl,
        listAttributeViews,
        listNotebooks,
        toArray,
        type AttributeViewOption,
        type NotebookOption,
    } from "../utils/siyuan";

    export let plugin: any;

    let type: MediaType = "book";
    let settings: MediaSettings = DEFAULT_SETTINGS;
    let webview: any = null;
    let eventsAttached = false;
    let currentUrl: string = DOUBAN_HOME.book;
    let showBrowser = false;
    let info: MediaInfo | null = null;
    let status = "";
    let busy = false;
    let showSettings = false;
    let notebooks: NotebookOption[] = [];
    let avList: AttributeViewOption[] = [];

    // 数据库按当前笔记本过滤：hPath 第一段就是笔记本名；列表未加载时先显示全部
    $: currentNotebookName = notebooks.find((n) => n.id === settings.notebookId)?.name || "";
    $: availableAvList = currentNotebookName
        ? avList.filter((av) => av.hPath.split("/").filter(Boolean)[0] === currentNotebookName)
        : avList;

    const mediaTypes: MediaType[] = ["book", "movie", "tv", "music"];
    // 用 Edge UA（实测 Edge 能正常显示豆瓣封面），减少豆瓣对嵌入式浏览器的拦截
    const browserUA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";

    onMount(async () => {
        settings = await plugin.getSettings();
        currentUrl = DOUBAN_HOME[type];
        const [nb, avs] = await Promise.all([
            listNotebooks().catch(() => []),
            listAttributeViews().catch(() => []),
        ]);
        notebooks = nb;
        avList = avs;
    });

    /** 切换笔记本：清掉不属于该笔记本的数据库选择，避免导入写错库。 */
    function selectNotebook(id: string) {
        const name = notebooks.find((n) => n.id === id)?.name || "";
        const list = name
            ? avList.filter((av) => av.hPath.split("/").filter(Boolean)[0] === name)
            : avList;
        const database = { ...settings.database };
        let cleared = 0;
        for (const t of mediaTypes) {
            if (database[t].avId && !list.some((av) => av.avID === database[t].avId)) {
                database[t] = { ...database[t], avId: "" };
                cleared += 1;
            }
        }
        settings = { ...settings, notebookId: id, database };
        if (cleared) {
            status = `已切换到「${name}」，${cleared} 个数据库需重新指定；留空时导入会自动在该笔记本下新建数据库。`;
        }
    }

    function avDisplayName(av: AttributeViewOption): string {
        const name = av.avName || av.hPath.split("/").filter(Boolean).pop() || av.avID;
        return av.hPath ? `${name}（${av.hPath}）` : name;
    }

    /** 选中数据库时，用它的 hPath 顺带推导笔记父路径，省去手填。 */
    function selectAv(t: MediaType, avId: string) {
        const av = avList.find((item) => item.avID === avId);
        const parts = av?.hPath.split("/").filter(Boolean) || [];
        const notePath =
            parts.length > 1 ? `/${parts.slice(1).join("/")}` : settings.database[t].notePath;
        settings = {
            ...settings,
            database: {
                ...settings.database,
                [t]: { ...settings.database[t], avId, notePath },
            },
        };
    }

    $: if (webview && !eventsAttached) {
        eventsAttached = true;
        const updateUrl = (event: any) => {
            if (event?.url) currentUrl = event.url;
        };
        webview.addEventListener("did-navigate", updateUrl);
        webview.addEventListener("did-navigate-in-page", updateUrl);
    }

    function openBrowser() {
        currentUrl = DOUBAN_HOME[type];
        showBrowser = true;
        status = "请在内置浏览器中打开豆瓣详情页，然后点击“从当前页面提取”。";
    }

    function navigate() {
        if (!currentUrl) return;
        showBrowser = true;
    }

    /** 把后端代理下载到的封面 dataUrl 注入当前豆瓣页面，替换被防盗链拦截的裂图。 */
    async function patchWebviewCover(dataUrl: string) {
        if (!webview || typeof webview.executeJavaScript !== "function") return;
        const script = `(() => {
            const url = ${JSON.stringify(dataUrl)};
            const sels = ["#mainpic img", "#cover img", ".cover img", "img[rel='v:photo']"];
            let patched = 0;
            for (const sel of sels) {
                document.querySelectorAll(sel).forEach((img) => {
                    img.src = url;
                    img.removeAttribute("srcset");
                    img.style.opacity = "1";
                    patched++;
                });
            }
            return patched;
        })()`;
        try {
            await webview.executeJavaScript(script);
        } catch (e) {
            // 注入失败不影响导入流程
        }
    }

    async function extract() {
        if (!webview) {
            status = "请先打开内置浏览器。";
            return;
        }
        if (typeof webview.executeJavaScript !== "function") {
            status = "当前环境不支持页面提取，请在思源桌面端使用。";
            return;
        }
        busy = true;
        status = "正在提取页面信息……";
        try {
            const raw = await webview.executeJavaScript(buildExtractor(type));
            const parsed = JSON.parse(raw);
            info = { ...parsed, type } as MediaInfo;
            // webview 内图片被豆瓣防盗链拦截，改由思源后端代理下载
            if (info && !info.coverDataUrl && info.coverUrl) {
                const dataUrl = await fetchImageAsDataUrl(info.coverUrl);
                if (dataUrl) {
                    info = { ...info, coverDataUrl: dataUrl };
                    // 把封面注入回 webview 页面，替换被豆瓣拦截的裂图
                    await patchWebviewCover(dataUrl);
                }
            }
            status = info?.coverDataUrl
                ? `提取成功：${info.title}（封面已就绪）`
                : `提取成功：${info.title}（封面下载失败，将使用远程链接）`;
        } catch (error: any) {
            status = `提取失败：${error?.message || error}`;
        } finally {
            busy = false;
        }
    }

    const arrayFields = [
        "authors",
        "translators",
        "directors",
        "writers",
        "cast",
        "genres",
        "regions",
        "languages",
    ];

    function fieldValue(source: MediaInfo, key: string): string {
        const value = (source as any)[key];
        if (Array.isArray(value)) return value.join("、");
        return value == null ? "" : String(value);
    }

    function setFieldValue(key: string, value: string) {
        if (!info) return;
        (info as any)[key] = value;
        info = info;
    }

    function editableFields(source: MediaInfo): Array<{ key: string; label: string }> {
        const common = [
            { key: "title", label: "标题" },
            { key: "rating", label: "豆瓣评分" },
            { key: "ratingCount", label: "评分人数" },
            { key: "coverUrl", label: "封面链接" },
        ];
        if (source.type === "book") {
            return [
                ...common,
                { key: "authors", label: "作者" },
                { key: "translators", label: "译者" },
                { key: "publisher", label: "出版社" },
                { key: "publishDate", label: "出版时间" },
                { key: "isbn", label: "ISBN" },
                { key: "originalTitle", label: "原作名" },
                { key: "summary", label: "简介" },
            ];
        }
        if (source.type === "movie" || source.type === "tv") {
            return [
                ...common,
                { key: "directors", label: "导演" },
                { key: "writers", label: "编剧" },
                { key: "cast", label: "主演" },
                { key: "genres", label: "类型" },
                { key: "regions", label: "制片国家/地区" },
                { key: "languages", label: "语言" },
                { key: "releaseDate", label: source.type === "tv" ? "首播" : "上映日期" },
                { key: "runtime", label: "片长/分钟" },
                { key: "episodes", label: "集数" },
                { key: "imdb", label: "IMDb" },
                { key: "summary", label: "简介" },
            ];
        }
        return [
            ...common,
            { key: "artist", label: "音乐人" },
            { key: "album", label: "专辑" },
            { key: "publishDate", label: "发行时间" },
            { key: "summary", label: "简介" },
        ];
    }

    async function doImport() {
        if (!info || !info.title) {
            status = "请先提取并确认媒体信息。";
            return;
        }
        if (!settings.notebookId) {
            status = "尚未指定笔记本，请在设置中选择「数据库所在笔记本」后再导入。";
            showSettings = true;
            return;
        }
        busy = true;
        status = "正在创建笔记并写入数据库……";
        try {
            const payload: any = { ...info };
            for (const key of arrayFields) {
                if (key in payload) payload[key] = toArray(payload[key]);
            }
            const result = await plugin.importMedia(payload as MediaInfo, settings);
            // 自动建库后刷新列表，让设置面板能看到新数据库
            avList = await listAttributeViews().catch(() => avList);
            status = `导入完成：${info.title}（文档 ${result.docId}）`;
            showMessage(`已导入《${info.title}》`);
        } catch (error: any) {
            status = `导入失败：${error?.message || error}`;
        } finally {
            busy = false;
        }
    }

    async function saveSettings() {
        await plugin.saveSettings(settings);
        status = "设置已保存。";
    }

    function updateDbSetting(t: MediaType, field: "avId" | "notePath", value: string) {
        settings = {
            ...settings,
            database: {
                ...settings.database,
                [t]: { ...settings.database[t], [field]: value },
            },
        };
    }
</script>

<div class="mi-root">
    <div class="mi-row mi-types">
        {#each mediaTypes as item}
            <button
                class="b3-button b3-button--outline"
                class:mi-active={type === item}
                on:click={() => {
                    type = item;
                    info = null;
                    currentUrl = DOUBAN_HOME[item];
                    status = `已选择“${MEDIA_LABELS[item]}”，点击“打开豆瓣”开始。`;
                }}
            >
                {MEDIA_LABELS[item]}
            </button>
        {/each}
        <button class="b3-button b3-button--text" on:click={() => (showSettings = !showSettings)}>
            {showSettings ? "收起设置" : "设置"}
        </button>
    </div>

    {#if showSettings}
        <div class="mi-settings">
            <div class="mi-row">
                <span class="mi-setting-label">数据库所在笔记本</span>
                <select value={settings.notebookId} on:change={(e) => selectNotebook(e.currentTarget.value)}>
                    {#if settings.notebookId && !notebooks.some((n) => n.id === settings.notebookId)}
                        <option value={settings.notebookId}>当前：{settings.notebookId}</option>
                    {/if}
                    {#each notebooks as nb}
                        <option value={nb.id}>{nb.name}</option>
                    {/each}
                </select>
                <span>封面目录</span>
                <input bind:value={settings.coverDir} />
            </div>
            {#each mediaTypes as item}
                <div class="mi-row">
                    <strong>{MEDIA_LABELS[item]}</strong>
                    <select
                        value={settings.database[item].avId}
                        on:change={(e) => selectAv(item, e.currentTarget.value)}
                    >
                        {#if settings.database[item].avId && !availableAvList.some((a) => a.avID === settings.database[item].avId)}
                            <option value={settings.database[item].avId}>当前：{settings.database[item].avId}</option>
                        {/if}
                        {#each availableAvList as av}
                            <option value={av.avID} title={avDisplayName(av)}>{avDisplayName(av)}</option>
                        {/each}
                    </select>
                    <span class="mi-setting-label">感想笔记位置</span>
                    <input
                        value={settings.database[item].notePath}
                        on:input={(e) => updateDbSetting(item, "notePath", e.currentTarget.value)}
                        placeholder="例如 /豆瓣电影"
                    />
                </div>
            {/each}
            <button class="b3-button b3-button--outline" on:click={saveSettings}>保存设置</button>
        </div>
    {/if}

    <div class="mi-row mi-actions">
        <button class="b3-button b3-button--outline" on:click={openBrowser}>打开豆瓣</button>
        <button class="b3-button" disabled={busy || !showBrowser} on:click={extract}>
            从当前页面提取
        </button>
        <button class="b3-button b3-button--outline" disabled={busy || !info} on:click={doImport}>
            导入思源
        </button>
    </div>

    <div class="mi-row mi-address">
        <input bind:value={currentUrl} placeholder="豆瓣页面地址" />
        <button class="b3-button b3-button--outline" on:click={navigate}>前往</button>
    </div>

    <div class="mi-main">
        {#if showBrowser}
            <webview
                bind:this={webview}
                src={currentUrl}
                useragent={browserUA}
                allowpopups="true"
                class="mi-webview"
                title="豆瓣"
            ></webview>
        {/if}

        {#if info}
            <div class="mi-preview">
                <div class="mi-preview-title">提取结果（可直接修改）</div>
                {#if info.coverDataUrl || info.coverUrl}
                    <div class="mi-cover-preview">
                        <img
                            src={info.coverDataUrl || info.coverUrl}
                            alt="封面预览"
                            referrerpolicy="no-referrer"
                        />
                        <span>{info.coverDataUrl ? "封面已就绪，导入时会保存到本地" : "封面仅远程链接，导入时可能下载失败"}</span>
                    </div>
                {/if}
                <div class="mi-fields">
                    {#each editableFields(info) as field}
                        <div class="mi-field">
                            <span>{field.label}</span>
                            <input
                                value={fieldValue(info, field.key)}
                                on:input={(e) => setFieldValue(field.key, e.currentTarget.value)}
                            />
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <div class="mi-status" class:mi-error={status.startsWith("提取失败") || status.startsWith("导入失败")}>
        {status || "请选择媒体类型，然后在内置浏览器中打开豆瓣详情页。"}
    </div>
</div>

<style>
    .mi-root {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
        height: 100%;
        min-height: 0;
        padding: 8px 4px;
        overflow: hidden;
        color: var(--b3-theme-on-background);
    }
    .mi-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        flex: 0 0 auto;
    }
    .mi-types .mi-active {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);
    }
    .mi-actions {
        padding: 4px 0;
    }
    .mi-address input {
        flex: 1;
        min-width: 180px;
    }
    .mi-settings {
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 0 0 auto;
        max-height: 34%;
        overflow: auto;
        background: var(--b3-theme-background);
    }
    .mi-settings input,
    .mi-settings select {
        flex: 1;
        min-width: 140px;
        max-width: 100%;
    }
    .mi-settings .mi-row > strong {
        width: 88px;
        flex-shrink: 0;
    }
    .mi-setting-label {
        flex-shrink: 0;
        font-size: 12px;
        white-space: nowrap;
        color: var(--b3-theme-on-surface);
    }
    /* 浏览器与预览共用一个弹性区域，随窗口伸缩 */
    .mi-main {
        flex: 1 1 auto;
        display: flex;
        gap: 8px;
        min-height: 0;
    }
    .mi-webview {
        flex: 1 1 58%;
        min-width: 0;
        min-height: 0;
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        background: #ffffff;
    }
    .mi-preview {
        flex: 1 1 42%;
        min-width: 280px;
        min-height: 0;
        border: 1px solid var(--b3-border-color);
        border-radius: 6px;
        padding: 8px;
        overflow: auto;
    }
    .mi-preview-title {
        font-weight: 600;
        margin-bottom: 6px;
    }
    .mi-cover-preview {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--b3-border-color);
        font-size: 12px;
        color: var(--b3-theme-on-surface);
    }
    .mi-cover-preview img {
        width: 72px;
        height: 100px;
        object-fit: cover;
        border-radius: 4px;
        border: 1px solid var(--b3-border-color);
        background: var(--b3-theme-background);
        flex: 0 0 auto;
    }
    .mi-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 6px 12px;
    }
    .mi-field {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }
    .mi-field span {
        width: 84px;
        flex-shrink: 0;
        color: var(--b3-theme-on-surface);
    }
    .mi-field input {
        flex: 1;
        min-width: 0;
    }
    .mi-status {
        font-size: 12px;
        color: var(--b3-theme-on-surface);
        min-height: 18px;
        flex: 0 0 auto;
    }
    .mi-error {
        color: var(--b3-font-color-error, #c94a4a);
    }
    /* 窗口收窄：浏览器与预览改为上下堆叠 */
    @media (max-width: 900px) {
        .mi-main {
            flex-direction: column;
        }
        .mi-webview {
            flex: 1 1 auto;
            min-height: 180px;
        }
        .mi-preview {
            flex: 0 1 auto;
            min-width: 0;
            max-height: 42%;
        }
    }
    @media (max-width: 700px) {
        .mi-fields {
            grid-template-columns: 1fr;
        }
    }
</style>
