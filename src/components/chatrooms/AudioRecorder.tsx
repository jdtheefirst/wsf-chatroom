"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Send,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

interface AudioRecorderProps {
  onSend: (audioBlob: Blob, duration: number) => Promise<void>;
  disabled?: boolean;
}

export function AudioRecorder({ onSend, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioURL]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : 1;
    }
  }, [isMuted]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      setAudioURL(null);
    }
    setDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
  };

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
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSend = async () => {
    if (!audioURL) return;

    setIsUploading(true);
    try {
      const response = await fetch(audioURL);
      const blob = await response.blob();
      await onSend(blob, duration);
      cancelRecording();
    } catch (error) {
      console.error("Error sending audio:", error);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      {!audioURL ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled}
          className={cn(
            "h-8 w-8 rounded-lg transition-all",
            isRecording &&
              "bg-red-500 hover:bg-red-600 text-white animate-pulse",
          )}
        >
          {isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      ) : (
        <div className="flex items-center gap-2 bg-muted rounded-lg p-2 min-w-[240px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlayback}
            className="h-8 w-8 rounded-full"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 ml-0.5" />
            )}
          </Button>

          <div className="flex-1">
            <Slider
              value={[currentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
          </div>

          <span className="text-xs font-mono min-w-[45px]">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="h-7 w-7 rounded-lg"
          >
            {isMuted ? (
              <VolumeX className="h-3 w-3" />
            ) : (
              <Volume2 className="h-3 w-3" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={cancelRecording}
            className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
            disabled={isUploading}
          >
            <Trash2 className="h-3 w-3" />
          </Button>

          <Button
            variant="default"
            size="icon"
            onClick={handleSend}
            className="h-7 w-7 rounded-lg"
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}

      {isRecording && (
        <div className="absolute -top-8 right-0 flex items-center gap-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs whitespace-nowrap">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Recording... {formatTime(duration)}
        </div>
      )}

      <audio
        ref={audioRef}
        src={audioURL || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
}
