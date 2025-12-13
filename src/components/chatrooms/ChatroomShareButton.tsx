// components/chatrooms/ChatroomShareButton.tsx
"use client";

import { Share2 } from "lucide-react";
import {
  FacebookShareButton,
  TwitterShareButton,
  LinkedinShareButton,
  WhatsappShareButton,
  TelegramShareButton,
  EmailShareButton,
  FacebookIcon,
  TwitterIcon,
  LinkedinIcon,
  WhatsappIcon,
  TelegramIcon,
  EmailIcon,
} from "next-share";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChatroomRecord } from "@/lib/chatrooms/types";

interface ChatroomShareButtonProps {
  chatroom: ChatroomRecord;
  roomMeta: any;
}

export function ChatroomShareButton({
  chatroom,
  roomMeta,
}: ChatroomShareButtonProps) {
  const shareUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `${process.env.NEXT_PUBLIC_APP_URL}/chatrooms/${chatroom.id}`;

  const title = `${chatroom.title} | WSF Chatroom`;
  const description =
    roomMeta.visibility === "public"
      ? `Join the ${chatroom.title} chatroom on World Samma Federation`
      : `Access the ${chatroom.title} chatroom on World Samma Federation`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // You can add a toast notification here
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const shareButtons = [
    {
      name: "Facebook",
      component: FacebookShareButton,
      icon: FacebookIcon,
      props: { url: shareUrl, quote: title },
    },
    {
      name: "Twitter",
      component: TwitterShareButton,
      icon: TwitterIcon,
      props: { url: shareUrl, title },
    },
    {
      name: "LinkedIn",
      component: LinkedinShareButton,
      icon: LinkedinIcon,
      props: { url: shareUrl, title, summary: description },
    },
    {
      name: "WhatsApp",
      component: WhatsappShareButton,
      icon: WhatsappIcon,
      props: { url: shareUrl, title, separator: " - " },
    },
    {
      name: "Telegram",
      component: TelegramShareButton,
      icon: TelegramIcon,
      props: { url: shareUrl, title },
    },
    {
      name: "Email",
      component: EmailShareButton,
      icon: EmailIcon,
      props: {
        url: shareUrl,
        subject: title,
        body: `${description}\n\n${shareUrl}`,
      },
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Copy Link Option */}
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          <span className="flex items-center gap-2">🔗 Copy Link</span>
        </DropdownMenuItem>

        {/* Social Media Options */}
        {shareButtons.map((platform) => {
          const ShareComponent = platform.component;
          const Icon = platform.icon;

          return (
            <DropdownMenuItem key={platform.name} className="p-0">
              <ShareComponent {...platform.props} className="w-full">
                <div className="flex items-center gap-2 px-2 py-1.5 w-full">
                  <Icon size={20} round />
                  <span>Share on {platform.name}</span>
                </div>
              </ShareComponent>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
