"use client";

import Image from "next/image";
import { type ReactNode } from "react";
import styles from "./auth-title-scene.module.css";

const hd2dAssetRoot = "/backgrounds/hd2d/auth/preview-v1";

type AuthTitleSceneProps = {
  children: ReactNode;
  showTitleAsset?: boolean;
  variant?: string;
};

type SceneLayerProps = {
  className: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
  src: string;
};

function SceneLayer({
  className,
  imageClassName = styles.layerImage,
  priority,
  sizes = "100vw",
  src
}: SceneLayerProps) {
  return (
    <div aria-hidden className={`${styles.sceneLayer} ${className}`} style={{ position: "absolute" }}>
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className={imageClassName}
      />
    </div>
  );
}

export function AuthTitleScene({ children, showTitleAsset = true, variant }: AuthTitleSceneProps) {
  return (
    <main
      data-hd2d-scene="auth-title"
      data-auth-composition="v3"
      data-variant={variant}
      className={styles.authScene}
    >
      <SceneLayer
        className={styles.atmosphere}
        imageClassName={styles.coverImage}
        priority
        src={`${hd2dAssetRoot}/depth-atmosphere-v3.png`}
      />
      <SceneLayer
        className={styles.townDepth}
        priority
        sizes="92vw"
        src={`${hd2dAssetRoot}/town-depth-v1.png`}
      />
      <SceneLayer
        className={styles.townSide}
        priority
        sizes="112vw"
        src={`${hd2dAssetRoot}/town-side-buildings-v1.png`}
      />
      <SceneLayer
        className={styles.treesLeft}
        sizes="30vw"
        src={`${hd2dAssetRoot}/natural-environment-v1.png`}
      />
      <SceneLayer
        className={styles.treesRight}
        sizes="23vw"
        src={`${hd2dAssetRoot}/natural-environment-v1.png`}
      />
      <SceneLayer
        className={styles.foreground}
        sizes="124vw"
        src={`${hd2dAssetRoot}/foreground-stage-v1-trimmed.png`}
      />
      <SceneLayer
        className={styles.townProps}
        sizes="96vw"
        src={`${hd2dAssetRoot}/town-props-v1.png`}
      />
      <span aria-hidden className={styles.grade} />
      {showTitleAsset ? (
        <SceneLayer
          className={styles.titleAsset}
          priority
          sizes="(max-width: 720px) 82vw, 600px"
          src={`${hd2dAssetRoot}/adaptabuddy-title-v2.png`}
        />
      ) : null}
      <span aria-hidden className={styles.formGlow} />

      <h1 className={styles.srOnly}>AdaptaBuddy</h1>

      <div className={styles.content}>{children}</div>
    </main>
  );
}
