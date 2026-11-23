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

export interface ImportResult {
    docId: string;
    avId: string;
    itemId: string;
    coverPath: string;
    writtenFields: string[];
}

export async function importMedia(
    info: MediaInfo,
    settings: MediaSettings,
): Promise<ImportResult> {
    const config = settings.database[info.type];
    if (!config?.avId || !config?.notePath) {
        throw new Error("当前媒体类型尚未配置数据库，请先在设置中填写 AV ID 和笔记路径");
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
    const markdown = buildNoteMarkdown(info, coverPath);
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
