import { DEFAULT_SETTINGS, type MediaType } from "../types";
import {
    apiPost,
    appendBlock,
    createDocWithMd,
    duplicateAttributeView,
    findAttributeViewCarrier,
    getAttributeView,
    listAttributeViews,
    removeAttributeViewBlocks,
} from "./siyuan";

/** 每种媒体类型对应的默认笔记父路径。 */
export const DEFAULT_NOTE_PATH: Record<MediaType, string> = {
    book: "/豆瓣读书",
    movie: "/豆瓣电影",
    tv: "/豆瓣电视剧／动画",
    music: "/音乐笔记",
    game: "/豆瓣游戏",
};

/** 每种媒体类型的默认数据库名称。 */
const AV_NAME: Record<MediaType, string> = {
    book: "书籍",
    movie: "电影",
    tv: "电视剧／动画",
    music: "音乐",
    game: "游戏",
};

/**
 * 为新笔记本初始化一个媒体数据库：
 * 1. 找一个可用的模板库（默认 avId → 同类型库 → 任意库），复制得到完整字段定义
 * 2. 清掉复制带过来的绑定行，避免源库数据混入
 * 3. 在目标笔记本下新建文档，把新库挂进去
 * 4. 返回新的 avId / notePath / 载体块 ID
 */
export async function initializeDatabase(
    notebookId: string,
    type: MediaType,
): Promise<{ avId: string; notePath: string; carrierBlockId: string }> {
    const templateAvId = await findTemplateAvId(type);
    const { avID: avId } = await duplicateAttributeView(templateAvId);

    // 清掉复制带过来的绑定行（detached 行不显示在数据库中，无需处理）
    try {
        const av = await getAttributeView(avId);
        const boundIds = new Set<string>();
        for (const kv of av?.keyValues || []) {
            for (const value of kv?.values || []) {
                const blockId = value?.block?.id || value?.blockID;
                if (blockId) boundIds.add(blockId);
            }
        }
        await removeAttributeViewBlocks(avId, Array.from(boundIds));
    } catch {
        // 清行失败不影响建库，用户可在界面手动删除
    }

    // 在目标笔记本下新建数据库文档，并把 AV 块挂进去
    const notePath = DEFAULT_NOTE_PATH[type];
    const docPath = `${notePath.replace(/\/$/, "")}/${AV_NAME[type]}数据库`;
    const docId = await createDocWithMd(notebookId, docPath, `# ${AV_NAME[type]}数据库\n`);
    await appendBlock(
        docId,
        `<div data-type="NodeAttributeView" data-av-id="${avId}" data-av-type="table"></div>`,
    );

    // 等索引落库后拿到载体块 ID（插件写库需要）
    const carrierBlockId = await findAttributeViewCarrier(avId);

    return { avId, notePath, carrierBlockId };
}

/** 按优先级找一个可用于复制的模板数据库。 */
async function findTemplateAvId(type: MediaType): Promise<string> {
    // 1. 默认配置里的该类型数据库（字段结构与插件最匹配）
    const defaultId = DEFAULT_SETTINGS.database[type]?.avId;
    if (defaultId && (await avExists(defaultId))) return defaultId;

    // 2. 当前工作空间里名字匹配该类型的库
    const list = await listAttributeViews();
    const wanted = AV_NAME[type];
    const matched = list.find((av) => av.avName === wanted || av.avName.includes(wanted));
    if (matched) return matched.avID;

    // 3. 任意库（至少能生成可用结构）
    if (list.length) return list[0].avID;

    throw new Error(
        "当前工作空间没有任何数据库可作为模板，请先在思源中新建一个数据库后再导入",
    );
}

async function avExists(avId: string): Promise<boolean> {
    try {
        return !!(await getAttributeView(avId));
    } catch {
        return false;
    }
}

/** 检查数据库字段是否覆盖插件写入所需的字段，返回缺失的字段名。 */
export async function checkDatabaseFields(
    avId: string,
    requiredFields: string[],
): Promise<{ ok: boolean; missing: string[] }> {
    const av = await apiPost<any>("/api/av/getAttributeView", { id: avId }).catch(() => null);
    const keys = av?.av || av;
    const names = new Set<string>(
        ((keys?.keyValues || []) as any[])
            .map((kv) => kv?.key?.name)
            .filter(Boolean),
    );
    const missing = requiredFields.filter((f) => !names.has(f));
    return { ok: missing.length === 0, missing };
}
