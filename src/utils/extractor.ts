import type { MediaInfo, MediaType } from "../types";

/**
 * 自包含的页面提取逻辑：只读 doc/href 两个入参，返回 JSON 字符串。
 * 必须保持自包含（不引用模块级变量/函数），因为它会被 toString() 序列化后
 * 注入 webview 执行；同时渲染进程也会直接调用它解析后端代理抓来的 HTML。
 */
function extractFromDocument(type: string, doc: Document, href: string): string {
    const TYPE = type;
    const tx = (el: any) => (el && el.textContent ? el.textContent : "").replace(/\s+/g, " ").trim();
    const clean = (s: any) => (s || "").replace(/^[:：\s]+/, "").replace(/[:：\s]+$/, "").trim();
    const toList = (s: any) => clean(s)
        .split(/[\/、,，;；]/)
        .map((x: any) => clean(x))
        .filter(Boolean);

    let pathname = "";
    try { pathname = new URL(href).pathname; } catch { pathname = ""; }
    const parts = pathname.split("/").filter(Boolean);
    const subjectIndex = parts.indexOf("subject");
    const subjectId = subjectIndex >= 0 ? parts[subjectIndex + 1] : "";
    if (!subjectId) {
        throw new Error("当前不是豆瓣条目详情页，请打开包含 /subject/ 的详情页面");
    }

    const infoEl = doc.querySelector("#info") || doc.querySelector(".subject-info") || doc.body;
    // 豆瓣 #info 中，字段值在 span.pl 的后续兄弟节点里，直到 <br> 为止。
    // 逐个节点读取，避免把后面的字段（作者/译者/出版社）混在一起。
    const readUntilBreak = (start: any) => {
        const segs: string[] = [];
        let node = start;
        while (node && node.nodeName !== "BR") {
            if (node.nodeType === 3) {
                const text = (node.textContent || "").replace(/\u00a0/g, " ").trim();
                if (text) segs.push(text);
            } else if (node.nodeType === 1) {
                const text = tx(node);
                if (text) segs.push(text);
            }
            node = node.nextSibling;
        }
        return clean(segs.join(" / "));
    };
    const field = (label: string) => {
        const spans = Array.from(infoEl.querySelectorAll("span.pl"));
        const span = spans.find((s: any) => {
            const t = tx(s).replace(/[:：\s]/g, "");
            return t === label || t.indexOf(label) >= 0;
        });
        if (!span) return "";
        const parent = (span as any).parentElement;
        if (!parent) return "";
        const value = readUntilBreak((span as any).nextSibling);
        if (value) return value;
        const links = Array.from(parent.querySelectorAll("a")).map(tx).filter(Boolean);
        if (links.length) return links.join(" / ");
        const labelText = tx(span);
        return clean(tx(parent).replace(labelText, ""));
    };

    let title = tx(doc.querySelector('h1 span[property="v:itemreviewed"]'));
    if (!title) {
        const h1span = tx(doc.querySelector("h1 span"));
        title = h1span ? h1span.split(" ")[0] : tx(doc.querySelector("h1"));
    }

    const coverEl = doc.querySelector("#mainpic img") ||
        doc.querySelector("#mainpic a") ||
        doc.querySelector(".subject img") ||
        doc.querySelector(".cover img");
    let coverUrl = "";
    if (coverEl) {
        coverUrl = coverEl.getAttribute("src") ||
            coverEl.getAttribute("data-src") ||
            coverEl.getAttribute("href") || "";
        coverUrl = coverUrl.split("#")[0].replace(/^http:/, "https:");
    }

    const rating = tx(doc.querySelector(".rating_num")) || tx(doc.querySelector('[property="v:average"]'));
    const ratingCount = tx(doc.querySelector('[property="v:votes"]')) ||
        tx(doc.querySelector(".rating_people span")).replace(/[^0-9]/g, "");

    // 豆瓣简介常有两份：.short（末尾带"(展开全部)"）和 .all.hidden（完整版）。
    // 优先取完整版；取文本前移除"展开全部"这类跳转链接，避免混进简介。
    const summaryText = (root: any) => {
        if (!root) return "";
        const clone = root.cloneNode(true);
        (clone.querySelectorAll ? clone.querySelectorAll(".a_show_full, a.j.a_show_full") : []).forEach((a: any) => a.remove());
        return tx(clone);
    };
    let summary = summaryText(doc.querySelector("#link-report .all .intro")) ||
        summaryText(doc.querySelector("#link-report .all.hidden .intro")) ||
        summaryText(doc.querySelector("#link-report-inner .all .intro")) ||
        summaryText(doc.querySelector('[property="v:summary"]')) ||
        summaryText(doc.querySelector("#link-report .intro")) ||
        summaryText(doc.querySelector("#link-report-inner .intro")) ||
        summaryText(doc.querySelector(".subject-abstract"));
    summary = (summary || "")
        .replace(/[（(]\s*展开(全部|更多)\s*[）)]?/g, "")
        .replace(/展开(全部|更多)/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    // 图片下载统一交给插件侧通过思源后端 forwardProxy 完成（webview 内 fetch 会卡超时且受防盗链拦截）
    const coverDataUrl = "";

    const data: any = {
        type: TYPE,
        title: clean(title),
        url: href.split("#")[0],
        coverUrl,
        coverDataUrl,
        rating: clean(rating),
        ratingCount: clean(ratingCount),
        summary,
    };

    if (TYPE === "book") {
        data.originalTitle = field("原作名") || field("原名");
        data.subtitle = field("副标题") || tx(doc.querySelector('[property="v:subtitle"]'));
        data.authors = toList(field("作者"));
        data.translators = toList(field("译者"));
        data.publisher = field("出版社");
        data.publishDate = field("出版时间") || field("出版年");
        data.isbn = field("ISBN").replace(/[^0-9Xx]/g, "");
    } else if (TYPE === "movie" || TYPE === "tv") {
        data.directors = toList(field("导演"));
        data.writers = toList(field("编剧"));
        data.cast = toList(field("主演"));
        data.genres = toList(field("类型"));
        data.regions = toList(field("制片国家/地区") || field("制片国家"));
        data.languages = toList(field("语言"));
        data.releaseDate = field("上映日期") || field("首播") || field("首播日期") || field("上映时间");
        data.runtime = field("片长").replace(/[^0-9]/g, "");
        data.episodes = field("集数").replace(/[^0-9]/g, "");
        data.aka = field("又名");
        data.imdb = field("IMDb");
    } else if (TYPE === "music") {
        data.artist = field("表演者") || field("艺人") || field("音乐人") || field("歌手");
        data.authors = toList(data.artist);
        data.album = field("专辑类型") || field("唱片集");
        data.publishDate = field("发行时间") || field("出版时间");
        data.publisher = field("出版者");
        data.musicType = field("介质") || field("类型");
        data.regions = toList(field("地区"));
        data.languages = toList(field("语言"));
    }

    if (!data.title) {
        throw new Error("未识别到条目标题，请确认当前是豆瓣详情页");
    }
    return JSON.stringify(data);
}

/**
 * 供 webview.executeJavaScript() 使用：把共用提取函数序列化注入，读取当前页面 DOM。
 */
export function buildExtractor(type: MediaType): string {
    return `(${extractFromDocument.toString()})(${JSON.stringify(type)}, document, location.href)`;
}

/**
 * 供无 webview 环境（Docker / 手机 / 浏览器前端）使用：
 * 直接对后端代理抓来的 HTML 做 DOMParser 解析，逻辑与 webview 路径完全共用。
 */
export function extractFromHtml(html: string, url: string, type: MediaType): MediaInfo {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const raw = extractFromDocument(type, doc, url);
    return JSON.parse(raw) as MediaInfo;
}
