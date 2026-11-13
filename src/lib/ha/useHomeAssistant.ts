"use client";

import { useContext } from "react";
import { HAContext, type HAContextValue } from "./HAProvider";

export function useHomeAssistant(): HAContextValue {
  const context = useContext(HAContext);
  if (!context) {
    throw new Error(
      "useHomeAssistant måste användas inuti en <HAProvider>.",
    );
  }
  return context;
}
