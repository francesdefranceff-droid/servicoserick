import { useEffect, useState } from "react";

/**
 * DebugErrorThrower
 *
 * Sem UI. Escuta o evento global "lovable-debug-error" e dispara um Error
 * de forma assíncrona (via window.dispatchEvent de ErrorEvent) para acionar
 * o overlay nativo da Lovable SEM desmontar a árvore React.
 *
 * Por que não throw síncrono no render: isso desmonta toda a app, deixa
 * tela branca e o próprio ErrorDebugPopup some — então depois de um revert
 * o usuário não consegue mais usar o debug tool. Disparando como ErrorEvent
 * no window, o "Try to Fix" continua aparecendo e a app permanece viva.
 *
 * DEVE ficar FORA de qualquer ErrorBoundary / Suspense.
 */
export const DebugErrorThrower = () => {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== "string" || detail.length === 0) return;

      const err = new Error(detail);
      // Dispara um ErrorEvent global — o overlay da Lovable escuta
      // window.onerror / 'error' e mostra o botão "Try to Fix".
      // Como não é throw síncrono no render, a app não desmonta.
      window.dispatchEvent(
        new ErrorEvent("error", {
          error: err,
          message: err.message,
          filename: window.location.href,
          lineno: 0,
          colno: 0,
        })
      );
      // Garante log no console também (para coleta de runtime errors).
      // eslint-disable-next-line no-console
      console.error(err);
    };
    window.addEventListener("lovable-debug-error", handler as EventListener);
    return () => window.removeEventListener("lovable-debug-error", handler as EventListener);
  }, []);

  return null;
};
