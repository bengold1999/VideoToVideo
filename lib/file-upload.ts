/**
 * Simple file upload helper for development and production
 * 
 * DEV: Stores files in memory temporarily (will be lost on server restart)
 * PROD: Should be replaced with actual S3/R2/CDN upload
 */

interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
  uploadedAt: Date;
}

// In-memory storage for development (NOT suitable for production)
const fileStore = new Map<string, UploadedFile>();

export async function uploadFile(file: File): Promise<string> {
  const isDev = process.env.NODE_ENV === 'development';
  
  if (!isDev) {
    throw new Error(
      'In-memory file storage is not suitable for production. ' +
      'Please implement S3/R2/CDN upload in lib/file-upload.ts that returns HTTPS URLs'
    );
  }

  // For development, we need HTTPS URLs for Runway API (required per official docs)
  // Use a simple file.io upload service for testing
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://file.io', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }

    const result = await response.json();
    
    if (result.success && result.link) {
      console.log('✅ File uploaded to HTTPS URL:', result.link);
      
      // Verify it's HTTPS as required by Runway API
      if (!result.link.startsWith('https://')) {
        throw new Error('Upload service returned non-HTTPS URL, which violates Runway API requirements');
      }
      
      return result.link;
    } else {
      throw new Error('Upload service returned error');
    }

  } catch (error) {
    console.error('🚨 File upload error:', error);
    
    // Don't fall back to HTTP URLs - they will always fail with Runway API
    throw new Error(
      'File upload failed and cannot fall back to local storage because ' +
      'Runway API requires HTTPS URLs only. Please use a proper cloud storage service ' +
      'or try again with the external upload service.'
    );
  }
}

export function getUploadedFile(fileId: string): UploadedFile | null {
  return fileStore.get(fileId) || null;
}

export function cleanupOldFiles() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  fileStore.forEach((file, fileId) => {
    if (file.uploadedAt < oneHourAgo) {
      fileStore.delete(fileId);
    }
  });
}