import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { DBTIResult } from "@shared/dbti";
import { Bot, X } from "lucide-react";
import { useState } from "react";

type DBTIAssistantProps = {
  result: DBTIResult;
};

export function DBTIAssistant({ result }: DBTIAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const assistant = trpc.ai.assist.useMutation({
    onSuccess: (answer) => setMessages((current) => [...current, { role: "assistant", content: answer }]),
    onError: () => setMessages((current) => [...current, { role: "assistant", content: "I don't have enough verified data" }]),
  });

  const sendMessage = (content: string) => {
    setMessages((current) => [...current, { role: "user", content }]);
    assistant.mutate({ question: content, scan: result });
  };

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open ? (
        <aside className="mb-3 w-[min(400px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[#262626] bg-[#111111] shadow-[0_18px_50px_rgba(11,11,11,0.82)]" aria-label="DBTI Assistant">
          <div className="flex items-center justify-between border-b border-[#262626] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#F5F5F5]">DBTI Assistant</p>
              <p className="mt-0.5 text-xs text-[#A1A1A1]">Grounded in this scan&apos;s public evidence</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close DBTI Assistant" className="text-[#A1A1A1] hover:bg-[#171717] hover:text-[#F5F5F5]">
              <X className="size-4" />
            </Button>
          </div>
          <AIChatBox
            height="430px"
            className="rounded-none border-0 bg-[#111111] shadow-none"
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={assistant.isPending}
            placeholder="Ask about this DBTI scan"
            emptyStateMessage="Ask about this business's verified DBTI evidence."
            suggestedPrompts={["Why is my score low?", "What should I fix first?", "Explain my security score."]}
          />
        </aside>
      ) : null}
      <button
        type="button"
        className="group flex h-11 items-center gap-2 rounded-full border border-[#262626] bg-[#F5F5F5] px-4 text-sm font-medium text-[#0B0B0B] transition duration-150 hover:bg-[#A1A1A1] active:scale-[0.97]"
        onClick={() => setOpen(true)}
        aria-label="Open DBTI Assistant"
      >
        <Bot className="size-4" aria-hidden="true" />
        DBTI Assistant
      </button>
    </div>
  );
}
