import "server-only";

import { AnchorDiscriminatorCalculator } from "@/app/components/AnchorDiscriminatorCalculator/AnchorDiscriminatorCalculator";
import ArticleSection from "@/app/components/ArticleSection/ArticleSection";
import CodeblockWrapper from "@/app/components/CodeblockWrapper/CodeblockWrapper";
import { MathFormula } from "@/app/components/MathFormula/MathFormula";
import { Icon } from "@blueshift-gg/ui-components";
import IDE from "@/app/components/TSChallengeEnv/IDE";
import { Requirement } from "@/app/components/Challenges/Requirement";
import { RequirementList } from "@/app/components/Challenges/RequirementList";
import { SafeMdxRenderer } from "safe-mdx";
import { mdxParse } from "safe-mdx/parse";
import { getSingletonHighlighter } from "@/lib/shiki/highlighter";
import { THEME_NAME, SKIP_HIGHLIGHT_LANGS } from "@/lib/shiki/config";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment, jsxs, jsx } from "react/jsx-runtime";
import { fetchCompiledContent, CompiledMDX } from "./content-source";

/**
 * Preprocess MDX content to convert math formulas ($$...$$ and $...$) to code blocks/components
 * This prevents safe-mdx from trying to parse LaTeX syntax as JSX expressions
 */
function preprocessMathFormulas(content: string): string {
  let processed = content;
  
  // First, convert block math ($$...$$) to code blocks with lang="math"
  // Match $$...$$ patterns, handling multiline formulas
  // This regex handles formulas that may span multiple lines
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    // Escape any backticks in the formula to prevent breaking the code block
    const escapedFormula = formula.replace(/```/g, "\\`\\`\\`");
    // Check if the match is within a blockquote by looking at the line before
    // For simplicity, we'll just convert to code block without blockquote prefix
    // The code block will be rendered correctly by MDX
    return `\`\`\`math\n${escapedFormula.trim()}\n\`\`\``;
  });
  
  // Convert inline math ($...$) to MathFormula components
  // Use a regex that avoids matching escaped dollars and block math
  // Match $...$ but not $$...$$ (already processed) or \$ (escaped)
  // We need to be careful with the regex to avoid lookbehind issues
  processed = processed.replace(/([^$\\]|^)\$([^$\n]+?)\$([^$]|$)/g, (match, before, formula, after) => {
    // Skip if it's part of a block math ($$)
    if (before === "$" || after === "$") {
      return match;
    }
    // Escape the formula content to prevent JSX parsing issues
    const escapedFormula = formula
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '&quot;')
      .replace(/\{/g, "&#123;")
      .replace(/\}/g, "&#125;");
    return `${before}<MathFormula formula="${escapedFormula}" display={false} />${after}`;
  });
  
  return processed;
}

export async function renderSafeMdx(compiled: CompiledMDX) {
  // In production, mdast is already compiled and included
  // Only parse in development mode when mdast is null
  const isDevelopment = process.env.NODE_ENV === "development";

  // Preprocess math formulas before parsing (only in development)
  const preprocessedRaw = isDevelopment
    ? preprocessMathFormulas(compiled.raw)
    : compiled.raw;

  const mdast =
    compiled.mdast || (isDevelopment ? mdxParse(preprocessedRaw) : null);
  if (!mdast) {
    throw new Error(
      "MDX AST is missing and runtime parsing is not available in production"
    );
  }

  // In production, all code should be pre-highlighted, so we never need the runtime highlighter
  // This avoids WebAssembly issues in Cloudflare Workers
  const highlighter =
    isDevelopment &&
    (!compiled.highlightedCode ||
      Object.keys(compiled.highlightedCode).length === 0)
      ? await getSingletonHighlighter()
      : null;

  // In production with pre-compiled mdast, we don't need to pass the raw markdown
  // This avoids any potential WebAssembly parsing in SafeMdxRenderer
  const rendererProps = isDevelopment
    ? { markdown: compiled.raw, mdast }
    : { mdast };

  return (
    <SafeMdxRenderer
      {...rendererProps}
      components={{
        ArticleSection,
        IDE,
        RequirementList,
        Requirement,
        AnchorDiscriminatorCalculator,
        MathFormula,
        blockquote: ({ children }: { children: React.ReactNode }) => (
          <blockquote className="bg-brand-primary/5 flex items-start gap-x-2 py-4 px-6">
            <Icon
              name="Warning"
              className="text-brand-secondary flex-shrink-0 top-1.5 relative"
              size={18}
            />
            <div className="overflow-x-auto custom-scrollbar min-w-0">
              {children}
            </div>
          </blockquote>
        ),
      }}
      renderNode={(node) => {
        if (node.type === "code") {
          const lang = node.lang || "text";

          // Handle math formulas (converted from $$...$$ blocks)
          if (lang === "math") {
            return <MathFormula formula={node.value} display={true} />;
          }

          // Skip syntax highlighting for bash and sh code blocks
          if (SKIP_HIGHLIGHT_LANGS.includes(lang)) {
            return;
          }

          // Use pre-highlighted code if available
          if (
            compiled.highlightedCode &&
            node.data &&
            "highlightId" in node.data
          ) {
            const highlightId = node.data.highlightId as string;
            const highlighted = compiled.highlightedCode[highlightId];
            if (highlighted) {
              return (
                <CodeblockWrapper data-language={highlighted.lang}>
                  {toJsxRuntime(highlighted.hast, { Fragment, jsxs, jsx })}
                </CodeblockWrapper>
              );
            }
          }

          // Fallback to runtime highlighting (development mode)
          if (highlighter) {
            const codeHtml = highlighter.codeToHast(node.value, {
              lang,
              theme: THEME_NAME,
            });

            return (
              <CodeblockWrapper data-language={lang}>
                {toJsxRuntime(codeHtml, { Fragment, jsxs, jsx })}
              </CodeblockWrapper>
            );
          }
        }

        // fall back to default rendering for other nodes
        return;
      }}
    />
  );
}

/**
 * Fetches and renders pre-compiled MDX content.
 */
export async function getCompiledMdx(relativePath: string) {
  const compiled = await fetchCompiledContent(relativePath);
  return renderSafeMdx(compiled);
}
