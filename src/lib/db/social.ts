// Social / Instagram Module — Database Repository
// Uses native Supabase client. Complex aggregations (DISTINCT ON) fetch + deduplicate in JS.
import { supabase } from '../supabase';
import type {
  SocialAccount, SocialMediaPost, ReelSocialLink, YouTubeSocialLink,
  SocialMediaMetricSnapshot, SocialAccountSnapshot, SocialSyncLog,
} from '../types';

// Re-export types for dynamic imports
export type { ReelSocialLink, YouTubeSocialLink };

// ─── Helpers ───

function nowStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function coerceRow<T>(row: Record<string, unknown>): T {
  // Postgres BOOLEANs come back as `true`/`false` but the TS types say `number`
  // Coerce is_archived, is_ignored, linked_manually, fired, auto_generated etc.
  const out = { ...row };
  for (const key of ['is_archived', 'is_ignored', 'linked_manually', 'fired', 'auto_generated', 'is_recurring']) {
    if (typeof out[key] === 'boolean') out[key] = out[key] ? 1 : 0;
  }
  return out as unknown as T;
}

function coerceRows<T>(rows: unknown[] | null): T[] {
  return (rows as Record<string, unknown>[] || []).map(coerceRow<T>);
}

async function selectOne<T>(table: string, column: string, value: string): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq(column, value).maybeSingle();
  if (error) throw new Error(`DB error: ${error.message}`);
  return data ? coerceRow<T>(data as Record<string, unknown>) : null;
}

// ─── Social Accounts ───

export async function getSocialAccounts(platform?: string): Promise<SocialAccount[]> {
  let q = supabase.from('social_accounts').select('*');
  if (platform) q = q.eq('platform', platform);
  q = q.order('platform', { ascending: true }).order('created_at', { ascending: false });
  const { data, error } = await q;
  if (error) throw new Error(`DB error: ${error.message}`);
  return coerceRows<SocialAccount>(data);
}

