// Note: Using direct API calls instead of SDK due to SDK being archived

export interface VideoToVideoRequest {
  model: string;
  promptText: string;
  videoUri: string;
  ratio: string;
  seed?: number;
  references?: Array<{
    type: 'image';
    uri: string;
  }>;
  contentModeration?: {
    publicFigureThreshold: string;
  };
}

export interface VideoToVideoResponse {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatus {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  outputs?: string[];
  error?: string;
  progress?: number;
  queuePosition?: number;
}

export class RunwayAPIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'RunwayAPIError';
  }
}

// Note: Using direct API calls instead of SDK due to SDK being archived

export async function createVideoToVideo(request: VideoToVideoRequest): Promise<VideoToVideoResponse> {
  try {
    const apiKey = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET;
    const version = process.env.X_RUNWAY_VERSION || '2024-12-01';
    
    if (!apiKey) {
      throw new Error('RUNWAY_API_KEY environment variable is required');
    }

    // Use the public API host that matches API keys issued for dev portal
    const response = await fetch('https://api.dev.runwayml.com/v1/video_to_video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': version,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model.trim(),
        promptText: request.promptText.trim(),
        videoUri: request.videoUri.trim(),
        ratio: request.ratio.trim(),
        ...(request.seed !== undefined && { seed: request.seed }),
        ...(request.references && { references: request.references }),
        ...(request.contentModeration && { contentModeration: request.contentModeration }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      
      throw new RunwayAPIError(
        response.status,
        'API_ERROR',
        errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`
      );
    }

    const task = await response.json();

    return {
      id: task.id,
      status: task.status || 'QUEUED',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString(),
    };

  } catch (error: any) {
    
    if (error instanceof RunwayAPIError) {
      throw error;
    }
    
    // Convert other errors to our custom error format
    const status = error.status || error.statusCode || 400;
    const code = error.code || 'API_ERROR';
    const message = error.message || 'Unknown error from Runway API';
    
    throw new RunwayAPIError(status, code, message);
  }
}

export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  try {
    const apiKey = process.env.RUNWAY_API_KEY;
    const version = process.env.X_RUNWAY_VERSION || '2024-12-01';
    
    if (!apiKey) {
      throw new Error('RUNWAY_API_KEY environment variable is required');
    }

    const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': version,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new RunwayAPIError(
        response.status,
        'API_ERROR',
        errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`
      );
    }

    const task = await response.json();

    // Normalize status to the set our UI expects
    const rawStatus = (task.status || '').toString().toUpperCase();
    const status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' =
      rawStatus === 'COMPLETED' ? 'SUCCEEDED'
      : rawStatus === 'SUCCESS' ? 'SUCCEEDED'
      : rawStatus === 'ERROR' ? 'FAILED'
      : (['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'].includes(rawStatus)
          ? rawStatus
          : 'RUNNING');

    // Normalize outputs into an array of direct URLs (strings)
    let outputs: string[] | undefined = undefined;
    const pickUrl = (obj: any) => obj?.uri || obj?.url || obj?.signedUrl || obj?.downloadUrl || obj?.videoUri || obj?.assetUrl || obj?.href;

    if (Array.isArray(task.outputs)) {
      outputs = task.outputs
        .map((o: any) => typeof o === 'string' ? o : pickUrl(o))
        .filter((u: any): u is string => typeof u === 'string');
    } else if (task.output) {
      if (Array.isArray(task.output)) {
        outputs = task.output
          .map((o: any) => typeof o === 'string' ? o : pickUrl(o))
          .filter((u: any): u is string => typeof u === 'string');
      } else if (typeof task.output === 'string') {
        outputs = [task.output];
      } else {
        const u = pickUrl(task.output);
        outputs = u ? [u] : undefined;
      }
    } else if (task.result) {
      // Handle alternative shapes sometimes returned under result/assets
      if (Array.isArray(task.result)) {
        outputs = task.result
          .map((o: any) => typeof o === 'string' ? o : pickUrl(o))
          .filter((u: any): u is string => typeof u === 'string');
      } else if (Array.isArray(task.result?.assets)) {
        outputs = task.result.assets
          .map((a: any) => typeof a === 'string' ? a : pickUrl(a))
          .filter((u: any): u is string => typeof u === 'string');
      } else if (Array.isArray(task.result?.files)) {
        outputs = task.result.files
          .map((f: any) => typeof f === 'string' ? f : pickUrl(f))
          .filter((u: any): u is string => typeof u === 'string');
      } else if (Array.isArray(task.result?.media)) {
        outputs = task.result.media
          .map((m: any) => typeof m === 'string' ? m : pickUrl(m))
          .filter((u: any): u is string => typeof u === 'string');
      } else if (task.result?.output) {
        const out = task.result.output;
        if (typeof out === 'string') {
          outputs = [out];
        } else {
          const u = pickUrl(out);
          outputs = u ? [u] : undefined;
        }
      }
    } else if (Array.isArray((task as any).assets)) {
      outputs = (task as any).assets
        .map((a: any) => typeof a === 'string' ? a : pickUrl(a))
        .filter((u: any): u is string => typeof u === 'string');
    } else if (Array.isArray((task as any).files)) {
      outputs = (task as any).files
        .map((f: any) => typeof f === 'string' ? f : pickUrl(f))
        .filter((u: any): u is string => typeof u === 'string');
    } else if (Array.isArray((task as any).media)) {
      outputs = (task as any).media
        .map((m: any) => typeof m === 'string' ? m : pickUrl(m))
        .filter((u: any): u is string => typeof u === 'string');
    }

    const errorMessage: string | undefined =
      task?.failure?.reason || task?.error?.message || task?.error || task?.message || undefined;

    return {
      id: task.id,
      status,
      createdAt: task.createdAt || '',
      updatedAt: task.updatedAt || '',
      outputs,
      error: errorMessage,
      progress: typeof task.progress === 'number' ? task.progress
               : typeof task.metrics?.progress === 'number' ? task.metrics.progress
               : undefined,
      queuePosition: typeof task.queuePosition === 'number' ? task.queuePosition
                     : typeof task.queue?.position === 'number' ? task.queue.position
                     : undefined,
    };

  } catch (error: any) {
    
    if (error instanceof RunwayAPIError) {
      throw error;
    }
    
    // Convert other errors to our custom error format
    const status = error.status || error.statusCode || 400;
    const code = error.code || 'API_ERROR';
    const message = error.message || 'Unknown error from Runway API';
    
    throw new RunwayAPIError(status, code, message);
  }
}

// Fetch the raw task payload from Runway for debugging/advanced use-cases
export async function getTaskDetailRaw(taskId: string): Promise<any> {
  const apiKey = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET;
  const version = process.env.X_RUNWAY_VERSION || '2024-12-01';
  if (!apiKey) {
    throw new Error('RUNWAY_API_KEY environment variable is required');
  }
  const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Runway-Version': version,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new RunwayAPIError(
      response.status,
      'API_ERROR',
      errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`
    );
  }
  return response.json();
}

// Cancel/delete a task
export async function cancelTask(taskId: string): Promise<{ cancelled: boolean }> {
  const apiKey = process.env.RUNWAY_API_KEY || process.env.RUNWAYML_API_SECRET;
  const version = process.env.X_RUNWAY_VERSION || '2024-12-01';
  if (!apiKey) {
    throw new Error('RUNWAY_API_KEY environment variable is required');
  }
  const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'X-Runway-Version': version,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new RunwayAPIError(
      response.status,
      'API_ERROR',
      errorData.error || errorData.message || `HTTP ${response.status} ${response.statusText}`
    );
  }
  return { cancelled: true };
}