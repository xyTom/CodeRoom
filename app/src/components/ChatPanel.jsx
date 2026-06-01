import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatPanel({ messages, status, onSend }) {
  const [draft, setDraft] = useState("");
  const messagesRef = useRef(null);
  const statusVariant = status === "live" ? "secondary" : "outline";

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      return;
    }
    setDraft("");
    await onSend(text);
  }

  return (
    <Card size="sm" className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] shadow-sm">
      <CardHeader className="border-b">
        <CardTitle>Chat</CardTitle>
        <CardDescription>{messages.length} message{messages.length === 1 ? "" : "s"}</CardDescription>
        <CardAction>
          <Badge variant={statusVariant}>{status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto bg-muted/30 p-0" ref={messagesRef}>
        {messages.length ? (
          <div className="flex flex-col gap-2 p-3">
            {messages.map((message) => (
              <article className="flex flex-col gap-1 rounded-2xl border bg-background px-3 py-2 shadow-sm" key={message.id}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">{message.author}</strong>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <div className="break-words text-sm leading-6 whitespace-pre-wrap">{message.text}</div>
              </article>
            ))}
          </div>
        ) : (
          <Empty className="h-full border-0 p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle />
              </EmptyMedia>
              <EmptyTitle>No messages yet</EmptyTitle>
              <EmptyDescription>Send notes, links, or quick interview context here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      <CardFooter className="border-t bg-card pb-3 pt-3">
        <form className="w-full" onSubmit={handleSubmit}>
          <FieldGroup className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <Field className="min-w-0">
              <FieldLabel className="sr-only" htmlFor="chat-message">
                Message
              </FieldLabel>
              <Input
                id="chat-message"
                maxLength={1200}
                placeholder="Message the room"
                autoComplete="off"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </Field>
            <Button size="icon-sm" type="submit" aria-label="Send message">
              <Send />
              <span className="sr-only">Send message</span>
            </Button>
          </FieldGroup>
        </form>
      </CardFooter>
    </Card>
  );
}
