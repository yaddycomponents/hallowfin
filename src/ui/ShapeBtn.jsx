// The show's shapes as the game's main buttons, no words: O is "yes" (the same
// O as the players' vote), the triangle points on, like play: "next".
// The label is the tooltip and the accessible name.
export function ShapeBtn({ shape, label, keyName, onClick, className = '' }) {
  return (
    <button className={`shape-btn ${shape} ${className}`} onClick={onClick} aria-label={label} data-tip={keyName ? `${label} · ${keyName}` : label}>
      <svg viewBox="0 0 100 100">
        {shape === 'o' ? <circle cx="50" cy="50" r="27" /> : <path d="M40 27 L73 50 L40 73 Z" />}
      </svg>
      {keyName && <kbd>{keyName}</kbd>}
    </button>
  )
}
