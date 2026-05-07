"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

export type AudioData = {
  url: string;
  duration: number;
  waveform_data: number[];
  size_bytes?: number;
};

interface AudioMessageProps {
  audioData: AudioData;
  isOwn?: boolean;
}

export function AudioMessage({ audioData, isOwn }: AudioMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(audioData.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `voice-message-${Date.now()}.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl max-w-[320px] w-full",
        isOwn ? "bg-primary text-primary-foreground" : "bg-muted",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlayback}
        className={cn(
          "h-10 w-10 rounded-full flex-shrink-0",
          isOwn ? "hover:bg-primary-foreground/20 text-primary-foreground" : "",
        )}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5 ml-0.5" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        {/* Waveform visualization */}
        {audioData.waveform_data && audioData.waveform_data.length > 0 && (
          <div className="flex items-center gap-0.5 h-8 mb-1">
            {audioData.waveform_data.slice(0, 40).map((height, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-full transition-all",
                  isOwn ? "bg-primary-foreground/60" : "bg-foreground/60",
                )}
                style={{ height: `${Math.max(4, height * 24)}px` }}
              />
            ))}
          </div>
        )}

        {/* Progress bar and time */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Slider
              value={[currentTime]}
              max={audioData.duration}
              step={0.1}
              onValueChange={handleSeek}
              className={cn(
                "w-full",
                isOwn && "[&_.slider-track]:bg-primary-foreground/20",
              )}
            />
          </div>
          <span className="text-xs font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(audioData.duration)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMuted(!isMuted)}
          className={cn(
            "h-8 w-8 rounded-lg flex-shrink-0",
            isOwn ? "hover:bg-primary-foreground/20" : "",
          )}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          className={cn(
            "h-8 w-8 rounded-lg flex-shrink-0",
            isOwn ? "hover:bg-primary-foreground/20" : "",
          )}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      <audio
        ref={audioRef}
        src={audioData.url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        muted={isMuted}
      />
    </div>
  );
}
