"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  Archive,
  Check,
  Clock,
  CheckCircle2,
  Inbox,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Reply,
  Send,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Zap,
} from "lucide-react";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ThreadView() {
  const {
    selectedThreadId,
    threads,
    messages,
    messagesLoading,
    isInAiContext,
    addToAiContext,
    removeFromAiContext,
    setAiSidebarOpen,
    toggleStarred,
  } = useAppState();

  if (!selectedThreadId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Select a thread to read
          </p>
        </div>
      </div>
    );
  }

  const thread = threads.find((t) => t.id === selectedThreadId);
  if (!thread) return null;

  const isDiscord = thread.platform === "DISCORD";
  const inContext = isInAiContext(thread.id);

  const handleToggleContext = () => {
    if (inContext) {
      removeFromAiContext(thread.id);
    } else {
      addToAiContext({ id: thread.id, label: thread.subject });
      setAiSidebarOpen(true);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isDiscord && (
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            )}
            <h2 className="truncate text-sm font-semibold text-foreground">
              {thread.subject}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {thread.participants.map((p) => p.name).join(", ")} &middot;{" "}
            {thread.messageCount} message
            {thread.messageCount !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Thread actions */}
        <div className="flex items-center gap-1">
          {/* Add to AI context */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={inContext ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-8 w-8",
                  inContext && "h-8 w-8",
                )}
                onClick={handleToggleContext}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {inContext ? "Remove from AI context" : "Add to AI context"}
            </TooltipContent>
          </Tooltip>



          {/* Star toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleStarred(thread.id)}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    thread.isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : "",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {thread.isStarred ? "Unstar" : "Star"}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-5" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Mark done</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Clock className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Snooze</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Tag className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tag</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>More</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0 px-6 py-4">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading messages...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No messages found in this thread
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id}>
                <div className="flex gap-3 py-4">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {getInitials(msg.fromName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {msg.fromName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {!isDiscord && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        to{" "}
                        {msg.toAddresses.length > 0
                          ? msg.toAddresses.join(", ")
                          : "..."}
                      </p>
                    )}

                    {msg.bodyHtml ? (
                      <div
                        className="mt-3 prose prose-sm max-w-none text-foreground prose-a:text-primary [&_img]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                      />
                    ) : (
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {msg.bodyText || "(no content)"}
                      </div>
                    )}
                  </div>
                </div>
                {idx < messages.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Quick actions bar */}
      <QuickActions
        threadId={thread.id}
        threadSubject={thread.subject}
        platform={thread.platform}
        participants={thread.participants}
        onOpenAi={() => {
          addToAiContext({ id: thread.id, label: thread.subject });
          setAiSidebarOpen(true);
        }}
      />
    </div>
  );
}

// ─── Quick AI Actions ────────────────────────────────────

interface QuickAction {
  id: string;
  label: string;
  icon: typeof ThumbsUp;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "ack",
    label: "Acknowledge",
    icon: ThumbsUp,
    prompt: "Send a brief acknowledgment reply — something like 'got it, thanks' in my tone. Keep it to 1-2 sentences max.",
  },
  {
    id: "decline",
    label: "Decline",
    icon: ThumbsDown,
    prompt: "Politely decline or pass on whatever is being asked/offered. Keep it brief and professional in my tone.",
  },
  {
    id: "more_info",
    label: "Ask for details",
    icon: HelpCircle,
    prompt: "Reply asking for more information or clarification about what they're discussing. Keep it concise, in my tone.",
  },
];

function QuickActions({
  threadId,
  threadSubject,
  platform,
  participants,
  onOpenAi,
}: {
  threadId: string;
  threadSubject: string;
  platform: string;
  participants: { name: string; email: string }[];
  onOpenAi: () => void;
}) {
  const { toneProfile } = useAppState();
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleQuickAction = async (action: QuickAction) => {
    setSending(action.id);
    setError(null);

    try {
      // Fetch thread messages for context
      const isOutlook = platform === "OUTLOOK";
      const url = isOutlook
        ? `/api/outlook/threads/${threadId}`
        : `/api/gmail/threads/${threadId}`;
      const threadRes = await fetch(url);
      const threadData = threadRes.ok ? await threadRes.json() : null;

      const context = threadData
        ? [
            {
              threadId,
              subject: threadSubject,
              messages: (threadData.messages ?? []).map(
                (m: { fromName: string; bodyText: string; sentAt: string }) => ({
                  from: m.fromName,
                  body: m.bodyText,
                  sentAt: m.sentAt,
                }),
              ),
            },
          ]
        : undefined;

      // Get AI draft
      const aiRes = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: action.prompt,
          context,
          toneProfile: toneProfile ?? undefined,
        }),
      });

      if (!aiRes.ok) throw new Error("AI request failed");

      const reader = aiRes.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }

      // Extract draft content from the response
      const draftMatch = accumulated.match(/```draft\n([\s\S]*?)```/);
      const draftBody = draftMatch ? draftMatch[1].trim() : accumulated.trim();

      if (!draftBody) throw new Error("Empty draft");

      // Send the reply
      const recipient = participants[0];
      const sendUrl = isOutlook ? "/api/outlook/send" : "/api/gmail/send";
      const sendPayload = isOutlook
        ? { to: recipient?.email ?? "", subject: threadSubject, body: draftBody }
        : { threadId, to: recipient?.email ?? "", subject: threadSubject, body: draftBody };

      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendPayload),
      });

      if (!sendRes.ok) throw new Error("Send failed");

      setSent(action.id);
      setTimeout(() => setSent(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setTimeout(() => setError(null), 3000);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="border-t border-border px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            const isSending = sending === action.id;
            const isSent = sent === action.id;

            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs"
                    onClick={() => handleQuickAction(action)}
                    disabled={!!sending}
                  >
                    {isSending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isSent ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                    {isSent ? "Sent" : action.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  AI generates and sends a &quot;{action.label.toLowerCase()}&quot; reply in your tone
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={onOpenAi}
        >
          <Sparkles className="h-3 w-3" />
          AI reply
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs text-muted-foreground"
          onClick={onOpenAi}
        >
          <Reply className="h-3 w-3" />
          Full reply
        </Button>

        {error && (
          <span className="text-xs text-red-500 ml-auto">{error}</span>
        )}
      </div>
    </div>
  );
}
