export function validateSelection(selected, available) {
  if (!Array.isArray(selected) || selected.length === 0 || selected.length > 5 || selected.some(x => typeof x !== 'string' || !available.includes(x)) || new Set(selected).size !== selected.length) throw new Error('请选择有效的试点设备');
  return selected;
}
