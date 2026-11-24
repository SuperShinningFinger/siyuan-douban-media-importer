import { fetchSyncPost } from "siyuan";
import type { MediaType } from "../types";

function unwrap<T = any>(resp: any): T {
    if (resp && typeof resp === "object" && "code" in resp) {
        if (resp.code !== 0) {
            throw new Error(resp.msg || "思源接口调用失败");
        }
        return resp.data as T;
    }
    return resp as T;
}

export async function apiPost<T = any>(path: string, data: any): Promise<T> {
    const resp = await fetchSyncPost(path, data);
    return unwrap<T>(resp);
}

/** 单条设置 AV 单元格（批量接口对 number 类型写入不稳定，逐条写更可靠）。 */
export async function setAttributeViewCell(
    avId: string,
    itemId: string,
    keyId: string,
    value: any,
): Promise<void> {
    await apiPost("/api/av/setAttributeViewBlockAttr", {
        avID: avId,
        keyID: keyId,
        itemID: itemId,
        value,
    });
}

export interface NotebookOption {
    id: string;
    name: string;
}

export interface AttributeViewOption {
    avID: string;
    avName: string;
    hPath: string;
}

/** 列出未关闭的笔记本，供设置面板下拉选择。 */
export async function listNotebooks(): Promise<NotebookOption[]> {
    const data = await apiPost<any>("/api/notebook/lsNotebooks", {});
    const notebooks = Array.isArray(data?.notebooks) ? data.notebooks : [];
    return notebooks
        .filter((n: any) => n && n.id && !n.closed)
        .map((n: any) => ({ id: String(n.id), name: String(n.name || n.id) }));
}

/** 列出所有属性视图数据库，按 avID 去重，供设置面板下拉选择。 */
export async function listAttributeViews(): Promise<AttributeViewOption[]> {
    const data = await apiPost<any>("/api/av/searchAttributeView", { keyword: "" });
    const results = Array.isArray(data?.results) ? data.results : [];
    const seen = new Map<string, AttributeViewOption>();
    for (const item of results) {
        if (!item?.avID || seen.has(item.avID)) continue;
        seen.set(item.avID, {
            avID: String(item.avID),
            avName: String(item.avName || ""),
            hPath: String(item.hPath || ""),
        });
    }
    return Array.from(seen.values());
}

/** 复制一个数据库，返回新库 ID 与其载体块 ID（内核会即时生成完整字段定义）。 */
export async function duplicateAttributeView(sourceAvId: string): Promise<{ avID: string; blockID: string }> {
    const data = await apiPost<any>("/api/av/duplicateAttributeViewBlock", { avID: sourceAvId });
    if (!data?.avID || !data?.blockID) {
        throw new Error("复制数据库失败，请确认模板数据库可用");
    }
    return { avID: String(data.avID), blockID: String(data.blockID) };
}

/** 读取一个数据库的全部定义与数据，用于清理复制库带过来的行。 */
export async function getAttributeView(avId: string): Promise<any | null> {
    const data = await apiPost<any>("/api/av/getAttributeView", { id: avId });
    return data?.av || null;
}

/** 从数据库中解绑一批文档块（会同时删除对应的行）。 */
export async function removeAttributeViewBlocks(avId: string, srcIds: string[]): Promise<void> {
    if (!srcIds.length) return;
    await apiPost("/api/av/removeAttributeViewBlocks", { avID: avId, srcIDs: srcIds });
}

/** 在指定文档末尾插入一个块（markdown 或 html）。 */
export async function appendBlock(parentId: string, data: string, dataType: "markdown" | "html" = "markdown"): Promise<void> {
    await apiPost("/api/block/appendBlock", { parentID: parentId, data, dataType });
}

/** 通过 AV ID 查找数据库载体块（数据库所在文档里的 NodeAttributeView 块）。 */
export async function findAttributeViewCarrier(avId: string, retries = 5): Promise<string> {
    const stmt = `SELECT id FROM blocks WHERE type = 'av' AND markdown LIKE '%${avId}%' LIMIT 1`;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const rows = await apiPost<any[]>(`/api/query/sql`, { stmt });
        if (Array.isArray(rows) && rows.length && rows[0]?.id) {
            return rows[0].id;
        }
        if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
    }
    throw new Error(`找不到数据库载体块，请确认数据库 ${avId} 已在思源中打开`);
}

export async function createDocWithMd(notebookId: string, path: string, markdown: string): Promise<string> {
    // 思源偶尔返回 "document metadata is not ready"（父目录元数据未就绪），重试即可
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const result = await apiPost<string>("/api/filetree/createDocWithMd", {
                notebook: notebookId,
                path,
                markdown,
            });
            if (typeof result === "string" && result) return result;
        } catch {
            // 下面重试
        }
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error("创建文档失败，请确认笔记本可用且路径无误");
}

export async function renameDocById(id: string, title: string): Promise<void> {
    await apiPost("/api/filetree/renameDocByID", { id, title });
}

export async function setBlockAttrs(blockId: string, attrs: Record<string, string>): Promise<void> {
    await apiPost("/api/attr/setBlockAttrs", {
        id: blockId,
        attrs,
    });
}

