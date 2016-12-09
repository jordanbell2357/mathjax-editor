import { mustFindElement, insertBetween } from './utils';

const KEY_BACKSPACE = 8;
const KEY_LEFT = 37;
const KEY_RIGHT = 39;

class Editor {
  /**
   * This is the main class of the Editor.
   * 
   * It contains all methods to deal with the cursor and math input.
   * It accepts an object as first argument, which must contain the options.
   * 
   * @param {Object} options
   * @param {DOMElement|String} options.el - The DOM Element itself or a string selector.
   * 
   * @constructor
   */
  constructor({ el }) {
    const Element = MathJax.HTML.Element;

    const $el = mustFindElement(el);
    const $container = Element('div', { className: 'mj-ed-container' });
    const $input = Element('input', { className: 'mj-ed-input' });
    const $display = Element('div', { className: 'mj-ed-display' }, ['\\(\\cursor\\)']);
    const $debug = Element('pre', {}, ['|']);

    $el.parentNode.replaceChild($container, $el);
    $container.appendChild($input);
    $container.appendChild($display);
    $container.appendChild($debug);

    $input.addEventListener('keydown', this.handleInputEvent.bind(this));
    $input.addEventListener('keyup', this.handleInputEvent.bind(this));

    MathJax.Hub.Queue(
      ['Typeset', MathJax.Hub, $display], () => {
        this.jaxElement = MathJax.Hub.getAllJax($display)[0];
      }, () => {
        $display.style.minHeight = `${$display.offsetHeight}px`;
        this.updateCursorElement();
      }
    );

    this.$container = $container;
    this.$debug = $debug;
    this.$display = $display;
    this.$input = $input;
    this.cursor = 0;
    this.value = '';
  }

  /**
   * This will update `this.$debug` inner HTML so that we can see
   * the raw Jax written by the user input.
   * (At the moment it updates the JaxElement, too)
   * 
   * @param {String} value - Jax to be used. It defaults to the editor's value.
   * 
   * @return {Void}
   */
  updateDebug(value = this.value) {
    const cursor = this.cursor;
    this.$debug.innerHTML = insertBetween(value, cursor, '|');
    this.updateJaxElement(
      insertBetween(value, cursor, '{\\cursor}'),
      this.updateCursorElement.bind(this)
    );
  }

  /**
   * Updates the Jax Element inside of `this.display`.
   * 
   * @param {String} jax
   * @param {Function} callback
   * 
   * @return {Void}
   */
  updateJaxElement(jax, callback = Function) {
    MathJax.Hub.Queue(
      ['Text', this.jaxElement, jax],
      callback
    );
  }

  /**
   * This updates the cursor position based on the amount
   * of movement is given.
   * 
   * PS: The meaning of the variable `next` is not the next index,
   *     but the next value the cursor will hold.
   * 
   * @param {Number} amount
   * 
   * @return {Void}
   */
  updateCursor(amount = 0) {
    let next = this.cursor + amount;
    const current = this.cursor;
    const value = this.value;
    const length = value.length;

    // Moving to the left.
    if (amount < 0) {
      if (value[next] === '{') {
        let i = next;
        while (i--) {
          if (value[i] === '\\') {
            break;
          }
        }
        next = i;
      }
    }

    // Moving to the right.
    if (amount > 0) {
      if (value[current] === '\\') {
        let i = next;
        while (i++ < length) {
          if (value[i] === '{') {
            break;
          }
        }
        next = i + 1;
      }

      if (value[next] === '{') {
        next += 1;
      }
    }

    this.cursor = next;
    this.updateDebug();
  }

  updateCursorElement() {
    MathJax.Hub.Queue(() => {
      const $cursor = this.$display.querySelector('.mjx-cursor');
      if (!$cursor) {
        return;
      }
      $cursor.style.marginLeft = `-${$cursor.offsetWidth}px`;   
    });
  }

  /**
   * Find a jax command at given position.
   * 
   * For instance, consider this as the current value of the editor:
   * 
   *     '\sqrt{2}'
   * 
   * If the given position is the index of any character of the
   * command '\sqrt', it will return the start and the end of the
   * command.
   * 
   * @param {Number} position
   * 
   * @return {Object}
   */
  findCommandAt(position) {
    const coordinates = { start: null, end: null };
    const value = this.value;
    const length = value.length;
    const previous = position - 1;
    const next = position + 1;
    let i;
    
    i = next;

    while (i--) {
      if (value[i] === '\\') {
        coordinates.start = i;
        break;
      }
    }

    i = previous;

    while (i++ < value.length) {
      if (value[i] === '}' && value[i + 1] !== '{') {
        coordinates.end = i;
        break;
      }
    }

    if (coordinates.end === null) {
      coordinates.end = i;
    }

    return coordinates;
  }

  /**
   * This will handle the events of `this.$input`.
   * It captures the key pressed and what the user have typed.
   * 
   * @param {KeyboardEvent} e
   * 
   * @return {Void}
   */
  handleInputEvent(e) {
    const $input = this.$input;
    const inputValue = $input.value.trim();
    let which = e.keyCode;

    $input.value = '';

    if (e.type === 'keyup') {
      which = null;
    }

    if (!inputValue.length) {
      return this.handleInput(which);
    }

    inputValue.split('')
      .forEach(char => {
        this.handleInput(which, char);
      });
  }

  /**
   * Handles the user input.
   * 
   * @param {Number} which - Which key was pressed.
   * @param {String} char - The character that was typed.
   * 
   * @return {Void}
   */
  handleInput(which, char) {
    switch (which) {
      case KEY_LEFT:
        if (this.cursor > 0) {
          this.updateCursor(-1);
        }
        return;

      case KEY_RIGHT:
        if (this.cursor < this.value.length) {
          this.updateCursor(1);
        }
        return;

      case KEY_BACKSPACE:
        this.erase();
        return;
    }

    if (which) {
      console.warn(`The key ${which} was pressed.`);
    }

    if (!char) {
      return;
    }

    this.insert(char);
  }

  /**
   * Insert a piece of text in editor's value.
   * 
   * @param {String} value
   * 
   * @return {Void}
   */
  insert(value) {
    const cursor = this.cursor;
    const current = this.value;

    if (cursor === -1) {
      this.value = value + current;
      this.cursor += value.length;
      return this.updateDebug();
    }

    this.cursor += value.length;
    this.value = insertBetween(current, cursor, value);

    this.updateDebug();
  }

  /**
   * Inserts a command in the editor.
   * 
   * The cursor will moved to the first "block" ({}).
   * 
   * @param {String} command - The command.
   * @param {Number} blockCount - The quantity of blocks it requires.
   * 
   * @return {Void}
   */
  insertCommand(command, blockCount = 1) {
    command = `${command}{`;
    this.insert(command);

    const value = this.value;
    const cursor = this.cursor;
    const blocks = '}' + '{}'.repeat(blockCount - 1);

    this.value = insertBetween(value, cursor, blocks);
    this.$input.focus();
    this.updateDebug();
  }

  /**
   * Erases the character before the cursor.
   * 
   * @return {Void}
   */
  erase() {
    const current = this.cursor;
    const previous = this.cursor - 1;
    const value = this.value;
    let before;
    let after;

    if (~['{', '}'].indexOf(value[previous])) {
      const coordinates = this.findCommandAt(current);
      before = value.slice(0, coordinates.start);
      after = value.slice(coordinates.end + 1);
    }
    else {
      before = value.slice(0, current - 1);
      after = value.slice(current);
    }

    this.value = before + after;
    this.cursor = before.length;
    this.updateDebug();
  }
}

export default Editor;