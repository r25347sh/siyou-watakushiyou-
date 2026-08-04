/**
 * AUVA IDE — style.js
 *
 * - エディタ UI（行番号・カーソル位置・タブ・リサイザ・ファイル I/O）
 * - auva.js 互換のクライアントサイド .auva パーサ／レンダラ
 *   （reitansai/js/auva.js のコアロジックを IDE 用に移植）
 */

(function () {
  "use strict";

  /* ================================================================== */
  /*  AUVA コア（reitansai/js/auva.js 準拠）                            */
  /* ================================================================== */

  function stripComments(text) {
    return text.replace(/<!--[\s\S]*?-->/g, "");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isTruthy(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return v.length > 0 && v.toLowerCase() !== "false";
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  }

  function evaluateExpression(expr, vars) {
    expr = String(expr).trim();
    if (!expr) return undefined;

    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      if (/\s/.test(expr[i])) {
        i++;
        continue;
      }
      if (expr[i] === '"' || expr[i] === "'") {
        const q = expr[i];
        let j = i + 1;
        let s = "";
        while (j < expr.length && expr[j] !== q) {
          if (expr[j] === "\\") {
            s += expr[j + 1] || "";
            j += 2;
          } else {
            s += expr[j];
            j++;
          }
        }
        tokens.push({ type: "string", value: s });
        i = j + 1;
        continue;
      }
      if (/[0-9.]/.test(expr[i])) {
        let j = i;
        while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
        tokens.push({ type: "number", value: parseFloat(expr.slice(i, j)) });
        i = j;
        continue;
      }
      if (/[a-zA-Z_ぁ-んァ-ン一-龯]/.test(expr[i])) {
        let j = i;
        while (j < expr.length && /[a-zA-Z0-9_ぁ-んァ-ン一-龯]/.test(expr[j])) j++;
        const id = expr.slice(i, j);
        if (id === "true") tokens.push({ type: "boolean", value: true });
        else if (id === "false") tokens.push({ type: "boolean", value: false });
        else if (id === "len") tokens.push({ type: "len" });
        else tokens.push({ type: "id", value: id });
        i = j;
        continue;
      }
      const two = expr.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "&&", "||", "+="].includes(two)) {
        tokens.push({ type: "op", value: two });
        i += 2;
        continue;
      }
      if ("+-*/%<>=!()[],".includes(expr[i])) {
        tokens.push({ type: "op", value: expr[i] });
        i++;
        continue;
      }
      i++;
    }

    let pos = 0;
    function peek() {
      return tokens[pos];
    }
    function consume() {
      return tokens[pos++];
    }

    function parsePrimary() {
      const t = peek();
      if (!t) return undefined;

      if (t.type === "number" || t.type === "string" || t.type === "boolean") {
        consume();
        return t.value;
      }

      if (t.type === "len") {
        consume();
        if (peek() && peek().value === "[") {
          consume();
          const nameTok = consume();
          if (peek() && peek().value === "]") consume();
          const arr = vars[nameTok.value];
          return Array.isArray(arr) ? arr.length : 0;
        }
        return 0;
      }

      if (t.type === "id") {
        consume();
        let val = vars[t.value];
        if (peek() && peek().value === "[") {
          consume();
          const idxExpr = parseExpr();
          if (peek() && peek().value === "]") consume();
          const idx = Math.floor(Number(idxExpr));
          if (Array.isArray(val) && idx >= 1 && idx <= val.length) {
            val = val[idx - 1];
          } else {
            val = undefined;
          }
        }
        return val;
      }

      if (t.value === "(") {
        consume();
        const v = parseExpr();
        if (peek() && peek().value === ")") consume();
        return v;
      }

      if (t.value === "!") {
        consume();
        return !isTruthy(parsePrimary());
      }

      if (t.value === "-") {
        consume();
        return -Number(parsePrimary());
      }

      return undefined;
    }

    function parseMul() {
      let left = parsePrimary();
      while (peek() && ["*", "/", "%"].includes(peek().value)) {
        const op = consume().value;
        const right = parsePrimary();
        if (op === "*") left = Number(left) * Number(right);
        else if (op === "/") left = Number(left) / Number(right);
        else left = Number(left) % Number(right);
      }
      return left;
    }

    function parseAdd() {
      let left = parseMul();
      while (peek() && ["+", "-"].includes(peek().value)) {
        const op = consume().value;
        const right = parseMul();
        if (op === "+") {
          if (typeof left === "string" || typeof right === "string") {
            left = String(left) + String(right);
          } else {
            left = Number(left) + Number(right);
          }
        } else {
          left = Number(left) - Number(right);
        }
      }
      return left;
    }

    function parseCmp() {
      let left = parseAdd();
      while (peek() && ["==", "!=", "<", ">", "<=", ">="].includes(peek().value)) {
        const op = consume().value;
        const right = parseAdd();
        if (op === "==") left = left == right;
        else if (op === "!=") left = left != right;
        else if (op === "<") left = Number(left) < Number(right);
        else if (op === ">") left = Number(left) > Number(right);
        else if (op === "<=") left = Number(left) <= Number(right);
        else if (op === ">=") left = Number(left) >= Number(right);
      }
      return left;
    }

    function parseAnd() {
      let left = parseCmp();
      while (peek() && peek().value === "&&") {
        consume();
        const right = parseCmp();
        left = isTruthy(left) && isTruthy(right);
      }
      return left;
    }

    function parseOr() {
      let left = parseAnd();
      while (peek() && peek().value === "||") {
        consume();
        const right = parseAnd();
        left = isTruthy(left) || isTruthy(right);
      }
      return left;
    }

    function parseExpr() {
      return parseOr();
    }

    try {
      return parseExpr();
    } catch (e) {
      console.warn("Expression evaluation error:", expr, e);
      return undefined;
    }
  }

  function interpolate(str, vars) {
    if (typeof str !== "string") return str;
    return str.replace(/\{([^}]+)\}/g, (_, expr) => {
      const v = evaluateExpression(expr.trim(), vars);
      return v === undefined || v === null ? "" : String(v);
    });
  }

  function parseValueBlock(content, vars) {
    let i = 0;
    const len = content.length;

    function skipWs() {
      while (i < len && /\s/.test(content[i])) i++;
    }

    function parseString() {
      const q = content[i];
      if (q !== '"' && q !== "'") return null;
      i++;
      let s = "";
      while (i < len && content[i] !== q) {
        if (content[i] === "\\") {
          i++;
          if (i < len) {
            s += content[i];
            i++;
          }
        } else {
          s += content[i];
          i++;
        }
      }
      if (i < len) i++;
      return s;
    }

    function parseList() {
      if (content[i] !== "[") return null;
      i++;
      const arr = [];
      skipWs();
      while (i < len && content[i] !== "]") {
        skipWs();
        if (content[i] === "]") break;
        let val;
        if (content[i] === '"' || content[i] === "'") val = parseString();
        else if (content[i] === "[") val = parseList();
        else if (content[i] === "{") val = parseDict();
        else {
          let j = i;
          while (j < len && !/[,\]]/.test(content[j]) && !/\s/.test(content[j])) j++;
          const raw = content.slice(i, j).trim();
          i = j;
          if (raw === "true") val = true;
          else if (raw === "false") val = false;
          else if (/^-?\d+(\.\d+)?$/.test(raw)) val = Number(raw);
          else val = raw;
        }
        arr.push(val);
        skipWs();
        if (content[i] === ",") {
          i++;
          skipWs();
        }
      }
      if (i < len && content[i] === "]") i++;
      return arr;
    }

    function parseDict() {
      if (content[i] !== "{") return null;
      i++;
      const obj = {};
      skipWs();
      while (i < len && content[i] !== "}") {
        skipWs();
        let key;
        if (content[i] === '"' || content[i] === "'") key = parseString();
        else {
          let j = i;
          while (j < len && /[a-zA-Z0-9_]/.test(content[j])) j++;
          key = content.slice(i, j);
          i = j;
        }
        skipWs();
        if (content[i] === ":") i++;
        skipWs();
        let val;
        if (content[i] === '"' || content[i] === "'") val = parseString();
        else if (content[i] === "[") val = parseList();
        else if (content[i] === "{") val = parseDict();
        else {
          let j = i;
          while (j < len && !/[,}]/.test(content[j]) && !/\s/.test(content[j])) j++;
          const raw = content.slice(i, j).trim();
          i = j;
          if (raw === "true") val = true;
          else if (raw === "false") val = false;
          else if (/^-?\d+(\.\d+)?$/.test(raw)) val = Number(raw);
          else val = raw;
        }
        obj[key] = val;
        skipWs();
        if (content[i] === ",") i++;
      }
      if (i < len && content[i] === "}") i++;
      return obj;
    }

    while (i < len) {
      skipWs();
      if (i >= len) break;
      let j = i;
      while (j < len && /[a-zA-Z0-9_ぁ-んァ-ン一-龯]/.test(content[j])) j++;
      if (j === i) {
        i++;
        continue;
      }
      const name = content.slice(i, j);
      i = j;
      skipWs();
      if (content[i] !== "=") continue;
      i++;
      skipWs();

      let value;
      if (content[i] === '"' || content[i] === "'") value = parseString();
      else if (content[i] === "[") value = parseList();
      else if (content[i] === "{") value = parseDict();
      else {
        let k = i;
        while (k < len && !/\s/.test(content[k]) && content[k] !== "<") k++;
        const raw = content.slice(i, k).trim();
        i = k;
        if (raw === "true") value = true;
        else if (raw === "false") value = false;
        else if (/^-?\d+(\.\d+)?$/.test(raw)) value = Number(raw);
        else value = raw;
      }
      vars[name] = value;
    }
  }

  function resolveAttrs(attrRaw, vars) {
    if (!attrRaw) return "";
    let s = attrRaw.trim();
    const singleVar = s.match(/^\{([^}]+)\}$/);
    if (singleVar) {
      const v = evaluateExpression(singleVar[1].trim(), vars);
      return v == null ? "" : String(v).trim();
    }
    return interpolate(s, vars).trim();
  }

  function generateTag(tagName, content, attrs, vars, isRawHtml) {
    const resolvedAttrs = resolveAttrs(attrs || "", vars);
    const attrPart = resolvedAttrs ? " " + resolvedAttrs : "";
    const voidTags = new Set([
      "img", "br", "hr", "input", "meta", "link", "area", "base",
      "col", "embed", "source", "track", "wbr"
    ]);
    if (voidTags.has(tagName.toLowerCase()) || content === null || content === undefined) {
      return `<${tagName}${attrPart}>`;
    }
    const body = isRawHtml
      ? content || ""
      : escapeHtml(interpolate(content || "", vars));
    return `<${tagName}${attrPart}>${body}</${tagName}>`;
  }

  function processContent(text, vars) {
    let result = "";
    let i = 0;
    const len = text.length;

    function skipWhitespace() {
      while (i < len && /\s/.test(text[i])) i++;
    }

    function parseBalancedBlock() {
      if (text[i] !== "{") return "";
      i++;
      let depth = 1;
      const start = i;
      while (i < len && depth > 0) {
        if (text[i] === '"' || text[i] === "'") {
          const q = text[i];
          i++;
          while (i < len && text[i] !== q) {
            if (text[i] === "\\") i += 2;
            else i++;
          }
          if (i < len) i++;
          continue;
        }
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
        if (depth > 0) i++;
      }
      const inner = text.slice(start, i);
      if (i < len && text[i] === "}") i++;
      return inner;
    }

    function parseOptionalAttrs() {
      skipWhitespace();
      if (text[i] !== "(") return "";
      i++;
      let depth = 1;
      const start = i;
      while (i < len && depth > 0) {
        if (text[i] === '"' || text[i] === "'") {
          const q = text[i];
          i++;
          while (i < len && text[i] !== q) {
            if (text[i] === "\\") i += 2;
            else i++;
          }
          if (i < len) i++;
          continue;
        }
        if (text[i] === "(") depth++;
        else if (text[i] === ")") depth--;
        if (depth > 0) i++;
      }
      const attrs = text.slice(start, i);
      if (i < len && text[i] === ")") i++;
      return attrs;
    }

    function consumeClosingBracket(isDouble) {
      skipWhitespace();
      if (isDouble) {
        if (text[i] === "]" && text[i + 1] === "]") {
          i += 2;
          return true;
        }
        if (text[i] === "]") {
          i += 1;
          return true;
        }
      } else if (text[i] === "]") {
        i += 1;
        return true;
      }
      return false;
    }

    function parseQuotedString() {
      const q = text[i];
      if (q !== '"' && q !== "'") return null;
      i++;
      let s = "";
      while (i < len && text[i] !== q) {
        if (text[i] === "\\") {
          i++;
          if (i < len) {
            const c = text[i];
            if (c === "n") s += "\n";
            else if (c === "t") s += "\t";
            else if (c === "r") s += "\r";
            else s += c;
            i++;
          }
        } else {
          s += text[i];
          i++;
        }
      }
      if (i < len) i++;
      return s;
    }

    function parseNestedContent() {
      const start = i;
      let depth = 0;
      while (i < len) {
        if (text[i] === '"' || text[i] === "'") {
          const q = text[i];
          i++;
          while (i < len && text[i] !== q) {
            if (text[i] === "\\") i += 2;
            else i++;
          }
          if (i < len) i++;
          continue;
        }
        if (text[i] === "[") {
          depth++;
          i++;
          continue;
        }
        if (text[i] === "]") {
          if (depth === 0) break;
          depth--;
          i++;
          continue;
        }
        i++;
      }
      return text.slice(start, i);
    }

    function parseTag() {
      const isDouble = text[i] === "[" && text[i + 1] === "[";
      if (isDouble) i += 2;
      else if (text[i] === "[") i += 1;
      else return null;

      let j = i;
      while (j < len && /[a-zA-Z0-9_-]/.test(text[j])) j++;
      if (j === i) return isDouble ? "[[" : "[";
      const tagName = text.slice(i, j);
      i = j;

      let content = null;
      let isRawHtml = false;
      skipWhitespace();

      if (text[i] === ":") {
        i++;
        skipWhitespace();
        if (text[i] === '"' || text[i] === "'") {
          content = parseQuotedString();
          isRawHtml = false;
          consumeClosingBracket(isDouble);
        } else {
          const inner = parseNestedContent();
          consumeClosingBracket(isDouble);
          content = processContent(inner, vars);
          isRawHtml = true;
        }
      } else {
        consumeClosingBracket(isDouble);
        content = null;
        isRawHtml = false;
      }

      const attrs = parseOptionalAttrs();
      return generateTag(tagName, content, attrs, vars, isRawHtml);
    }

    function parseScript() {
      if (text[i] !== "/" || text[i + 1] !== "/") return null;
      i += 2;
      skipWhitespace();

      let j = i;
      while (j < len && /[a-zA-Z_]/.test(text[j])) j++;
      const keyword = text.slice(i, j);
      i = j;
      skipWhitespace();

      if (keyword === "repetition") {
        if (text[i] !== "[") return "";
        i++;
        let depth = 1;
        const start = i;
        while (i < len && depth > 0) {
          if (text[i] === "[") depth++;
          else if (text[i] === "]") depth--;
          if (depth > 0) i++;
        }
        const params = text.slice(start, i).trim();
        if (i < len && text[i] === "]") i++;
        skipWhitespace();

        const paramMatch = params.match(
          /^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(.+)$/
        );
        if (!paramMatch) {
          console.warn("Invalid repetition params:", params);
          return "";
        }
        const varName = paramMatch[1];
        const startVal = evaluateExpression(paramMatch[2].trim(), vars);
        const endVal = evaluateExpression(paramMatch[3].trim(), vars);
        const stepVal = evaluateExpression(paramMatch[4].trim(), vars) || 1;
        const body = parseBalancedBlock();
        let html = "";
        const localVars = Object.create(vars);
        for (const k of Object.keys(vars)) localVars[k] = vars[k];

        let cur = Number(startVal);
        const end = Number(endVal);
        const step = Number(stepVal);
        if (step > 0) {
          for (; cur <= end; cur += step) {
            localVars[varName] = cur;
            html += processContent(body, localVars);
          }
        } else if (step < 0) {
          for (; cur >= end; cur += step) {
            localVars[varName] = cur;
            html += processContent(body, localVars);
          }
        }
        return html;
      }

      if (keyword === "if" || keyword === "while") {
        if (text[i] !== "[") return "";
        i++;
        let depth = 1;
        const start = i;
        while (i < len && depth > 0) {
          if (text[i] === "[") depth++;
          else if (text[i] === "]") depth--;
          if (depth > 0) i++;
        }
        const condStr = text.slice(start, i).trim();
        if (i < len && text[i] === "]") i++;
        skipWhitespace();
        const body = parseBalancedBlock();

        if (keyword === "while") {
          let html = "";
          const localVars = Object.create(vars);
          for (const k of Object.keys(vars)) localVars[k] = vars[k];
          let guard = 0;
          while (isTruthy(evaluateExpression(condStr, localVars)) && guard < 10000) {
            html += processContent(body, localVars);
            for (const k of Object.keys(localVars)) {
              if (Object.prototype.hasOwnProperty.call(localVars, k)) {
                vars[k] = localVars[k];
              }
            }
            guard++;
          }
          return html;
        }

        let html = "";
        const localVars = Object.create(vars);
        for (const k of Object.keys(vars)) localVars[k] = vars[k];

        if (isTruthy(evaluateExpression(condStr, localVars))) {
          html += processContent(body, localVars);
          while (true) {
            skipWhitespace();
            if (text.slice(i, i + 2) !== "//") break;
            const save = i;
            i += 2;
            skipWhitespace();
            let k = i;
            while (k < len && /[a-zA-Z_]/.test(text[k])) k++;
            const nextKw = text.slice(i, k);
            if (nextKw === "elif" || nextKw === "else") {
              i = k;
              skipWhitespace();
              if (nextKw === "elif") {
                if (text[i] === "[") {
                  i++;
                  let d = 1;
                  while (i < len && d > 0) {
                    if (text[i] === "[") d++;
                    else if (text[i] === "]") d--;
                    if (d > 0) i++;
                  }
                  if (i < len && text[i] === "]") i++;
                }
              }
              skipWhitespace();
              parseBalancedBlock();
            } else {
              i = save;
              break;
            }
          }
        } else {
          let taken = false;
          while (true) {
            skipWhitespace();
            if (text.slice(i, i + 2) !== "//") break;
            const save = i;
            i += 2;
            skipWhitespace();
            let k = i;
            while (k < len && /[a-zA-Z_]/.test(text[k])) k++;
            const nextKw = text.slice(i, k);
            if (nextKw === "elif") {
              i = k;
              skipWhitespace();
              if (text[i] !== "[") {
                i = save;
                break;
              }
              i++;
              let d = 1;
              const cs = i;
              while (i < len && d > 0) {
                if (text[i] === "[") d++;
                else if (text[i] === "]") d--;
                if (d > 0) i++;
              }
              const cStr = text.slice(cs, i).trim();
              if (i < len && text[i] === "]") i++;
              skipWhitespace();
              const b = parseBalancedBlock();
              if (!taken && isTruthy(evaluateExpression(cStr, localVars))) {
                html += processContent(b, localVars);
                taken = true;
              }
            } else if (nextKw === "else") {
              i = k;
              skipWhitespace();
              const b = parseBalancedBlock();
              if (!taken) {
                html += processContent(b, localVars);
                taken = true;
              }
            } else {
              i = save;
              break;
            }
          }
        }
        for (const k of Object.keys(localVars)) {
          if (Object.prototype.hasOwnProperty.call(localVars, k)) {
            vars[k] = localVars[k];
          }
        }
        return html;
      }

      const lhs = keyword;
      skipWhitespace();
      let op = null;
      if (text.slice(i, i + 2) === "+=") {
        op = "+=";
        i += 2;
      } else if (text.slice(i, i + 2) === "-=") {
        op = "-=";
        i += 2;
      } else if (text.slice(i, i + 2) === "*=") {
        op = "*=";
        i += 2;
      } else if (text.slice(i, i + 2) === "/=") {
        op = "/=";
        i += 2;
      } else if (text[i] === "=") {
        op = "=";
        i++;
      }

      if (op) {
        skipWhitespace();
        let k = i;
        while (k < len && text[k] !== "\n" && !(text[k] === "/" && text[k + 1] === "/")) {
          k++;
        }
        const rhs = text.slice(i, k).trim();
        i = k;
        const rhsVal = evaluateExpression(rhs, vars);
        if (op === "=") vars[lhs] = rhsVal;
        else if (op === "+=") vars[lhs] = (Number(vars[lhs]) || 0) + Number(rhsVal);
        else if (op === "-=") vars[lhs] = (Number(vars[lhs]) || 0) - Number(rhsVal);
        else if (op === "*=") vars[lhs] = (Number(vars[lhs]) || 0) * Number(rhsVal);
        else if (op === "/=") vars[lhs] = (Number(vars[lhs]) || 0) / Number(rhsVal);
      }
      return "";
    }

    while (i < len) {
      if (text[i] === "(" && text[i + 1] === "(") {
        i += 2;
        let depth = 1;
        const start = i;
        while (i < len && depth > 0) {
          if (text[i] === '"' || text[i] === "'") {
            const q = text[i];
            i++;
            while (i < len && text[i] !== q) {
              if (text[i] === "\\") i += 2;
              else i++;
            }
            if (i < len) i++;
            continue;
          }
          if (text[i] === "(" && text[i + 1] === "(") {
            depth++;
            i += 2;
          } else if (text[i] === ")" && text[i + 1] === ")") {
            depth--;
            if (depth === 0) break;
            i += 2;
          } else {
            i++;
          }
        }
        const inner = text.slice(start, i);
        if (i < len && text[i] === ")" && text[i + 1] === ")") i += 2;
        const attrs = parseOptionalAttrs();
        const resolvedAttrs = resolveAttrs(attrs, vars);
        const attrPart = resolvedAttrs ? " " + resolvedAttrs : "";
        const innerHtml = processContent(inner, vars);
        result += `<div${attrPart}>${innerHtml}</div>`;
        continue;
      }

      if (text[i] === "[") {
        const tagHtml = parseTag();
        if (tagHtml !== null) {
          result += tagHtml;
          continue;
        }
      }

      if (text[i] === "/" && text[i + 1] === "/") {
        const scriptHtml = parseScript();
        if (scriptHtml !== null) {
          result += scriptHtml;
          continue;
        }
      }

      let j = i;
      while (
        j < len &&
        !(text[j] === "(" && text[j + 1] === "(") &&
        text[j] !== "[" &&
        !(text[j] === "/" && text[j + 1] === "/")
      ) {
        j++;
      }
      if (j > i) {
        const plain = text.slice(i, j);
        if (plain.trim()) {
          result += escapeHtml(interpolate(plain, vars));
        }
        i = j;
      } else {
        result += escapeHtml(text[i]);
        i++;
      }
    }

    return result;
  }

  /**
   * IDE 用: 外部 link は fetch せずスキップ（サンドボックス制約のため）。
   * <value> と本文のみ処理する。
   */
  function processAuvaSource(rawText) {
    const vars = Object.create(null);
    let text = stripComments(rawText);

    const valueRe = /<value>([\s\S]*?)<\/value>/gi;
    let m;
    while ((m = valueRe.exec(text)) !== null) {
      parseValueBlock(m[1], vars);
    }

    text = text
      .replace(/<link\s+[^>]*?\/?>/gi, "")
      .replace(/<value>[\s\S]*?<\/value>/gi, "");

    const html = processContent(text.trim(), vars);
    return { html, vars };
  }

  /* ================================================================== */
  /*  IDE UI                                                            */
  /* ================================================================== */

  const editor = document.getElementById("editor");
  const gutter = document.getElementById("gutter");
  const statusLine = document.getElementById("status-line");
  const renderStatus = document.getElementById("render-status");
  const preview = document.getElementById("preview");
  const htmlOut = document.getElementById("html-out");
  const varsOut = document.getElementById("vars-out");
  const logOut = document.getElementById("log-out");
  const fileLabel = document.getElementById("file-label");
  const fileInput = document.getElementById("file-input");
  const resizer = document.getElementById("resizer");
  const previewPanel = document.getElementById("preview-panel");
  const helpModal = document.getElementById("help-modal");

  const SAMPLE = `<value>
  title = "AUVA IDE デモ"
  items = ["探究", "発表", "フィードバック"]
  year = 2026
</value>

((
[[h2:"{title}"]]
[[p:"麗探祭 {year} 向けの .auva 記法サンプルです。"]]
[[p:"下のリストは repetition で生成しています。"]]
))(class="card")

((
[[h2:"見どころ"]]
// repetition[i = 1, 3, 1]{
[[p:"・{items[i]}"]]
// }
[[br]]
[[p:"問いから始まる学びの革命。"]]
))(class="card")

// if[year >= 2026]{
(([[p:"開催年は {year} です。"]]))(class="card")
// } else{
(([[p:"まだ未来です。"]]))(class="card")
// }
`;

  function log(msg, cls) {
    const t = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = `[${t}] ${msg}`;
    logOut.appendChild(line);
    logOut.scrollTop = logOut.scrollHeight;
  }

  function updateGutter() {
    const lines = editor.value.split("\n").length;
    let html = "";
    for (let n = 1; n <= lines; n++) html += n + "\n";
    gutter.textContent = html;
  }

  function updateCursor() {
    const val = editor.value;
    const pos = editor.selectionStart;
    const before = val.slice(0, pos);
    const line = before.split("\n").length;
    const col = before.length - before.lastIndexOf("\n");
    statusLine.textContent = `行 ${line} · 列 ${col}`;
  }

  function syncScroll() {
    gutter.scrollTop = editor.scrollTop;
  }

  function run() {
    const src = editor.value;
    const t0 = performance.now();
    try {
      const { html, vars } = processAuvaSource(src);
      preview.innerHTML = html || '<p style="color:#64748b">（空の出力）</p>';
      htmlOut.textContent = html || "（空）";

      const dumped = {};
      for (const k of Object.keys(vars)) dumped[k] = vars[k];
      varsOut.textContent = Object.keys(dumped).length
        ? JSON.stringify(dumped, null, 2)
        : "（変数なし）";

      const ms = (performance.now() - t0).toFixed(1);
      renderStatus.textContent = `OK · ${ms} ms`;
      renderStatus.style.color = "var(--success)";
      log(`レンダリング成功 (${ms} ms)`, "ok");
    } catch (err) {
      renderStatus.textContent = "エラー";
      renderStatus.style.color = "var(--danger)";
      log(String(err && err.message ? err.message : err), "err");
      console.error(err);
    }
  }

  function loadSample() {
    editor.value = SAMPLE;
    fileLabel.textContent = "sample.auva";
    updateGutter();
    updateCursor();
    run();
    log("サンプルを読み込みました", "info");
  }

  function clearEditor() {
    editor.value = "";
    fileLabel.textContent = "untitled.auva";
    preview.innerHTML = "";
    htmlOut.textContent = "";
    varsOut.textContent = "（実行後に表示）";
    renderStatus.textContent = "未実行";
    renderStatus.style.color = "";
    updateGutter();
    updateCursor();
    log("エディタをクリアしました", "info");
  }

  function downloadAuva() {
    const blob = new Blob([editor.value], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileLabel.textContent || "untitled.auva";
    a.click();
    URL.revokeObjectURL(a.href);
    log("ダウンロード開始: " + a.download, "info");
  }

  /* --- イベント --- */
  editor.addEventListener("input", () => {
    updateGutter();
    updateCursor();
  });
  editor.addEventListener("keyup", updateCursor);
  editor.addEventListener("click", updateCursor);
  editor.addEventListener("scroll", syncScroll);

  editor.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      run();
      return;
    }
    // Tab でインデント
    if (e.key === "Tab") {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const v = editor.value;
      editor.value = v.slice(0, start) + "  " + v.slice(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      updateGutter();
    }
  });

  document.getElementById("btn-run").addEventListener("click", run);
  document.getElementById("btn-sample").addEventListener("click", loadSample);
  document.getElementById("btn-clear").addEventListener("click", clearEditor);
  document.getElementById("btn-download").addEventListener("click", downloadAuva);

  document.getElementById("btn-toggle-preview").addEventListener("click", () => {
    const hidden = previewPanel.style.display === "none";
    previewPanel.style.display = hidden ? "" : "none";
    resizer.style.display = hidden ? "" : "none";
  });

  document.getElementById("btn-help").addEventListener("click", () => {
    helpModal.hidden = false;
  });
  helpModal.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => {
      helpModal.hidden = true;
    });
  });

  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.value = String(reader.result || "");
      fileLabel.textContent = f.name;
      updateGutter();
      updateCursor();
      run();
      log("ファイル読込: " + f.name, "info");
    };
    reader.readAsText(f, "utf-8");
    fileInput.value = "";
  });

  // タブ切替
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      const pane = document.getElementById("pane-" + tab.dataset.tab);
      if (pane) pane.classList.add("active");
    });
  });

  // リサイザ
  (function setupResizer() {
    let dragging = false;
    resizer.addEventListener("mousedown", (e) => {
      dragging = true;
      resizer.classList.add("active");
      e.preventDefault();
    });
    window.addEventListener("mouseup", () => {
      dragging = false;
      resizer.classList.remove("active");
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const workspace = document.querySelector(".workspace");
      const rect = workspace.getBoundingClientRect();
      const vertical = window.matchMedia("(max-width: 800px)").matches;
      if (vertical) {
        const y = e.clientY - rect.top;
        const pct = Math.min(80, Math.max(20, (y / rect.height) * 100));
        document.querySelector(".panel-editor").style.flex = `0 0 ${pct}%`;
        previewPanel.style.flex = `0 0 ${100 - pct}%`;
      } else {
        const x = e.clientX - rect.left;
        const pct = Math.min(80, Math.max(20, (x / rect.width) * 100));
        document.querySelector(".panel-editor").style.flex = `0 0 ${pct}%`;
        previewPanel.style.flex = `1 1 ${100 - pct}%`;
      }
    });
  })();

  // 起動
  updateGutter();
  updateCursor();
  loadSample();
  log("AUVA IDE 準備完了", "ok");
})();
