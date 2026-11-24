export type MediaType = "book" | "movie" | "tv" | "music";

export interface MediaInfo {
    type: MediaType;
    title: string;
    originalTitle?: string;
    subtitle?: string;
    authors?: string[];
    translators?: string[];
    publisher?: string;
    publishDate?: string;
    isbn?: string;
    coverUrl?: string;
    coverDataUrl?: string;
    rating?: string;
    ratingCount?: string;
    directors?: string[];
    writers?: string[];
    cast?: string[];
    genres?: string[];
    regions?: string[];
    languages?: string[];
    releaseDate?: string;
    runtime?: string;
    episodes?: string;
    aka?: string;
    imdb?: string;
    summary?: string;
    url?: string;
    artist?: string;
    album?: string;
    musicType?: string;
}

export interface MediaSettings {
    notebookId: string;
    database: Record<MediaType, { avId: string; notePath: string }>;
    coverDir: string;
    /** 每种媒体类型的自定义感想笔记模板；缺省或空字符串时使用内置默认模板。 */
    templates: Partial<Record<MediaType, string>>;
}

export const MEDIA_LABELS: Record<MediaType, string> = {
    book: "书籍",
    movie: "电影",
    tv: "电视剧／动画",
    music: "音乐",
};

export const DOUBAN_HOME: Record<MediaType, string> = {
    book: "https://book.douban.com/",
    movie: "https://movie.douban.com/",
    tv: "https://movie.douban.com/tv/",
    music: "https://music.douban.com/",
};

export const DEFAULT_SETTINGS: MediaSettings = {
    notebookId: "20261123202020-gb8iq5m",
    coverDir: "assets/媒体封面",
    templates: {},
    database: {
        book: { avId: "20261123202021-cjsznts", notePath: "/豆瓣读书" },
        movie: { avId: "20261123202021-qnajmhm", notePath: "/豆瓣电影" },
        tv: { avId: "20261123202021-juohgij", notePath: "/豆瓣电视剧／动画" },
        music: { avId: "20261123202021-twwcz34", notePath: "/音乐笔记" },
    },
};
