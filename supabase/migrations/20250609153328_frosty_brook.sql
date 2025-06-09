/*
  # Create admin settings table and storage

  1. New Tables
    - `admin_settings` - Store platform configuration settings
    
  2. Storage Buckets
    - `platform-assets` - Store logos, splash screens, and other branding assets
    
  3. Security
    - Only superadmins can modify settings
    - Settings are readable by all authenticated users for UI display
    - Platform assets are publicly readable for performance
*/

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value jsonb NOT NULL,
  setting_type text NOT NULL DEFAULT 'text',
  category text NOT NULL DEFAULT 'general',
  display_name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on admin_settings
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read settings (for UI display)
CREATE POLICY "Authenticated users can read settings"
  ON admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow superadmins to insert settings
CREATE POLICY "Superadmins can insert settings"
  ON admin_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'SUPERADMIN'
    )
  );

-- Allow superadmins to update settings
CREATE POLICY "Superadmins can update settings"
  ON admin_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'SUPERADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'SUPERADMIN'
    )
  );

-- Allow superadmins to delete settings
CREATE POLICY "Superadmins can delete settings"
  ON admin_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'SUPERADMIN'
    )
  );

-- Create platform-assets storage bucket (public for performance)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for platform assets
CREATE POLICY "Superadmins can upload platform assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'platform-assets' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'SUPERADMIN'
  )
);

CREATE POLICY "Superadmins can update platform assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'platform-assets' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'SUPERADMIN'
  )
);

CREATE POLICY "Superadmins can delete platform assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'platform-assets' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'SUPERADMIN'
  )
);

CREATE POLICY "Public can view platform assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'platform-assets');

-- Insert default settings
INSERT INTO admin_settings (setting_key, setting_value, setting_type, category, display_name, description) VALUES
('site_name', '"Falak Academy"', 'text', 'branding', 'Site Name', 'The name of your learning platform'),
('site_description', '"Professional Learning Management System"', 'text', 'branding', 'Site Description', 'A brief description of your platform'),
('site_logo_url', 'null', 'image', 'branding', 'Site Logo', 'Main logo displayed in the header'),
('site_favicon_url', 'null', 'image', 'branding', 'Favicon', 'Small icon displayed in browser tabs'),
('login_splash_image_url', 'null', 'image', 'branding', 'Login Splash Image', 'Background image for login/signup pages'),
('primary_color', '"#2563eb"', 'color', 'branding', 'Primary Color', 'Main brand color used throughout the platform'),
('secondary_color', '"#7c3aed"', 'color', 'branding', 'Secondary Color', 'Secondary brand color for accents'),
('allow_public_registration', 'true', 'boolean', 'general', 'Allow Public Registration', 'Allow users to sign up without invitation'),
('require_email_verification', 'false', 'boolean', 'general', 'Require Email Verification', 'Users must verify email before accessing'),
('default_user_role', '"USER"', 'select', 'general', 'Default User Role', 'Default role assigned to new users'),
('max_file_upload_size', '50', 'number', 'general', 'Max File Upload Size (MB)', 'Maximum file size for uploads'),
('enable_certificates', 'true', 'boolean', 'features', 'Enable Certificates', 'Allow automatic certificate generation'),
('enable_quizzes', 'true', 'boolean', 'features', 'Enable Quizzes', 'Allow quiz creation and taking'),
('maintenance_mode', 'false', 'boolean', 'general', 'Maintenance Mode', 'Temporarily disable public access'),
('footer_text', '"© 2025 Falak Academy. All rights reserved."', 'text', 'branding', 'Footer Text', 'Text displayed in the footer'),
('support_email', '"support@falakacademy.com"', 'email', 'general', 'Support Email', 'Contact email for support'),
('terms_url', 'null', 'url', 'legal', 'Terms of Service URL', 'Link to terms of service'),
('privacy_url', 'null', 'url', 'legal', 'Privacy Policy URL', 'Link to privacy policy')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_settings_updated_at();