export async function getSocialAccountByPlatform(platform: string): Promise<SocialAccount | null> {
  // Prefer connected account; fall back to most recently synced
  const { data, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('platform', platform)
    .order('connection_status', { ascending: true }) // 'connected' < 'disconnected'
    .order('last_sync_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`DB error: ${error.message}`);
  return data ? coerceRow<SocialAccount>(data as Record<string, unknown>) : null;
}

export async function getSocialAccountById(id: string): Promise<SocialAccount | null> {
  return selectOne<SocialAccount>('social_accounts', 'id', id);
}

export async function upsertSocialAccount(
  data: Partial<SocialAccount> & { platform: string; platform_account_id: string }
): Promise<SocialAccount> {
  // Look up by platform + platform_account_id (the unique external ID)
  const { data: matches } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('platform', data.platform)
    .eq('platform_account_id', data.platform_account_id)
    .maybeSingle();

  if (matches) {
    return (await updateSocialAccount(matches.id, data))!;
  }

  // Also check by platform_account_id alone (migration from single-account era)
  const { data: legacy } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('platform_account_id', data.platform_account_id)
    .maybeSingle();

  if (legacy) {
    return (await updateSocialAccount(legacy.id, data))!;
  }

  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('social_accounts').insert({
    id,
    platform: data.platform,
    platform_account_id: data.platform_account_id,
    username: data.username ?? null,
    display_name: data.display_name ?? null,
    account_type: data.account_type ?? null,
    profile_picture_url: data.profile_picture_url ?? null,
    connection_status: data.connection_status ?? 'connected',
    followers_count: data.followers_count ?? null,
    media_count: data.media_count ?? null,
    token_reference: data.token_reference ?? null,
    token_expires_at: data.token_expires_at ?? null,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
  return (await getSocialAccountById(id))!;
}

const SOCIAL_ACCOUNT_EDITABLE: (keyof SocialAccount)[] = [
  'username', 'display_name', 'account_type', 'profile_picture_url',
  'connection_status', 'followers_count', 'media_count',
  'token_reference', 'token_expires_at',
  'last_sync_at', 'last_sync_status', 'last_sync_error',
];

export async function updateSocialAccount(id: string, data: Partial<SocialAccount>): Promise<SocialAccount | null> {
  const updateData: Record<string, unknown> = { updated_at: nowStr() };
  for (const f of SOCIAL_ACCOUNT_EDITABLE) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  const { error } = await supabase.from('social_accounts').update(updateData).eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
  return getSocialAccountById(id);
}

export async function deleteSocialAccount(id: string): Promise<void> {
  const { error } = await supabase.from('social_accounts').delete().eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
}

// ─── Social Media Posts ───

export async function getSocialMediaPosts(accountId: string): Promise<SocialMediaPost[]> {
  const { data, error } = await supabase
    .from('social_media_posts')
    .select('*')
    .eq('social_account_id', accountId)
    .order('published_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);
  return coerceRows<SocialMediaPost>(data);
}

export async function getSocialMediaPostById(id: string): Promise<SocialMediaPost | null> {
  return selectOne<SocialMediaPost>('social_media_posts', 'id', id);
}

export async function getSocialMediaPostByPlatformId(platform: string, platformMediaId: string): Promise<SocialMediaPost | null> {
  const { data, error } = await supabase
    .from('social_media_posts')
    .select('*')
    .eq('platform', platform)
    .eq('platform_media_id', platformMediaId)
    .maybeSingle();
  if (error) throw new Error(`DB error: ${error.message}`);
  return data ? coerceRow<SocialMediaPost>(data as Record<string, unknown>) : null;
}

export async function getUnlinkedPosts(accountId: string): Promise<SocialMediaPost[]> {
  // Get all linked post IDs
  const { data: links } = await supabase.from('reel_social_links').select('social_media_post_id');
  const linkedIds = new Set((links || []).map(l => l.social_media_post_id));

  const { data, error } = await supabase
    .from('social_media_posts')
    .select('*')
    .eq('social_account_id', accountId)
    .eq('is_ignored', false)
    .in('sync_status', ['new', 'unlinked'])
    .order('published_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);

  return ((data as Record<string, unknown>[]) || [])
    .filter(r => !linkedIds.has(r.id as string))
    .map(coerceRow<SocialMediaPost>);
}

export async function createSocialMediaPost(
  data: Partial<SocialMediaPost> & { social_account_id: string; platform: string; platform_media_id: string }
): Promise<SocialMediaPost> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('social_media_posts').insert({
    id,
    social_account_id: data.social_account_id,
    platform: data.platform,
    platform_media_id: data.platform_media_id,
    media_type: data.media_type || 'VIDEO',
    media_product_type: data.media_product_type ?? null,
    caption: data.caption ?? null,
    permalink: data.permalink ?? null,
    thumbnail_url: data.thumbnail_url ?? null,
    media_url: data.media_url ?? null,
    published_at: data.published_at ?? null,
    facebook_post_id: data.facebook_post_id ?? null,
    sync_status: data.sync_status || 'new',
    is_ignored: data.is_ignored ?? false,
    last_synced_at: data.last_synced_at ?? null,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
  return (await getSocialMediaPostById(id))!;
}

const SOCIAL_POST_EDITABLE: (keyof SocialMediaPost)[] = [
  'media_type', 'media_product_type', 'caption', 'permalink',
  'thumbnail_url', 'media_url', 'published_at', 'facebook_post_id',
  'sync_status', 'is_ignored', 'last_synced_at',
];

export async function updateSocialMediaPost(id: string, data: Partial<SocialMediaPost>): Promise<SocialMediaPost | null> {
  const updateData: Record<string, unknown> = { updated_at: nowStr() };
  for (const f of SOCIAL_POST_EDITABLE) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  if (Object.keys(updateData).length === 1) return getSocialMediaPostById(id);
  const { error } = await supabase.from('social_media_posts').update(updateData).eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
  return getSocialMediaPostById(id);
}

export async function ignoreSocialMediaPost(id: string): Promise<void> {
  const { error } = await supabase
    .from('social_media_posts')
    .update({ is_ignored: true, sync_status: 'ignored', updated_at: nowStr() })
    .eq('id', id);
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function upsertSocialMediaPost(
  accountId: string, platform: string,
  mediaData: {
    platform_media_id: string; media_type: string; media_product_type?: string | null;
    caption?: string | null; permalink?: string | null; thumbnail_url?: string | null;
    media_url?: string | null; published_at?: string | null;
  }
): Promise<SocialMediaPost> {
  const existing = await getSocialMediaPostByPlatformId(platform, mediaData.platform_media_id);
  if (existing) {
    return (await updateSocialMediaPost(existing.id, {
      media_type: mediaData.media_type as SocialMediaPost['media_type'],
      media_product_type: mediaData.media_product_type || null,
      caption: mediaData.caption || null,
      permalink: mediaData.permalink || null,
      thumbnail_url: mediaData.thumbnail_url || null,
      media_url: mediaData.media_url || null,
      published_at: mediaData.published_at || null,
      last_synced_at: nowStr(),
    }))!;
  }
  return createSocialMediaPost({
    social_account_id: accountId,
    platform,
    platform_media_id: mediaData.platform_media_id,
    media_type: mediaData.media_type as SocialMediaPost['media_type'],
    media_product_type: mediaData.media_product_type || null,
    caption: mediaData.caption || null,
    permalink: mediaData.permalink || null,
    thumbnail_url: mediaData.thumbnail_url || null,
    media_url: mediaData.media_url || null,
    published_at: mediaData.published_at || null,
    sync_status: 'new',
  });
}

// ─── Reel Social Links ───

export async function getReelSocialLinkByReelId(reelId: string): Promise<ReelSocialLink | null> {
  return selectOne<ReelSocialLink>('reel_social_links', 'local_reel_id', reelId);
}

export async function getReelSocialLinkByPostId(postId: string): Promise<ReelSocialLink | null> {
  return selectOne<ReelSocialLink>('reel_social_links', 'social_media_post_id', postId);
}

export async function getLinkedPostForReel(reelId: string): Promise<{ link: ReelSocialLink; post: SocialMediaPost } | null> {
  const link = await getReelSocialLinkByReelId(reelId);
  if (!link) return null;
  const post = await getSocialMediaPostById(link.social_media_post_id);
  if (!post) return null;
  return { link, post };
}

export async function getLinkedReelsForPosts(postIds: string[]): Promise<Record<string, ReelSocialLink>> {
  if (postIds.length === 0) return {};
  const { data, error } = await supabase
    .from('reel_social_links')
    .select('*')
    .in('social_media_post_id', postIds);
  if (error) throw new Error(`DB error: ${error.message}`);
  const map: Record<string, ReelSocialLink> = {};
  for (const l of coerceRows<ReelSocialLink>(data)) {
    map[l.social_media_post_id] = l;
  }
  return map;
}

export async function createReelSocialLink(
  localReelId: string, postId: string, platform: string,
  platformMediaId: string, manually: boolean = true, confidence?: number
): Promise<ReelSocialLink> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('reel_social_links').insert({
    id,
    local_reel_id: localReelId,
    social_media_post_id: postId,
    platform,
    platform_media_id: platformMediaId,
    linked_at: now,
    linked_manually: manually,
    match_confidence: confidence ?? null,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);

  await ignoreSocialMediaPost(postId);
  await supabase.from('social_media_posts').update({ sync_status: 'linked', updated_at: nowStr() }).eq('id', postId);

  // Update the local reel
  const post = await getSocialMediaPostById(postId);
  if (post) {
    const { data: reel } = await supabase
      .from('reels')
      .select('id, status')
      .eq('id', localReelId)
      .maybeSingle();
    if (reel && reel.status !== 'published') {
      await supabase.from('reels').update({
        publication_link: post.permalink || '',
        status: 'published',
        published_date: post.published_at || now,
        updated_at: now,
      }).eq('id', localReelId);
    }
  }

  return (await selectOne<ReelSocialLink>('reel_social_links', 'id', id))!;
}

export async function removeReelSocialLink(id: string, keepMetrics: boolean = true): Promise<void> {
  const link = await selectOne<ReelSocialLink>('reel_social_links', 'id', id);
  if (!link) return;

  await supabase.from('social_media_posts').update({ sync_status: 'unlinked', updated_at: nowStr() }).eq('id', link.social_media_post_id);
  if (!keepMetrics) {
    await supabase.from('social_media_metric_snapshots').delete().eq('social_media_post_id', link.social_media_post_id);
  }
  await supabase.from('reel_social_links').delete().eq('id', id);
}

export async function getUnlinkedReels(platform: string = 'instagram'): Promise<
  { id: string; title: string; project: string | null; status: string; scheduled_date: string | null; published_date: string | null }[]
> {
  const { data: links } = await supabase.from('reel_social_links').select('local_reel_id').eq('platform', platform);
  const linkedIds = new Set((links || []).map(l => l.local_reel_id));

  const { data, error } = await supabase
    .from('reels')
    .select('id, title, project, status, scheduled_date, published_date')
    .eq('is_archived', false)
    .in('status', ['published', 'scheduled', 'ready_to_record', 'recorded', 'editing', 'reviewing'])
    .order('scheduled_date', { ascending: false, nullsFirst: false })
    .order('published_date', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);

  return ((data || []) as { id: string; title: string; project: string | null; status: string; scheduled_date: string | null; published_date: string | null }[])
    .filter(r => !linkedIds.has(r.id));
}

// ─── YouTube Social Links ───

export async function getYouTubeSocialLinkByVideoId(videoId: string): Promise<YouTubeSocialLink | null> {
  return selectOne<YouTubeSocialLink>('youtube_social_links', 'local_youtube_video_id', videoId);
}

export async function getYouTubeSocialLinkByPostId(postId: string): Promise<YouTubeSocialLink | null> {
  return selectOne<YouTubeSocialLink>('youtube_social_links', 'social_media_post_id', postId);
}

export async function getLinkedPostForYouTubeVideo(videoId: string): Promise<{ link: YouTubeSocialLink; post: SocialMediaPost } | null> {
  const link = await getYouTubeSocialLinkByVideoId(videoId);
  if (!link) return null;
  const post = await getSocialMediaPostById(link.social_media_post_id);
  if (!post) return null;
  return { link, post };
}

export async function createYouTubeSocialLink(
  localVideoId: string, postId: string, platform: string,
  platformMediaId: string, manually: boolean = true, confidence?: number
): Promise<YouTubeSocialLink> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('youtube_social_links').insert({
    id,
    local_youtube_video_id: localVideoId,
    social_media_post_id: postId,
    platform,
    platform_media_id: platformMediaId,
    linked_at: now,
    linked_manually: manually,
    match_confidence: confidence ?? null,
    created_at: now,
    updated_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);

  await supabase.from('social_media_posts').update({ sync_status: 'linked', updated_at: nowStr() }).eq('id', postId);

  const post = await getSocialMediaPostById(postId);
  if (post) {
    await supabase
      .from('youtube_videos')
      .update({
        published_link: post.permalink || '',
        status: 'published',
        published_date: post.published_at || now,
        updated_at: now,
      })
      .eq('id', localVideoId)
      .neq('status', 'published');
  }

  return (await selectOne<YouTubeSocialLink>('youtube_social_links', 'id', id))!;
}

export async function removeYouTubeSocialLink(id: string, keepMetrics: boolean = true): Promise<void> {
  const link = await selectOne<YouTubeSocialLink>('youtube_social_links', 'id', id);
  if (!link) return;

  await supabase.from('social_media_posts').update({ sync_status: 'unlinked', updated_at: nowStr() }).eq('id', link.social_media_post_id);
  if (!keepMetrics) {
    await supabase.from('social_media_metric_snapshots').delete().eq('social_media_post_id', link.social_media_post_id);
  }
  await supabase.from('youtube_social_links').delete().eq('id', id);
}

export async function getUnlinkedYouTubeVideos(platform: string = 'youtube'): Promise<
  { id: string; provisional_title: string; project: string | null; status: string; published_date: string | null }[]
> {
  const { data: links } = await supabase.from('youtube_social_links').select('local_youtube_video_id').eq('platform', platform);
  const linkedIds = new Set((links || []).map(l => l.local_youtube_video_id));

  const { data, error } = await supabase
    .from('youtube_videos')
    .select('id, provisional_title, project, status, published_date')
    .eq('is_archived', false)
    .in('status', ['published', 'scheduled', 'ready_to_record', 'recorded', 'editing', 'thumbnail', 'review'])
    .order('published_date', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);

  return ((data || []) as { id: string; provisional_title: string; project: string | null; status: string; published_date: string | null }[])
    .filter(r => !linkedIds.has(r.id));
}

// ─── Combined unlinked content ───

export interface UnlinkedContentItem {
  id: string;
  title: string;
  project: string | null;
  status: string;
  date: string | null;
  entityType: 'reel' | 'youtube_video';
}

export async function getUnlinkedContent(platform: string): Promise<UnlinkedContentItem[]> {
  const [reels, videos] = await Promise.all([
    getUnlinkedReels(platform),
    getUnlinkedYouTubeVideos(platform),
  ]);

  const items: UnlinkedContentItem[] = [
    ...reels.map(r => ({ id: r.id, title: r.title, project: r.project, status: r.status, date: r.published_date || r.scheduled_date, entityType: 'reel' as const })),
    ...videos.map(v => ({ id: v.id, title: v.provisional_title, project: v.project, status: v.status, date: v.published_date, entityType: 'youtube_video' as const })),
  ];

  items.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });

  return items;
}

// ─── Metrics Snapshots ───

export async function getMetricSnapshots(postId: string): Promise<SocialMediaMetricSnapshot[]> {
  const { data, error } = await supabase
    .from('social_media_metric_snapshots')
    .select('*')
    .eq('social_media_post_id', postId)
    .order('captured_at', { ascending: false })
    .order('metric_name', { ascending: true });
  if (error) throw new Error(`DB error: ${error.message}`);
  return (data || []) as unknown as SocialMediaMetricSnapshot[];
}

export async function getLatestMetricsByPost(postId: string): Promise<Record<string, SocialMediaMetricSnapshot>> {
  // Fetch all snapshots for this post (with index, fast) and deduplicate in JS
  const { data, error } = await supabase
    .from('social_media_metric_snapshots')
    .select('*')
    .eq('social_media_post_id', postId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);

  const map: Record<string, SocialMediaMetricSnapshot> = {};
  for (const s of (data || []) as SocialMediaMetricSnapshot[]) {
    if (!map[s.metric_name]) {
      map[s.metric_name] = s;
    }
  }
  return map;
}

export async function createMetricSnapshot(
  postId: string, metricName: string, value: number | null,
  unit: string | null, apiVersion: string | null,
  status: 'ok' | 'unavailable' | 'error' = 'ok', errorMsg?: string
): Promise<void> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('social_media_metric_snapshots').insert({
    id,
    social_media_post_id: postId,
    metric_name: metricName,
    metric_value: value,
    metric_unit: unit,
    captured_at: now,
    api_version: apiVersion,
    sync_status: status,
    error_message: errorMsg || null,
    created_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function createMetricSnapshotsBatch(
  postId: string, metrics: Record<string, { value: number | null; unit?: string }>,
  apiVersion: string | null
): Promise<void> {
  const now = nowStr();
  const snapshots = Object.entries(metrics).map(([name, m]) => ({
    id: crypto.randomUUID(),
    social_media_post_id: postId,
    metric_name: name,
    metric_value: m.value,
    metric_unit: m.unit || null,
    captured_at: now,
    api_version: apiVersion,
    sync_status: 'ok' as const,
    error_message: null,
    created_at: now,
  }));

  const { error } = await supabase.from('social_media_metric_snapshots').insert(snapshots);
  if (error) throw new Error(`DB error: ${error.message}`);

  // Clean up old snapshots: keep only the latest per metric_name
  for (const name of Object.keys(metrics)) {
    // Get the ID of the latest snapshot for this metric
    const { data: latest } = await supabase
      .from('social_media_metric_snapshots')
      .select('id')
      .eq('social_media_post_id', postId)
      .eq('metric_name', name)
      .order('created_at', { ascending: false })
      .limit(1);
    if (latest && latest.length > 0) {
      await supabase
        .from('social_media_metric_snapshots')
        .delete()
        .eq('social_media_post_id', postId)
        .eq('metric_name', name)
        .neq('id', latest[0].id);
    }
  }
}

export async function getAggregatedMetrics(accountId: string): Promise<Record<string, number>> {
  // Fetch all posts for this account, then all snapshots, deduplicate in JS
  const { data: posts, error: postsErr } = await supabase
    .from('social_media_posts')
    .select('id')
    .eq('social_account_id', accountId);
  if (postsErr) throw new Error(`DB error: ${postsErr.message}`);
  const postIds = (posts || []).map(p => p.id);
  if (postIds.length === 0) return {};

  const { data: snapshots, error: snapErr } = await supabase
    .from('social_media_metric_snapshots')
    .select('metric_name, metric_value, social_media_post_id, created_at')
    .in('social_media_post_id', postIds)
    .order('created_at', { ascending: false });
  if (snapErr) throw new Error(`DB error: ${snapErr.message}`);

  // Keep latest per (post_id, metric_name)
  const latest = new Map<string, { metric_name: string; metric_value: number | null }>();
  for (const s of (snapshots || []) as { metric_name: string; metric_value: number | null; social_media_post_id: string }[]) {
    const key = `${s.social_media_post_id}:${s.metric_name}`;
    if (!latest.has(key)) latest.set(key, s);
  }

  // Aggregate
  let plays = 0, reach = 0, likes = 0, comments = 0, saves = 0, shares = 0;
  for (const s of latest.values()) {
    const v = s.metric_value || 0;
    if (s.metric_name === 'plays' || s.metric_name === 'views') plays += v;
    else if (s.metric_name === 'reach') reach += v;
    else if (s.metric_name === 'likes') likes += v;
    else if (s.metric_name === 'comments') comments += v;
    else if (s.metric_name === 'saves') saves += v;
    else if (s.metric_name === 'shares') shares += v;
  }

  return { total_plays: plays, total_reach: reach, total_likes: likes, total_comments: comments, total_saves: saves, total_shares: shares };
}

export type CombinedMetrics = {
  total_views: number; total_likes: number; total_comments: number;
  total_reach: number; total_saves: number; total_shares: number;
};

export async function getCombinedMetrics(): Promise<CombinedMetrics> {
  // Same approach: fetch all snapshots, deduplicate in JS
  const { data: snapshots, error } = await supabase
    .from('social_media_metric_snapshots')
    .select('metric_name, metric_value, social_media_post_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`DB error: ${error.message}`);

  // Keep latest per (post_id, metric_name)
  const latest = new Map<string, { metric_name: string; metric_value: number | null }>();
  for (const s of (snapshots || []) as { metric_name: string; metric_value: number | null; social_media_post_id: string }[]) {
    const key = `${s.social_media_post_id}:${s.metric_name}`;
    if (!latest.has(key)) latest.set(key, s);
  }

  let views = 0, likes = 0, comments = 0, reach = 0, saves = 0, shares = 0;
  for (const s of latest.values()) {
    const v = s.metric_value || 0;
    if (s.metric_name === 'plays' || s.metric_name === 'views') views += v;
    if (s.metric_name === 'likes') likes += v;
    if (s.metric_name === 'comments') comments += v;
    if (s.metric_name === 'reach') reach += v;
    if (s.metric_name === 'saves') saves += v;
    if (s.metric_name === 'shares') shares += v;
  }

  return { total_views: views, total_likes: likes, total_comments: comments, total_reach: reach, total_saves: saves, total_shares: shares };
}

// ─── Account Snapshots ───

export async function createAccountSnapshot(accountId: string, data: Partial<SocialAccountSnapshot>, apiVersion?: string): Promise<void> {
  const now = nowStr();
  const { error } = await supabase.from('social_account_snapshots').insert({
    id: crypto.randomUUID(),
    social_account_id: accountId,
    followers_count: data.followers_count ?? null,
    media_count: data.media_count ?? null,
    reach: data.reach ?? null,
    impressions: data.impressions ?? null,
    profile_views: data.profile_views ?? null,
    interactions: data.interactions ?? null,
    captured_at: now,
    api_version: apiVersion || null,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function getAccountSnapshots(accountId: string, limit: number = 30): Promise<SocialAccountSnapshot[]> {
  const { data, error } = await supabase
    .from('social_account_snapshots')
    .select('*')
    .eq('social_account_id', accountId)
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`DB error: ${error.message}`);
  return (data || []) as unknown as SocialAccountSnapshot[];
}

// ─── Sync Logs ───

export async function logSyncEvent(accountId: string, eventType: string, status: string, details?: string): Promise<void> {
  const { error } = await supabase.from('social_sync_logs').insert({
    id: crypto.randomUUID(),
    social_account_id: accountId,
    event_type: eventType,
    status,
    details: details || null,
    created_at: nowStr(),
  });
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function createSyncLog(
  accountId: string,
  syncType: 'manual' | 'auto' | 'on_open'
): Promise<string> {
  const id = crypto.randomUUID();
  const now = nowStr();
  const { error } = await supabase.from('social_sync_logs').insert({
    id,
    social_account_id: accountId,
    sync_type: syncType,
    started_at: now,
    status: 'running',
    created_at: now,
  });
  if (error) throw new Error(`DB error: ${error.message}`);
  return id;
}

export async function completeSyncLog(
  logId: string,
  data: {
    status: 'completed' | 'partial' | 'failed' | 'cancelled';
    posts_found?: number; posts_created?: number; posts_updated?: number;
    metrics_updated?: number; errors_count?: number; error_details?: string;
  }
): Promise<void> {
  const updateData: Record<string, unknown> = {
    finished_at: nowStr(),
    status: data.status,
  };
  for (const key of ['posts_found', 'posts_created', 'posts_updated', 'metrics_updated', 'errors_count', 'error_details'] as const) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }
  const { error } = await supabase.from('social_sync_logs').update(updateData).eq('id', logId);
  if (error) throw new Error(`DB error: ${error.message}`);
}

export async function getSyncLogs(accountId: string, limit: number = 50): Promise<SocialSyncLog[]> {
  const { data, error } = await supabase
    .from('social_sync_logs')
    .select('*')
    .eq('social_account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`DB error: ${error.message}`);
  return (data || []) as unknown as SocialSyncLog[];
}

// ─── Social Account Overview (for Dashboard) ───

export interface SocialAccountOverview {
  account: SocialAccount;
  totalPosts: number;
  linkedPosts: number;
  unlinkedPosts: number;
  reelCount: number;
}

export async function getSocialAccountOverview(accountId: string): Promise<SocialAccountOverview> {
  const account = await getSocialAccountById(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const { data: allPosts } = await supabase
    .from('social_media_posts')
    .select('id', { count: 'exact', head: true })
    .eq('social_account_id', accountId);
  const totalPosts = allPosts?.length ?? 0;

  const { data: linkedPosts } = await supabase
    .from('social_media_posts')
    .select('id', { count: 'exact', head: true })
    .eq('social_account_id', accountId)
    .eq('sync_status', 'linked');
  const linkedCount = linkedPosts?.length ?? 0;

  // Unlinked: sync_status IN ('new','unlinked') AND is_ignored = false AND not in reel_social_links
  const { data: unlinked } = await supabase
    .from('social_media_posts')
    .select('id')
    .eq('social_account_id', accountId)
    .in('sync_status', ['new', 'unlinked'])
    .eq('is_ignored', false);
  // Filter out linked posts
  const unlinkedIds = (unlinked || []).map(p => p.id);
  const { data: reelLinks } = await supabase
    .from('reel_social_links')
    .select('social_media_post_id')
    .in('social_media_post_id', unlinkedIds.length > 0 ? unlinkedIds : ['__none__']);
  const linkedSet = new Set((reelLinks || []).map(l => l.social_media_post_id));
  const unlinkedCount = unlinkedIds.filter(id => !linkedSet.has(id)).length;

  const { data: reels } = await supabase
    .from('social_media_posts')
    .select('id', { count: 'exact', head: true })
    .eq('social_account_id', accountId)
    .eq('media_type', 'REEL');
  const reelCount = reels?.length ?? 0;

  return { account, totalPosts, linkedPosts: linkedCount, unlinkedPosts: unlinkedCount, reelCount };
}
