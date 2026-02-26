export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const runSequence = async (animations = []) => {
  for (const { fn, waitMs } of animations) {
    await fn();
    if (waitMs) {
      await delay(waitMs);
    }
  }
};