export function generateId(length = 7): string {
    const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
    let out = "";
    for (let i = 0; i < length; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

export function generateBlockId(): string {
    const now = new Date();
    const time = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
    ].join("");
    return `${time}-${generateId()}`;
}

export function normalizeDate(value?: string): string {
    if (!value) return "";
    const match = value.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})?\s*[-/.月]?\s*(\d{1,2})?/);
    if (!match) return "";
    const year = match[1];
    const month = (match[2] || "1").padStart(2, "0");
    const day = (match[3] || "1").padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function dateToTimestamp(value?: string): number {
    const normalized = normalizeDate(value);
    if (!normalized) return 0;
    const [y, m, d] = normalized.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
}

export function toNumber(value?: string | number): number {
    if (typeof value === "number") return value;
    if (!value) return 0;
    const match = String(value).match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
}

export function toArray(value?: string | string[]): string[] {
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
    if (!value) return [];
    return String(value)
        .split(/[\/、,，;；]/)
        .map((v) => v.trim())
        .filter(Boolean);
}

/**
 * 通过思源后端代理下载图片并转 dataUrl。
 * 豆瓣图片有防盗链（无 Referer 返回 418，非豆瓣来源返回 403），
 * 渲染进程 fetch 无法设置 Referer，必须交给后端 forwardProxy 带豆瓣 Referer 下载。
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
    if (!url) return "";
    try {
        // 注意：headers 必须是 [{Header名: 值}] 的对象数组，不是 {name,value}。
        // 用旧格式会导致 Referer 没设置，豆瓣返回 418。
        const resp: any = await fetchSyncPost("/api/network/forwardProxy", {
            url,
            method: "GET",
            timeout: 12000,
            headers: [
                {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
                },
                { Referer: "https://book.douban.com/" },
            ],
            payload: "",
            payloadEncoding: "text",
            responseEncoding: "base64",
        });
        // fetchSyncPost 返回 {code, data}；unwrap 后是 NetworkForwardData。
        const data = resp?.data && typeof resp.data === "object" ? resp.data : resp;
        if (data?.status && data.status >= 400) return "";
        // 顶层 contentType 是字符串；headers 里的键大小写不固定，作兜底。
        let contentType: string = data?.contentType || "";
        if (!contentType) {
            const h = data?.headers || {};
            const key = Object.keys(h).find((k) => k.toLowerCase() === "content-type");
            contentType = key ? String(h[key]?.[0] || "") : "";
        }
        if (!String(contentType).startsWith("image/")) return "";
        const body = data?.body;
        if (!body) return "";
        return `data:${contentType};base64,${body}`;
    } catch {
        return "";
    }
}

/**
 * 通过思源后端代理抓取网页 HTML 文本（Docker/手机等无 webview 环境用）。
 * forwardProxy 返回 base64 body，这里按 UTF-8 解码成字符串。
 */
export async function fetchTextViaProxy(url: string, referer?: string): Promise<string> {
    if (!url) return "";
    const resp: any = await fetchSyncPost("/api/network/forwardProxy", {
        url,
        method: "GET",
        timeout: 15000,
        headers: [
            {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
            },
            { Referer: referer || "https://www.douban.com/" },
        ],
        payload: "",
        payloadEncoding: "text",
        responseEncoding: "base64",
    });
    const data = resp?.data && typeof resp.data === "object" ? resp.data : resp;
    if (!data?.body) throw new Error(`代理返回为空（status ${data?.status || "?"}）`);
    if (data.status && data.status >= 400) {
        throw new Error(`豆瓣页面请求失败（HTTP ${data.status}），请在桌面端使用内置浏览器导入`);
    }
    const bin = atob(data.body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
}

function safeFileName(name: string): string {
    return (
        name
            .replace(/[\\/:*?"<>|\r\n\t]/g, "_")
            .replace(/\s+/g, "_")
            .slice(0, 60) || "cover"
    );
}

export async function uploadCover(
    dataUrl: string | undefined,
    remoteUrl: string | undefined,
    title: string,
    coverDir: string,
    type: MediaType,
): Promise<string> {
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
        return remoteUrl || "";
    }
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+-]+);base64,(.*)$/);
    if (!match) return remoteUrl || "";
    const mime = match[1];
    const extMap: Record<string, string> = { jpeg: "jpg", "x-icon": "ico", "svg+xml": "svg" };
    const ext = extMap[mime.split("/")[1]] || mime.split("/")[1] || "jpg";
    const fileName = `${safeFileName(title)}_${generateBlockId()}.${ext}`;
    const relativePath = `${coverDir.replace(/^\/+/, "")}/${type}/${fileName}`;
    const byteString = atob(match[2]);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
        bytes[i] = byteString.charCodeAt(i);
    }
    const formData = new FormData();
    formData.append("path", `/data/${relativePath}`);
    formData.append("file", new File([bytes], fileName, { type: mime }));
    await apiPost("/api/file/putFile", formData);
    return relativePath;
}
