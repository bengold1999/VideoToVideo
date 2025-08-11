'use client';

import { useState } from 'react';
import { ToastContainer, useToasts } from '@/components/toast';
import { ALLOWED_RATIOS, ALLOWED_MODELS, VideoGenerationData } from '@/lib/validation';

interface TaskStatus {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  outputs?: string[];
  error?: string;
}

export default function Home() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [formData, setFormData] = useState<VideoGenerationData>({
    promptText: '',
    model: 'gen4_aleph',
    ratio: '1280:720',
    seed: undefined,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [outputVideo, setOutputVideo] = useState<string | null>(null);
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);

  const { toasts, removeToast, success, error, info } = useToasts();


  const downloadUrl = (url: string, filename?: string) => {
    try {
      const link = document.createElement('a');
      link.href = url;
      if (filename) link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error('Auto-download failed, falling back:', e);
      window.open(url, '_blank');
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    // Extend polling window: 15 minutes at 3s intervals
    const POLL_INTERVAL_MS = 3000;
    const maxAttempts = Math.ceil((15 * 60 * 1000) / POLL_INTERVAL_MS);
    let attempts = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3; // Circuit breaker: stop after 3 consecutive errors

    const poll = async () => {
      if (attempts >= maxAttempts) {
        error('Task polling timed out');
        setIsGenerating(false);
        return;
      }

      if (consecutiveErrors >= maxConsecutiveErrors) {
        error('Too many consecutive errors. Stopping to prevent excessive API calls.');
        setIsGenerating(false);
        return;
      }

      try {
        const response = await fetch(`/api/task/${taskId}`);
        const data = await response.json();

        if (!response.ok) {
          // Check for permanent errors that shouldn't be retried
          if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
            error(`Permanent error: ${data.message || data.error || 'Invalid request'}`);
            setIsGenerating(false);
            return;
          }
          throw new Error(data.message || 'Failed to get task status');
        }

        // Reset consecutive errors on successful response
        consecutiveErrors = 0;
        setTaskStatus(data);

        if (data.status === 'SUCCEEDED') {
          setIsGenerating(false);
          if (data.outputs && data.outputs.length > 0) {
            const url = data.outputs[0];
            setOutputVideo(url);
            if (!hasDownloaded) {
              const filename = `runway-generated-${Date.now()}.mp4`;
              downloadUrl(url, filename);
              setHasDownloaded(true);
            }
            success('Video generation completed!');
          } else {
            error('Generation completed but no output received');
          }
        } else if (data.status === 'FAILED') {
          setIsGenerating(false);
          error(data.error || 'Video generation failed');
        } else {
          // Continue polling
          attempts++;
          setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err: any) {
        console.error('Polling error:', err);
        attempts++;
        consecutiveErrors++;
        
        // Check for permanent errors that shouldn't be retried
        if (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404) {
          error(`Permanent error: ${err.message || 'Invalid request'}`);
          setIsGenerating(false);
          return;
        }
        
        // Be more conservative with retries to avoid expensive API calls
        if (consecutiveErrors < maxConsecutiveErrors && attempts < maxAttempts) {
          // Only retry if we haven't hit the circuit breaker limits
          setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          error('Failed to check generation status - stopping to prevent excessive API calls');
          setIsGenerating(false);
        }
      }
    };

    poll();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validate URL input only
    if (!videoUrl.trim()) {
      error('Please enter a video URL');
      return;
    }
    if (!videoUrl.startsWith('https://')) {
      error('Only HTTPS URLs are allowed');
      return;
    }

    if (!formData.promptText.trim()) {
      error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setTaskStatus(null);
    setOutputVideo(null);
    setHasDownloaded(false);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: videoUrl,
          promptText: formData.promptText,
          model: formData.model,
          ratio: formData.ratio,
          seed: formData.seed,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Generation failed');
      }

      info('Generation started. This may take a few minutes...');
      setTaskId(data.taskId);
      pollTaskStatus(data.taskId);

    } catch (err) {
      console.error('Generation error:', err);
      error(err instanceof Error ? err.message : 'Failed to start generation');
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (outputVideo) {
      const link = document.createElement('a');
      link.href = outputVideo;
      link.download = `runway-generated-${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Form Section */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-3">Video URL</label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full px-3 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="text-slate-500 text-xs mt-2 space-y-1">
                <div>Enter a direct HTTPS URL to your MP4 video file</div>
                <div className="text-slate-600">Examples: GitHub releases, Google Drive direct links, S3, etc.</div>
              </div>
            </div>

            {/* Prompt */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-slate-200 mb-2">
                Prompt
              </label>
              <textarea
                id="prompt"
                value={formData.promptText}
                onChange={(e) => setFormData(prev => ({ ...prev, promptText: e.target.value }))}
                placeholder="Describe how you want to transform the video..."
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                maxLength={500}
              />
              <div className="text-slate-500 text-xs mt-1">
                {formData.promptText.length}/500 characters
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-slate-200 mb-2">
                Model
              </label>
              <select
                id="model"
                value={formData.model}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value as any }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ALLOWED_MODELS.map(model => (
                  <option key={model} value={model}>
                    {model} {model === 'gen4_aleph' ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label htmlFor="ratio" className="block text-sm font-medium text-slate-200 mb-2">
                Aspect Ratio
              </label>
              <select
                id="ratio"
                value={formData.ratio}
                onChange={(e) => setFormData(prev => ({ ...prev, ratio: e.target.value as any }))}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {ALLOWED_RATIOS.map(ratio => (
                  <option key={ratio} value={ratio}>
                    {ratio} {ratio === '1280:720' ? '(Landscape)' : ratio === '720:1280' ? '(Portrait)' : ratio === '960:960' ? '(Square)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Seed (Optional) */}
            <div>
              <label htmlFor="seed" className="block text-sm font-medium text-slate-200 mb-2">
                Seed (Optional)
              </label>
              <input
                id="seed"
                type="number"
                value={formData.seed || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  seed: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                placeholder="Leave empty for random seed"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="text-slate-500 text-xs mt-1">
                Set a specific seed for reproducible results
              </div>
            </div>

            {/* Generate Button */}
            <button
              type="submit"
              disabled={
                isGenerating ||
                !formData.promptText.trim() ||
                !videoUrl.trim()
              }
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-all duration-200"
            >
              {isGenerating ? 'Generating...' : 'Generate Video'}
            </button>
          </form>
        </div>

        {/* Status Section */}
        {(taskStatus || taskId) && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-medium text-white mb-4">Generation Status</h3>
            {taskStatus ? (
              <div className="flex items-center space-x-3">
                <div className={`w-3 h-3 rounded-full ${
                  taskStatus.status === 'QUEUED' ? 'bg-yellow-500' :
                  taskStatus.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' :
                  taskStatus.status === 'SUCCEEDED' ? 'bg-green-500' :
                  'bg-red-500'
                }`}></div>
                <span className="text-slate-200 capitalize">
                  {taskStatus.status.toLowerCase()}
                </span>
                {taskStatus.status === 'RUNNING' && (
                  <span className="text-slate-400 text-sm">
                    This usually takes 2-3 minutes...
                  </span>
                )}
              </div>
            ) : (
              <div className="text-slate-400 text-sm">Waiting to start...</div>
            )}
            {taskId && (
              <div className="mt-3 text-slate-400 text-sm">
                Task ID: <code className="text-slate-300">{taskId}</code>
                <a
                  href={`/api/task/${taskId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 text-blue-400 hover:text-blue-300 underline"
                >
                  View raw JSON
                </a>
              </div>
            )}
            {taskStatus?.error && (
              <div className="mt-3 text-red-400 text-sm">
                Error: {taskStatus.error}
              </div>
            )}
            {taskStatus?.status === 'RUNNING' && (
              <div className="mt-3 text-slate-400 text-sm space-y-1">
                {typeof (taskStatus as any).progress === 'number' && (
                  <div>Progress: {(taskStatus as any).progress}%</div>
                )}
                {typeof (taskStatus as any).queuePosition === 'number' && (
                  <div>Queue position: {(taskStatus as any).queuePosition}</div>
                )}
                <button
                  onClick={async () => {
                    if (!taskId) return;
                    try {
                      const res = await fetch(`/api/task/${taskId}`, { method: 'DELETE' });
                      if (res.ok) {
                        error('Task cancelled');
                        setIsGenerating(false);
                      } else {
                        const data = await res.json().catch(() => ({}));
                        error(data.message || data.error || 'Failed to cancel task');
                      }
                    } catch (e) {
                      error('Failed to cancel task');
                    }
                  }}
                  className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-xs"
                >
                  Cancel Task
                </button>
              </div>
            )}
          </div>
        )}

        {/* Output Section */}
        {outputVideo && (
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-white">Generated Video</h3>
              <button
                onClick={handleDownload}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Download</span>
              </button>
            </div>
            <video
              src={outputVideo}
              controls
              className="w-full rounded-lg bg-black"
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
            <div className="mt-3 text-slate-400 text-sm">
              ⚠️ Note: Generated videos are temporary. Download immediately for permanent storage.
            </div>
          </div>
        )}

        {/* Cost Notice */}
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h4 className="text-amber-300 font-medium mb-1">Usage & Costs</h4>
              <p className="text-amber-200/80 text-sm">
                Each generation consumes Runway credits. The Gen4 Aleph model is optimized for quality and speed.
                Generated videos are temporary - download them immediately after completion.
              </p>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}