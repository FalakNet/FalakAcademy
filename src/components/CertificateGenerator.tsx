import React, { useState } from 'react';
import { Certificate, Course, Profile } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import download from 'downloadjs';
import { Download, FileText, AlertCircle } from 'lucide-react';

interface CertificateGeneratorProps {
  certificate: Certificate & { courses: Course };
  profile: Profile;
  onDownload?: () => void;
}

export default function CertificateGenerator({ certificate, profile, onDownload }: CertificateGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return [0, 0, 0];
    return [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ];
  };

  const generatePDFCertificate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const course = certificate.courses;
      
      // Check if course has a custom template
      if (course.certificate_template_url && course.certificate_settings) {
        await generateCustomCertificate(course);
      } else {
        await generateDefaultCertificate();
      }

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('Error generating certificate:', error);
      setError('Failed to generate certificate. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const generateCustomCertificate = async (course: Course) => {
    if (!course.certificate_template_url || !course.certificate_settings) {
      throw new Error('Course template or settings not configured');
    }

    try {
      // Download the template PDF from Supabase storage
      const { data: templateData, error: downloadError } = await supabase.storage
        .from('certificate-templates')
        .download(course.certificate_template_url);

      if (downloadError) {
        throw new Error(`Failed to download template: ${downloadError.message}`);
      }

      // Convert blob to array buffer
      const templateBytes = await templateData.arrayBuffer();

      // Load the PDF template
      const pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // Get available fonts
      const fonts = {
        'Helvetica': await pdfDoc.embedFont(StandardFonts.Helvetica),
        'Helvetica-Bold': await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        'Times-Roman': await pdfDoc.embedFont(StandardFonts.TimesRoman),
        'Times-Bold': await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        'Courier': await pdfDoc.embedFont(StandardFonts.Courier),
        'Courier-Bold': await pdfDoc.embedFont(StandardFonts.CourierBold)
      };

      const settings = course.certificate_settings;

      // Add student name
      if (settings.studentName) {
        const [r, g, b] = hexToRgb(settings.studentName.fontColor);
        const font = fonts[settings.studentName.fontFamily as keyof typeof fonts] || fonts['Helvetica'];
        
        firstPage.drawText(profile.name, {
          x: settings.studentName.x,
          y: settings.studentName.y,
          size: settings.studentName.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      // Add course name
      if (settings.courseName) {
        const [r, g, b] = hexToRgb(settings.courseName.fontColor);
        const font = fonts[settings.courseName.fontFamily as keyof typeof fonts] || fonts['Helvetica'];
        
        firstPage.drawText(course.title, {
          x: settings.courseName.x,
          y: settings.courseName.y,
          size: settings.courseName.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      // Add completion date
      if (settings.completionDate) {
        const [r, g, b] = hexToRgb(settings.completionDate.fontColor);
        const font = fonts[settings.completionDate.fontFamily as keyof typeof fonts] || fonts['Helvetica'];
        const completionDate = new Date(certificate.issued_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        firstPage.drawText(completionDate, {
          x: settings.completionDate.x,
          y: settings.completionDate.y,
          size: settings.completionDate.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      // Add certificate number
      if (settings.certificateNumber) {
        const [r, g, b] = hexToRgb(settings.certificateNumber.fontColor);
        const font = fonts[settings.certificateNumber.fontFamily as keyof typeof fonts] || fonts['Helvetica'];
        
        firstPage.drawText(certificate.certificate_number, {
          x: settings.certificateNumber.x,
          y: settings.certificateNumber.y,
          size: settings.certificateNumber.fontSize,
          font,
          color: rgb(r, g, b),
        });
      }

      // Generate and download the PDF directly
      const pdfBytes = await pdfDoc.save();
      const fileName = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}_${course.title.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate.pdf`;
      download(pdfBytes, fileName, 'application/pdf');

    } catch (error) {
      console.error('Error generating custom certificate:', error);
      throw error;
    }
  };

  const generateDefaultCertificate = async () => {
    // Create a new PDF document for default certificate
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([792, 612]); // Letter size landscape
    
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    
    const { width, height } = page.getSize();
    
    // Background gradient effect with rectangles
    page.drawRectangle({
      x: 0,
      y: 0,
      width: width,
      height: height,
      color: rgb(0.98, 0.98, 1), // Very light blue background
    });
    
    // Decorative border
    page.drawRectangle({
      x: 40,
      y: 40,
      width: width - 80,
      height: height - 80,
      borderColor: rgb(0.2, 0.4, 0.8),
      borderWidth: 3,
    });
    
    // Inner decorative border
    page.drawRectangle({
      x: 60,
      y: 60,
      width: width - 120,
      height: height - 120,
      borderColor: rgb(0.8, 0.6, 0.2),
      borderWidth: 1,
    });
    
    // Header decoration
    page.drawRectangle({
      x: 80,
      y: height - 140,
      width: width - 160,
      height: 2,
      color: rgb(0.2, 0.4, 0.8),
    });
    
    // Title
    page.drawText('CERTIFICATE OF COMPLETION', {
      x: width / 2 - 180,
      y: height - 120,
      size: 28,
      font: boldFont,
      color: rgb(0.2, 0.4, 0.8),
    });
    
    // Subtitle
    page.drawText('Falak Academy', {
      x: width / 2 - 70,
      y: height - 160,
      size: 20,
      font: italicFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    // Decorative line under subtitle
    page.drawRectangle({
      x: width / 2 - 100,
      y: height - 170,
      width: 200,
      height: 1,
      color: rgb(0.8, 0.6, 0.2),
    });
    
    // This certifies that
    page.drawText('This is to certify that', {
      x: width / 2 - 90,
      y: height - 220,
      size: 16,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Student name with decorative underline
    const nameWidth = profile.name.length * 16; // Approximate width
    page.drawText(profile.name, {
      x: width / 2 - (nameWidth / 2),
      y: height - 260,
      size: 32,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    
    // Decorative underline for name
    page.drawRectangle({
      x: width / 2 - (nameWidth / 2) - 20,
      y: height - 270,
      width: nameWidth + 40,
      height: 2,
      color: rgb(0.8, 0.6, 0.2),
    });
    
    // Has successfully completed
    page.drawText('has successfully completed the course', {
      x: width / 2 - 140,
      y: height - 310,
      size: 16,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    // Course title
    const courseTitle = certificate.courses.title;
    const courseTitleWidth = courseTitle.length * 12; // Approximate width
    page.drawText(courseTitle, {
      x: width / 2 - (courseTitleWidth / 2),
      y: height - 350,
      size: 24,
      font: boldFont,
      color: rgb(0.2, 0.4, 0.8),
    });
    
    // Date section
    const completionDate = new Date(certificate.issued_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    page.drawText(`Issued on ${completionDate}`, {
      x: width / 2 - 80,
      y: height - 420,
      size: 14,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    // Certificate number (bottom left)
    page.drawText(`Certificate No: ${certificate.certificate_number}`, {
      x: 100,
      y: 120,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    // Verification text (bottom center)
    page.drawText('This certificate can be verified at falakacademy.com', {
      x: width / 2 - 120,
      y: 100,
      size: 8,
      font: italicFont,
      color: rgb(0.6, 0.6, 0.6),
    });
    
    // Signature section
    page.drawLine({
      start: { x: width - 280, y: 180 },
      end: { x: width - 120, y: 180 },
      thickness: 1,
      color: rgb(0.3, 0.3, 0.3),
    });
    
    page.drawText('Director, Falak Academy', {
      x: width - 260,
      y: 160,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    
    // Decorative elements
    // Left side decoration
    page.drawRectangle({
      x: 100,
      y: height / 2 - 50,
      width: 3,
      height: 100,
      color: rgb(0.8, 0.6, 0.2),
    });
    
    // Right side decoration
    page.drawRectangle({
      x: width - 103,
      y: height / 2 - 50,
      width: 3,
      height: 100,
      color: rgb(0.8, 0.6, 0.2),
    });
    
    // Generate and download the PDF directly
    const pdfBytes = await pdfDoc.save();
    const fileName = `${profile.name.replace(/[^a-zA-Z0-9]/g, '_')}_${certificate.courses.title.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate.pdf`;
    download(pdfBytes, fileName, 'application/pdf');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400 mr-3" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{certificate.courses.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Certificate #{certificate.certificate_number}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Issued</p>
          <p className="font-medium text-gray-900 dark:text-white">{new Date(certificate.issued_at).toLocaleDateString()}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      )}
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          onClick={generatePDFCertificate}
          disabled={generating}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {generating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating Certificate...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Download Certificate
            </>
          )}
        </button>
      </div>
    </div>
  );
}