/** 比照夾娃娃攔截內建瀏覽器手勢，Pixi 面板仍接收自己的拖曳事件。 */
export function guardGameGestures(root: HTMLElement, signal: AbortSignal): void {
  const preventBrowserGesture = (event: Event): void => {
    if (event.cancelable) {
      event.preventDefault();
    }
  };
  // 只取消瀏覽器預設行為，不中斷事件傳遞，保留 ScrollBox 的觸控滑動。
  for (const type of ['touchmove', 'gesturestart', 'gesturechange']) {
    root.addEventListener(type, preventBrowserGesture, { passive: false, signal });
  }
}
