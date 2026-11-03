export interface MemberRecord {
  id: number;
  couple_id: string; // JR001 to JR110 format, unique
  husband_name: string;
  wife_name: string;
  husband_registered_mobile: string | null;
  wife_registered_mobile: string | null;
  husband_dob: string | null;
  wife_dob: string | null;
  marriage_anniversary: string | null;
  kids: string | null;
  year1_status: string; // "Active / Year-1 Member"
  requires_mobile_review: number; // 0 or 1
  mobile_review_reasons: string | null;
  year1_profile_data: string | null; // Legacy / extra Year-1 profile metadata
  active_status: number;
  created_at: string;
  updated_at: string;
}

export interface VerificationRecord {
  id: number;
  couple_id: string; // Foreign key referencing members(couple_id)
  verified_mobile: string;
  verification_status: string; // 'verified'
  verified_at: string;
  created_at: string;
}

export interface Year2ProfileRecord {
  id: number;
  couple_id: string; // Unique foreign key referencing members(couple_id)
  current_city: string | null;
  residential_address: string | null;
  occupation_update: string | null;
  organization_update: string | null;
  family_update: string | null;
  family_photo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Year2PreferenceRecord {
  id: number;
  couple_id: string; // Unique foreign key referencing members(couple_id)
  wishlist: string | null; // JSON array of strings
  contribution_areas: string | null; // JSON array of strings
  royal_idea: string | null;
  jsg_should_be_known_for: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmissionRecord {
  id: number;
  couple_id: string; // Database-level UNIQUE constraint
  status: string; // 'submitted'
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface CorrectionRequestRecord {
  id: number;
  couple_id: string; // Foreign key referencing members(couple_id)
  requested_correction: string;
  member_message: string;
  status: 'pending' | 'under_review' | 'resolved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminUserRecord {
  id: number;
  email: string;
  role: 'super_admin' | 'admin';
  password_hash: string;
  created_at: string;
}
