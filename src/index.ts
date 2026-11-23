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
        const initial = this.computeDialogSize();
        let onResize: () => void = () => {};
        const dialog = new Dialog({
            title: "豆瓣书影音导入助手",
            content: `<div class="mi-dialog-root" style="width:100%;height:100%;min-height:0;"></div>`,
            width: initial.width,
            height: initial.height,
            destroyCallback: () => {
                window.removeEventListener("resize", onResize);
                this.panel?.$destroy();
                this.panel = null;
                this.dialog = null;
            },
        });
        this.dialog = dialog;
        onResize = () => {
            const { width, height } = this.computeDialogSize();
            // 思源不同版本把尺寸写在 dialog 根节点或内部容器上，两处都同步；
            // 主题里的 max-width/max-height 会把弹窗压小，用 important 覆盖。
            const apply = (el: HTMLElement | null) => {
                if (!el) return;
                el.style.setProperty("width", width, "important");
                el.style.setProperty("height", height, "important");
                el.style.setProperty("max-width", "none", "important");
                el.style.setProperty("max-height", "none", "important");
            };
            apply(dialog.element);
            apply(dialog.element.querySelector(".b3-dialog__container"));
        };
        // 创建后立即应用一次，不能只等 resize 事件
        onResize();
        window.addEventListener("resize", onResize);
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
        };
    }

    async saveSettings(settings: MediaSettings): Promise<void> {
        await this.saveData(STORAGE_SETTINGS, settings);
    }

    async importMedia(info: any, settings: MediaSettings) {
        return importMedia(info, settings);
    }
}
