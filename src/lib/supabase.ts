import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Enhanced validation and debugging
console.log('Supabase Configuration:');
console.log('URL:', supabaseUrl);
console.log('Anon Key exists:', !!supabaseAnonKey);
console.log('Anon Key length:', supabaseAnonKey?.length || 0);

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');
  
  console.error('Missing Supabase environment variables:', missingVars);
  console.error('Please check your .env file and ensure it contains:');
  console.error('VITE_SUPABASE_URL=your_supabase_url');
  console.error('VITE_SUPABASE_ANON_KEY=your_supabase_anon_key');
  
  throw new Error(`Missing Supabase environment variables: ${missingVars.join(', ')}`);
}

// Validate URL format
try {
  new URL(supabaseUrl);
} catch (error) {
  console.error('Invalid Supabase URL format:', supabaseUrl);
  throw new Error('Invalid Supabase URL format. Please check your VITE_SUPABASE_URL in .env file');
}

// Validate anon key format (should be a JWT)
if (!supabaseAnonKey.startsWith('eyJ')) {
  console.error('Invalid Supabase anon key format. Expected JWT starting with "eyJ"');
  throw new Error('Invalid Supabase anon key format. Please check your VITE_SUPABASE_ANON_KEY in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'X-Client-Info': 'learning-platform'
    }
  }
});

// Test connection on initialization
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Supabase auth connection test failed:', error);
  } else {
    console.log('Supabase connection established successfully');
  }
}).catch((error) => {
  console.error('Supabase connection test error:', error);
});

export type UserRole = 'USER' | 'COURSE_ADMIN' | 'SUPERADMIN';
export type MaterialType = 'video' | 'image' | 'file';
export type ContentType = 'video' | 'image' | 'text' | 'quiz' | 'file';

export interface Profile {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  description?: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  certificate_template_url?: string;
  certificate_settings?: CertificateSettings;
}

export interface CertificateSettings {
  studentName: {
    x: number;
    y: number;
    fontSize: number;
    fontColor: string;
    fontFamily: string;
  };
  courseName?: {
    x: number;
    y: number;
    fontSize: number;
    fontColor: string;
    fontFamily: string;
  };
  completionDate?: {
    x: number;
    y: number;
    fontSize: number;
    fontColor: string;
    fontFamily: string;
  };
  certificateNumber?: {
    x: number;
    y: number;
    fontSize: number;
    fontColor: string;
    fontFamily: string;
  };
}

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  order_index: number;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SectionContent {
  id: string;
  section_id: string;
  title: string;
  content_type: ContentType;
  content_data: any; // Flexible JSON data
  order_index: number;
  is_published: boolean;
  duration_minutes?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ContentCompletion {
  id: string;
  user_id: string;
  content_id: string;
  completed_at: string;
  time_spent_minutes: number;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
}

export interface Material {
  id: string;
  course_id: string;
  title: string;
  type: MaterialType;
  url: string;
  description?: string;
  order_index: number;
  created_by: string;
  created_at: string;
}

export interface Quiz {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  max_attempts: number;
  time_limit?: number;
  created_by: string;
  created_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  correct_option: number;
  points: number;
  order_index: number;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  answers: Record<string, number>;
  score: number;
  max_score: number;
  completed: boolean;
  started_at: string;
  completed_at?: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  file_url: string;
  file_name: string;
  file_type: string;
  submitted_at: string;
}

export interface CourseCompletion {
  id: string;
  user_id: string;
  course_id: string;
  completed_at: string;
  completion_percentage: number;
}

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  certificate_url?: string;
  issued_at: string;
  certificate_number: string;
}