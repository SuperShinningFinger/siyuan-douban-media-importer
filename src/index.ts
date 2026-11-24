import { Dialog, Plugin } from "siyuan";
import ImportPanel from "./components/ImportPanel.svelte";
import { ICON_PNG_BASE64 } from "./assets/icon-base64";
import { DEFAULT_SETTINGS, type MediaSettings } from "./types";
import { importMedia } from "./utils/importer";

const STORAGE_SETTINGS = "settings";

export default class MediaImporterPlugin extends Plugin {
    private dialog: Dialog | null = null;
    private panel: ImportPanel | null = null;

    async onload() {
        // 顶栏使用商店图标的彩色缩略图（内嵌 base64，避免相对路径加载失败）
        this.addIcons(`<symbol id="iconMediaImporter" viewBox="0 0 160 160">
            <image width="160" height="160" href="data:image/png;base64,${ICON_PNG_BASE64}" />
        </symbol>`);

        this.addTopBar({
            icon: "iconMediaImporter",
            title: "豆瓣书影音导入助手",
            position: "right",
            callback: () => this.openPanel(),
        });
    }

    async onLayoutReady() {
        // 无需在布局阶段执行操作
    }

    async onunload() {
        this.panel?.$destroy();
        this.panel = null;
        this.dialog?.destroy();
        this.dialog = null;
    }

    /** 弹窗尺寸跟随视口：尽量铺满窗口，小屏保留最小可用尺寸。 */
    private computeDialogSize() {
        const clamp = (value: number, min: number, max: number) =>
            Math.min(max, Math.max(min, value));
        const width = clamp(window.innerWidth - 80, 720, 1920);
        const height = clamp(window.innerHeight - 80, 520, 1080);
        return { width: `${width}px`, height: `${height}px` };
    }

    private openPanel() {
        if (this.dialog) {
            this.dialog.destroy();
            this.dialog = null;
        }
        // 尺寸只通过 Dialog 官方的 width/height 参数传入（作用于内部
        // .b3-dialog__container）。不要给 dialog.element（外层 .b3-dialog--open
        // 遮罩）写内联样式或用 !important 覆盖，否则会破坏全局弹窗布局。
        const { width, height } = this.computeDialogSize();
        const dialog = new Dialog({
            title: "豆瓣书影音导入助手",
            content: `<div class="mi-dialog-root" style="width:100%;height:100%;min-height:0;"></div>`,
            width,
            height,
            destroyCallback: () => {
                this.panel?.$destroy();
                this.panel = null;
                this.dialog = null;
            },
        });
        this.dialog = dialog;
        const target = dialog.element.querySelector(".mi-dialog-root") as HTMLElement;
        this.panel = new ImportPanel({
            target,
            props: { plugin: this },
        });
    }

    async getSettings(): Promise<MediaSettings> {
        const saved = (await this.loadData(STORAGE_SETTINGS)) as Partial<MediaSettings> | null;
        if (!saved) return structuredClone(DEFAULT_SETTINGS);
        return {
            ...DEFAULT_SETTINGS,
            ...saved,
            database: {
                ...DEFAULT_SETTINGS.database,
                ...(saved.database || {}),
            },
            templates: {
                ...(saved.templates || {}),
            },
        };
    }

    async saveSettings(settings: MediaSettings): Promise<void> {
        await this.saveData(STORAGE_SETTINGS, settings);
    }

    async importMedia(info: any, settings: MediaSettings) {
        return importMedia(info, settings, {
            onDatabaseInitialized: async (type, avId, notePath) => {
                settings.database[type] = { avId, notePath };
                await this.saveSettings(settings);
            },
        });
    }
}
