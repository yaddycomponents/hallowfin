// A round icon button with a tooltip (the label is also its accessible name)
export function IconBtn({ icon: Icon, label, on, onClick, className = '', size = 20 }) {
  return (
    <button className={`icon-btn ${on === false ? 'off' : ''} ${className}`} onClick={onClick} aria-label={label} data-tip={label}>
      <Icon size={size} strokeWidth={2.2} />
    </button>
  )
}
