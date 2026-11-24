import type { MediaInfo, MediaSettings } from "../types";
import { writeRowToAV } from "./database";
import {
    createDocWithMd,
    findAttributeViewCarrier,
    renameDocById,
    setBlockAttrs,
    uploadCover,
} from "./siyuan";
import { buildNoteMarkdown } from "./template";
import { initializeDatabase } from "./db-init";

export interface ImportResult {
    docId: string;
    avId: string;
    itemId: string;
    coverPath: string;
    writtenFields: string[];
}

export interface ImportOptions {
    /** 自动初始化数据库后回调，用于把新的 avId/notePath 持久化到插件设置。 */
    onDatabaseInitialized?: (type: MediaInfo["type"], avId: string, notePath: string) => void | Promise<void>;
}

export async function importMedia(
    info: MediaInfo,
    settings: MediaSettings,
    options: ImportOptions = {},
): Promise<ImportResult> {
    // 1. 必须先指定笔记本
    if (!settings.notebookId) {
        throw new Error("尚未指定笔记本，请在设置中选择「数据库所在笔记本」");
    }

    // 2. 该媒体类型未配置数据库时，自动在笔记本下新建文档并初始化数据库
    let config = settings.database[info.type];
    if (!config?.avId) {
        const created = await initializeDatabase(settings.notebookId, info.type);
        config = { avId: created.avId, notePath: created.notePath };
        settings = {
            ...settings,
            database: { ...settings.database, [info.type]: config },
        };
        if (options.onDatabaseInitialized) {
            await options.onDatabaseInitialized(info.type, config.avId, config.notePath);
        }
    }
    if (!config.notePath) {
        throw new Error("笔记路径为空，请检查设置");
    }

    // 下载封面到本地 assets，避免豆瓣防盗链导致封面在插件和笔记中都不显示
    const coverPath = await uploadCover(
        info.coverDataUrl,
        info.coverUrl,
        info.title,
        settings.coverDir,
        info.type,
    );

    const carrierBlockId = await findAttributeViewCarrier(config.avId);
    const markdown = buildNoteMarkdown(info, coverPath, settings.templates?.[info.type]);
    const docPath = `${config.notePath.replace(/\/$/, "")}/${info.title}`;

    const docId = await createDocWithMd(settings.notebookId, docPath, markdown);
    await renameDocById(docId, info.title);
    await setBlockAttrs(docId, { "custom-avs": config.avId });

    const { itemId, writtenFields } = await writeRowToAV(
        config.avId,
        carrierBlockId,
        docId,
        info,
        coverPath,
    );

    return { docId, avId: config.avId, itemId, coverPath, writtenFields };
}
