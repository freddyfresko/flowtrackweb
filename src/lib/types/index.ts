// FlowTrack Type Definitions

export interface Client {
  id: string;
  name: string;
  artist_name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  social_media: string | null;
  preferred_contact: string | null;
  notes: string | null;
  first_contact_date: string | null;
  status: 'prospect' | 'active' | 'inactive' | 'frequent' | 'archived';
  created_at: string;
  updated_at: string;
  is_archived: number;
}

export interface Reel {
  id: string;
  job_id: string | null;
  title: string;
  idea: string | null;
  script: string | null;
  project: string | null;
  platform: string | null;
  category: string | null;
  objective: string | null;
  call_to_action: string | null;
  recording_date: string | null;
  editing_date: string | null;
  scheduled_date: string | null;
  published_date: string | null;
  file_path: string | null;
  reference_link: string | null;
  publication_link: string | null;
  notes: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: ReelStatus;
  created_at: string;
  updated_at: string;
  is_archived: number;
}

export type ReelStatus =
  | 'idea'
  | 'script'
  | 'ready_to_record'
  | 'recorded'
  | 'editing'
  | 'reviewing'
  | 'scheduled'
  | 'published'
  | 'paused'
  | 'discarded';

export interface YouTubeVideo {
  id: string;
  job_id: string | null;
  provisional_title: string;
  final_title: string | null;
  idea: string | null;
  objective: string | null;
  project: string | null;
  script: string | null;
  research: string | null;
  resources: string | null;
  references: string | null;
  description: string | null;
  tags: string | null;
  thumbnail: string | null;
  recording_date: string | null;
  editing_date: string | null;
  published_date: string | null;
  material_path: string | null;
  project_path: string | null;
  published_link: string | null;
  notes: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: YouTubeStatus;
  created_at: string;
  updated_at: string;
  is_archived: number;
}

export type YouTubeStatus =
  | 'idea'
  | 'research'
  | 'script'
  | 'ready_to_record'
  | 'recorded'
  | 'editing'
  | 'thumbnail'
  | 'review'
  | 'scheduled'
  | 'published'
  | 'paused'
  | 'discarded';

export interface Job {
  id: string;
  client_id: string | null;
  type: 'youtube_video' | 'social_video' | 'music_production' | 'consultancy' | 'filmmaker_videoclip' | 'filmmaker_reels' | 'audio_mix' | 'audio_mastering' | 'audio_ep' | 'audio_album' | 'other';
  title: string;
  description: string | null;
  status: JobStatus;
  budget: number | null;
  deposit: number | null;
  balance: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_archived: number;
}

export type JobStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_client'
  | 'in_review'
  | 'with_changes'
  | 'blocked'
  | 'delivered'
  | 'cancelled'
  | 'archived';

export interface DigitalProject {
  id: string;
  name: string;
  description: string | null;
  current_objective: string | null;
  status: ProjectStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  start_date: string | null;
  target_date: string | null;
  last_activity: string | null;
  next_step: string | null;
  local_folder: string | null;
  repository: string | null;
  url: string | null;
  technologies: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_archived: number;
}

export type ProjectStatus =
  | 'idea'
  | 'research'
  | 'planning'
  | 'development'
  | 'testing'
  | 'paused'
  | 'blocked'
  | 'launched'
  | 'maintenance'
  | 'archived';

export interface MusicProject {
  id: string;
  job_id: string | null;
  client_id: string | null;
  source_type: 'personal' | 'client_job';
  title: string;
  artist: string | null;
  project_type: 'single' | 'ep' | 'album' | 'beat' | 'mix' | 'mastering' | 'recording' | 'other';
  status: MusicProjectStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  start_date: string | null;
  target_date: string | null;
  total_tracks: number | null;
  bpm: string | null;
  key: string | null;
  musical_refs: string | null;
  client_observations: string | null;
  stems_path: string | null;
  session_path: string | null;
  exports_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_archived: number;
}

export type MusicProjectStatus =
  | 'idea'
  | 'preproduction'
  | 'recording'
  | 'editing'
  | 'mixing'
  | 'mastering'
  | 'review'
  | 'delivered'
  | 'archived';

export interface MusicTrack {
  id: string;
  music_project_id: string;
  title: string;
  track_number: number | null;
  bpm: string | null;
  key: string | null;
  status: 'pending' | 'recording' | 'editing' | 'mixed' | 'mastered' | 'delivered';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  area: string | null;
  client_id: string | null;
  job_id: string | null;
  project_id: string | null;
  source_type: string | null;
  source_id: string | null;
  rule_key: string | null;
  auto_generated: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: TaskStatus;
  due_date: string | null;
  estimated_time: number | null;
  actual_time: number | null;
  tags: string | null;
  notes: string | null;
  parent_task_id: string | null;
  is_recurring: number;
  recurrence_rule: string | null;
  created_at: string;
  updated_at: string;
  is_archived: number;
  subtask_count?: number;
}

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'testing'
  | 'completed'
  | 'cancelled';

export interface Consultancy {
  id: string;
  client_id: string | null;
  contact_name: string | null;
  topic: string;
  objective: string | null;
  date: string;
  time: string | null;
  duration: number | null;
  contact_method: string | null;
  payment_status: 'pending' | 'paid' | 'partial';
  amount: number | null;
  pre_notes: string | null;
  diagnosis: string | null;
  agreements: string | null;
  next_steps: string | null;
  follow_up: string | null;
  files: string | null;
  status: ConsultancyStatus;
  created_at: string;
  updated_at: string;
  is_archived: number;
}

