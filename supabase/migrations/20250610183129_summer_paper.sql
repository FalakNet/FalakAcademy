/*
  # Add Ziina test mode setting

  1. New Settings
    - Add `ziina_test_mode` setting to control whether Ziina payments are in test mode
    - Default to true (test mode) for safety

  2. Security
    - Only superadmins can modify this setting through existing RLS policies
*/

-- Insert the Ziina test mode setting
INSERT INTO public.admin_settings (
  setting_key,
  setting_value,
  setting_type,
  category,
  display_name,
  description
) VALUES (
  'ziina_test_mode',
  'true',
  'boolean',
  'system',
  'Ziina Test Mode',
  'Enable test mode for Ziina payments. When enabled, no real charges will be made and test card numbers can be used.'
) ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  setting_type = EXCLUDED.setting_type,
  category = EXCLUDED.category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  updated_at = now();