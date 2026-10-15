'use client';

import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/lib/client-context';
import type { LandmarkSet } from '@/lib/engine/image-tasks';
import { detectLandmarks, MP_VARIANT, MP_VARIANT_KINDS, type MpKind } from '@/lib/engine/mediapipe';

/**
 * Live camera overlay for the real-time category.
 *
 * Runs entirely on the client: every camera frame goes through the selected
 * MediaPipe model (VIDEO running mode) and the real landmarks are drawn on top.
 */
export function LiveOverlay({ variant, mp }: { variant: 'face' | 'pose' | 'hand'; mp?: MpKind }) {
  const kind = (mp && mp in MP_VARIANT_KINDS ? mp : MP_VARIANT[variant]) as keyof typeof MP_VARIANT_KINDS;
  const setRef = useRef<LandmarkSet | null>(null);
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
    let busy = false;
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
        if (!busy) {
          busy = true;
          detectLandmarks(kind, v, { mode: 'VIDEO', out: { w: W, h: H } })
            .then((r) => (setRef.current = r.set))
            .catch((e) => setError(String(e?.message ?? e)))
            .finally(() => (busy = false));
        }

        const set = setRef.current;
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 3;
        if (set) {
          if (kind === 'face-detect') ctx.strokeRect(set.box.x, set.box.y, set.box.w, set.box.h);
          set.edges.forEach(([a, b]) => {
            ctx.beginPath();
            ctx.moveTo(set.points[a].x, set.points[a].y);
            ctx.lineTo(set.points[b].x, set.points[b].y);
            ctx.stroke();
          });
          set.points.forEach((pt) => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, variant === 'face' ? 1.4 : 2.4, 0, Math.PI * 2);
            ctx.fill();
          });
        }
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
  }, [on, variant, kind]);

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
              ? 'MediaPipe 模型逐帧推理，本地运行，不上传任何数据'
              : 'MediaPipe runs on every frame locally — nothing is uploaded'}
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
