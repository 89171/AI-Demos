'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/client-context';
import { buildLandmarks } from '@/lib/engine/image-tasks';

/**
 * Live camera overlay for the real-time category.
 *
 * Runs entirely on the client: the camera frame is composited with the
 * landmark topology for the selected model so you can see the overlay behave
 * at interactive frame rates. It is a visual harness — the landmark positions
 * are driven by a tracking anchor, not by a loaded network.
 */
export function LiveOverlay({ variant }: { variant: 'face' | 'pose' | 'hand' }) {
  const { locale } = useApp();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const [on, setOn] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!on) return;
    let frames = 0;
    let last = performance.now();
    const loop = () => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.videoWidth) {
        const W = 480;
        const H = Math.round((v.videoHeight / v.videoWidth) * W);
        if (c.width !== W || c.height !== H) {
          c.width = W;
          c.height = H;
        }
        const ctx = c.getContext('2d')!;
        ctx.drawImage(v, 0, 0, W, H);

        const t = performance.now() / 1000;
        const w = variant === 'pose' ? 0.4 : 0.34;
        const h = variant === 'pose' ? 0.78 : 0.4;
        const box = {
          x: 0.5 - w / 2 + Math.sin(t * 0.6) * 0.045,
          y: (variant === 'pose' ? 0.5 : 0.44) - h / 2 + Math.cos(t * 0.45) * 0.03,
          w,
          h,
        };
        const set = buildLandmarks(variant, box, `live-${variant}`);
        const px = (x: number) => (x / 1) * 0; // placeholder to keep types explicit
        void px;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 3;
        set.edges.forEach(([a, b]) => {
          ctx.beginPath();
          ctx.moveTo(set.points[a].x, set.points[a].y);
          ctx.lineTo(set.points[b].x, set.points[b].y);
          ctx.stroke();
        });
        set.mesh?.forEach((row) => {
          ctx.beginPath();
          row.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
          ctx.stroke();
        });
        set.points.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, variant === 'face' ? 1.4 : 2.4, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 0;

        frames++;
        if (performance.now() - last > 700) {
          setFps(Math.round((frames * 1000) / (performance.now() - last)));
          frames = 0;
          last = performance.now();
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [on, variant]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
      setOn(true);
    } catch {
      setError(locale === 'zh' ? '无法访问摄像头' : 'Camera unavailable');
    }
  };

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setOn(false);
  };

  useEffect(() => () => stop(), []);

  return (
    <div className="surface rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[12.5px] font-medium">
            {locale === 'zh' ? '实时叠加预览' : 'Live overlay preview'}
          </div>
          <div className="mt-0.5 text-[10px]" style={{ color: 'var(--fg-faint)' }}>
            {locale === 'zh'
              ? '摄像头画面 + 关键点拓扑，本地渲染，不上传任何数据'
              : 'Camera frames plus landmark topology, rendered locally — nothing is uploaded'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {on && <span className="tag mono">{fps} fps</span>}
          <button type="button" className="btn" onClick={on ? stop : start}>
            {on ? (locale === 'zh' ? '关闭' : 'Stop') : locale === 'zh' ? '开启摄像头' : 'Start camera'}
          </button>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-lg border" style={{ background: '#000', aspectRatio: '4 / 3' }}>
        <video ref={videoRef} muted playsInline className="hidden" />
        <canvas ref={canvasRef} className="block h-full w-full object-cover" />
        {!on && (
          <div className="absolute inset-0 flex items-center justify-center text-[12px]" style={{ color: '#a1a1aa' }}>
            {locale === 'zh' ? '摄像头未开启' : 'Camera off'}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
