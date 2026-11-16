// JSON Feed 1.1 (https://www.jsonfeed.org/version/1.1/) with the extensions PUPS clients write:
// _pups (RFC-7), _source (RFC-1: inReplyTo, markdown), _image (alt text). Items become the Post
// objects that postviewer (bigwide-net/lib) renders.
import { renderMarkdown } from '@lib/postviewer/src/markdown';
import type {ExternalScript, Post, PostInReplyTo } from '@lib/postviewer/src/types';

export interface JsonFeedAuthor {
    name?: string;
    url?: string;
    avatar?: string;
}

export interface JsonFeedAttachment {
    url?: string;
    mime_type?: string;
    title?: string;
    size_in_bytes?: number;
    duration_in_seconds?: number;
}

export interface JsonFeedItem {
    id?: string | number;
    url?: string;
    external_url?: string;
    title?: string;
    content_html?: string;
    content_text?: string;
    summary?: string;
    image?: string;
    banner_image?: string;
    date_published?: string;
    date_modified?: string;
    authors?: JsonFeedAuthor[];
    author?: JsonFeedAuthor;
    tags?: string[];
    attachments?: JsonFeedAttachment[];
    _image?: {alt?: string};
    _source?: {inReplyTo?: string | {value?: string, isPermaLink?: boolean, feedUrl?: string, feedTitle?: string}, markdown?: string};
}

export interface JsonFeed {
    version: string;
    title?: string;
    description?: string;
    home_page_url?: string;
    feed_url?: string;
    next_url?: string;
    icon?: string;
    favicon?: string;
    authors?: JsonFeedAuthor[];
    language?: string;
    items: JsonFeedItem[];
    _pups?: {pupsControlled?: boolean, archive_url?: string, updates_url?: string};
}

const str = (v: unknown): string | undefined => typeof v == 'string' && v.trim() ? v.trim() : undefined;

/** The JSON Feed in `text`, or undefined if it is none (JSON Feed 1.0 and 1.1). */
export function parseJsonFeed(text: string): JsonFeed | undefined {
    try {
        const json = JSON.parse(text);
        return typeof json?.version == 'string' && json.version.startsWith('https://jsonfeed.org/version/1') && Array.isArray(json.items)
            ? {...json, items: json.items.filter((i: unknown) => i && typeof i == 'object')} : undefined;
    } catch {
        return undefined;
    }
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]!);

