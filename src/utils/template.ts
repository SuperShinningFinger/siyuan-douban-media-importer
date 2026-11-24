import type { MediaInfo } from "../types";

/** 设置面板中展示的可用占位符（name 用于 {{name}}）。 */
export const TEMPLATE_VARIABLES: Array<{ name: string; label: string }> = [
    { name: "title", label: "标题" },
    { name: "rating", label: "豆瓣评分（纯数字）" },
    { name: "ratingCount", label: "评分人数" },
    { name: "ratingLine", label: "豆瓣评分整行（⭐ + 人数）" },
    { name: "myRating", label: "我的评分（留空待填）" },
    { name: "summary", label: "简介（多行自动缩进，配合“- ”使用）" },
    { name: "summaryRaw", label: "简介原文" },
    { name: "cover", label: "封面图片（Markdown 语法）" },
    { name: "coverPath", label: "封面本地路径" },
    { name: "coverUrl", label: "封面豆瓣链接" },
    { name: "created", label: "创建时间" },
    { name: "weekDay", label: "星期" },
    { name: "week", label: "第几周" },
    { name: "dayLeft", label: "距新年剩余天数" },
    { name: "nextYear", label: "明年年份" },
    { name: "today", label: "今天日期" },
    { name: "authors", label: "作者" },
    { name: "translators", label: "译者" },
    { name: "publisher", label: "出版社" },
    { name: "publishDate", label: "出版/发行时间" },
    { name: "isbn", label: "ISBN" },
    { name: "originalTitle", label: "原作名" },
    { name: "subtitle", label: "副标题" },
    { name: "directors", label: "导演" },
    { name: "writers", label: "编剧" },
    { name: "cast", label: "主演" },
    { name: "genres", label: "类型" },
    { name: "regions", label: "制片国家/地区" },
    { name: "languages", label: "语言" },
    { name: "releaseDate", label: "上映/首播日期" },
    { name: "runtime", label: "片长" },
    { name: "episodes", label: "集数" },
    { name: "imdb", label: "IMDb" },
    { name: "artist", label: "音乐人" },
    { name: "album", label: "专辑" },
    { name: "musicType", label: "音乐类型" },
    { name: "aka", label: "又名" },
    { name: "url", label: "豆瓣详情页链接" },
];

/**
 * 内置默认模板：与当前生成的「感想笔记.md」排版完全一致。
 * 行尾的 "- " 是待填写的列表项，请勿随意删除空格。
 */
export const DEFAULT_TEMPLATE = `🕐 创建时间：{{created}} · {{weekDay}} · 第 {{week}} 周
距离 {{nextYear}}-01-01 还剩 {{dayLeft}} 天，加油！
{: style="color: var(--b3-card-info-color); background-color: var(--b3-card-info-background);"}

<br/>

## 🎯 主要内容
{: style="background-color: var(--b3-font-background11);"}
### 豆瓣评分：{{ratingLine}}
### 我的评分：
### 是否推荐：
### 简介
- {{summary}}

---

## ✏️ 优点
{: style="background-color: var(--b3-font-background5);"}
- 

---

## ✍️ 缺点
{: style="background-color: var(--b3-font-background12);"}
- 
---

## 🤔 感想
{: style="background-color: var(--b3-font-background1);"}
- 
`;

/** 复刻「感想笔记.md」模板顶部的时间/星期/周数/倒计时，改为静态值（createDocWithMd 不执行 .action{}）。 */
function noteMeta() {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const anchor = new Date("2022-12-25T00:00:00").getTime();

    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const ysDuration = Math.floor((yearStart - anchor) / dayMs);
    const ysWeekDay = ((ysDuration % 7) + 7) % 7;
    let yearStartWeek = Math.floor((ysDuration - 1) / 7) + 1;
    if (ysWeekDay === 0 || ysWeekDay > 4) yearStartWeek += 1;

    const daysSinceAnchor = Math.floor((now.getTime() - anchor) / dayMs);
    const nowWeek = Math.floor(daysSinceAnchor / 7) + 1;
    const week = nowWeek - yearStartWeek;

    const nextYear = now.getFullYear() + 1;
    const nextYearStart = new Date(nextYear, 0, 1).getTime();
    const dayLeft = Math.floor((nextYearStart - now.getTime()) / dayMs);

    const weekDays = ["星期天", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const weekIndex = (((daysSinceAnchor + 7) % 7) + 7) % 7;
    const pad = (n: number) => String(n).padStart(2, "0");
    const created = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    return { created, today, weekDay: weekDays[weekIndex], week, dayLeft, nextYear };
}

function ratingLine(info: MediaInfo): string {
    const rating = info.rating ? `⭐ ${info.rating}` : "⭐ 暂无评分";
    const count = info.ratingCount ? `（基于 ${info.ratingCount} 人评价）` : "";
    return `${rating}${count}`;
}

function joinValue(value: unknown): string {
    if (Array.isArray(value)) return value.join("、");
    return value == null ? "" : String(value);
}

/** 把 {{变量}} 替换为实际值；未识别的变量替换为空字符串，避免污染正文。 */
export function renderNoteMarkdown(template: string, info: MediaInfo, coverPath: string): string {
    const meta = noteMeta();
    const summaryRaw = info.summary || "";
    const context: Record<string, string> = {
        title: info.title || "",
        rating: info.rating || "",
        ratingCount: info.ratingCount || "",
        ratingLine: ratingLine(info),
        summary: summaryRaw.replace(/\n+/g, "\n  "),
        summaryRaw,
        cover: coverPath ? `![封面](${coverPath})` : "",
        coverPath: coverPath || "",
        coverUrl: info.coverUrl || "",
        url: info.url || "",
        created: meta.created,
        today: meta.today,
        weekDay: meta.weekDay,
        week: String(meta.week),
        dayLeft: String(meta.dayLeft),
        nextYear: String(meta.nextYear),
    };
    for (const field of [
        "myRating", "authors", "translators", "publisher", "publishDate", "isbn",
        "originalTitle", "subtitle", "directors", "writers", "cast", "genres",
        "regions", "languages", "releaseDate", "runtime", "episodes", "imdb",
        "artist", "album", "musicType", "aka",
    ]) {
        context[field] = joinValue((info as any)[field]);
    }

    return template.replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g, (_match, name: string) =>
        Object.prototype.hasOwnProperty.call(context, name) ? context[name] : "",
    );
}

/** 兼容旧调用：不传自定义模板时使用内置默认模板。 */
export function buildNoteMarkdown(info: MediaInfo, coverPath: string, template?: string): string {
    return renderNoteMarkdown(template || DEFAULT_TEMPLATE, info, coverPath);
}
