import React, { useState } from 'react';
import { IconChevron, IconFolder, IconPlus, IconTrash } from './icons.jsx';

export default function CategoryGroup({ group, groupIndex, type, accent, update, allNames }) {
  const [open, setOpen] = useState(true);
  const [newCat, setNewCat] = useState('');
  const groupKey = type === 'income' ? 'incomeGroups' : 'expenseGroups';

  const add = () => {
    const v = newCat.trim();
    if (!v || allNames.includes(v)) return;
    update((p) => {
      const groups = [...p[groupKey]];
      groups[groupIndex] = {
        ...groups[groupIndex],
        categories: [...groups[groupIndex].categories, v],
      };
      return { ...p, [groupKey]: groups };
    });
    setNewCat('');
  };

  const remove = (catIndex) =>
    update((p) => {
      const groups = [...p[groupKey]];
      groups[groupIndex] = {
        ...groups[groupIndex],
        categories: groups[groupIndex].categories.filter((_, i) => i !== catIndex),
      };
      return { ...p, [groupKey]: groups };
    });

  const removeGroup = () =>
    update((p) => ({ ...p, [groupKey]: p[groupKey].filter((_, i) => i !== groupIndex) }));

  return (
    <div className="slide-in" style={{ marginBottom: 6 }}>
      <div className="group-header" onClick={() => setOpen((o) => !o)}>
        <span
          style={{
            color: accent,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(0)' : 'rotate(-90deg)',
            display: 'flex',
          }}
        >
          <IconChevron />
        </span>
        <span style={{ color: accent, display: 'flex' }}>
          <IconFolder />
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{group.name}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{group.categories.length}</span>
        <button
          className="btn ghost xs"
          onClick={(e) => {
            e.stopPropagation();
            removeGroup();
          }}
        >
          <IconTrash />
        </button>
      </div>
      <div className={`group-body ${open ? 'open' : 'closed'}`}>
        <div style={{ padding: '8px 0 0 18px' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
            <input
              className="input sm"
              placeholder="Add category…"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn primary sm" onClick={add}>
              <IconPlus />
            </button>
          </div>
          {group.categories.map((c, i) => (
            <div
              key={c}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '5px 10px',
                background: 'var(--surface)',
                borderRadius: 6,
                marginBottom: 3,
              }}
            >
              <span style={{ fontSize: 12 }}>{c}</span>
              <button className="btn ghost xs" onClick={() => remove(i)}>
                <IconTrash />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
