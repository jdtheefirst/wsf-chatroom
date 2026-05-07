"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PollCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (
    question: string,
    options: string[],
    optionImages: File[],
    isMultiSelect: boolean,
    durationDays: number,
  ) => Promise<void>;
}

export function PollCreator({
  open,
  onOpenChange,
  onCreate,
}: PollCreatorProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([
    { text: "", image: null as File | null },
  ]);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [durationDays, setDurationDays] = useState("7");
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, { text: "", image: null }]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOptionText = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index].text = text;
    setOptions(newOptions);
  };

  const handleOptionImage = (index: number, file: File | null) => {
    if (file && file.type.startsWith("image/")) {
      const newOptions = [...options];
      newOptions[index].image = file;
      setOptions(newOptions);
    }
  };

  const handleCreate = async () => {
    if (!question.trim() || options.some((opt) => !opt.text.trim())) {
      alert("Please fill in question and all options");
      return;
    }

    setIsCreating(true);
    try {
      await onCreate(
        question,
        options.map((opt) => opt.text),
        options
          .map((opt) => opt.image)
          .filter((img): img is File => img !== null),
        isMultiSelect,
        parseInt(durationDays),
      );
      // Reset form
      setQuestion("");
      setOptions([{ text: "", image: null }]);
      setIsMultiSelect(false);
      setDurationDays("7");
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating poll:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a Poll</DialogTitle>
          <DialogDescription>
            Ask a question and get feedback from the community
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question */}
          <div>
            <Label>Question</Label>
            <Textarea
              placeholder="What would you like to ask?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Options */}
          <div>
            <Label>Options (2-10)</Label>
            <div className="space-y-2 mt-1">
              {options.map((option, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder={`Option ${idx + 1}`}
                    value={option.text}
                    onChange={(e) => updateOptionText(idx, e.target.value)}
                    className="flex-1"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(ref) => {
                      fileInputRefs.current[idx] = ref;
                    }}
                    onChange={(e) =>
                      handleOptionImage(idx, e.target.files?.[0] || null)
                    }
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRefs.current[idx]?.click()}
                    className={cn(
                      "flex-shrink-0",
                      option.image && "border-primary text-primary",
                    )}
                    title={option.image ? "Change image" : "Add image"}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  {idx > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeOption(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addOption}
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Option
              </Button>
            )}
          </div>

          {/* Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Duration</Label>
              <Select value={durationDays} onValueChange={setDurationDays}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 mt-auto pb-2">
              <input
                type="checkbox"
                id="multiSelect"
                checked={isMultiSelect}
                onChange={(e) => setIsMultiSelect(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="multiSelect" className="text-sm font-normal">
                Allow multiple selections
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Poll"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
