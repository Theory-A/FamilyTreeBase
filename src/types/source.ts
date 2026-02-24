/**
 * Source document metadata stored in the source_documents table
 */
export interface SourceDocument {
  id: string;
  storage_path: string;
  storage_url: string;
  thumbnail_url?: string;

  title: string;
  document_date?: string;
  is_approximate_date?: boolean;

  source_notes?: string;
  source_location?: string;

  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
  uploaded_at: string;
}

/**
 * Channel mode for isolation/boost
 */
export type ChannelMode = 'none' | 'red' | 'blue' | 'green';

/**
 * Filter settings for the magnifier
 */
export interface FilterSettings {
  // Basic adjustments
  brightness: number; // 0.5 - 2.0, default 1
  contrast: number; // 0.5 - 3.0, default 1
  gamma: number; // 0.3 - 3.0, default 1 (1 = no change)

  // Color manipulation
  grayscale: number; // 0 - 1, default 0
  invert: number; // 0 - 1, default 0
  channelMode: ChannelMode; // channel isolation, default 'none'

  // Sharpening
  unsharpAmount: number; // 0 - 3, default 0 (disabled)
  unsharpRadius: number; // 1 - 5, default 2

  // Binarization
  threshold: number; // 0 - 1, default 0 (disabled)
  adaptiveThreshold: boolean; // use Sauvola instead of global
  adaptiveK: number; // Sauvola k parameter, 0.1 - 0.5, default 0.2
  adaptiveRadius: number; // window radius in pixels, 5 - 30, default 15
}

/**
 * Filter presets for common document enhancement scenarios
 */
export type FilterPreset =
  | "original"
  | "faded-ink"
  | "yellowed-paper"
  | "high-contrast"
  | "photo-negative"
  | "handwriting";

/**
 * Default filter settings (original/unmodified)
 */
export const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  brightness: 1,
  contrast: 1,
  gamma: 1,
  grayscale: 0,
  invert: 0,
  channelMode: 'none',
  unsharpAmount: 0,
  unsharpRadius: 2,
  threshold: 0,
  adaptiveThreshold: false,
  adaptiveK: 0.2,
  adaptiveRadius: 15,
};

/**
 * Filter preset configurations
 * Each preset is optimized for specific document degradation scenarios
 */
export const FILTER_PRESETS: Record<FilterPreset, FilterSettings> = {
  // Baseline - no modifications
  original: {
    ...DEFAULT_FILTER_SETTINGS,
  },

  // Faded Ink: For documents where ink has oxidized/degraded
  // Uses gamma correction (better than linear brightness for faded ink)
  // High contrast to separate faint traces from paper
  "faded-ink": {
    ...DEFAULT_FILTER_SETTINGS,
    gamma: 0.75, // Darkens midtones, recovers faded strokes
    contrast: 2.0,
    grayscale: 1,
  },

  // Yellowed Paper: Compensates for age-related paper discoloration
  // Blue channel boost helps counteract yellow cast
  "yellowed-paper": {
    ...DEFAULT_FILTER_SETTINGS,
    brightness: 1.05,
    contrast: 1.3,
    grayscale: 0.7, // Partial - preserves some color for red seals
    channelMode: 'blue', // Boosts blue to counteract yellow
  },

  // High Contrast: OCR-ready binarization using adaptive Sauvola threshold
  // Handles uneven illumination and paper degradation
  "high-contrast": {
    ...DEFAULT_FILTER_SETTINGS,
    contrast: 1.5,
    grayscale: 1,
    threshold: 0.5,
    adaptiveThreshold: true, // Sauvola - much better than global
    adaptiveK: 0.2,
    adaptiveRadius: 15,
  },

  // Photo Negative: Inverts for examining negatives or revealing hidden marks
  "photo-negative": {
    ...DEFAULT_FILTER_SETTINGS,
    invert: 1,
  },

  // Handwriting: Optimized for manuscript/cursive with thin strokes
  // Unsharp mask enhances stroke edges without destroying connecting strokes
  handwriting: {
    ...DEFAULT_FILTER_SETTINGS,
    gamma: 0.9,
    contrast: 1.6,
    grayscale: 0.4, // Preserves ink density variation (濃淡)
    unsharpAmount: 1.2,
    unsharpRadius: 2,
  },
};

/**
 * Request body for uploading a new source document
 */
export interface SourceUploadRequest {
  title: string;
  document_date?: string;
  is_approximate_date?: boolean;
  source_notes?: string;
  source_location?: string;
}

/**
 * Request body for updating source document metadata
 */
export interface SourceUpdateRequest {
  title?: string;
  document_date?: string;
  is_approximate_date?: boolean;
  source_notes?: string;
  source_location?: string;
}

/**
 * Response from source document API endpoints
 */
export interface SourceApiResponse {
  success: boolean;
  document?: SourceDocument;
  documents?: SourceDocument[];
  error?: string;
}

/**
 * Sort options for the gallery
 */
export type SortOption = "uploaded_at" | "document_date";
