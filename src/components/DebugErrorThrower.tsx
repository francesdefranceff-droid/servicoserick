import { useEffect, useState } from "react";

/**
 * DebugErrorThrower
 *
 * Mantém compatibilidade com o evento antigo do Debug Tool, mas não derruba
 * mais a aplicação. Antes ele lançava um erro proposital durante o render e
 * isso causava tela branca persistente para o usuário final.
 */
export const DebugErrorThrower = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail !== "string" || detail.length === 0) return;
      setErrorMessage(detail);
    };
    window.addEventListener("lovable-debug-error", handler as EventListener);
    return () => window.removeEventListener("lovable-debug-error", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!errorMessage) return;
    console.info("[Debug Tool] Instrução recebida sem interromper o app:", errorMessage);
    setErrorMessage(null);
  }, [errorMessage]);

  return null;
};
