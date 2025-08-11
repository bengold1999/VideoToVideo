import { NextRequest, NextResponse } from 'next/server';
import { getTaskStatus, RunwayAPIError, cancelTask } from '@/lib/runway';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      );
    }

    const taskStatus = await getTaskStatus(id);

    return NextResponse.json(taskStatus);

  } catch (error) {
    console.error('Task status error:', error);

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

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid task ID' },
        { status: 400 }
      );
    }

    await cancelTask(id);
    return NextResponse.json({ cancelled: true });

  } catch (error) {
    console.error('Task cancel error:', error);

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

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}