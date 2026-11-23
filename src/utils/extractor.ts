import type { MediaType } from "../types";

/**
 * 生成一段在豆瓣页面上下文中执行的脚本。
 * 脚本读取当前页面 DOM，返回 JSON 字符串形式的媒体信息。
 */
export function buildExtractor(type: MediaType): string {
    return `(async () => {
    const TYPE = ${JSON.stringify(type)};
    const tx = (el) => (el && el.textContent ? el.textContent : "").replace(/\\s+/g, " ").trim();
    const clean = (s) => (s || "").replace(/^[:：\\s]+/, "").replace(/[:：\\s]+$/, "").trim();
    const toList = (s) => clean(s)
        .split(/[\\/、,，;；]/)
        .map((x) => clean(x))
        .filter(Boolean);

    const parts = location.pathname.split("/").filter(Boolean);
    const subjectIndex = parts.indexOf("subject");
    const subjectId = subjectIndex >= 0 ? parts[subjectIndex + 1] : "";
    if (!subjectId) {
        throw new Error("当前不是豆瓣条目详情页，请打开包含 /subject/ 的详情页面");
    }

    const infoEl = document.querySelector("#info") || document.querySelector(".subject-info") || document.body;
    // 豆瓣 #info 中，字段值在 span.pl 的后续兄弟节点里，直到 <br> 为止。
    // 逐个节点读取，避免把后面的字段（作者/译者/出版社）混在一起。
    const readUntilBreak = (start) => {
        const parts = [];
        let node = start;
        while (node && node.nodeName !== "BR") {
            if (node.nodeType === 3) {
                const text = (node.textContent || "").replace(/\\u00a0/g, " ").trim();
                if (text) parts.push(text);
            } else if (node.nodeType === 1) {
                const text = tx(node);
                if (text) parts.push(text);
            }
            node = node.nextSibling;
        }
        return clean(parts.join(" / "));
    };
    const field = (label) => {
        const spans = Array.from(infoEl.querySelectorAll("span.pl"));
        const span = spans.find((s) => {
            const t = tx(s).replace(/[:：\\s]/g, "");
            return t === label || t.indexOf(label) >= 0;
        });
        if (!span) return "";
        const parent = span.parentElement;
        if (!parent) return "";
        const value = readUntilBreak(span.nextSibling);
        if (value) return value;
        const links = Array.from(parent.querySelectorAll("a")).map(tx).filter(Boolean);
        if (links.length) return links.join(" / ");
        const labelText = tx(span);
        return clean(tx(parent).replace(labelText, ""));
    };

    let title = tx(document.querySelector('h1 span[property="v:itemreviewed"]'));
    if (!title) {
        const h1span = tx(document.querySelector("h1 span"));
        title = h1span ? h1span.split(" ")[0] : tx(document.querySelector("h1"));
    }

    const coverEl = document.querySelector("#mainpic img") ||
        document.querySelector("#mainpic a") ||
        document.querySelector(".subject img") ||
        document.querySelector(".cover img");
    let coverUrl = "";
    if (coverEl) {
        coverUrl = coverEl.getAttribute("src") ||
            coverEl.getAttribute("data-src") ||
            coverEl.getAttribute("href") || "";
        coverUrl = coverUrl.split("#")[0].replace(/^http:/, "https:");
    }

    let rating = tx(document.querySelector(".rating_num")) || tx(document.querySelector('[property="v:average"]'));
    let ratingCount = tx(document.querySelector('[property="v:votes"]')) ||
        tx(document.querySelector(".rating_people span")).replace(/[^0-9]/g, "");

    // 豆瓣简介常有两份：.short（末尾带"(展开全部)"）和 .all.hidden（完整版）。
    // 优先取完整版；取文本前移除"展开全部"这类跳转链接，避免混进简介。
    const summaryText = (root) => {
        if (!root) return "";
        const clone = root.cloneNode(true);
        (clone.querySelectorAll ? clone.querySelectorAll(".a_show_full, a.j.a_show_full") : []).forEach((a) => a.remove());
        return tx(clone);
    };
    let summary = summaryText(document.querySelector("#link-report .all .intro")) ||
        summaryText(document.querySelector("#link-report .all.hidden .intro")) ||
        summaryText(document.querySelector("#link-report-inner .all .intro")) ||
        summaryText(document.querySelector('[property="v:summary"]')) ||
        summaryText(document.querySelector("#link-report .intro")) ||
        summaryText(document.querySelector("#link-report-inner .intro")) ||
        summaryText(document.querySelector(".subject-abstract"));
    summary = (summary || "")
        .replace(/[（(]\\s*展开(全部|更多)\\s*[）)]?/g, "")
        .replace(/展开(全部|更多)/g, "")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim();

    // 图片下载统一交给插件侧通过思源后端 forwardProxy 完成（webview 内 fetch 会卡超时且受防盗链拦截）
    const coverDataUrl = "";

    const data = {
        type: TYPE,
        title: clean(title),
        url: location.href.split("#")[0],
        coverUrl: coverUrl,
        coverDataUrl: coverDataUrl,
        rating: clean(rating),
        ratingCount: clean(ratingCount),
        summary: summary
    };

    if (TYPE === "book") {
        data.originalTitle = field("原作名") || field("原名");
        data.subtitle = field("副标题") || tx(document.querySelector('[property="v:subtitle"]'));
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
})()`;
}
