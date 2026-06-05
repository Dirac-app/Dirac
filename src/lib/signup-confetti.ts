/** Short branded burst after Google signup succeeds. */
export async function fireSignupConfetti(): Promise<void> {
  const { default: confetti } = await import("canvas-confetti");
  const colors = ["#FF8A3D", "#ffffff", "#f4f4f5"];

  void confetti({
    particleCount: 64,
    spread: 72,
    startVelocity: 28,
    origin: { y: 0.55 },
    colors,
    ticks: 160,
    gravity: 1.1,
    scalar: 0.9,
  });

  await new Promise((r) => setTimeout(r, 180));

  void confetti({
    particleCount: 28,
    angle: 60,
    spread: 48,
    origin: { x: 0.12, y: 0.5 },
    colors,
  });
  void confetti({
    particleCount: 28,
    angle: 120,
    spread: 48,
    origin: { x: 0.88, y: 0.5 },
    colors,
  });
}
