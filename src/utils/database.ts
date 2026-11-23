import type { MediaInfo } from "../types";
import {
    apiPost,
    dateToTimestamp,
    normalizeDate,
    setAttributeViewCell,
    toArray,
    toNumber,
} from "./siyuan";

type RawValue = string | string[] | number | undefined;
type SetOptions = (content: string) => string;
type Resolver = (info: MediaInfo, coverPath: string, options: SetOptions) => RawValue;

const first = (values?: string[] | string) => {
    const arr = toArray(values);
    return arr.length ? arr[0] : "";
};

const FIELD_MAP: Record<string, Record<string, Resolver>> = {
    book: {
        书名: (i) => i.title,
        原作名: (i) => i.originalTitle || "",
        封面: (_i, cover) => cover,
        作者: (i, _c, opt) => toArray(i.authors).map(opt).join("|") || "",
        译者: (i, _c, opt) => toArray(i.translators).map(opt).join("|") || "",
        出版社: (i) => i.publisher || "",
        出版年: (i) => normalizeDate(i.publishDate),
        ISBN: (i) => i.isbn || "",
        豆瓣链接: (i) => i.url || "",
        豆瓣评分: (i) => toNumber(i.rating),
    },
    movie: {
        电影名称: (i) => i.title,
        海报: (_i, cover) => cover,
        导演: (i, _c, opt) => toArray(i.directors).map(opt).join("|") || "",
        编剧: (i, _c, opt) => toArray(i.writers).map(opt).join("|") || "",
        主演: (i, _c, opt) => toArray(i.cast).map(opt).join("|") || "",
        类型: (i, _c, opt) => toArray(i.genres).map(opt).join("|") || "",
        "制片国家/地区": (i, _c, opt) => toArray(i.regions).map(opt).join("|") || "",
        上映日期: (i) => normalizeDate(i.releaseDate),
        "片长/分钟": (i) => toNumber(i.runtime),
        IMDb: (i) => i.imdb || "",
        豆瓣链接: (i) => i.url || "",
        豆瓣评分: (i) => toNumber(i.rating),
    },
    tv: {
        电影名称: (i) => i.title,
        海报: (_i, cover) => cover,
        导演: (i, _c, opt) => toArray(i.directors).map(opt).join("|") || "",
        编剧: (i, _c, opt) => toArray(i.writers).map(opt).join("|") || "",
        主演: (i, _c, opt) => toArray(i.cast).map(opt).join("|") || "",
        类型: (i, _c, opt) => toArray(i.genres).map(opt).join("|") || "",
        "制片国家/地区": (i, _c, opt) => toArray(i.regions).map(opt).join("|") || "",
        首播: (i) => normalizeDate(i.releaseDate),
        语言: (i, _c, opt) => toArray(i.languages).map(opt).join("|") || "",
        集数: (i) => toNumber(i.episodes),
        "单集片长/分钟": (i) => toNumber(i.runtime),
        又名: (i) => i.aka || "",
        IMDb: (i) => i.imdb || "",
        豆瓣链接: (i) => i.url || "",
        豆瓣评分: (i) => toNumber(i.rating),
    },
    music: {
        音乐名: (i) => i.title,
        音乐人: (i) => first(i.artist || i.authors),
    },
};

/** 收集每个多选列已有的选项，用于复用而非重复创建。 */
function collectOptions(av: any): Record<string, Set<string>> {
    const result: Record<string, Set<string>> = {};
    for (const column of av?.keyValues || []) {
        const key = column?.key;
        if (!key) continue;
        const set = new Set<string>();
        for (const option of key.options || []) {
            if (option?.name) set.add(option.name);
        }
        for (const value of column.values || []) {
            for (const item of value?.mSelect || []) {
                if (item?.content) set.add(item.content);
            }
        }
        result[key.name] = set;
    }
    return result;
}

