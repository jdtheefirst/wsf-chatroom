// components/LeaderboardItem.tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getBeltInfo } from "@/lib/constants";
import { getInitials } from "@/lib/utils";
import { Badge } from "../ui/badge";
import Link from "next/link";

interface LeaderboardItemProps {
  item: any;
  index: number;
  currentUserId?: string;
  showRewardTier?: boolean;
  isAllTime?: boolean;
}

export function LeaderboardItem({
  item,
  index,
  currentUserId,
  showRewardTier = false,
  isAllTime = false,
}: LeaderboardItemProps) {
  const beltInfo = getBeltInfo(item.user.belt_level || 0);
  const isCurrentUser = item.user.id === currentUserId;
  const isTopThree = index < 3;
  const isChampion = index === 0 && isAllTime;

  const getRewardTier = (position: number) => {
    if (position <= 3) return "🥇 Gold";
    if (position <= 7) return "🥈 Silver";
    return "🥉 Bronze";
  };

  return (
    <Link
      href={`https://www.worldsamma.org/students/${item.user.admission_no}`}
      passHref
      className={`flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50 ${
        isCurrentUser ? "bg-primary/5" : ""
      } ${
        isChampion
          ? "bg-gradient-to-r from-yellow-50/50 to-amber-50/50 border border-yellow-200"
          : ""
      }`}
    >
      <div className="flex-shrink-0">
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm ${
            index === 0
              ? "bg-yellow-100 text-yellow-800"
              : index === 1
              ? "bg-slate-100 text-slate-800"
              : index === 2
              ? "bg-amber-100 text-amber-800"
              : "bg-muted"
          }`}
        >
          {index + 1}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={item.user.avatar_url || ""} />
            <AvatarFallback className="text-xs">
              {getInitials(item.user.full_name)}
            </AvatarFallback>
          </Avatar>
          <span
            className={`font-medium text-sm truncate ${
              isChampion ? "text-yellow-800" : ""
            }`}
          >
            {isCurrentUser ? "You" : item.user.full_name}
            {isChampion && " 👑"}
          </span>
          {beltInfo && (
            <div
              className="h-3 w-3 rounded-full border border-background"
              style={{ backgroundColor: beltInfo.color }}
              title={beltInfo.name}
            />
          )}
          {showRewardTier && isTopThree && (
            <Badge variant="outline" className="h-4 text-xs">
              {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="text-xs text-muted-foreground">
            {item.messageCount} message{item.messageCount !== 1 ? "s" : ""}
            {showRewardTier && !isTopThree && index < 10 && (
              <span className="ml-2 text-amber-600">
                {getRewardTier(index + 1)}
              </span>
            )}
          </div>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs h-5">
              You
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
