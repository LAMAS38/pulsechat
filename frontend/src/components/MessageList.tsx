import { useMemo, useEffect } from "react";

import { AnimatePresence, motion } from "framer-motion";

import { groupMessagesByDate } from "../lib/messageGroups";

import type { RoomTheme } from "../lib/roomTheme";

import { useSmartScroll } from "../hooks/useSmartScroll";

import type { ConnectionStatus as Status } from "../hooks/useChatWebSocket";

import type { Message } from "../types";

import { scaleIn } from "../lib/motion";

import { CHAT_MOBILE_FRAME_SYNC } from "../lib/mobileChatFrame";

import { ChatSkeleton } from "./ChatSkeleton";

import { DateDivider } from "./DateDivider";

import { MessageBubble } from "./MessageBubble";

import { ScrollToBottomFab } from "./ScrollToBottomFab";



interface MessageListProps {

  messages: Message[];

  currentUsername: string;

  slug: string;

  theme: RoomTheme;

  connectionStatus: Status;

  isLoadingHistory: boolean;

}



export function MessageList({

  messages,

  currentUsername,

  slug,

  theme,

  connectionStatus,

  isLoadingHistory,

}: MessageListProps) {

  const { containerRef, bottomRef, onScroll, showScrollFab, scrollToBottom } = useSmartScroll(

    messages.length,

  );

  useEffect(() => {
    const onFrameSync = () => {
      const composeFocused = Boolean(document.activeElement?.closest(".chat-compose-area"));
      if (composeFocused) {
        scrollToBottom("auto");
      }
    };
    window.addEventListener(CHAT_MOBILE_FRAME_SYNC, onFrameSync);
    return () => window.removeEventListener(CHAT_MOBILE_FRAME_SYNC, onFrameSync);
  }, [scrollToBottom]);



  const groups = useMemo(() => groupMessagesByDate(messages), [messages]);

  const lastMessageId = messages[messages.length - 1]?.id;



  if (isLoadingHistory) {

    return <ChatSkeleton />;

  }



  if (messages.length === 0) {

    return (

      <motion.div

        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 pb-8 text-center"

        variants={scaleIn}

        initial="initial"

        animate="animate"

      >

        <div className="room-empty-glow relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 sm:p-10">

          <motion.span

            className="inline-block text-5xl"

            aria-hidden

            animate={{ y: [0, -6, 0] }}

            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}

          >

            {theme.emoji}

          </motion.span>

          <h2 className="room-slug-title mt-4 text-xl md:text-2xl">#{slug}</h2>

          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">

            {connectionStatus === "connected"

              ? "Votre salon est prêt. Lancez la conversation, chaque message vit ici en temps réel."

              : "Connexion au salon…"}

          </p>

        </div>

      </motion.div>

    );

  }



  return (

    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">

      <div

        ref={containerRef}

        onScroll={onScroll}

        className="chat-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pt-3 pb-10 sm:px-4 sm:pt-4 md:space-y-4 md:px-5 md:pb-12 lg:px-6 lg:pt-5"

        role="log"

        aria-live="polite"

        aria-relevant="additions"

        aria-label="Messages du salon"

      >

        {groups.map((group) => (

          <div key={group.key} className="space-y-3 sm:space-y-4">

            <DateDivider label={group.label} />

            {group.messages.map((message, index) => {

              const isOwn = message.username === currentUsername;

              const prev = group.messages[index - 1];

              const showAvatar = !isOwn && (!prev || prev.username !== message.username);



              return (

                <MessageBubble

                  key={message.id}

                  message={message}

                  isOwn={isOwn}

                  showAvatar={showAvatar}

                  animate={message.id === lastMessageId}

                />

              );

            })}

          </div>

        ))}

        <div ref={bottomRef} className="h-6 shrink-0" aria-hidden />

      </div>

      <AnimatePresence>

        {showScrollFab && (

          <ScrollToBottomFab key="fab" onClick={() => scrollToBottom()} />

        )}

      </AnimatePresence>

    </div>

  );

}

