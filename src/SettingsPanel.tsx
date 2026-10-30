import { useWorld } from './state';
export function Settings() {
  const s = useWorld();
  return (
    <div className="settings-list">
      <label>
        <span>
          <strong>Evening light</strong>
          <small>Warm lamps and a quieter sky</small>
        </span>
        <input
          type="checkbox"
          checked={s.night}
          onChange={(e) => s.set({ night: e.target.checked })}
        />
      </label>
      <label>
        <span>
          <strong>Resident names</strong>
          <small>Labels above characters</small>
        </span>
        <input
          type="checkbox"
          checked={s.labels}
          onChange={(e) => s.set({ labels: e.target.checked })}
        />
      </label>
      <label>
        <span>
          <strong>Resident outings</strong>
          <small>Idle residents visit shared spaces and return for work</small>
        </span>
        <input
          type="checkbox"
          checked={s.residentOutings}
          onChange={(e) => s.set({ residentOutings: e.target.checked })}
        />
      </label>
      <label>
        <span>
          <strong>Reduced motion</strong>
          <small>Still residents and scenery, with instant camera changes</small>
        </span>
        <input
          type="checkbox"
          checked={s.reducedMotion}
          onChange={(e) => s.set({ reducedMotion: e.target.checked, cinematic: false })}
        />
      </label>
      <label>
        <span>
          <strong>Rendering quality</strong>
          <small>Lower quality simplifies scenery, pixels, and shadows</small>
        </span>
        <select
          value={s.quality}
          onChange={(e) => s.set({ quality: e.target.value as 'high' | 'low' })}
        >
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </label>
    </div>
  );
}
