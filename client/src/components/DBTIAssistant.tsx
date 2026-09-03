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
  const [open, setOpen] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview_assistant"));
  const [messages, setMessages] = useState<Message[]>([]);
  const hasVerifiedEvidence = result.evidence.some((item) => item.status === "VERIFIED_PASS" || item.status === "VERIFIED_FAIL" || item.status === "PARTIAL");
  const assistant = trpc.ai.assist.useMutation({
    onSuccess: (answer) => setMessages((current) => [...current, { role: "assistant", content: answer }]),
    onError: () => setMessages((current) => [...current, { role: "assistant", content: hasVerifiedEvidence ? "The assistant could not obtain a grounded AI response for this scan. Review the evidence ledger and try again." : "I don't have enough verified data" }]),
  });

  const sendMessage = (content: string) => {
    setMessages((current) => [...current, { role: "user", content }]);
    if (!hasVerifiedEvidence) {
      setMessages((current) => [...current, { role: "assistant", content: "I don't have enough verified data" }]);
      return;
    }
    assistant.mutate({ question: content, scan: result });
  };

  return (
    <div className="fixed bottom-5 right-5 z-30">
      {open ? (
        <aside className="mb-3 w-[min(400px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_50px_rgba(11,11,11,0.82)]" aria-label="DBTI Assistant">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">DBTI Assistant</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{result.aiAvailable ? "Grounded in this scan's public evidence" : result.aiStatus === "QUOTA_EXCEEDED" ? "Gemini quota is currently exhausted" : "Only grounded responses will be shown"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close DBTI Assistant" className="text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]">
              <X className="size-4" />
            </Button>
          </div>
          <AIChatBox
            height="430px"
            className="rounded-none border-0 bg-[var(--card)] shadow-none"
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={assistant.isPending}
            placeholder="Ask about this DBTI scan"
            emptyStateMessage={result.aiAvailable ? "Ask about this business's verified DBTI evidence." : result.aiStatus === "QUOTA_EXCEEDED" ? "Gemini API quota is currently exhausted. DBTI will continue to show deterministic evidence and recommendations." : "The scan did not receive validated AI insight. You can still ask a question; DBTI will only answer if it can ground the response in verified evidence."}
            suggestedPrompts={["Why is my score low?", "What should I fix first?", "Explain my security score."]}
          />
        </aside>
      ) : null}
      <button
        type="button"
        className="group flex h-11 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--surface-foreground)] transition duration-150 hover:bg-[var(--muted-foreground)] active:scale-[0.97]"
        onClick={() => setOpen(true)}
        aria-label="Open DBTI Assistant"
      >
        <Bot className="size-4" aria-hidden="true" />
        DBTI Assistant
      </button>
    </div>
  );
}
