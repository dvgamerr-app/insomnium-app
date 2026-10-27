/** Inspect contributions without invoking exported callbacks.
 * @param {any} exports @param {ReturnType<import("./plugin-tag-metadata.js").createPluginTagMetadata>} tagMetadata */
export function inspectPluginMetadata(exports,tagMetadata){

      if (!exports || (typeof exports !== 'object' && typeof exports !== 'function')) throw Error('Plugin exports must be an object');
      const names = ['templateTags','requestHooks','responseHooks','themes','requestGroupActions','requestActions','workspaceActions','documentActions'];
      const contributions = [];
      for (const kind of names) {
        if (exports[kind] === undefined) continue;
        const values = exports[kind];
        if (!Array.isArray(values) || values.length > 64) throw Error('Invalid contribution array: ' + kind);
        const items = values.map((value, index) => {
          if (kind.endsWith('Hooks')) { if (typeof value !== 'function') throw Error('Hook must be a function: ' + kind); return { index }; }
          if (!value || typeof value !== 'object') throw Error('Invalid contribution: ' + kind);
          if (kind === 'templateTags') {
            const definition=tagMetadata.inspect(value);
            const name=definition.name,label=definition.displayName??definition.label??name;
            if(label.length>1024)throw Error('Contribution label exceeds its limit');
            return {index,name,label,definition};
          }
          if (kind.endsWith('Actions') && typeof value.action !== 'function') throw Error('Action requires an action function: ' + kind);
          const name = typeof value.name === 'string' ? value.name : '';
          const label = typeof value.displayName === 'string' ? value.displayName : typeof value.label === 'string' ? value.label : name;
          if (name.length > 256 || label.length > 1024) throw Error('Contribution label exceeds its limit');
          if (kind === 'themes') {
            if (!name || !value.theme || typeof value.theme !== 'object' || Array.isArray(value.theme)) throw Error('Theme requires a name and theme object');
            return { index, name, label, definition: { name, displayName: label, theme: value.theme } };
          }
          return { index, name, label, ...(kind==='documentActions'?{hideAfterClick:value.hideAfterClick===true}:{}) };
        });
        contributions.push({ kind, count: items.length, items });
      }
      return { contributions, unknownExports: Object.keys(exports).filter(name => !names.includes(name)).slice(0,64) };
}
