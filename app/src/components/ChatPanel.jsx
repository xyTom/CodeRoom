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
    <Card className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
      <CardHeader>
        <div>
          <CardTitle>Chat</CardTitle>
          <CardDescription>Room messages</CardDescription>
        </div>
        <CardAction>
          <Badge variant={status === "live" ? "secondary" : "outline"}>{status}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0" ref={messagesRef}>
        {messages.length ? (
          <div className="flex flex-col px-4">
            {messages.map((message) => (
              <article className="flex flex-col gap-1 border-b py-3 last:border-b-0" key={message.id}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <strong className="font-medium text-foreground">{message.author}</strong>
                  <span>{formatTime(message.createdAt)}</span>
                </div>
                <div className="break-words text-sm leading-6 whitespace-pre-wrap">{message.text}</div>
              </article>
            ))}
          </div>
        ) : (
          <Empty className="p-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageCircle />
              </EmptyMedia>
              <EmptyTitle>No messages yet</EmptyTitle>
              <EmptyDescription>Messages between interviewer and candidate will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
      <CardFooter className="border-t bg-card pb-5 pt-5">
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
            <Button size="icon" type="submit">
              <Send />
              <span className="sr-only">Send message</span>
            </Button>
          </FieldGroup>
        </form>
      </CardFooter>
    </Card>
  );
}
