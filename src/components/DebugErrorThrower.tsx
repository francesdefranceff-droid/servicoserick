import { useEffect } from "react";

/**
 * DebugErrorThrower
 *
 * Sem UI. Escuta o evento global "lovable-debug-error", guarda a instrução
 * em state e, durante o render, lança um Error real para que o overlay
 * global da Lovable apareça com o botão "Try to Fix".
 *
 * DEVE ficar FORA de qualquer ErrorBoundary / Suspense.
 * NÃO trocar o throw por setTimeout, console.error, toast ou qualquer
 * tratamento — o throw síncrono no render é o que aciona o overlay nativo.
 */
export const DebugErrorThrower = () => {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== "string" || detail.length === 0) return;
      // Lança de forma assíncrona para virar "uncaught error" e acionar
      // o overlay nativo "Try to Fix" SEM quebrar o render da árvore React.
      setTimeout(() => {
        throw new Error(detail);
      }, 0);
    };
    window.addEventListener("lovable-debug-error", handler as EventListener);
    return () => window.removeEventListener("lovable-debug-error", handler as EventListener);
  }, []);

  return null;
};
