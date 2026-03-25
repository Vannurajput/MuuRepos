const KEY = {
  T: 'KeyT',
  W: 'KeyW',
  F: 'KeyF',
  P: 'KeyP',
  S: 'KeyS',
  U: 'KeyU',
  D: 'KeyD',
  I: 'KeyI',
  J: 'KeyJ',
  H: 'KeyH',
  F4: 'F4',
  F12: 'F12',
  TAB: 'Tab',
  DIGIT_1: 'Digit1',
  DIGIT_2: 'Digit2',
  DIGIT_3: 'Digit3',
  DIGIT_4: 'Digit4',
  DIGIT_5: 'Digit5',
  DIGIT_6: 'Digit6',
  DIGIT_7: 'Digit7',
  DIGIT_8: 'Digit8',
  DIGIT_9: 'Digit9',
  N: 'KeyN',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  F5: 'F5',
  R: 'KeyR',
  HOME: 'Home',
  L: 'KeyL',
  F6: 'F6',
  K: 'KeyK',
  E: 'KeyE',
  PLUS: 'Equal', // Ctrl + '=' is reported for the '+' key
  NUMPAD_PLUS: 'NumpadAdd',
  MINUS: 'Minus',
  NUMPAD_MINUS: 'NumpadSubtract',
  ZERO: 'Digit0',
  NUMPAD_ZERO: 'Numpad0'
};

const isCmdOrCtrl = (input) => (process.platform === 'darwin' ? input.meta : input.control);

module.exports = {
  KEY,
  isCmdOrCtrl
};
