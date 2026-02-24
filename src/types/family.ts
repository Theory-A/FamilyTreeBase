export type Gender = "male" | "female" | "unknown";

// Relationship type support for complex family structures
export type RelationshipType = "biological" | "adoptive" | "step" | "foster";
export type PartnershipType = "married" | "divorced" | "widowed" | "partner";

export interface Names {
  primary_zh: string;
  pinyin: string;
  display_en?: string;
}

export interface DateInfo {
  date_iso?: string; // YYYY-MM-DD or YYYY
  is_approximate?: boolean;
}

export interface VitalStats {
  birth?: DateInfo;
  death?: DateInfo;
}

export interface Attributes {
  note?: string; // Short note (single line)
  description?: string; // Longer biographical overview (paragraph)
  link?: string; // URL to external resource (Wikipedia, etc.)
  [key: string]: unknown;
}

// Enhanced parent reference for complex relationships (e.g., adoption)
export interface ParentLink {
  id: string;
  type?: RelationshipType; // defaults to 'biological'
}

// Enhanced partner reference for remarriage support
export interface PartnerLink {
  id: string;
  type?: PartnershipType; // defaults to 'married'
  marriage_date?: DateInfo;
  divorce_date?: DateInfo;
  order?: number; // 1st spouse, 2nd spouse, etc.
}

// Image reference for biographical content
export interface BiographyImage {
  url: string;
  caption?: string;
  date?: DateInfo;
}

// Biographical information (extensible for future fields)
export interface Biography {
  images?: BiographyImage[];
  // Future fields: occupation, education, places_lived, etc.
}

// Avatar crop configuration for a person
export interface AvatarCrop {
  imageId: string;
  cropX: number;      // percentage 0-100
  cropY: number;      // percentage 0-100
  cropWidth: number;  // percentage 0-100
  cropHeight: number; // percentage 0-100
  croppedUrl?: string; // Generated cropped image URL
}

export interface FamilyNode {
  id: string;
  names: Names;
  gender: Gender;
  vital_stats?: VitalStats;

  // Support both simple string IDs and detailed link objects (backward compatible)
  parent_ids?: (string | ParentLink)[];
  partner_ids?: (string | PartnerLink)[];

  // Optional computed field for visualization (tree depth from root)
  generation?: number;

  biography?: Biography;
  attributes?: Attributes;
  avatar?: AvatarCrop;
}

// FamilyTreeData is now just the array of nodes (meta removed)
export type FamilyTreeData = FamilyNode[];
