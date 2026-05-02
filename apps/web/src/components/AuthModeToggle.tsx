"use client";

import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import framesJson from "../../public/ui/auth_toggle.frames.json";

type AuthMode = "signin" | "signup";
type InteractionState = "idle" | "hover" | "pressed";

type SpriteFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type SpriteFrames = {
  frameWidth: number;
  frameHeight: number;
  sprite: string;
  frames: Record<string, SpriteFrame>;
};

type AuthModeToggleProps = {
  value: AuthMode;
  onChange: (value: AuthMode) => void;
  disabled?: boolean;
};

const spriteFrames = framesJson as SpriteFrames;

const stateFrameMap: Record<AuthMode, Record<InteractionState, string>> = {
  signin: {
    idle: "signin_idle",
    hover: "signin_hover",
    pressed: "signin_pressed"
  },
  signup: {
    idle: "signup_idle",
    hover: "signup_hover",
    pressed: "signup_pressed"
  }
};

export function AuthModeToggle({ value, onChange, disabled = false }: AuthModeToggleProps) {
  const previousValueRef = useRef<AuthMode>(value);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [flipScale, setFlipScale] = useState(1);
  const [isShimmering, setIsShimmering] = useState(false);
  const [shimmerX, setShimmerX] = useState(120);

  useEffect(() => {
    if (previousValueRef.current === value) {
      return;
    }
    previousValueRef.current = value;

    setFlipScale(0.93);
    setIsShimmering(true);
    setShimmerX(120);

    const startShimmerAnimation = window.requestAnimationFrame(() => {
      setShimmerX(-20);
    });

    const flipTimeout = window.setTimeout(() => setFlipScale(1), 90);
    const shimmerTimeout = window.setTimeout(() => setIsShimmering(false), 260);

    return () => {
      window.cancelAnimationFrame(startShimmerAnimation);
      window.clearTimeout(flipTimeout);
      window.clearTimeout(shimmerTimeout);
    };
  }, [value]);

  const interactionState: InteractionState = disabled
    ? "idle"
    : isPressed
      ? "pressed"
      : isHovered
        ? "hover"
        : "idle";
  const frameName = stateFrameMap[value][interactionState];
  const frame = spriteFrames.frames[frameName];

  const handleToggle = () => {
    if (disabled) {
      return;
    }
    onChange(value === "signin" ? "signup" : "signin");
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPressed(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setIsPressed(true);
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setIsPressed(false);
      handleToggle();
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={value === "signup"}
        aria-label={value === "signin" ? "Switch to sign up mode" : "Switch to sign in mode"}
        className="relative inline-block select-none align-middle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgba(255,220,160,0.75)] disabled:cursor-not-allowed disabled:opacity-70"
        style={{
          position: "relative",
          display: "inline-block",
          width: frame.w,
          height: frame.h,
          overflow: "hidden"
        }}
        onClick={handleToggle}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => {
          setIsHovered(false);
          setIsPressed(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={() => setIsPressed(false)}
        onPointerCancel={() => setIsPressed(false)}
        onBlur={() => setIsPressed(false)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <span
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            backgroundImage: `url(${spriteFrames.sprite})`,
            backgroundPosition: `-${frame.x}px -${frame.y}px`,
            backgroundRepeat: "no-repeat",
            imageRendering: "pixelated",
            transformOrigin: "center",
            transform: `scale3d(${flipScale}, ${flipScale}, 1)`,
            transition: "transform 90ms steps(2, end)"
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none"
          style={{
            position: "absolute",
            inset: 0,
            opacity: isShimmering ? 0.28 : 0,
            backgroundImage:
              "repeating-linear-gradient(180deg, rgba(255,248,222,0.34) 0 1px, transparent 1px 3px), linear-gradient(105deg, transparent 24%, rgba(255,236,184,0.82) 42%, transparent 60%)",
            backgroundSize: "100% 3px, 220% 100%",
            backgroundPosition: `0 0, ${shimmerX}% 0`,
            imageRendering: "pixelated",
            mixBlendMode: "screen",
            transition: "opacity 120ms linear, background-position 260ms linear"
          }}
        />
      </button>
    </>
  );
}
