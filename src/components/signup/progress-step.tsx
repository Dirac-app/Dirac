"use client";

interface ProgressStepProps {
  current: 1 | 2;
  total?: 2;
}

export function ProgressStep({ current, total = 2 }: ProgressStepProps) {
  return (
    <div className="mb-10 space-y-2">
      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
        Step {current} of {total}
      </p>
      <div className="flex gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="h-0.5 flex-1"
            style={{
              backgroundColor: i < current ? "#FF8A3D" : "rgb(39 39 42)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
