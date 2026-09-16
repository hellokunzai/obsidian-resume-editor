// 主线程让出工具。
//
// 导出这类"一次性算完"的任务最容易把界面卡死：只要中间不让出主线程，
// 浏览器就没有机会绘制进度、也没有机会处理鼠标/键盘事件。
// 这里提供三个粒度的让出手段，导出流程按阶段穿插使用。
//
// 一个必须防住的坑：**requestAnimationFrame 在窗口不可见（最小化、被其他
// 窗口完全遮挡、标签页在后台）时不会触发**。纯 rAF 的等待在这种状态下会
// 永久挂住，整个导出就死在那里了。所以 rAF 一律用超时兜底 —— 可见时走正常
// 帧节拍，不可见时退化为定时器，最多多等一个 timeoutMs，绝不会永远等下去。

/** 等到下一帧渲染前触发；超过 timeoutMs 未出帧则由定时器兜底放行。 */
export function nextFrame(timeoutMs = 64): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timer: number | null = null;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) window.clearTimeout(timer);
      resolve();
    };
    timer = window.setTimeout(finish, timeoutMs);
    window.requestAnimationFrame(finish);
  });
}

/**
 * 等两帧，确保刚写进去的 DOM 改动真的画到了屏幕上。
 *
 * 单帧不够：调度这次回调时，当前这一帧的绘制计划可能已经排定，
 * 新改动要等到再下一帧才可见。所有"先把进度浮层画出来，再开始重计算"的地方都走它。
 *
 * 注意：这里只保证"给过浏览器绘制机会"，不保证一定画过——窗口不可见时本来就
 * 没有绘制，此时以不阻塞为先。
 */
export async function settleUi(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

/**
 * 把主线程让给浏览器的事件循环。
 *
 * 与 nextFrame 的区别：不依赖渲染帧，只要求回到事件循环，
 * 适合插在纯计算链的中间（此时没有 DOM 变更要等）。
 */
export function yieldToUi(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}
