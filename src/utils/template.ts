import type { MediaInfo } from "../types";

const ratingLine = (info: MediaInfo) => {
    const rating = info.rating ? `⭐ ${info.rating}` : "⭐ 暂无评分";
    const count = info.ratingCount ? `（基于 ${info.ratingCount} 人评价）` : "";
    return `${rating}${count}`;
};

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

    return { created, weekDay: weekDays[weekIndex], week, dayLeft, nextYear };
}

export function buildNoteMarkdown(info: MediaInfo, _coverPath: string): string {
    const meta = noteMeta();
    const lines: string[] = [
        `🕐 创建时间：${meta.created} · ${meta.weekDay} · 第 ${meta.week} 周`,
        `距离 ${meta.nextYear}-01-01 还剩 ${meta.dayLeft} 天，加油！`,
        '{: style="color: var(--b3-card-info-color); background-color: var(--b3-card-info-background);"}',
        "",
        "<br/>",
        "",
        "## 🎯 主要内容",
        '{: style="background-color: var(--b3-font-background11);"}',
        `### 豆瓣评分：${ratingLine(info)}`,
        "### 我的评分：",
        "### 是否推荐：",
        "### 简介",
    ];
    if (info.summary) {
        lines.push(`- ${info.summary.replace(/\n+/g, "\n  ")}`);
    } else {
        lines.push("- ");
    }

    lines.push(
        "",
        "---",
        "",
        "## ✏️ 优点",
        '{: style="background-color: var(--b3-font-background5);"}',
        "- ",
        "",
        "---",
        "",
        "## ✍️ 缺点",
        '{: style="background-color: var(--b3-font-background12);"}',
        "- ",
        "---",
        "",
        "## 🤔 感想",
        '{: style="background-color: var(--b3-font-background1);"}',
        "- ",
        "",
    );

    return lines.join("\n");
}
