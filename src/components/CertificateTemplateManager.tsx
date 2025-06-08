import React, { useState, useRef } from 'react';
import { Course, CertificateSettings } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { 
  Upload, Download, Settings, Eye, Save, X, 
  FileText, AlertCircle, CheckCircle, Palette,
  Type, Move, RotateCcw
} from 'lucide-react';

interface CertificateTemplateManagerProps {
  course: Course;
  onUpdate: (course: Course) => void;
}

const DEFAULT_SETTINGS: CertificateSettings = {
  studentName: {
    x: 250,
    y: 300,
    fontSize: 24,
    fontColor: '#000000',
    fontFamily: 'Helvetica-Bold'
  },
  courseName: {
    x: 200,
    y: 250,
    fontSize: 18,
    fontColor: '#333333',
    fontFamily: 'Helvetica'
  },
  completionDate: {
    x: 200,
    y: 200,
    fontSize: 14,
    fontColor: '#666666',
    fontFamily: 'Helvetica'
  },
  certificateNumber: {
    x: 50,
    y: 50,
    fontSize: 10,
    fontColor: '#999999',
    fontFamily: 'Helvetica'
  }
};

const FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Helvetica-Bold', label: 'Helvetica Bold' },
  { value: 'Times-Roman', label: 'Times Roman' },
  { value: 'Times-Bold', label: 'Times Bold' },
  { value: 'Courier', label: 'Courier' },
  { value: 'Courier-Bold', label: 'Courier Bold' }
];

