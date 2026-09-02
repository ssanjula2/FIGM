// Clean: the <img> element declares explicit width/height and an aspect-ratio, so the browser
// can reserve layout space before the image loads -- FIGM-PERF-02 must NOT fire.
export function Avatar({ userAvatarUrl }) {
  return (
    <img
      src={userAvatarUrl}
      alt="User avatar"
      width={48}
      height={48}
      style={{ aspectRatio: '1/1' }}
      className="avatar"
    />
  );
}