function buildCellValue(
    keyType: string,
    raw: RawValue,
    info: MediaInfo,
    optionColors: Record<string, string>,
): any {
    if (keyType === "block") return { block: { content: info.title } };
    if (keyType === "text") {
        return { text: { content: Array.isArray(raw) ? raw.join("、") : String(raw ?? "") } };
    }
    if (keyType === "url") return { url: { content: String(raw ?? "") } };
    if (keyType === "number") {
        const content = toNumber(raw as any);
        return {
            number: {
                content,
                isNotEmpty: content !== 0,
                format: "",
                formattedContent: String(content),
            },
        };
    }
    if (keyType === "date") {
        const normalized = normalizeDate(Array.isArray(raw) ? String(raw[0] || "") : String(raw ?? ""));
        return {
            date: {
                content: dateToTimestamp(normalized),
                isNotEmpty: !!normalized,
                hasEndDate: false,
                isNotTime: true,
            },
        };
    }
    if (keyType === "mAsset") {
        const content = Array.isArray(raw) ? String(raw[0] || "") : String(raw ?? "");
        return content ? { mAsset: [{ type: "image", name: "封面", content }] } : null;
    }
    if (keyType === "mSelect" || keyType === "select") {
        const contents = toArray(raw as any);
        if (!contents.length) return null;
        const items = contents.map((content) => ({
            content,
            color: optionColors[content] || "1",
        }));
        return { mSelect: items, text: { content: contents.join("、") } };
    }
    return null;
}

export interface AvWriteResult {
    avId: string;
    itemId: string;
    writtenFields: string[];
}

/**
 * 使用思源官方 API 写入数据库：
 * 1. addAttributeViewBlocks 把文档绑定为数据库的一行
 * 2. getAttributeViewItemIDsByBoundIDs 拿到行 ID
 * 3. setAttributeViewBlockAttr 逐列写入值（number 用批量接口会写入默认空值）
 */
export async function writeRowToAV(
    avId: string,
    carrierBlockId: string,
    docId: string,
    info: MediaInfo,
    coverPath: string,
): Promise<AvWriteResult> {
    const avResp = await apiPost<any>("/api/av/getAttributeView", { id: avId });
    const av = avResp?.av;
    if (!av || !Array.isArray(av.keyValues)) {
        throw new Error("无法读取数据库定义，请检查 AV ID 是否正确");
    }

    const options = collectOptions(av);
    const palette = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

    // 1. 绑定文档为数据库行。blockID 是数据库的载体块（AttributeView 块）ID
    await apiPost("/api/av/addAttributeViewBlocks", {
        avID: avId,
        blockID: carrierBlockId,
        srcs: [{ id: docId, isDetached: false }],
    });

    // 2. 反查行 ID
    const idsResp = await apiPost<Record<string, string>>("/api/av/getAttributeViewItemIDsByBoundIDs", {
        avID: avId,
        blockIDs: [docId],
    });
    const itemId = idsResp?.[docId];
    if (!itemId) throw new Error("数据库绑定成功但未获取到行 ID");

    // 3. 构造并逐列写入字段值（含完整的 key 定义对象，用于多选选项同步）
    const map = FIELD_MAP[info.type] || {};
    const writtenFields: string[] = [];
    for (const column of av.keyValues) {
        const key = column?.key;
        if (!key || key.type === "created" || key.type === "block") continue;
        const resolver = map[key.name];
        if (!resolver) continue;

        // 多选列：先确保选项中包含新内容
        const optionColors: Record<string, string> = {};
        const resolveOption = (content: string): string => {
            const normalized = String(content || "").trim();
            if (!normalized) return normalized;
            let color = optionColors[normalized];
            if (!color) {
                const existing = (key.options || []).find((o: any) => o?.name === normalized);
                if (existing) {
                    color = existing.color || "1";
                } else {
                    const set = options[key.name] || (options[key.name] = new Set());
                    color = palette[set.size % palette.length];
                    set.add(normalized);
                    if (!Array.isArray(key.options)) key.options = [];
                    key.options.push({ name: normalized, color, desc: "" });
                }
                optionColors[normalized] = color;
            }
            return normalized;
        };

        const raw = resolver(info, coverPath, resolveOption);
        if (raw === undefined || raw === null) continue;
        if (typeof raw === "string" && !raw.trim()) continue;
        if (Array.isArray(raw) && !raw.length) continue;
        const value = buildCellValue(key.type, raw, info, optionColors);
        if (!value) continue;
        await setAttributeViewCell(avId, itemId, key.id, value);
        writtenFields.push(key.name);
    }

    return { avId, itemId, writtenFields };
}