export default function CertificateTemplateManager({ course, onUpdate }: CertificateTemplateManagerProps) {
  const [settings, setSettings] = useState<CertificateSettings>(
    course.certificate_settings || DEFAULT_SETTINGS
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const fileName = `${course.id}_${Date.now()}.pdf`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('certificate-templates')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Update course with template URL
      const { error: updateError } = await supabase
        .from('courses')
        .update({
          certificate_template_url: data.path,
          certificate_settings: settings
        })
        .eq('id', course.id);

      if (updateError) {
        throw updateError;
      }

      const updatedCourse = {
        ...course,
        certificate_template_url: data.path,
        certificate_settings: settings
      };

      onUpdate(updatedCourse);
      setSuccess('Certificate template uploaded successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error('Error uploading template:', error);
      setError(error.message || 'Failed to upload template');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('courses')
        .update({
          certificate_settings: settings
        })
        .eq('id', course.id);

      if (error) {
        throw error;
      }

      const updatedCourse = {
        ...course,
        certificate_settings: settings
      };

      onUpdate(updatedCourse);
      setSuccess('Certificate settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error('Error saving settings:', error);
      setError(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTemplate = async () => {
    if (!confirm('Are you sure you want to remove the certificate template? This will revert to the default template.')) {
      return;
    }

    try {
      // Delete file from storage if it exists
      if (course.certificate_template_url) {
        await supabase.storage
          .from('certificate-templates')
          .remove([course.certificate_template_url]);
      }

      // Update course to remove template
      const { error } = await supabase
        .from('courses')
        .update({
          certificate_template_url: null,
          certificate_settings: null
        })
        .eq('id', course.id);

      if (error) {
        throw error;
      }

      const updatedCourse = {
        ...course,
        certificate_template_url: undefined,
        certificate_settings: undefined
      };

      onUpdate(updatedCourse);
      setSettings(DEFAULT_SETTINGS);
      setSuccess('Certificate template removed successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (error: any) {
      console.error('Error removing template:', error);
      setError(error.message || 'Failed to remove template');
    }
  };

  const updateFieldSetting = (field: keyof CertificateSettings, property: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [property]: value
      }
    }));
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const downloadTemplate = async () => {
    if (!course.certificate_template_url) return;

    try {
      const { data, error } = await supabase.storage
        .from('certificate-templates')
        .download(course.certificate_template_url);

      if (error) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${course.title}_certificate_template.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error: any) {
      console.error('Error downloading template:', error);
      setError(error.message || 'Failed to download template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Certificate Template</h3>
          <p className="text-sm text-gray-600">
            Upload a custom PDF template and configure text positioning for certificates
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Eye className="w-4 h-4 mr-1" />
            {showPreview ? 'Hide' : 'Show'} Settings
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
            <p className="text-sm text-green-800">{success}</p>
          </div>
        </div>
      )}

      {/* Template Upload Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-gray-900">PDF Template</h4>
          {course.certificate_template_url && (
            <div className="flex items-center space-x-2">
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </button>
              <button
                onClick={handleRemoveTemplate}
                className="inline-flex items-center px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </button>
            </div>
          )}
        </div>

        {course.certificate_template_url ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-green-600 mr-2" />
              <div>
                <p className="text-sm font-medium text-green-800">Custom template uploaded</p>
                <p className="text-xs text-green-600">
                  Template file: {course.certificate_template_url.split('/').pop()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600 mb-2">
              Upload a PDF template for custom certificates
            </p>
            <p className="text-xs text-gray-500 mb-4">
              Maximum file size: 10MB. Only PDF files are supported.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload PDF Template
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> If no custom template is uploaded, certificates will use the default Falak Academy template.
            The settings below will only apply when a custom template is used.
          </p>
        </div>
      </div>

      {/* Settings Panel */}
      {showPreview && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-medium text-gray-900">Text Positioning Settings</h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={resetToDefaults}
                className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset to Defaults
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student Name Settings */}
            <div className="space-y-4">
              <h5 className="font-medium text-gray-900 flex items-center">
                <Type className="w-4 h-4 mr-2" />
                Student Name
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">X Position</label>
                  <input
                    type="number"
                    value={settings.studentName.x}
                    onChange={(e) => updateFieldSetting('studentName', 'x', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={settings.studentName.y}
                    onChange={(e) => updateFieldSetting('studentName', 'y', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                  <input
                    type="number"
                    min="8"
                    max="72"
                    value={settings.studentName.fontSize}
                    onChange={(e) => updateFieldSetting('studentName', 'fontSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={settings.studentName.fontColor}
                    onChange={(e) => updateFieldSetting('studentName', 'fontColor', e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                <select
                  value={settings.studentName.fontFamily}
                  onChange={(e) => updateFieldSetting('studentName', 'fontFamily', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {FONT_OPTIONS.map(font => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Course Name Settings */}
            <div className="space-y-4">
              <h5 className="font-medium text-gray-900 flex items-center">
                <Type className="w-4 h-4 mr-2" />
                Course Name
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">X Position</label>
                  <input
                    type="number"
                    value={settings.courseName?.x || 0}
                    onChange={(e) => updateFieldSetting('courseName', 'x', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={settings.courseName?.y || 0}
                    onChange={(e) => updateFieldSetting('courseName', 'y', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                  <input
                    type="number"
                    min="8"
                    max="72"
                    value={settings.courseName?.fontSize || 18}
                    onChange={(e) => updateFieldSetting('courseName', 'fontSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={settings.courseName?.fontColor || '#333333'}
                    onChange={(e) => updateFieldSetting('courseName', 'fontColor', e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                <select
                  value={settings.courseName?.fontFamily || 'Helvetica'}
                  onChange={(e) => updateFieldSetting('courseName', 'fontFamily', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {FONT_OPTIONS.map(font => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Completion Date Settings */}
            <div className="space-y-4">
              <h5 className="font-medium text-gray-900 flex items-center">
                <Type className="w-4 h-4 mr-2" />
                Completion Date
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">X Position</label>
                  <input
                    type="number"
                    value={settings.completionDate?.x || 0}
                    onChange={(e) => updateFieldSetting('completionDate', 'x', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={settings.completionDate?.y || 0}
                    onChange={(e) => updateFieldSetting('completionDate', 'y', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                  <input
                    type="number"
                    min="8"
                    max="72"
                    value={settings.completionDate?.fontSize || 14}
                    onChange={(e) => updateFieldSetting('completionDate', 'fontSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={settings.completionDate?.fontColor || '#666666'}
                    onChange={(e) => updateFieldSetting('completionDate', 'fontColor', e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                <select
                  value={settings.completionDate?.fontFamily || 'Helvetica'}
                  onChange={(e) => updateFieldSetting('completionDate', 'fontFamily', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {FONT_OPTIONS.map(font => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Certificate Number Settings */}
            <div className="space-y-4">
              <h5 className="font-medium text-gray-900 flex items-center">
                <Type className="w-4 h-4 mr-2" />
                Certificate Number
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">X Position</label>
                  <input
                    type="number"
                    value={settings.certificateNumber?.x || 0}
                    onChange={(e) => updateFieldSetting('certificateNumber', 'x', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Y Position</label>
                  <input
                    type="number"
                    value={settings.certificateNumber?.y || 0}
                    onChange={(e) => updateFieldSetting('certificateNumber', 'y', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                  <input
                    type="number"
                    min="8"
                    max="72"
                    value={settings.certificateNumber?.fontSize || 10}
                    onChange={(e) => updateFieldSetting('certificateNumber', 'fontSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <input
                    type="color"
                    value={settings.certificateNumber?.fontColor || '#999999'}
                    onChange={(e) => updateFieldSetting('certificateNumber', 'fontColor', e.target.value)}
                    className="w-full h-10 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
                <select
                  value={settings.certificateNumber?.fontFamily || 'Helvetica'}
                  onChange={(e) => updateFieldSetting('certificateNumber', 'fontFamily', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                >
                  {FONT_OPTIONS.map(font => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h6 className="font-medium text-gray-900 mb-2">Positioning Guide</h6>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>X Position:</strong> Distance from the left edge of the PDF (in points)</li>
              <li>• <strong>Y Position:</strong> Distance from the bottom edge of the PDF (in points)</li>
              <li>• <strong>Font Size:</strong> Text size in points (typical range: 10-72)</li>
              <li>• <strong>Color:</strong> Text color in hexadecimal format</li>
              <li>• <strong>Font Family:</strong> Choose from available PDF-standard fonts</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}