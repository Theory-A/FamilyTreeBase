/**
 * Image metadata stored in the family_images table
 */
export interface ImageMetadata {
  id: string;
  storage_path: string;
  storage_url: string;
  thumbnail_url?: string;
  tagged_node_ids: string[];
  caption?: string;
  date_taken?: string;
  is_approximate_date?: boolean;
  uploaded_at: string;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type?: string;
}

/**
 * Avatar crop configuration for a person
 * Stored in FamilyNode.avatar
 */
export interface AvatarCrop {
  imageId: string;
  cropX: number;      // percentage 0-100
  cropY: number;      // percentage 0-100
  cropWidth: number;  // percentage 0-100
  cropHeight: number; // percentage 0-100
  croppedUrl?: string; // Generated cropped image URL
}

/**
 * Request body for uploading a new image
 */
export interface ImageUploadRequest {
  tagged_node_ids: string[];
  caption?: string;
  date_taken?: string;
  is_approximate_date?: boolean;
}

/**
 * Request body for updating image metadata
 */
export interface ImageUpdateRequest {
  tagged_node_ids?: string[];
  caption?: string;
  date_taken?: string;
  is_approximate_date?: boolean;
}

/**
 * Request body for creating an avatar crop
 */
export interface AvatarCropRequest {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}

/**
 * Response from image API endpoints
 */
export interface ImageApiResponse {
  success: boolean;
  image?: ImageMetadata;
  images?: ImageMetadata[];
  error?: string;
}
