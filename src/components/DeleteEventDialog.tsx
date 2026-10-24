import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Event } from "../lib/types";
import { deleteDraftEvent } from "../lib/api";
import { errorMessage } from "../lib/utils";
import { Field, Modal } from "./ui";

export default function DeleteEventDialog({
  event,
  onClose,
  onDeleted,
  onEdit,
}: {
  event: Event;
  onClose: () => void;
  onDeleted: () => void;
  onEdit: () => void;
}) {
  const [title, setTitle] = useState("");
  const deletion = useMutation({
    retry: false,
    mutationFn: () => deleteDraftEvent(event.id, title),
    onSuccess: onDeleted,
  });
  if (event.status !== "draft")
    return (
      <Modal title="Arrangementet kan ikke slettes" onClose={onClose}>
        <p>
          Bare upubliserte utkast uten tilknyttede data kan slettes permanent.
          Bruk avlysning for et publisert arrangement, eller rediger
          publiseringsstatus. Eksisterende påmeldinger og historikk må bevares.
        </p>
        <div className="button-row">
          <button className="button" onClick={onClose}>
            Lukk
          </button>
          <button className="button primary" onClick={onEdit}>
            Rediger publiseringsstatus
          </button>
        </div>
      </Modal>
    );
  return (
    <Modal
      title="Slette arrangementet permanent?"
      onClose={() => {
        if (!deletion.isPending) onClose();
      }}
    >
      <p>
        Utkastet «{event.title}» fjernes permanent. Slettingen kan ikke angres.
        Serveren avviser sletting hvis det finnes påmeldinger (også avbestilte),
        venteliste, lag, varsler eller gruppetilknytninger. Arrangementsbilder
        og revisjonslogger beholdes.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (title === event.title && !deletion.isPending) deletion.mutate();
        }}
      >
        <Field label="Skriv arrangementets eksakte tittel" hint={event.title}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={deletion.isPending}
          />
        </Field>
        {deletion.error && (
          <div className="error" role="alert">
            {errorMessage(deletion.error)}
          </div>
        )}
        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={deletion.isPending}
            onClick={onClose}
          >
            Behold utkastet
          </button>
          <button
            type="submit"
            className="button danger"
            disabled={title !== event.title || deletion.isPending}
          >
            {deletion.isPending ? "Sletter …" : "Slett permanent"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
