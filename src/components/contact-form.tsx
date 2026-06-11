"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  sendContactMessage,
  type ContactState,
} from "@/app/(app)/contact/actions";
import { SubmitButton } from "@/components/submit-button";

const INITIAL: ContactState = {};

export function ContactForm() {
  const [state, formAction] = useActionState(sendContactMessage, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="card p-6">
      <div>
        <label className="label" htmlFor="subject">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          maxLength={120}
          placeholder="What can we help with?"
          className="input"
        />
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          maxLength={2000}
          rows={6}
          placeholder="Share the details and we'll get back to you."
          className="textarea"
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton className="w-full sm:w-auto" pendingText="Sending…">
          Send message
        </SubmitButton>
        {state.success && (
          <span className="text-sm text-success">
            Thanks — your message is on its way to the front office.
          </span>
        )}
        {state.error && (
          <span className="text-sm text-danger">{state.error}</span>
        )}
      </div>
    </form>
  );
}