/** content_text as HTML: paragraphs at blank lines, line breaks inside them. */
export const textToHtml = (text: string) =>
    text.trim().split(/\n\s*\n/).map(p => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

function markdownToHtml(markdown: string, base: string): string {
    const div = document.createElement('div');
    div.appendChild(renderMarkdown(markdown, base));
    return div.innerHTML;
}

/** The vendor scripts that the embeds in a post body need (RFC-2, Script embeds). */
const EMBED_MARKERS: [RegExp, ExternalScript][] = [
    [/class=["'][^"']*\btwitter-tweet\b/, 'x-widget'],
    [/class=["'][^"']*\btiktok-embed\b/, 'tiktok-embed'],
    [/class=["'][^"']*\binstagram-media\b/, 'instagram-embed'],
    [/class=["'][^"']*\btext-post-media\b/, 'threads-embed'],
    [/class=["'][^"']*\breddit-(embed-bq|card)\b/, 'reddit-embed'],
    [/data-bluesky-uri=/, 'bluesky-embed'],
];

export const embedScripts = (html: string): ExternalScript[] =>
    EMBED_MARKERS.filter(([re]) => re.test(html)).map(([, script]) => script);

function inReplyTo(v: NonNullable<JsonFeedItem['_source']>['inReplyTo']): PostInReplyTo | undefined {
    const value = str(typeof v == 'string' ? v : v?.value);
    if (!value)
        return undefined;
    const o = typeof v == 'object' ? v : undefined;
    return {value, isPermalink: o?.isPermaLink != false && /^https?:\/\//i.test(value), feedUrl: str(o?.feedUrl), feedTitle: str(o?.feedTitle)};
}

const kindOf = (a: JsonFeedAttachment) => a.mime_type?.split('/')[0].toLowerCase();

/** The item's attachments that have a URL. */
export const itemAttachments = (item: JsonFeedItem): JsonFeedAttachment[] =>
    (Array.isArray(item.attachments) ? item.attachments : []).filter(a => str(a?.url));

/** 3725 → "1:02:05", 95 → "1:35". */
export function formatDuration(seconds: number): string {
    const s = Math.round(seconds);
    const mm = String(Math.floor(s / 60) % 60), ss = String(s % 60).padStart(2, '0');
    return s >= 3600 ? `${Math.floor(s / 3600)}:${mm.padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

/** 43200000 → "41 MB". */
export function formatSize(bytes: number): string {
    const units = ['bytes', 'KB', 'MB', 'GB'];
    let n = bytes, u = 0;
    for (; n >= 1024 && u < units.length - 1; u++)
        n /= 1024;
    return `${u && n < 10 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
}

const FORMATS: Record<string, string> = {
    'audio/mpeg': 'MP3', 'audio/mp3': 'MP3', 'audio/mp4': 'M4A', 'audio/x-m4a': 'M4A', 'audio/aac': 'AAC', 'audio/ogg': 'OGG', 'audio/opus': 'Opus',
    'audio/wav': 'WAV', 'audio/x-wav': 'WAV', 'audio/flac': 'FLAC', 'video/mp4': 'MP4', 'video/webm': 'WebM', 'video/quicktime': 'MOV',
    'application/pdf': 'PDF', 'text/plain': 'TXT', 'text/vtt': 'VTT', 'application/x-subrip': 'SRT', 'application/json': 'JSON',
};

/** The file's name in its URL, decoded. */
export function fileName(url: string): string {
    try {
        return decodeURIComponent(new URL(url).pathname.split('/').pop() || url);
    } catch {
        return url;
    }
}

/** A short format label: from the MIME type, else the file extension. */
export function formatOf(a: JsonFeedAttachment): string | undefined {
    const known = a.mime_type && FORMATS[a.mime_type.toLowerCase().split(';')[0].trim()];
    const ext = /\.([a-z0-9]{1,5})$/i.exec(fileName(a.url ?? ''))?.[1];
    return known || ext?.toUpperCase();
}

/** "Episode 1 · 6:00 · WAV · 47 KB" without the parts that are missing. */
export function attachmentDetails(a: JsonFeedAttachment): string[] {
    return [
        typeof a.duration_in_seconds == 'number' && a.duration_in_seconds > 0 ? formatDuration(a.duration_in_seconds) : '',
        formatOf(a) ?? '',
        typeof a.size_in_bytes == 'number' && a.size_in_bytes > 0 ? formatSize(a.size_in_bytes) : '',
    ].filter(Boolean);
}

/** A JSON Feed item as a Post of postviewer. The body is content_html, else the Markdown of
 *  _source.markdown (RFC-1), else content_text. Relative URLs are resolved against `base`. */
export function toPost(item: JsonFeedItem, base: string): Post {
    const markdown = str(item._source?.markdown);
    const description = typeof item.content_html == 'string' ? item.content_html
        : markdown ? markdownToHtml(markdown, base)
        : typeof item.content_text == 'string' ? textToHtml(item.content_text) : '';
    const attachments = itemAttachments(item);
    const media = attachments.find(a => kindOf(a) == 'audio' || kindOf(a) == 'video');
    const image = str(item.image) ?? attachments.find(a => kindOf(a) == 'image')?.url;
    const authors = Array.isArray(item.authors) ? item.authors : item.author ? [item.author] : [];
    const author = authors.map(a => str(a?.name)).filter(Boolean).join(', ');
    return {
        title: str(item.title),
        link: str(item.url) ?? str(item.external_url),
        description,
        pubDate: str(item.date_published) ?? str(item.date_modified),
        author: author || undefined,
        imageUrl: image,
        imageAlt: str(item._image?.alt),
        mediaUrl: media?.url,
        mediaType: media?.mime_type,
        inReplyTo: inReplyTo(item._source?.inReplyTo),
        externalScripts: embedScripts(description),
    };
}

/** An item's id as a string, for #fragments and de-duplication. */
export const itemId = (item: JsonFeedItem) => item.id != undefined ? String(item.id) : undefined;

/** The item's tags, cleaned up. */
export const itemTags = (item: JsonFeedItem) =>
    (Array.isArray(item.tags) ? item.tags : []).map(str).filter((t): t is string => !!t);
