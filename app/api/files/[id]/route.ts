import { NextRequest, NextResponse } from 'next/server';
import { getUploadedFile } from '@/lib/file-upload';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid file ID' },
        { status: 400 }
      );
    }

    const file = getUploadedFile(id);

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Create a typed array copy compatible with BodyInit
    const uint8 = new Uint8Array(file.buffer.length);
    uint8.set(file.buffer);

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': file.mimetype,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('File serve error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}