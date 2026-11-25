import type { MediaInfo, MediaType } from "../types";
import {
    addAttributeViewKey,
    apiPost,
    dateToTimestamp,
    generateBlockId,
    getAttributeView,
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

/** 本地日期（不用 toISOString，避免跨时区差一天）。 */
const today = (): string => {
    const now = new Date();
    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("-");
};

const FIELD_MAP: Record<string, Record<string, Resolver>> = {
    book: {
        书名: (i) => i.title,
        原作名: (i) => i.originalTitle || "",
        封面: (_i, cover) => cover,
        作者: (i, _c, opt) => toArray(i.authors).map(opt),
        译者: (i, _c, opt) => toArray(i.translators).map(opt),
        出版社: (i) => i.publisher || "",
        出版年: (i) => normalizeDate(i.publishDate),
        ISBN: (i) => i.isbn || "",
        豆瓣链接: (i) => i.url || "",
        豆瓣评分: (i) => toNumber(i.rating),
    },
    movie: {
        电影名称: (i) => i.title,
        海报: (_i, cover) => cover,
        导演: (i, _c, opt) => toArray(i.directors).map(opt),
        编剧: (i, _c, opt) => toArray(i.writers).map(opt),
        主演: (i, _c, opt) => toArray(i.cast).map(opt),
        类型: (i, _c, opt) => toArray(i.genres).map(opt),
        "制片国家/地区": (i, _c, opt) => toArray(i.regions).map(opt),
        上映日期: (i) => normalizeDate(i.releaseDate),
        "片长/分钟": (i) => toNumber(i.runtime),
        IMDb: (i) => i.imdb || "",
        豆瓣链接: (i) => i.url || "",
        豆瓣评分: (i) => toNumber(i.rating),
    },
    tv: {
        电影名称: (i) => i.title,
        海报: (_i, cover) => cover,
        导演: (i, _c, opt) => toArray(i.directors).map(opt),
        编剧: (i, _c, opt) => toArray(i.writers).map(opt),
        主演: (i, _c, opt) => toArray(i.cast).map(opt),
        类型: (i, _c, opt) => toArray(i.genres).map(opt),
        "制片国家/地区": (i, _c, opt) => toArray(i.regions).map(opt),
        首播: (i) => normalizeDate(i.releaseDate),
        语言: (i, _c, opt) => toArray(i.languages).map(opt),
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
    game: {
        游戏名: (i) => i.title,
        封面: (_i, cover) => cover,
        平台: (i, _c, opt) => toArray(i.platforms).map(opt),
        类型: (i, _c, opt) => toArray(i.gameType).map(opt),
        开发商: (i, _c, opt) => toArray(i.developers).map(opt),
        发行商: (i, _c, opt) => toArray(i.publishers).map(opt),
        发行日期: (i) => normalizeDate(i.publishDate),
        别名: (i) => i.aka || "",
        豆瓣链接: (i) => i.url || "",
        豆瓣评分: (i) => toNumber(i.rating),
        创建时间: () => today(),
    },
};

/**
 * 每种媒体写入数据库所需的列（列名 + 内核类型），与 FIELD_MAP 一一对应。
 * 主键列（block，如「书名/电影名称/游戏名」）不在此列——空库自带的主键列会被
 * writeRowToAV 跳过，文档绑定后主键显示的就是文档标题，无需补建。
 * 当目标库是空库或缺列时，按此表自动补列，避免"笔记建了但字段全空"。
 */
type ColumnDef = { name: string; type: string };
const REQUIRED_COLUMNS: Record<MediaType, ColumnDef[]> = {
    book: [
        { name: "原作名", type: "text" },
        { name: "封面", type: "mAsset" },
        { name: "作者", type: "mSelect" },
        { name: "译者", type: "mSelect" },
        { name: "出版社", type: "text" },
        { name: "出版年", type: "date" },
        { name: "ISBN", type: "text" },
        { name: "豆瓣链接", type: "url" },
        { name: "豆瓣评分", type: "number" },
    ],
    movie: [
        { name: "海报", type: "mAsset" },
        { name: "导演", type: "mSelect" },
        { name: "编剧", type: "mSelect" },
        { name: "主演", type: "mSelect" },
        { name: "类型", type: "mSelect" },
        { name: "制片国家/地区", type: "mSelect" },
        { name: "上映日期", type: "date" },
        { name: "片长/分钟", type: "number" },
        { name: "IMDb", type: "text" },
        { name: "豆瓣链接", type: "url" },
        { name: "豆瓣评分", type: "number" },
    ],
    tv: [
        { name: "海报", type: "mAsset" },
        { name: "导演", type: "mSelect" },
        { name: "编剧", type: "mSelect" },
        { name: "主演", type: "mSelect" },
        { name: "类型", type: "mSelect" },
        { name: "制片国家/地区", type: "mSelect" },
        { name: "首播", type: "date" },
        { name: "语言", type: "mSelect" },
        { name: "集数", type: "number" },
        { name: "单集片长/分钟", type: "number" },
        { name: "又名", type: "text" },
        { name: "IMDb", type: "text" },
        { name: "豆瓣链接", type: "url" },
        { name: "豆瓣评分", type: "number" },
    ],
    music: [
        { name: "音乐人", type: "text" },
    ],
    game: [
        { name: "封面", type: "mAsset" },
        { name: "平台", type: "mSelect" },
        { name: "类型", type: "mSelect" },
        { name: "开发商", type: "mSelect" },
        { name: "发行商", type: "mSelect" },
        { name: "发行日期", type: "date" },
        { name: "别名", type: "text" },
        { name: "豆瓣链接", type: "url" },
        { name: "豆瓣评分", type: "number" },
        { name: "创建时间", type: "date" },
    ],
};

/** 检测目标库缺哪些列并补齐，返回补列后的最新 AV 定义。 */
async function ensureColumns(
    avId: string,
    carrierBlockId: string,
    type: MediaType,
    av: any,
): Promise<any> {
    const keyValues: any[] = Array.isArray(av?.keyValues) ? av.keyValues : [];
    const existing = new Set<string>();
    for (const kv of keyValues) {
        const name = kv?.key?.name;
        if (name) existing.add(name);
    }
    const missing = (REQUIRED_COLUMNS[type] || []).filter((col) => !existing.has(col.name));
    if (!missing.length) return av;

    // 追加到末尾：previousKeyID 依次指向上一列（新补的列也串起来）
    let previousKeyId = keyValues.length ? String(keyValues[keyValues.length - 1]?.key?.id || "") : "";
    for (const col of missing) {
        const keyId = generateBlockId();
        await addAttributeViewKey(avId, carrierBlockId, keyId, col.name, col.type, previousKeyId);
        previousKeyId = keyId;
    }
    // 内核补列后索引即时更新，重读一次拿到完整定义与列 ID
    return (await getAttributeView(avId)) || av;
}

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
    let av = avResp?.av;
    if (!av || !Array.isArray(av.keyValues)) {
        throw new Error("无法读取数据库定义，请检查 AV ID 是否正确");
    }

    // 空库/缺列时自动补齐所需字段（含正确的列类型），保证字段能写入
    av = await ensureColumns(avId, carrierBlockId, info.type, av);
    if (!av || !Array.isArray(av.keyValues)) {
        throw new Error("补齐数据库字段后无法重新读取定义，请重试");
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
