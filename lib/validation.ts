import { z } from 'zod';

export const ALLOWED_RATIOS = [
  '1280:720',
  '720:1280', 
  '960:960',
  '1104:832',
  '832:1104',
  '1584:672'
] as const;

export const ALLOWED_MODELS = [
  'gen4_aleph'
] as const;

export const videoGenerationSchema = z.object({
  promptText: z.string().min(1, 'Prompt is required').max(500, 'Prompt too long'),
  model: z.enum(ALLOWED_MODELS),
  ratio: z.enum(ALLOWED_RATIOS),
  seed: z.number().optional(),
});

export type VideoGenerationData = z.infer<typeof videoGenerationSchema>;

// Supported video formats per Runway API docs
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm', 
  'video/quicktime',
  'video/mov',
  'video/ogg',
  'video/h264'
] as const;

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  // Check file type against official API supported formats
  const isValidType = ALLOWED_VIDEO_TYPES.some(type => 
    file.type === type || file.type.includes(type)
  );
  
  if (!isValidType) {
    return { 
      valid: false, 
      error: 'Only MP4, WebM, MOV, OGG, and H.264 video files are supported per Runway API requirements' 
    };
  }

  // Check file size (16MB = 16 * 1024 * 1024 bytes) per API docs
  const maxSize = 16 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 16MB per Runway API requirements' };
  }

  return { valid: true };
}