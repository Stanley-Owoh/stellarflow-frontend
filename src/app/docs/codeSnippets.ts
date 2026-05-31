import React from "react";

// ─── Raw Snippet Sources ─────────────────────────────────────────────────────

const RUST_SNIPPET = `#![no_std]
use soroban_sdk::{contractimpl, Env, Address, Symbol};

pub struct ConsumerContract;

#[contractimpl]
impl ConsumerContract {
    pub fn read_oracle_rate(env: Env, oracle_id: Address) -> u128 {
        // Invoke StellarFlow core proxy using dynamic interface
        let asset_symbol = Symbol::new(&env, "NGN");
        let rate: u128 = env.invoke_contract(
            &oracle_id,
            &Symbol::new(&env, "get_latest_rate"),
            soroban_sdk::vec![&env, asset_symbol.to_val()]
        );
        rate
    }
}`;

const JS_SNIPPET = `import { Contract, networks } from '@stellar/stellar-sdk';

const contractId = 'CCEMOFO5TE7FGOAJOA3RDHPC6RW3CFXRVIGOFQPFE4ZGOKA2QEA636SN';
const stellarFlowOracle = new Contract(contractId);

async function fetchLiveRate(providerRpcUrl) {
  // Query latest decentralized exchange base rates
  const response = await providerRpcUrl.getLatestRate({
    asset: 'NGN'
  });
  console.log(\`Live Oracle Rate: \${response.rate}\`);
}`;

// ─── Tokenizer ───────────────────────────────────────────────────────────────

type TokenType =
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "builtin"
  | "punctuation"
  | "plain";

interface Token {
  text: string;
  type: TokenType;
}

const RUST_KEYWORDS = new Set([
  "as", "async", "await", "break", "const", "continue", "crate", "dyn",
  "else", "enum", "extern", "false", "fn", "for", "if", "impl", "in",
  "let", "loop", "match", "mod", "move", "mut", "pub", "ref", "return",
  "self", "static", "struct", "super", "trait", "true", "type", "unsafe",
  "use", "where", "while", "u128", "u64", "u32", "i128", "i64", "i32",
]);

const JS_KEYWORDS = new Set([
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "export", "extends",
  "false", "finally", "for", "function", "if", "import", "in",
  "instanceof", "let", "new", "of", "return", "static", "switch", "this",
  "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
]);

const JS_BUILTINS = new Set([
  "console", "Contract", "networks", "Address",
]);

const TOKEN_CLASSES: Record<TokenType, string> = {
  keyword: "text-purple-400",
  string: "text-emerald-400",
  comment: "text-gray-500 italic",
  number: "text-orange-400",
  builtin: "text-blue-400",
  punctuation: "text-gray-400",
  plain: "text-gray-300",
};

/**
 * Simple line-level tokenizer that splits source code into typed tokens.
 * Designed to be called once during initial render, producing React elements
 * that can be stored and switched between instantly.
 */
