/**
 * Aether AI Browser - Tab Content Preload Script (CommonJS)
 * Injected into all web tabs (isolated world) to detect comment boxes,
 * generate contextual AI comments, and auto-insert into contenteditable/textarea inputs.
 */

const { ipcRenderer } = require('electron');

(() => {
  function insertTextIntoElement(target, text) {
    if (!target) return;
    target.focus();
    try {
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } catch (e) {
      if ('value' in target) {
        target.value = text;
      } else {
        target.innerText = text;
      }
    }
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }

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

  function renderOptionPills(container, targetInput, suggestions) {
    let pillsRow = container.querySelector('.aether-pills-row');
    if (!pillsRow) {
      pillsRow = document.createElement('div');
      pillsRow.className = 'aether-pills-row';
      pillsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;';
      container.appendChild(pillsRow);
    }

    pillsRow.innerHTML = '';

    suggestions.forEach((item, index) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.innerHTML = `<span>${index === 0 ? '💡' : index === 1 ? '❓' : '⚖️'}</span> <span>${item.style_label.split('(')[0].trim()}</span>`;
      pill.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: ${index === 0 ? '#0a66c2' : '#f1f5f9'};
        color: ${index === 0 ? '#ffffff' : '#334155'};
        border: 1px solid ${index === 0 ? '#0a66c2' : '#cbd5e1'};
        font-size: 11px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
      `;

      pill.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        pillsRow.querySelectorAll('button').forEach((b) => {
          b.dataset.selected = 'false';
          b.style.background = '#f1f5f9';
          b.style.color = '#334155';
          b.style.borderColor = '#cbd5e1';
        });

        pill.dataset.selected = 'true';
        pill.style.background = '#0a66c2';
        pill.style.color = '#ffffff';
        pill.style.borderColor = '#0a66c2';

        insertTextIntoElement(targetInput, item.content);
      };

      pillsRow.appendChild(pill);
    });
  }

  function attachCommentHelper(targetElement) {
    // 1. Locate the outer unclipped comment box container
    const hostContainer = targetElement.closest(
      '.comments-comment-box, form.comments-comment-box__form, .comments-comment-box__form-container, .feed-shared-update-v2__comments-container, [data-testid="tweetTextarea_0"]'
    ) || targetElement.parentElement;

    if (!hostContainer) return;

    // Avoid duplicate buttons in same container
    if (hostContainer.querySelector('.aether-comment-helper-container')) return;
    if (targetElement.dataset.aetherAttached === 'true') return;
    targetElement.dataset.aetherAttached = 'true';

    // Helper to find the active editable element
    const getEditableTarget = () => {
      return hostContainer.querySelector('div.editor-content[contenteditable="true"], div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"], div[contenteditable="true"], textarea') || targetElement;
    };

    // Container for button & pills (placed outside any clipped element)
    const wrapper = document.createElement('div');
    wrapper.className = 'aether-comment-helper-container';
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      margin: 8px 0 10px 48px;
      z-index: 999999;
      position: relative;
      clear: both;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

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
    `;

    btn.onmouseenter = () => {
      btn.style.transform = 'translateY(-1px)';
      btn.style.boxShadow = '0 4px 10px rgba(10, 102, 194, 0.45)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 2px 6px rgba(10, 102, 194, 0.35)';
    };

    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const editable = getEditableTarget();
      const postText = extractEnclosingPostText(hostContainer);

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
          return;
        }

        // 1. Immediately insert first suggestion into the comment box!
        insertTextIntoElement(editable, suggestions[0].content);

        // 2. Render options pills for switching angles
        renderOptionPills(wrapper, editable, suggestions);

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

    wrapper.appendChild(btn);
    hostContainer.appendChild(wrapper);
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

  // Scan immediately, on focusin, and periodically on scroll/mutations
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanAndAttach);
  } else {
    scanAndAttach();
  }

  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (target && (target.getAttribute('contenteditable') === 'true' || target.tagName === 'TEXTAREA')) {
      attachCommentHelper(target);
    }
  });

  setInterval(scanAndAttach, 1500);
})();
