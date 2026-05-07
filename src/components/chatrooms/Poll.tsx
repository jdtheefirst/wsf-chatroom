"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  BarChart3,
  Clock,
  Image as ImageIcon,
  X,
  Check,
  CheckCheck,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { toast } from "sonner";

export type PollData = {
  question: string;
  is_multi_select: boolean;
  expires_at: string;
  total_votes: number;
  options: Array<{
    id: string;
    text: string;
    image_url: string | null;
    vote_count: number;
  }>;
  user_votes: string[];
};

interface PollProps {
  pollData: PollData;
  messageId: string;
  onVote: (optionId: string) => Promise<void>;
  isOwn?: boolean;
}

export function Poll({ pollData, onVote, isOwn }: PollProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [showMultiSelectConfirm, setShowMultiSelectConfirm] = useState(false);

  const isExpired = new Date(pollData.expires_at) < new Date();
  const hasVoted = pollData.user_votes && pollData.user_votes.length > 0;
  const canVote = !hasVoted && !isExpired && !isOwn;
  const totalVotes = pollData.total_votes;

  const handleVote = async (optionId: string) => {
    if (!canVote || isVoting) return;

    if (!pollData.is_multi_select) {
      setIsVoting(true);
      await onVote(optionId);
      setIsVoting(false);
    } else {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      );
    }
  };

  const submitMultiVote = async () => {
    if (selectedOptions.length === 0 || isVoting) return;
    setIsVoting(true);
    for (const optionId of selectedOptions) {
      await onVote(optionId);
    }
    setIsVoting(false);
    setShowMultiSelectConfirm(false);
    setSelectedOptions([]);
  };

  const getPercentage = (voteCount: number) => {
    if (totalVotes === 0) return 0;
    return (voteCount / totalVotes) * 100;
  };

  const formatExpiry = () => {
    const expiry = new Date(pollData.expires_at);
    const now = new Date();
    const diffHours = Math.floor(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60),
    );

    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} left`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} left`;
  };

  return (
    <Card className="mt-3 p-2 sm:p-4 bg-muted/30 border-2 transition-all hover:border-primary/30">
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              Poll
            </span>
            {pollData.is_multi_select && (
              <Badge variant="outline" className="text-xs">
                Multiple choice
              </Badge>
            )}
          </div>
          <h4 className="font-semibold text-base">{pollData.question}</h4>
        </div>

        {isExpired ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Closed
          </Badge>
        ) : (
          !hasVoted && (
            <Badge
              variant="outline"
              className="flex items-center gap-1 text-xs"
            >
              <Clock className="h-3 w-3" />
              {formatExpiry()}
            </Badge>
          )
        )}
      </div>

      {/* Options */}
      <div className="space-y-3">
        {pollData.options.map((option) => {
          const percentage = getPercentage(option.vote_count);
          const isSelected = selectedOptions.includes(option.id);
          const isUserVoted = pollData.user_votes?.includes(option.id);
          const showResults = hasVoted || isExpired || isOwn;

          return (
            <div key={option.id} className="space-y-1">
              <button
                onClick={() => handleVote(option.id)}
                disabled={!canVote || (pollData.is_multi_select && isUserVoted)}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-all",
                  "hover:bg-muted/50",
                  (isSelected || isUserVoted) && "border-primary bg-primary/5",
                  !canVote && "cursor-default",
                  canVote && "cursor-pointer",
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Option Image */}
                  {option.image_url && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Image
                            src={option.image_url}
                            alt={option.text}
                            fill
                            className="object-cover"
                          />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl p-0 overflow-hidden">
                        <div className="relative w-full h-[80vh]">
                          <Image
                            src={option.image_url}
                            alt={option.text}
                            fill
                            className="object-contain"
                          />
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Option Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{option.text}</span>
                      {showResults && (
                        <span className="text-xs text-muted-foreground">
                          {option.vote_count} vote
                          {option.vote_count !== 1 ? "s" : ""}
                          {totalVotes > 0 && ` (${Math.round(percentage)}%)`}
                        </span>
                      )}
                    </div>

                    {showResults && (
                      <Progress value={percentage} className="h-2" />
                    )}

                    {pollData.is_multi_select && canVote && isSelected && (
                      <div className="flex items-center gap-1 mt-1">
                        <Check className="h-3 w-3 text-primary" />
                        <span className="text-xs text-primary">Selected</span>
                      </div>
                    )}
                  </div>

                  {isUserVoted && !pollData.is_multi_select && (
                    <CheckCheck className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>
            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
          </span>
        </div>

        {pollData.is_multi_select && canVote && selectedOptions.length > 0 && (
          <Button
            size="sm"
            onClick={() => setShowMultiSelectConfirm(true)}
            disabled={isVoting}
          >
            {isVoting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Submit ${selectedOptions.length} vote${selectedOptions.length !== 1 ? "s" : ""}`
            )}
          </Button>
        )}

        {hasVoted && !isExpired && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <Check className="h-3 w-3" />
            Voted
          </span>
        )}
      </div>

      {/* Multi-select confirmation dialog */}
      <Dialog
        open={showMultiSelectConfirm}
        onOpenChange={setShowMultiSelectConfirm}
      >
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <h3 className="font-semibold">Confirm your votes</h3>
            <div className="space-y-2">
              {selectedOptions.map((optId) => {
                const option = pollData.options.find((o) => o.id === optId);
                return (
                  <div key={optId} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>{option?.text}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowMultiSelectConfirm(false)}
              >
                Cancel
              </Button>
              <Button onClick={submitMultiVote}>Confirm Vote</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
