export default function ToggleSwitch({ checked, onChange, green = false }) {
  return (
    <label className="relative w-[42px] h-[23px] flex-shrink-0 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <span className={`absolute inset-0 rounded-full transition-colors duration-250
        bg-[var(--color-border)] 
        ${green ? 'peer-checked:bg-[var(--color-green)]' : 'peer-checked:bg-[var(--color-blue)]'}`}
      />
      <span className="absolute top-[3px] left-[3px] w-[17px] h-[17px] bg-white rounded-full 
                       transition-transform duration-250 peer-checked:translate-x-[19px]" />
    </label>
  )
}
