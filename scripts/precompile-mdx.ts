import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, dirname, relative } from "node:path";
import { createHash } from "node:crypto";
import { mdxParse } from "safe-mdx/parse";
import { createShikiHighlighter } from "../src/lib/shiki/highlighter";
import { THEME_NAME, SKIP_HIGHLIGHT_LANGS } from "../src/lib/shiki/config";

const CONTENT_DIR = join(process.cwd(), "src/app/content");
const OUTPUT_DIR = join(process.cwd(), ".compiled-mdx");
const CACHE_FILE = join(process.cwd(), ".compiled-mdx", ".cache.json");

interface HighlightedCode {
  lang: string;
  hast: any;
}

interface CompiledMDX {
  mdast: any;
  raw: string;
  highlightedCode: Record<string, HighlightedCode>;
}

interface CacheEntry {
  hash: string;
}

interface Cache {
  [filePath: string]: CacheEntry;
}

// Hash file content for cache invalidation
function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// Load cache from disk
async function loadCache(): Promise<Cache> {
  try {
    const cacheData = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(cacheData);
  } catch {
    return {};
  }
}

// Save cache to disk
async function saveCache(cache: Cache): Promise<void> {
  await mkdir(dirname(CACHE_FILE), { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

// Check if file needs recompilation
async function needsRecompilation(
  inputPath: string,
  outputPath: string,
  cache: Cache,
  relativePath: string
): Promise<boolean> {
  try {
    // Check if output exists
    await stat(outputPath);

    // Get current file content
    const content = await readFile(inputPath, "utf-8");
    const currentHash = hashContent(content);

    // Check cache entry
    const cacheEntry = cache[relativePath];
    if (!cacheEntry) {
      return true; // No cache entry, needs compilation
    }

    if (cacheEntry.hash !== currentHash) {
      return true; // Content changed
    }

    return false; // File unchanged, skip compilation
  } catch {
    return true; // Output doesn't exist or error, needs compilation
  }
}

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

async function precompileMDX(
  inputPath: string,
  outputPath: string,
  highlighter: Awaited<ReturnType<typeof createShikiHighlighter>>,
  cache: Cache,
  relativePath: string
) {
  try {
    const raw = await readFile(inputPath, "utf-8");
    // Preprocess math formulas before parsing
    const preprocessed = preprocessMathFormulas(raw);
    const mdast = mdxParse(preprocessed);

    // Pre-highlight all code blocks
    const highlightedCode: Record<string, HighlightedCode> = {};

    function traverseNodes(
      node: any,
      currentIndex: { value: number } = { value: 0 }
    ) {
      if (node.type === "code") {
        const lang = node.lang || "text";

        // Skip bash/sh like in the runtime renderer
        if (!SKIP_HIGHLIGHT_LANGS.includes(lang)) {
          try {
            const hast = highlighter.codeToHast(node.value, {
              lang,
              theme: THEME_NAME,
            });

            const blockId = `code-${currentIndex.value++}`;
            highlightedCode[blockId] = { lang, hast };

            // Store the block ID in the node for reference
            node.data = node.data || {};
            node.data.highlightId = blockId;
          } catch (error) {
            console.error(
              `Warning: Failed to highlight code block in ${inputPath} (lang: ${lang})`,
              error
            );
          }
        }
      }

      if (node.children) {
        node.children.forEach((child: any) =>
          traverseNodes(child, currentIndex)
        );
      }
    }

    traverseNodes(mdast);

    const compiled: CompiledMDX = {
      mdast,
      raw,
      highlightedCode,
    };

    // Ensure output directory exists
    await mkdir(dirname(outputPath), { recursive: true });

    // Write compiled JSON
    await writeFile(outputPath, JSON.stringify(compiled), "utf-8");

    // Update cache
    cache[relativePath] = {
      hash: hashContent(raw),
    };
  } catch (error) {
    console.error(`✗ Failed to compile ${inputPath}:`, error);
    throw error;
  }
}

async function findMDXFiles(
  dir: string,
  baseDir: string = dir
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findMDXFiles(fullPath, baseDir)));
    } else if (entry.isFile() && entry.name.endsWith(".mdx")) {
      files.push(relative(baseDir, fullPath));
    }
  }

  return files;
}

async function main() {
  console.log("🚀 Starting MDX precompilation...\n");

  // Load cache
  const cache = await loadCache();
  console.log("✓ Cache loaded\n");

  // Create highlighter once for all files
  console.log("Initializing syntax highlighter...");
  const highlighter = await createShikiHighlighter();
  console.log("✓ Highlighter ready\n");

  // Find all MDX files
  const mdxFiles = await findMDXFiles(CONTENT_DIR);

  console.log(`Found ${mdxFiles.length} MDX files\n`);

  // Filter files that need recompilation
  const filesToCompile: string[] = [];
  for (const file of mdxFiles) {
    const inputPath = join(CONTENT_DIR, file);
    const outputFile = file.replace(/\.mdx$/, ".json");
    const outputPath = join(OUTPUT_DIR, outputFile);

    if (await needsRecompilation(inputPath, outputPath, cache, file)) {
      filesToCompile.push(file);
    }
  }

  const skipped = mdxFiles.length - filesToCompile.length;
  console.log(`Files to compile: ${filesToCompile.length}`);
  console.log(`Files cached (skipped): ${skipped}\n`);

  if (filesToCompile.length === 0) {
    console.log("✨ All files are up to date!");
    return;
  }

  let compiled = 0;
  let failed = 0;

  // Process files in parallel batches for better performance
  const BATCH_SIZE = 100;
  const batches = [];
  for (let i = 0; i < filesToCompile.length; i += BATCH_SIZE) {
    batches.push(filesToCompile.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (file) => {
        const inputPath = join(CONTENT_DIR, file);
        const outputFile = file.replace(/\.mdx$/, ".json");
        const outputPath = join(OUTPUT_DIR, outputFile);

        try {
          await precompileMDX(inputPath, outputPath, highlighter, cache, file);
          compiled++;
        } catch (error) {
          failed++;
        }
      })
    );

    // Log progress after each batch
    if (compiled % 100 === 0 || compiled === filesToCompile.length) {
      console.log(
        `Progress: ${compiled}/${filesToCompile.length} files compiled`
      );
    }
  }

  // Save updated cache
  await saveCache(cache);

  console.log(`\n✨ Precompilation complete!`);
  console.log(`   ✓ Compiled: ${compiled}`);
  console.log(`   ⊘ Skipped: ${skipped}`);
  if (failed > 0) {
    console.log(`   ✗ Failed: ${failed}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
