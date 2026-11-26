// One paint at a time. A second call (auth ready, hash change) waits and then
// paints the latest request, so an older render cannot wipe <main> after the
// newer one already drew it.
export function createRenderQueue(renderOnce) {
  let running = false;
  let pending = null;
  let idle = Promise.resolve();
  let resolveIdle = () => {};

  function arm() {
    idle = new Promise((resolve) => {
      resolveIdle = resolve;
    });
  }

  async function pump() {
    try {
      while (pending) {
        const options = pending;
        pending = null;
        try {
          await renderOnce(options);
        } catch (error) {
          console.error(error);
        }
      }
    } finally {
      running = false;
      if (pending) {
        running = true;
        void pump();
        return;
      }
      resolveIdle();
    }
  }

  return function schedule(options) {
    pending = options ?? {};
    if (running) return idle;
    running = true;
    arm();
    void pump();
    return idle;
  };
}
