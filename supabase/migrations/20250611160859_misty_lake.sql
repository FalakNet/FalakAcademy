/*
  # Add Test Mode System Setting

  1. New Settings
    - Add test_mode setting for payment processing
    - Add ziina_api_key setting for API configuration
  
  2. Configuration
    - Test mode controls whether payments are processed in test or live mode
    - API key setting for secure storage of Ziina credentials
*/

-- Insert test mode setting
INSERT INTO admin_settings (setting_key, setting_value, setting_type, category, display_name, description)
VALUES 
  ('test_mode', 'true', 'boolean', 'payments', 'Test Mode', 'Enable test mode for payments (no real charges will be made)'),
  ('ziina_api_key', '""', 'text', 'payments', 'Ziina API Key', 'Your Ziina API key for payment processing')
ON CONFLICT (setting_key) DO NOTHING;