import mark from "../assets/null-face.svg";

/** The same scalable, decorative face is shared by the wordmark and favicon. */
export default function BrandMark({
  className = "logo-mark",
}: {
  className?: string;
}) {
  return (
    <img
      className={className}
      src={mark}
      alt=""
      width="84"
      height="84"
      aria-hidden="true"
    />
  );
}
