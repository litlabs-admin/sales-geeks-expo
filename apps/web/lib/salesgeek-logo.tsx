/**
 * SalesGeek lockup logo (glasses mark + "SALESGEEK" wordmark).
 *
 * Use `height` to size — width auto-scales so the aspect ratio stays correct.
 * The image lives at /public/salesgeek-logo.png so it's served as a static asset.
 */
type Props = {
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
};

export default function SalesGeekLogo({
  height = 40,
  className,
  style,
  alt = "SalesGeek",
}: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/salesgeek-logo.png"
      alt={alt}
      style={{
        height,
        width: "auto",
        display: "block",
        objectFit: "contain",
        ...style,
      }}
      className={className}
    />
  );
}
