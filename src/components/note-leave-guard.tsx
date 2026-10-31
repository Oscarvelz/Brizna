import { useBlocker, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useTx } from "@/lib/i18n";
import { clearDrafts, padFamily, pendingDrafts } from "@/lib/note-draft";
import { savePad, createPadPage } from "@/lib/server/lawn";

export function NoteLeaveGuard() {
  const tx = useTx();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const inPad = pathname === "/notas";
  const [pending, setPending] = useState(false);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (pendingDrafts().length === 0) return false;
      return padFamily(current.pathname) && !padFamily(next.pathname);
    },
    withResolver: true,
    enableBeforeUnload: () => pendingDrafts().length > 0,
  });

  function discard() {
    for (const note of pendingDrafts()) {
      try {
        sessionStorage.removeItem(`ols-pad-${note.pageId}`);
      } catch {
        /* ignore */
      }
    }
    clearDrafts();
    blocker.proceed?.();
  }

  async function keep() {
    const notes = pendingDrafts();
    if (notes.length === 0) {
      blocker.proceed?.();
      return;
    }
    setPending(true);
    try {
      for (const note of notes) {
        let pageId = note.pageId;
        if (pageId <= 0) {
          const created = await createPadPage({ data: { title: note.title || "Nota nueva", folder: note.folder } });
          pageId = created.id;
        }
        await savePad({
          data: { pageId, html: note.html, title: note.title, folder: note.folder },
        });
        try {
          sessionStorage.removeItem(`ols-pad-${note.pageId}`);
        } catch {
          /* ignore */
        }
      }
      clearDrafts();
      await qc.invalidateQueries({ queryKey: ["pad"] });
      toast.success(
        notes.length > 1
          ? tx("Notas guardadas", "Notes saved")
          : tx(`Guardada en ${notes[0]?.folder ?? ""}`, `Saved in ${notes[0]?.folder ?? ""}`),
      );
      blocker.proceed?.();
    } catch {
      toast.error(tx("No se pudo guardar la nota", "Could not save the note"));
    } finally {
      setPending(false);
    }
  }

  const many = pendingDrafts().length > 1;

  return (
    <ConfirmDialog
      front
      stack
      pending={pending}
      open={blocker.status === "blocked"}
      title={
        inPad
          ? tx("¿Qué hago con esta nota?", "What should I do with this note?")
          : tx("¿Qué hago con la nota que estabas escribiendo?", "What should I do with the note you were writing?")
      }
      description={
        many
          ? tx(
              "Hay dos notas sin guardar: la del Bloc de notas y la que empezaste en una carpeta. Dentro del bloc, puedes consultar otras notas y seguir escribiendo después. Si sales a otra pestaña, elige si las guardas.",
              "Two notes are unsaved: the one in the notepad and the one you started in a folder. Inside the notepad you can look at other notes and keep writing after. If you leave for another tab, choose whether to save them.",
            )
          : inPad
            ? tx(
                "Todavía no está guardada. Dentro del bloc, puedes consultar otras notas y seguir escribiendo después. Si sales a otra pestaña, elige si la guardas.",
                "It is not saved yet. Inside the notepad you can look at other notes and keep writing after. If you leave for another tab, choose whether to save it.",
              )
            : tx(
                "La dejaste a medias en el Bloc de notas. Dentro del bloc, puedes consultar otras notas y seguir escribiendo después. Si sales a otra pestaña, elige si la guardas.",
                "You left it half written in the notepad. Inside the notepad you can look at other notes and keep writing after. If you leave for another tab, choose whether to save it.",
              )
      }
      confirmLabel={tx("Guardar", "Save")}
      extraLabel={tx("Salir sin guardar", "Leave without saving")}
      cancelLabel={tx("Quedarme", "Stay")}
      onConfirm={() => void keep()}
      onExtra={discard}
      onCancel={() => blocker.reset?.()}
    />
  );
}
