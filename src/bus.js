let listener = async () => {};

export function onRender(fn) {
  listener = fn;
}

export function render(options) {
  return listener(options);
}
