import { NextRequest, NextResponse } from 'next/server';
import { createVideoToVideo, RunwayAPIError, VideoToVideoRequest } from '@/lib/runway';
import { videoGenerationSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let promptText: string;
    let model: string;
    let ratio: string;
    let seed: number | undefined;
    let videoUri: string;

    if (contentType.includes('application/json')) {
      // Handle JSON request (URL input)
      const body = await request.json();
      promptText = body.promptText;
      model = body.model;
      ratio = body.ratio;
      seed = body.seed;
      
      // Validate URL
      if (!body.videoUrl) {
        return NextResponse.json(
          { error: 'No video URL provided' },
          { status: 400 }
        );
      }
      
      if (!body.videoUrl.startsWith('https://')) {
        return NextResponse.json(
          { error: 'Only HTTPS URLs are allowed' },
          { status: 400 }
        );
      }
      
      videoUri = body.videoUrl;
    } else {
      // For URL-only mode, reject non-JSON content types
      return NextResponse.json(
        { error: 'Only JSON body with videoUrl is supported' },
        { status: 400 }
      );
    }
    
    try {
      videoGenerationSchema.parse({
        promptText,
        model,
        ratio,
        seed,
      });
    } catch (validationError) {
      console.error('Validation error details:', validationError);
      console.error('Form data received:', { promptText, model, ratio, seed });
      
      let errorMessage = 'Invalid form data';
      if (validationError && typeof validationError === 'object' && 'issues' in validationError) {
        const issues = (validationError as any).issues;
        if (issues && issues.length > 0) {
          errorMessage = issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        }
      }
      
      return NextResponse.json(
        { error: errorMessage, details: validationError },
        { status: 400 }
      );
    }

    // Call Runway API
    const requestData: VideoToVideoRequest = {
      model,
      promptText,
      videoUri,
      ratio,
      ...(seed !== undefined && { seed }),
      references: [
        {
          type: 'image',
          uri: 'https://res.cloudinary.com/dheh8zkmv/image/upload/v1716397906/tzfdxn2h93xq9ux2vbjv.webp'
        }
      ],
      contentModeration: {
        publicFigureThreshold: 'auto'
      }
    };

    const response = await createVideoToVideo(requestData);

    return NextResponse.json({ taskId: response.id });

  } catch (error) {
    console.error('Generation error:', error);

    if (error instanceof RunwayAPIError) {
      return NextResponse.json(
        { 
          error: 'Runway API Error', 
          message: error.message,
          code: error.code 
        },
        { status: error.status >= 500 ? 500 : 400 }
      );
    }

    if (error instanceof Error) {
      // Handle file upload errors specifically
      if (error.message.includes('not suitable for production')) {
        return NextResponse.json(
          { error: 'File upload not configured for production' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}