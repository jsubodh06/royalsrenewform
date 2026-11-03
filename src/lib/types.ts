export interface MemberYear1 {
  couple_id: string; // JR001 - JR110
  husband_name: string;
  wife_name: string;
  husband_registered_mobile: string;
  wife_registered_mobile: string | null;
  husband_dob: string | null;
  wife_dob: string | null;
  marriage_anniversary: string | null;
  children_info: string | null;
  year1_city: string | null;
  year1_business: string | null;
  active_status: number;
}

export interface ChildDetail {
  id: string;
  name: string;
  age: string;
  relationOrEducation?: string;
}

export interface Year2ProfileData {
  current_city?: string;
  city?: string;
  residential_address?: string;
  occupation_status?: string;
  occupation_details?: string;
  occupation_business_update?: string;
  organization_update?: string;
  organization_firm_name?: string;
  family_status?: string;
  family_details?: string;
  family_children_updates?: string;
  family_update?: string;
  children_details?: ChildDetail[];
  photo_id?: string | null;
  photo_filename?: string | null;
  photo_mime?: string | null;
  photo_size?: number | null;
  family_photo_path?: string | null;
  family_photo_url?: string | null;
  last_step?: number;
}

export interface Year2PreferenceData {
  wishlist: string[];
  wishlist_other?: string;
  dream_experience?: string;
  contribution_areas: string[];
  contribution_other?: string;
  contribution_help_text?: string;
  royal_idea: string;
  identity_known_for?: string[];
  identity_statement?: string;
  jsg_royals_identity?: string;
  jsg_should_be_known_for?: string;
}

export interface SubmissionData {
  id: number;
  couple_id: string;
  submission_status: string;
  submitted_at: string;
  submitted_by_mobile: string | null;
}

export interface CorrectionRequest {
  id: number;
  couple_id: string;
  requested_by_mobile: string | null;
  requested_correction: string;
  member_message: string;
  status: 'pending' | 'resolved' | 'in_review';
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface MemberSession {
  coupleId: string;
  mobile: string;
  role: 'member';
  spouseType: 'husband' | 'wife';
  husbandName: string;
  wifeName: string;
}

export interface AdminSession {
  email: string;
  role: 'super_admin' | 'admin';
}

export interface AdminNote {
  id: number;
  couple_id: string;
  admin_email: string;
  note: string;
  created_at: string;
}

export interface AdminAuditLog {
  id: number;
  admin_email: string;
  action: string;
  target_couple_id: string | null;
  details: string | null;
  created_at: string;
}
