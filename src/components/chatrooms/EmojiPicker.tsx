// components/chatrooms/EmojiPicker.tsx - UPDATED
"use client";

import { useState, useRef, useEffect } from "react";
import EmojiPicker, { Theme, EmojiStyle, EmojiClickData } from "emoji-picker-react";
import { Button } from "@/components/ui/button";
import { Smile } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPickerComponent({ onEmojiSelect, disabled }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const handleEmojiSelect = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setOpen(false);
  };

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-9 w-9"
        >
          <Smile className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={popoverRef}
        className="w-auto border-none p-0 shadow-lg"
        align="start"
      >
        <EmojiPicker
          onEmojiClick={handleEmojiSelect}
          autoFocusSearch={false}
          theme={Theme.LIGHT}
          emojiStyle={EmojiStyle.NATIVE}
          width={350}
          height={400}
          previewConfig={{
            showPreview: false,
          }}
          searchDisabled={false}
          skinTonesDisabled={false}
        />
      </PopoverContent>
    </Popover>
  );
}