function tokenize(source: string, isRust: boolean): React.ReactNode[] {
  const keywords = isRust ? RUST_KEYWORDS : JS_KEYWORDS;
  const builtins = isRust ? new Set<string>() : JS_BUILTINS;

  const lines = source.split("\n");
  const elements: React.ReactNode[] = [];

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const tokens: Token[] = [];
    let i = 0;

    while (i < line.length) {
      // Line comment
      if (line[i] === "/" && line[i + 1] === "/") {
        tokens.push({ text: line.slice(i), type: "comment" });
        i = line.length;
        break;
      }

      // Block comment start
      if (line[i] === "/" && line[i + 1] === "*") {
        const end = line.indexOf("*/", i + 2);
        if (end !== -1) {
          tokens.push({ text: line.slice(i, end + 2), type: "comment" });
          i = end + 2;
          continue;
        }
        tokens.push({ text: line.slice(i), type: "comment" });
        i = line.length;
        break;
      }

      // Double-quoted string
      if (line[i] === '"') {
        const end = line.indexOf('"', i + 1);
        if (end !== -1) {
          tokens.push({ text: line.slice(i, end + 1), type: "string" });
          i = end + 1;
          continue;
        }
        tokens.push({ text: line.slice(i), type: "string" });
        i = line.length;
        break;
      }

      // Single-quoted string
      if (line[i] === "'") {
        const end = line.indexOf("'", i + 1);
        if (end !== -1) {
          tokens.push({ text: line.slice(i, end + 1), type: "string" });
          i = end + 1;
          continue;
        }
        tokens.push({ text: line.slice(i), type: "string" });
        i = line.length;
        break;
      }

      // Backtick template literal
      if (line[i] === "`") {
        const end = line.indexOf("`", i + 1);
        if (end !== -1) {
          tokens.push({ text: line.slice(i, end + 1), type: "string" });
          i = end + 1;
          continue;
        }
        tokens.push({ text: line.slice(i), type: "string" });
        i = line.length;
        break;
      }

      // Number literal
      if (/[0-9]/.test(line[i]) && (i === 0 || /[\s,=([\]<>+\-*/%|&!?:;]/.test(line[i - 1]))) {
        let end = i + 1;
        while (end < line.length && /[0-9xXa-fA-F.]/.test(line[end])) end++;
        tokens.push({ text: line.slice(i, end), type: "number" });
        i = end;
        continue;
      }

      // Word (identifier or keyword)
      if (/[a-zA-Z_$@#]/.test(line[i])) {
        let end = i + 1;
        while (end < line.length && /[a-zA-Z0-9_$]/.test(line[end])) end++;
        const word = line.slice(i, end);
        if (keywords.has(word)) {
          tokens.push({ text: word, type: "keyword" });
        } else if (builtins.has(word)) {
          tokens.push({ text: word, type: "builtin" });
        } else {
          tokens.push({ text: word, type: "plain" });
        }
        i = end;
        continue;
      }

      // Punctuation / operators
      if (/[{}()\[\]<>;:,.\-+*/%=!&|^~?@#]/.test(line[i])) {
        // Check for arrow function =>
        if (line[i] === "=" && line[i + 1] === ">") {
          tokens.push({ text: "=>", type: "punctuation" });
          i += 2;
          continue;
        }
        tokens.push({ text: line[i], type: "punctuation" });
        i++;
        continue;
      }

      // Whitespace and other characters
      tokens.push({ text: line[i], type: "plain" });
      i++;
    }

    // Convert line tokens into React elements
    const lineKey = `l${li}`;
    const lineEls: React.ReactNode[] = [];

    for (const token of tokens) {
      if (token.type === "plain" && /^\s+$/.test(token.text)) {
        // Preserve whitespace without wrapper spans
        lineEls.push(token.text);
      } else {
        lineEls.push(
          <span
            key={`${lineKey}-${token.text}-${lineEls.length}`}
            className={TOKEN_CLASSES[token.type]}
          >
            {token.text}
          </span>,
        );
      }
    }

    elements.push(
      <div key={lineKey} className="flex">
        <span className="select-none text-gray-600 w-8 shrink-0 text-right mr-4 tabular-nums">
          {li + 1}
        </span>
        <span className="whitespace-pre">{lineEls}</span>
      </div>,
    );
  }

  return elements;
}

// ─── Pre-parsed Snippets (module-level, loaded once) ─────────────────────────

export interface ParsedSnippets {
  rust: React.ReactNode[];
  js: React.ReactNode[];
  raw: {
    rust: string;
    js: string;
  };
}

/**
 * Parses both snippets eagerly at module-load time so that tab switching
 * in the docs page is instant — no string processing occurs on the switch path.
 */
export function createParsedSnippets(): ParsedSnippets {
  return {
    rust: tokenize(RUST_SNIPPET, true),
    js: tokenize(JS_SNIPPET, false),
    raw: {
      rust: RUST_SNIPPET,
      js: JS_SNIPPET,
    },
  };
}
