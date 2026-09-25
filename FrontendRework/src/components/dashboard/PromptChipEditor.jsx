import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';

// A prompt box where inline asset tags (`&[CTA:Buy Now]`) render as real,
// atomic chips instead of raw markup. The string with tag syntax stays the
// source of truth — `value` in, `onChange(value, caret)` out, where `caret`
// is an offset into that string — so callers keep doing plain string work
// (mention detection, insertion, the #ImageN transform on submit).
//
// The DOM is managed imperatively (React never renders children into the
// contentEditable): it's rebuilt from `value` only when the value changes
// from outside, e.g. a mention was inserted, and otherwise left to the
// browser so typing, selection and IME behave natively.

const TAG_REGEX = /([*@#&])\[(Reference|Character|Environment|CTA|Promo|Logo):([^\]]+)\]/g;

const isChip = (n) => n.nodeType === 1 && n.dataset?.tag != null;

// Serialize a node's children back to the tag string. A trailing <br> is the
// placeholder that makes an empty last line visible — it isn't a newline of
// its own, so it's dropped unless we're measuring a caret offset.
function serialize(root, { keepTrailingBr = false } = {}) {
  let out = '';
  const walk = (node, isRoot) => {
    const kids = node.childNodes;
    for (let i = 0; i < kids.length; i++) {
      const c = kids[i];
      if (c.nodeType === 3) out += c.nodeValue.replace(/​/g, '');
      else if (isChip(c)) out += c.dataset.tag;
      else if (c.nodeName === 'BR') {
        if (!(isRoot && !keepTrailingBr && i === kids.length - 1)) out += '\n';
      } else if (c.nodeType === 1) {
        // Block elements some browsers wrap new lines in.
        if ((c.nodeName === 'DIV' || c.nodeName === 'P') && out && !out.endsWith('\n')) out += '\n';
        walk(c, false);
      }
    }
  };
  walk(root, true);
  // Chrome's own version of that placeholder: under pre-wrap, Enter at the
  // very end inserts "\n\n" as text, only one of which the user typed.
  const tail = root.lastChild;
  if (!keepTrailingBr && tail?.nodeType === 3 && tail.nodeValue.endsWith('\n')) out = out.slice(0, -1);
  return out;
}

function buildChip(trigger, label, name, chipClassFor) {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.tag = `${trigger}[${label}:${name}]`;
  chip.className = `inline-flex items-baseline gap-1 rounded-full border px-2 mx-0.5 leading-snug select-none ${chipClassFor(label)}`;
  const kind = document.createElement('span');
  kind.className = 'text-[9px] font-black uppercase tracking-wider opacity-60';
  kind.textContent = label;
  const text = document.createElement('span');
  text.className = 'font-bold';
  text.textContent = name;
  chip.append(kind, text);
  return chip;
}

function render(root, value, chipClassFor) {
  root.replaceChildren();
  const appendText = (s) => {
    s.split('\n').forEach((part, i) => {
      if (i > 0) root.appendChild(document.createElement('br'));
      if (part) root.appendChild(document.createTextNode(part));
    });
  };
  let last = 0;
  let m;
  TAG_REGEX.lastIndex = 0;
  while ((m = TAG_REGEX.exec(value))) {
    appendText(value.slice(last, m.index));
    root.appendChild(buildChip(m[1], m[2], m[3], chipClassFor));
    last = TAG_REGEX.lastIndex;
  }
  appendText(value.slice(last));
  // Placeholder so a trailing newline actually shows an empty line.
  if (value.endsWith('\n')) root.appendChild(document.createElement('br'));
}

function getCaret(root) {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(r.endContainer, r.endOffset);
  const tmp = document.createElement('div');
  tmp.appendChild(pre.cloneContents());
  return serialize(tmp, { keepTrailingBr: true }).length;
}

// Place the caret at `offset` in the serialized string (flat DOM, as built by render()).
function setCaret(root, offset) {
  const range = document.createRange();
  let acc = 0;
  let placed = false;
  for (const node of root.childNodes) {
    const len = node.nodeType === 3 ? node.nodeValue.length
      : isChip(node) ? node.dataset.tag.length
      : node.nodeName === 'BR' ? 1 : 0;
    if (node.nodeType === 3 && offset <= acc + len) {
      range.setStart(node, offset - acc);
      placed = true;
      break;
    }
    if (offset <= acc) {
      range.setStartBefore(node);
      placed = true;
      break;
    }
    acc += len;
  }
  if (!placed) {
    const lastNode = root.lastChild;
    // Land before the trailing placeholder <br>, not after it.
    if (lastNode?.nodeName === 'BR') range.setStartBefore(lastNode);
    else { range.selectNodeContents(root); range.collapse(false); }
  }
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

const PromptChipEditor = forwardRef(function PromptChipEditor(
  { value, onChange, onKeyDown, onBlur, placeholder, chipClassFor, className = '' },
  ref
) {
  const rootRef = useRef(null);
  const lastEmitted = useRef(null);
  const pendingCaret = useRef(null);
  const composing = useRef(false);

  useImperativeHandle(ref, () => ({
    focus: () => rootRef.current?.focus(),
    // Where to put the caret once the next outside `value` is rendered.
    setCaretAfterUpdate: (offset) => { pendingCaret.current = offset; },
  }), []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || value === lastEmitted.current) return;
    render(root, value, chipClassFor);
    lastEmitted.current = value;
    if (pendingCaret.current != null) {
      root.focus();
      setCaret(root, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [value, chipClassFor]);

  const emit = () => {
    const root = rootRef.current;
    let caret = getCaret(root);
    const next = serialize(root);
    // Anything the browser nested (a pasted block, a wrapper div), or tag
    // syntax typed out by hand: re-render flat so it becomes chips.
    const needsRebuild = [...root.childNodes].some(n => n.nodeType === 1 && !isChip(n) && n.nodeName !== 'BR')
      || [...root.childNodes].some(n => n.nodeType === 3 && (TAG_REGEX.lastIndex = 0, TAG_REGEX.test(n.nodeValue)));
    if (needsRebuild) {
      render(root, next, chipClassFor);
      if (caret != null) setCaret(root, Math.min(caret, next.length));
    }
    lastEmitted.current = next;
    if (caret != null) caret = Math.min(caret, next.length);
    onChange(next, caret ?? next.length);
  };

  const handleKeyDown = (e) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertLineBreak');
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  };

  return (
    <div className="relative h-full">
      {!value && (
        <div className="absolute inset-0 px-4 py-3.5 text-sm leading-relaxed text-slate-600 pointer-events-none select-none">
          {placeholder}
        </div>
      )}
      <div
        ref={rootRef}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={() => { if (!composing.current) emit(); }}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={() => { composing.current = false; emit(); }}
        onKeyDown={handleKeyDown}
        onKeyUp={(e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) emit(); }}
        onPaste={handlePaste}
        onBlur={onBlur}
        className={`h-full overflow-y-auto px-4 py-3.5 text-sm leading-relaxed text-white wrap-break-word outline-none ${className}`}
        // Inline, not a class: spaces next to chips and trailing newlines
        // are only kept (and serialized back) under pre-wrap.
        style={{ whiteSpace: 'pre-wrap' }}
      />
    </div>
  );
});

export default PromptChipEditor;