export type ConsultancyStatus =
  | 'requested'
  | 'scheduled'
  | 'confirmed'
  | 'paid'
  | 'completed'
  | 'in_follow_up'
  | 'closed'
  | 'cancelled';

export interface Income {
  id: string;
  date: string;
  concept: string;
  amount: number;
  client_id: string | null;
  job_id: string | null;
  project_id: string | null;
  category: string | null;
  payment_method: string | null;
  status: 'expected' | 'pending' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  receipt: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  date: string;
  concept: string;
  amount: number;
  category: string | null;
  project_id: string | null;
  job_id: string | null;
  provider: string | null;
  payment_method: string | null;
  expense_type: 'one_time' | 'monthly' | 'annual' | 'recurring';
  receipt: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSession {
  id: string;
  project_id: string | null;
  task_id: string | null;
  reel_id: string | null;
  youtube_id: string | null;
  job_id: string | null;
  consultancy_id: string | null;
  session_type: string | null;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  description: string | null;
  result: string | null;
  notes: string | null;
  created_at: string;
}

// ─── Social / Instagram Module ───

export interface SocialAccount {
  id: string;
  platform: string;
  platform_account_id: string;
  username: string | null;
  display_name: string | null;
  account_type: string | null;
  profile_picture_url: string | null;
  connection_status: 'connected' | 'disconnected' | 'expired' | 'error';
  followers_count: number | null;
  media_count: number | null;
  token_reference: string | null;
  token_expires_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaPost {
  id: string;
  social_account_id: string;
  platform: string;
  platform_media_id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REEL' | 'STORY';
  media_product_type: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  published_at: string | null;
  facebook_post_id: string | null;
  sync_status: 'new' | 'unlinked' | 'linked' | 'ignored' | 'sync_error' | 'unsupported';
  is_ignored: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReelSocialLink {
  id: string;
  local_reel_id: string;
  social_media_post_id: string;
  platform: string;
  platform_media_id: string;
  linked_at: string;
  linked_manually: number;
  match_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface YouTubeSocialLink {
  id: string;
  local_youtube_video_id: string;
  social_media_post_id: string;
  platform: string;
  platform_media_id: string;
  linked_at: string;
  linked_manually: number;
  match_confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaMetricSnapshot {
  id: string;
  social_media_post_id: string;
  metric_name: string;
  metric_value: number | null;
  metric_unit: string | null;
  captured_at: string;
  api_version: string | null;
  sync_status: 'ok' | 'unavailable' | 'error';
  error_message: string | null;
  created_at: string;
}

export interface SocialAccountSnapshot {
  id: string;
  social_account_id: string;
  followers_count: number | null;
  media_count: number | null;
  reach: number | null;
  impressions: number | null;
  profile_views: number | null;
  interactions: number | null;
  captured_at: string;
  api_version: string | null;
  created_at: string;
}

export interface SocialSyncLog {
  id: string;
  social_account_id: string;
  sync_type: 'manual' | 'auto' | 'on_open';
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  posts_found: number;
  posts_created: number;
  posts_updated: number;
  metrics_updated: number;
  errors_count: number;
  error_details: string | null;
  created_at: string;
}

// Instagram-specific response types (normalized)

export interface InstagramAccountInfo {
  id: string;
  username: string;
  name: string;
  account_type: string;
  profile_picture_url: string | null;
  followers_count: number;
  media_count: number;
}

export interface InstagramMediaItem {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REEL';
  media_product_type: string;
  caption: string | null;
  permalink: string;
  thumbnail_url: string | null;
  media_url: string | null;
  timestamp: string;
  facebook_post_id: string | null;
  insights: InstagramMediaInsights | null;
}

export interface InstagramMediaInsights {
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  plays: number | null;
  profile_views: number | null;
  follows: number | null;
}

export interface YouTubeAccountInfo {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  subscribers: number;
  videoCount: number;
  viewCount: number;
}

export interface YouTubeVideoItem {
  id: string;
  videoId: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  publishedAt: string;
  channelId: string;
  statistics: YouTubeVideoStats | null;
}

export interface YouTubeVideoStats {
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export type LinkStatus =
  | 'unlinked'
  | 'linked'
  | 'ignored'
  | 'sync_error'
  | 'unsupported';

// ─── Agenda Module ───

export type AgendaItemType =
  | 'meeting'
  | 'call'
  | 'recording'
  | 'music_production'
  | 'consultancy'
  | 'delivery'
  | 'event'
  | 'reminder'
  | 'other';

export type AgendaStatus = 'pending' | 'confirmed' | 'in_progress' | 'done' | 'cancelled';

export type AgendaPriority = 'low' | 'medium' | 'high' | 'urgent';

/** `source_module` values that may project dates into the Calendar view. */
export type CalendarSourceModule =
  | 'agenda'
  | 'tasks'
  | 'social'
  | 'content'
  | 'music'
  | 'jobs'
  | 'consultancies'
  | 'projects'
  | 'finance';

export interface AgendaItem {
  id: string;
  title: string;
  description: string | null;
  item_type: AgendaItemType;
  source_module: string | null;
  client_id: string | null;
  project_id: string | null;
  job_id: string | null;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  duration: number | null; // minutes
  priority: AgendaPriority;
  status: AgendaStatus;
  location: string | null;
  tags: string | null; // comma-separated
  created_at: string;
  updated_at: string;
  is_archived: number;
  client_name?: string;
  project_name?: string;
}

export interface AgendaReminder {
  id: string;
  agenda_item_id: string;
  reminder_offset: number | null; // e.g. 10, 1, 24
  reminder_unit: 'minutes' | 'hours' | 'days';
  reminder_time: string | null; // absolute time HH:MM (optional)
  fired: number;
  created_at: string;
}
