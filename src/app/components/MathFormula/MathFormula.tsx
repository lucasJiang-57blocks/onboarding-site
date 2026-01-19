"use client";

import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathFormulaProps {
  formula: string;
  display?: boolean;
}

export function MathFormula({ formula, display = false }: MathFormulaProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(formula.trim(), containerRef.current, {
          displayMode: display,
          throwOnError: false,
          errorColor: "#ff285a",
        });
      } catch (error) {
        console.error("KaTeX rendering error:", error);
        if (containerRef.current) {
          containerRef.current.textContent = formula;
        }
      }
    }
  }, [formula, display]);

  return (
    <div
      ref={containerRef}
      className={display ? "my-4 overflow-x-auto" : "inline-block"}
      style={display ? { textAlign: "center" } : undefined}
    />
  );
}
