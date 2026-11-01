/**
 * Aether AI Browser - Tab Content Preload Script (CommonJS)
 * Injected into all web tabs (isolated world) to detect comment boxes,
 * generate contextual AI comments, and auto-insert into contenteditable/textarea inputs.
 */

const { ipcRenderer } = require('electron');

(() => {
  // Prevent duplicate initialization in same frame
  if (window.__aetherTabPreloadLoaded) return;
  window.__aetherTabPreloadLoaded = true;

  /**
   * Universal text insertion routine that works on LinkedIn Quill editors,
   * React controlled inputs, and standard textareas.
   */
  function insertTextIntoElement(target, text) {
    if (!target) return false;

    // 1. Focus and click to activate LinkedIn's Quill editor / React state
    try {
      target.click();
      target.focus();
    } catch (e) {}

    let success = false;
    try {
      document.execCommand('selectAll', false, null);
      success = document.execCommand('insertText', false, text);
    } catch (e) {
      success = false;
    }

    // 2. Direct DOM insertion fallback for Quill or standard inputs
    const currentText = target.innerText || target.value || '';
    if (!success || !currentText.includes(text.slice(0, 10))) {
      if ('value' in target) {
        target.value = text;
      } else {
        // LinkedIn Quill wraps paragraphs in <p> tags
        const p = target.querySelector('p');
        if (p) {
          p.innerText = text;
        } else {
          target.innerText = text;
        }
      }
    }

    // 3. Dispatch full suite of input events to notify Quill & React state
    try {
      target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: text }));
    } catch (e) {}
    try {
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    } catch (e) {}
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));

    return true;
  }

  /**
   * Scrapes contextual post text from enclosing LinkedIn card or article.
   */
  function extractEnclosingPostText(element) {
    const postContainer = element.closest('.feed-shared-update-v2, article, [data-urn], .feed-shared-update-v2__content, .occluded-update') || document.body;
    const bodySelectors = [
      '.feed-shared-update-v2__description',
      '.update-components-text',
      '.feed-shared-inline-show-more-text',
      '.attributed-text-segment-list__content',
      'span.break-words'
    ];

    for (const sel of bodySelectors) {
      const el = postContainer.querySelector(sel);
      if (el && el.innerText.trim().length > 10) {
        return el.innerText.trim();
      }
    }

    return postContainer.innerText.slice(0, 1500).trim();
  }

  /**
   * Renders the 3 distinct angle options: Value-Add, Thoughtful Question, Constructive Nuance.
   */
  function renderOptionPills(container, targetInput, suggestions, onRegenerate) {
    let pillsRow = container.querySelector('.aether-pills-row');
    if (!pillsRow) {
      pillsRow = document.createElement('div');
      pillsRow.className = 'aether-pills-row';
      pillsRow.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 6px;';
      container.appendChild(pillsRow);
    }

    pillsRow.innerHTML = '';

    suggestions.forEach((item, index) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      const icon = index === 0 ? '💡' : index === 1 ? '❓' : '⚖️';
      const label = item.style_label.split('(')[0].trim();
      pill.innerHTML = `<span>${icon}</span> <span>${label}</span>`;
      pill.title = item.content.slice(0, 120) + '...';
      pill.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: ${index === 0 ? '#0a66c2' : '#f8fafc'};
        color: ${index === 0 ? '#ffffff' : '#334155'};
        border: 1px solid ${index === 0 ? '#0a66c2' : '#cbd5e1'};
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
        font-family: inherit;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      `;

      pill.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        pillsRow.querySelectorAll('button[data-angle]').forEach((b) => {
          b.dataset.selected = 'false';
          b.style.background = '#f8fafc';
          b.style.color = '#334155';
          b.style.borderColor = '#cbd5e1';
        });

        pill.dataset.selected = 'true';
        pill.style.background = '#0a66c2';
        pill.style.color = '#ffffff';
        pill.style.borderColor = '#0a66c2';

        insertTextIntoElement(targetInput, item.content);
      };

      pill.dataset.angle = 'true';
      pillsRow.appendChild(pill);
    });

    // Add Regenerate pill
    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.innerHTML = '🔄 Refresh';
    regenBtn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #f1f5f9;
      color: #64748b;
      border: 1px dashed #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    `;
    regenBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onRegenerate) onRegenerate();
    };
    pillsRow.appendChild(regenBtn);
  }

  /**
   * Attaches the AI comment helper UI directly beneath the comment input box.
   */
  function attachCommentHelper(targetElement) {
    // 1. Identify outer comment box anchor
    const anchor = targetElement.closest('.comments-comment-box')
      || targetElement.closest('form.comments-comment-box__form')
      || targetElement.closest('.comments-comment-texteditor')
      || targetElement.closest('[data-testid="tweetTextarea_0"]')
      || targetElement;

    if (!anchor || !anchor.parentNode) return;

    // Check if helper is already attached to this anchor
    if (anchor.dataset.aetherAttached === 'true') {
      const existing = anchor.parentNode.querySelector(`.aether-comment-helper-container[data-anchor-id="${anchor.id || 'default'}"]`);
      if (existing && document.body.contains(existing)) {
        return;
      }
    }
    anchor.dataset.aetherAttached = 'true';

    // Helper to find the active editable element
    const getEditableTarget = () => {
      return anchor.querySelector('div.ql-editor[contenteditable="true"], div.editor-content[contenteditable="true"], div[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea')
        || (targetElement.getAttribute('contenteditable') === 'true' || targetElement.tagName === 'TEXTAREA' ? targetElement : null)
        || anchor;
    };

    // 2. Build Wrapper Container (Sibling placed right AFTER comment box)
    const wrapper = document.createElement('div');
    wrapper.className = 'aether-comment-helper-container';
    if (anchor.id) wrapper.dataset.anchorId = anchor.id;
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin: 8px 0 10px 48px;
      z-index: 999999;
      position: relative;
      clear: both;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    `;

    // 3. Create Main AI Comment Trigger Button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '✨ AI Comment';
    btn.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #0a66c2 0%, #004182 100%);
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(10, 102, 194, 0.35);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
      user-select: none;
      line-height: 1.4;
    `;

    btn.onmouseenter = () => {
      if (!btn.disabled) {
        btn.style.transform = 'translateY(-1px)';
        btn.style.boxShadow = '0 4px 10px rgba(10, 102, 194, 0.45)';
      }
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 2px 6px rgba(10, 102, 194, 0.35)';
    };

    const triggerGeneration = async () => {
      const editable = getEditableTarget();
      const postText = extractEnclosingPostText(anchor);

      btn.disabled = true;
      btn.innerHTML = '⏳ Writing AI Comment...';
      btn.style.opacity = '0.85';

      try {
        const response = await ipcRenderer.invoke('ai:generateComment', {
          sourcePostText: postText,
          tone: 'analytical'
        });

        const suggestions = response?.suggestions || [];
        if (suggestions.length === 0) {
          btn.innerHTML = '⚠️ No comments generated';
          btn.disabled = false;
          btn.style.opacity = '1';
          return;
        }

        // 1. Immediately insert first suggestion into the comment box!
        insertTextIntoElement(editable, suggestions[0].content);

        // 2. Render options pills for switching angles
        renderOptionPills(wrapper, editable, suggestions, triggerGeneration);

        btn.innerHTML = '✅ Comment Inserted!';
        btn.style.background = '#059669';

        setTimeout(() => {
          btn.innerHTML = '🔄 Regenerate Comment';
          btn.style.background = 'linear-gradient(135deg, #0a66c2 0%, #004182 100%)';
          btn.style.opacity = '1';
          btn.disabled = false;
        }, 3000);
      } catch (err) {
        console.error('Failed to generate AI comment:', err);
        btn.innerHTML = '⚠️ Generation failed';
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    };

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerGeneration();
    };

    wrapper.appendChild(btn);

    // 4. Insert wrapper as a sibling immediately AFTER the comment box
    if (anchor.nextSibling) {
      anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
    } else {
      anchor.parentNode.appendChild(wrapper);
    }
  }

  function scanAndAttach() {
    const selectors = [
      '.comments-comment-box',
      '.comments-comment-box__form-container',
      'form.comments-comment-box__form',
      '.comments-comment-texteditor',
      'div.editor-content[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'div[role="textbox"]',
      '[data-testid="tweetTextarea_0"]',
      'div[data-placeholder*="comment" i]'
    ];

    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        attachCommentHelper(el);
      });
    });
  }

  // Initial runs
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndAttach);
  } else {
    scanAndAttach();
  }

  window.addEventListener('load', scanAndAttach);

  // MutationObserver for instant attachment on dynamic feed loads
  let mutationTimeout = null;
  const observer = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(scanAndAttach, 200);
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Dynamic focus attachment for text inputs
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && (target.getAttribute('contenteditable') === 'true' || target.tagName === 'TEXTAREA')) {
      attachCommentHelper(target);
    }
  });

  // Periodic safety check
  setInterval(scanAndAttach, 1500);
})();
